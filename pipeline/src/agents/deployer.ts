import { deployToCloudflarePages } from '../tools/cloudflare.js'
import type { Lead, AgentResult } from '../types.js'

export async function runDeployerAgent(lead: Lead): Promise<AgentResult<Lead>> {
  if (!lead.github_repo) return { success: false, error: 'No GitHub repo' }

  console.log(`[Deployer] Deploying ${lead.name} to Cloudflare Pages`)

  const match = lead.github_repo.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!match) return { success: false, error: 'Cannot parse GitHub repo URL' }

  const [, repoOwner, repoName] = match
  // Cloudflare project names: lowercase, alphanumeric + hyphens, max 63 chars
  const projectName = repoName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63)

  const templateDir = (lead.brand_data as any)?._templateDir as string | undefined
  if (!templateDir) return { success: false, error: 'No templateDir in brand_data' }

  try {
    const envVars: Record<string, string> = {
      BUSINESS_NAME:  lead.name,
      BUSINESS_NICHE: lead.niche,
      // Injected so contact form API can SMS/email the owner on every inquiry
      // This is the killer demo hook: owner gets "you got a lead!" before paying
      BUSINESS_OWNER_PHONE: lead.phone  || '',
      BUSINESS_OWNER_EMAIL: lead.email  || '',
      PIPELINE_API_URL: process.env.PIPELINE_API_URL || 'https://api.webcrew.app',
    }

    const result = await deployToCloudflarePages({
      repoOwner,
      repoName,
      projectName,
      templateDir,
      envVars,
    })

    if (!result) return { success: false, error: 'Cloudflare Pages deployment failed' }

    return {
      success: true,
      data: { ...lead, cloudflare_url: result.url, status: 'deployed' },
    }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
