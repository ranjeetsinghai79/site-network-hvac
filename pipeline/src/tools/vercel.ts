const BASE = 'https://api.vercel.com'

function headers() {
  return {
    Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

export async function deployRepo(params: {
  repoOwner: string
  repoName: string
  projectName: string
  rootDirectory?: string
}): Promise<{ url: string } | null> {
  // Create project linked to GitHub repo
  const projectRes = await fetch(`${BASE}/v10/projects`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      name: params.projectName,
      framework: 'nextjs',
      rootDirectory: params.rootDirectory,
      gitRepository: {
        type: 'github',
        repo: `${params.repoOwner}/${params.repoName}`,
      },
    }),
  })

  if (!projectRes.ok) {
    const err = await projectRes.text()
    // Project may already exist — continue
    if (!err.includes('already exists')) {
      console.error('[Vercel] create project failed:', err)
      return null
    }
  }

  // Trigger deployment
  const deployRes = await fetch(`${BASE}/v13/deployments`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      name: params.projectName,
      gitSource: {
        type: 'github',
        repo: `${params.repoOwner}/${params.repoName}`,
        ref: 'main',
      },
    }),
  })

  if (!deployRes.ok) {
    console.error('[Vercel] deploy failed:', await deployRes.text())
    return null
  }

  const deployment = await deployRes.json() as any

  // Poll until ready (max 5 min)
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 10000))

    const statusRes = await fetch(`${BASE}/v13/deployments/${deployment.id}`, {
      headers: headers(),
    })
    const status = await statusRes.json() as any

    if (status.readyState === 'READY') {
      return { url: `https://${status.url}` }
    }
    if (status.readyState === 'ERROR') {
      console.error('[Vercel] deployment errored')
      return null
    }

    console.log(`  [Vercel] status: ${status.readyState}...`)
  }

  console.error('[Vercel] deployment timed out')
  return null
}
