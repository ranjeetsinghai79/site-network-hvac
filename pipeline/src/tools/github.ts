import { seal } from 'tweetsodium'

const BASE = 'https://api.github.com'

// ── Token pool: rotate on rate limit ──────────────────────────────────────────

function getTokenPool(): string[] {
  const pool: string[] = []
  for (let i = 1; i <= 10; i++) {
    const key = i === 1 ? 'GITHUB_TOKEN' : `GITHUB_TOKEN${i}`
    const val = process.env[key]
    if (val?.trim()) pool.push(val.trim())
  }
  return pool
}

let _tokenIdx = 0

function headers(token?: string): Record<string, string> {
  const pool = getTokenPool()
  const t = token ?? pool[_tokenIdx % pool.length] ?? ''
  return {
    Authorization: `token ${t}`,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github.v3+json',
  }
}

// Fetch with automatic token rotation on 403 rate limit
async function ghFetch(url: string, init?: RequestInit): Promise<Response> {
  const pool = getTokenPool()
  let attempts = 0

  while (attempts < pool.length) {
    const token = pool[_tokenIdx % pool.length]
    const hdrs = {
      ...headers(token),
      ...(init?.headers as Record<string, string> ?? {}),
    }
    const res = await fetch(url, { ...init, headers: hdrs })

    if (res.status === 401) {
      console.log(`[GitHub] Token ${_tokenIdx % pool.length + 1} bad credentials — rotating`)
      _tokenIdx++
      attempts++
      continue
    }

    if (res.status === 403 || res.status === 429) {
      const body = await res.text()
      if (body.includes('rate limit')) {
        console.log(`[GitHub] Token ${_tokenIdx % pool.length + 1} rate limited — rotating`)
        _tokenIdx++
        attempts++
        continue
      }
      // Non-rate-limit 403 — return as-is with a synthetic response
      return new Response(body, { status: res.status, headers: res.headers })
    }

    return res
  }

  throw new Error(`GitHub rate limit exceeded on all ${pool.length} token(s)`)
}

// ── GitHub Actions secret helpers ──────────────────────────────────────────

async function getRepoPublicKey(owner: string, repo: string): Promise<{ key_id: string; key: string } | null> {
  const res = await ghFetch(`${BASE}/repos/${owner}/${repo}/actions/secrets/public-key`)
  if (!res.ok) {
    console.error('[GitHub] get public key failed:', await res.text())
    return null
  }
  return res.json() as any
}

export async function setRepoSecret(params: {
  owner: string
  repo: string
  secretName: string
  secretValue: string
}): Promise<boolean> {
  const pk = await getRepoPublicKey(params.owner, params.repo)
  if (!pk) return false

  const keyBytes = Buffer.from(pk.key, 'base64')
  const msgBytes = Buffer.from(params.secretValue, 'utf8')
  const encrypted = Buffer.from(seal(msgBytes, keyBytes)).toString('base64')

  const res = await ghFetch(
    `${BASE}/repos/${params.owner}/${params.repo}/actions/secrets/${params.secretName}`,
    {
      method: 'PUT',
      body: JSON.stringify({ encrypted_value: encrypted, key_id: pk.key_id }),
    }
  )
  if (!res.ok && res.status !== 204) {
    console.error('[GitHub] set secret failed:', await res.text())
    return false
  }
  return true
}

export async function createRepoFromTemplate(params: {
  templateOwner: string
  templateRepo: string
  newOwner: string
  newRepoName: string
}): Promise<{ html_url: string } | null> {
  // Check if repo already exists — reuse it
  const existsRes = await ghFetch(`${BASE}/repos/${params.newOwner}/${params.newRepoName}`)
  if (existsRes.ok) {
    const existing = await existsRes.json() as any
    console.log(`[GitHub] reusing existing repo: ${existing.html_url}`)
    return { html_url: existing.html_url }
  }

  const pool = getTokenPool()
  console.log(`[GitHub] Using token pool: ${pool.length} token(s)`)

  const res = await ghFetch(
    `${BASE}/repos/${params.templateOwner}/${params.templateRepo}/generate`,
    {
      method: 'POST',
      body: JSON.stringify({
        owner: params.newOwner,
        name: params.newRepoName,
        description: `Website for ${params.newRepoName}`,
        private: false,
        include_all_branches: false,
      }),
    }
  )

  if (!res.ok) {
    console.error('[GitHub] create repo failed:', await res.text())
    return null
  }

  const data = await res.json() as any
  await new Promise(r => setTimeout(r, 4000))
  return { html_url: data.html_url }
}

export async function uploadBinaryFile(params: {
  owner: string
  repo: string
  path: string
  buffer: Buffer
  message: string
}): Promise<boolean> {
  const getRes = await ghFetch(
    `${BASE}/repos/${params.owner}/${params.repo}/contents/${params.path}`
  )
  const sha = getRes.ok ? (await getRes.json() as any).sha : undefined

  const putRes = await ghFetch(
    `${BASE}/repos/${params.owner}/${params.repo}/contents/${params.path}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        message: params.message,
        content: params.buffer.toString('base64'),
        ...(sha ? { sha } : {}),
      }),
    }
  )
  if (!putRes.ok) {
    console.error('[GitHub] upload binary failed:', await putRes.text())
    return false
  }
  return true
}

/**
 * Batch-upload many small binary files (e.g. a frame sequence) in one commit
 * via the Git Data API instead of one GET+PUT per file. Cuts a ~150-file
 * upload from ~300 Contents-API calls down to ~150 blob POSTs + 3 calls.
 */
export async function uploadBinaryFilesBatch(params: {
  owner: string
  repo: string
  files: { path: string; buffer: Buffer }[]
  message: string
}): Promise<boolean> {
  if (params.files.length === 0) return true

  const repoRes = await ghFetch(`${BASE}/repos/${params.owner}/${params.repo}`)
  if (!repoRes.ok) {
    console.error('[GitHub] batch upload: get repo failed:', await repoRes.text())
    return false
  }
  const { default_branch: branch } = await repoRes.json() as any

  const refRes = await ghFetch(`${BASE}/repos/${params.owner}/${params.repo}/git/ref/heads/${branch}`)
  if (!refRes.ok) {
    console.error('[GitHub] batch upload: get ref failed:', await refRes.text())
    return false
  }
  const baseCommitSha = (await refRes.json() as any).object.sha

  const commitRes = await ghFetch(`${BASE}/repos/${params.owner}/${params.repo}/git/commits/${baseCommitSha}`)
  if (!commitRes.ok) {
    console.error('[GitHub] batch upload: get base commit failed:', await commitRes.text())
    return false
  }
  const baseTreeSha = (await commitRes.json() as any).tree.sha

  const treeEntries: { path: string; mode: string; type: string; sha: string }[] = []
  for (const file of params.files) {
    const blobRes = await ghFetch(`${BASE}/repos/${params.owner}/${params.repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: file.buffer.toString('base64'), encoding: 'base64' }),
    })
    if (!blobRes.ok) {
      console.error(`[GitHub] batch upload: blob create failed for ${file.path}:`, await blobRes.text())
      return false
    }
    const { sha } = await blobRes.json() as any
    treeEntries.push({ path: file.path, mode: '100644', type: 'blob', sha })
  }

  const treeRes = await ghFetch(`${BASE}/repos/${params.owner}/${params.repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
  })
  if (!treeRes.ok) {
    console.error('[GitHub] batch upload: tree create failed:', await treeRes.text())
    return false
  }
  const newTreeSha = (await treeRes.json() as any).sha

  const newCommitRes = await ghFetch(`${BASE}/repos/${params.owner}/${params.repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message: params.message, tree: newTreeSha, parents: [baseCommitSha] }),
  })
  if (!newCommitRes.ok) {
    console.error('[GitHub] batch upload: commit create failed:', await newCommitRes.text())
    return false
  }
  const newCommitSha = (await newCommitRes.json() as any).sha

  const updateRefRes = await ghFetch(`${BASE}/repos/${params.owner}/${params.repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: newCommitSha }),
  })
  if (!updateRefRes.ok) {
    console.error('[GitHub] batch upload: ref update failed:', await updateRefRes.text())
    return false
  }

  return true
}

export async function fetchFileContent(params: {
  owner: string
  repo: string
  path: string
}): Promise<string | null> {
  const res = await ghFetch(
    `${BASE}/repos/${params.owner}/${params.repo}/contents/${params.path}`
  )
  if (!res.ok) return null
  const data = await res.json() as any
  return Buffer.from(data.content, 'base64').toString('utf8')
}

export async function updateFile(params: {
  owner: string
  repo: string
  path: string
  content: string
  message: string
}): Promise<boolean> {
  // Right after createRepoFromTemplate(), the new repo's file tree is still
  // replicating — GET can return 404 (stale) for a file that the template
  // already includes (e.g. templates/medspa/src/lib/config.ts ships with the
  // template repo itself). A sha-less PUT then races the real content and
  // GitHub returns 409 ("path already exists") once replication catches up.
  // Retry with a fresh GET+sha a couple times before giving up.
  const contentsUrl = `${BASE}/repos/${params.owner}/${params.repo}/contents/${params.path}`

  for (let attempt = 0; attempt < 3; attempt++) {
    const getRes = await ghFetch(contentsUrl)
    const sha = getRes.ok ? (await getRes.json() as any).sha : undefined

    const putRes = await ghFetch(contentsUrl, {
      method: 'PUT',
      body: JSON.stringify({
        message: params.message,
        content: Buffer.from(params.content).toString('base64'),
        ...(sha ? { sha } : {}),
      }),
    })

    if (putRes.ok) return true

    const errText = await putRes.text()
    const isConflict = putRes.status === 409
    if (!isConflict || attempt === 2) {
      console.error('[GitHub] upsert file failed:', errText)
      return false
    }
    console.warn(`[GitHub] upsert file conflict (attempt ${attempt + 1}/3), retrying: ${params.path}`)
    await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
  }

  return false
}
