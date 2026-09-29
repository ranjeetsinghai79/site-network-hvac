const BASE = 'https://api.cloudflare.com/client/v4'

function headers() {
  return {
    Authorization: `Bearer ${process.env.CLOUDFLARE_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

// ─── Custom domain management ─────────────────────────────────────────────────

/**
 * Add a custom domain to an existing Cloudflare Pages project.
 * Called when a client pays and provides their domain.
 *
 * After calling this:
 * 1. CF returns DNS instructions (CNAME/A record)
 * 2. You relay those to the client (email/SMS)
 * 3. CF automatically provisions SSL once DNS propagates (~minutes if on CF, ~hours otherwise)
 *
 * @returns DNS instructions to send to client, or null on error
 */
export async function addCustomDomainToPages(params: {
  projectName:  string    // e.g. "site-jazz-heating-air-conditioning-and-plumbi"
  customDomain: string    // e.g. "jazzheating.com" or "www.jazzheating.com"
}): Promise<{
  domain:       string
  cname_target: string    // point CNAME here
  status:       string
} | null> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID not set')

  const { projectName, customDomain } = params

  const res = await fetch(
    `${BASE}/accounts/${accountId}/pages/projects/${projectName}/domains`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ name: customDomain }),
    }
  )

  const body = await res.json() as any

  if (!res.ok) {
    console.error('[Cloudflare] addCustomDomain failed:', body?.errors ?? body)
    return null
  }

  const result = body.result
  // CF Pages custom domains always use CNAME → projectName.pages.dev
  return {
    domain:       result.name ?? customDomain,
    cname_target: `${projectName}.pages.dev`,
    status:       result.status ?? 'pending_verification',
  }
}

/**
 * Remove a custom domain from a Pages project (e.g. client churned).
 */
export async function removeCustomDomainFromPages(params: {
  projectName:  string
  customDomain: string
}): Promise<boolean> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!accountId) return false

  const res = await fetch(
    `${BASE}/accounts/${accountId}/pages/projects/${params.projectName}/domains/${params.customDomain}`,
    { method: 'DELETE', headers: headers() }
  )
  return res.ok
}

/**
 * List all custom domains on a Pages project.
 */
export async function listCustomDomains(projectName: string): Promise<Array<{
  name: string; status: string
}>> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!accountId) return []

  const res = await fetch(
    `${BASE}/accounts/${accountId}/pages/projects/${projectName}/domains`,
    { headers: headers() }
  )
  if (!res.ok) return []
  const body = await res.json() as any
  return (body.result ?? []).map((d: any) => ({ name: d.name, status: d.status }))
}

/** Delete a temporary Cloudflare Pages project after its seven-day preview TTL. */
export async function deleteCloudflarePagesProject(projectName: string): Promise<boolean> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!accountId || !/^[a-z0-9-]{1,63}$/.test(projectName)) return false
  const res = await fetch(`${BASE}/accounts/${accountId}/pages/projects/${projectName}`, {
    method: 'DELETE', headers: headers(),
  })
  if (!res.ok) console.error('[Cloudflare] delete project failed:', await res.text())
  return res.ok
}

export async function deployToCloudflarePages(params: {
  repoOwner: string
  repoName: string
  projectName: string
  templateDir: string
  envVars?: Record<string, string>
}): Promise<{ url: string } | null> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID not set')

  const { projectName, envVars = {} } = params

  const cfEnvVars: Record<string, { value: string }> = {}
  for (const [k, v] of Object.entries(envVars)) {
    cfEnvVars[k] = { value: v }
  }

  // Create or verify project exists (no GitHub source — GH Actions deploys via Wrangler)
  const createRes = await fetch(`${BASE}/accounts/${accountId}/pages/projects`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      name: projectName,
      production_branch: 'main',
      deployment_configs: {
        production: {
          compatibility_date: '2024-09-23',
          compatibility_flags: ['nodejs_compat'],
          env_vars: Object.keys(cfEnvVars).length > 0 ? cfEnvVars : undefined,
        },
      },
    }),
  })

  if (!createRes.ok) {
    const err = await createRes.text()
    if (!err.includes('already exists') && !err.includes('taken')) {
      console.error('[Cloudflare] create project failed:', err)
      return null
    }
    console.log('[Cloudflare] project already exists, continuing')
  } else {
    console.log(`[Cloudflare] project "${projectName}" created ✓`)
  }

  // GH Actions triggered by the push in builder — wait up to 12 min for it to deploy
  // First delay: GH Actions cold start + build (~3-4 min)
  console.log('[Cloudflare] Waiting for GitHub Actions build (3 min)…')
  await new Promise(r => setTimeout(r, 3 * 60_000))

  // Poll until Pages shows a successful deployment (max 9 more min, 30s intervals)
  for (let i = 0; i < 18; i++) {
    const deploymentsRes = await fetch(
      `${BASE}/accounts/${accountId}/pages/projects/${projectName}/deployments`,
      { headers: headers() }
    )
    if (!deploymentsRes.ok) {
      console.warn('[Cloudflare] poll failed, retrying…')
      await new Promise(r => setTimeout(r, 30_000))
      continue
    }

    const deployments = (await deploymentsRes.json() as any).result as any[]
    const latest = deployments?.[0]
    const stage = latest?.latest_stage

    console.log(`  [Cloudflare] ${stage?.name ?? 'pending'} — ${stage?.status ?? 'waiting'}`)

    if (stage?.name === 'deploy' && stage?.status === 'success') {
      // Cloudflare may append a collision-safe suffix to the public subdomain
      // even though the project name itself remains unchanged. Never infer it.
      const projectRes = await fetch(`${BASE}/accounts/${accountId}/pages/projects/${projectName}`, { headers: headers() })
      if (projectRes.ok) {
        const project = (await projectRes.json() as any).result
        if (project?.subdomain) return { url: `https://${project.subdomain}` }
      }
      return { url: latest?.url ?? `https://${projectName}.pages.dev` }
    }
    if (stage?.status === 'failure') {
      console.error('[Cloudflare] deployment failed at stage:', stage?.name)
      return null
    }

    await new Promise(r => setTimeout(r, 30_000))
  }

  console.error('[Cloudflare] deployment timed out after 12 min')
  return null
}
