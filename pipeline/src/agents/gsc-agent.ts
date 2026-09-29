// Fully automatic Google Search Console onboarding for a deployed client
// site — zero client action, no OAuth handshake, no manual "add user in
// GSC" step. Runs after deployer confirms the site is live.
//
// How: WebCrew's own service account self-verifies ownership via the Site
// Verification API's FILE method (place a token file at the site root,
// Google fetches it, verification completes) — this only needs write
// access to the site's own deployed content, which the pipeline already
// has via github.ts, so it works for ANY domain (pages.dev subdomain today,
// a client's custom domain later) with no DNS access required. Once
// verified, the same service account is automatically a Search Console
// owner too (Site Verification and Search Console share verified-owner
// state), so google-search-console.ts's calls work immediately after.
//
// This is what makes analytics-agent.ts's weekly GSC report actually have
// real data going forward, instead of relying on someone manually adding
// the service account as an Owner per client (the gap that existed before
// this agent — see project_webcrew_seo_audit_fixes_2026_09_03.md).

import { getFileVerificationToken, completeFileVerification, isVerified } from '../tools/gsc-site-verification.js'
import { submitSitemap } from '../tools/google-search-console.js'
import { updateFile } from '../tools/github.js'
import type { Lead, AgentResult } from '../types.js'

const POLL_INTERVAL_MS = 5000
const POLL_TIMEOUT_MS = 3 * 60 * 1000 // CF Pages redeploy on a one-file push is usually <1min

async function waitUntilLive(url: string): Promise<boolean> {
  const deadline = Date.now() + POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok) return true
    } catch { /* transient DNS/connection errors while the deploy propagates — keep polling */ }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
  }
  return false
}

export async function runGscAgent(lead: Lead): Promise<AgentResult<{ siteUrl: string }>> {
  const host = lead.cloudflare_url ?? lead.vercel_url
  if (!host) return { success: false, error: 'No deployed site URL on lead' }
  if (!lead.github_repo) return { success: false, error: 'No GitHub repo on lead' }

  // host is already a full URL (deployer.ts sets cloudflare_url to result.url,
  // scheme included) — verified via a real run where this double-prefixed to
  // "https://https://..." and GSC verification silently failed every time.
  const normalizedHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const siteUrl = `https://${normalizedHost}/`
  console.log(`[GSC] Verifying ${siteUrl} for ${lead.name}`)

  try {
    // Idempotent — skip the whole flow if this exact property is already verified
    // (re-runs from the admin "Run GSC Check" button shouldn't redo the file push).
    if (lead.gsc_verified && lead.gsc_site_url === siteUrl) {
      return { success: true, data: { siteUrl } }
    }

    const match = lead.github_repo.match(/github\.com\/([^/]+)\/([^/]+)/)
    if (!match) return { success: false, error: 'Cannot parse GitHub repo URL' }
    const [, repoOwner, repoName] = match

    const token = await getFileVerificationToken(siteUrl)
    if (!token) return { success: false, error: 'Could not get verification token from Google' }

    const fileName = `google${token}.html`
    const pushed = await updateFile({
      owner: repoOwner,
      repo: repoName,
      path: `public/${fileName}`,
      content: token,
      message: 'chore: add Search Console verification file',
    })
    if (!pushed) return { success: false, error: 'Failed to push verification file to repo' }

    const live = await waitUntilLive(`${siteUrl}${fileName}`)
    if (!live) return { success: false, error: 'Verification file never went live (deploy timeout)' }

    const verified = await completeFileVerification(siteUrl)
    if (!verified) {
      // A false here can also mean "already verified from a prior partial run" —
      // isVerified() disambiguates before treating it as a real failure.
      if (!(await isVerified(siteUrl))) return { success: false, error: 'Google verification call failed' }
    }

    await submitSitemap(siteUrl, `${siteUrl}sitemap.xml`)

    console.log(`[GSC] Verified and sitemap submitted: ${siteUrl}`)
    return { success: true, data: { siteUrl } }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
