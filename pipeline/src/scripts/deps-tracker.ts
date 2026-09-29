/**
 * Open Source Dependency Tracker
 * Checks GitHub for latest releases across all tracked repos.
 * Run daily: tsx src/scripts/deps-tracker.ts
 */

import 'dotenv/config'

interface TrackedRepo {
  name: string
  owner: string
  repo: string
  usedIn: string
  purpose: string
  currentVersion?: string
}

const TRACKED_REPOS: TrackedRepo[] = [
  // Core pipeline tools
  { name: 'Firecrawl',         owner: 'mendableai',    repo: 'firecrawl',          usedIn: 'pipeline/brand-analyst',    purpose: 'Web scraping for brand analysis' },
  { name: 'Anthropic SDK',     owner: 'anthropics',    repo: 'anthropic-sdk-python',usedIn: 'pipeline (all agents)',     purpose: 'Claude API client' },
  { name: 'Supabase JS',       owner: 'supabase',      repo: 'supabase-js',         usedIn: 'pipeline/leads-agent',      purpose: 'Lead database' },

  // Template stack
  { name: 'Next.js',           owner: 'vercel',        repo: 'next.js',             usedIn: 'all templates',             purpose: 'App framework' },
  { name: 'Framer Motion',     owner: 'framer',        repo: 'motion',              usedIn: 'all templates',             purpose: 'Cinematic animations' },
  { name: 'Tailwind CSS',      owner: 'tailwindlabs',  repo: 'tailwindcss',         usedIn: 'all templates',             purpose: 'Utility CSS v4' },
  { name: 'Lucide React',      owner: 'lucide-icons',  repo: 'lucide',              usedIn: 'all templates',             purpose: 'SVG icon set' },

  // New additions
  { name: 'Remotion',          owner: 'remotion-dev',  repo: 'remotion',            usedIn: 'pipeline/video-agent',      purpose: 'Programmatic video for outreach' },
  { name: 'Impeccable',        owner: 'pbakaus',       repo: 'impeccable',          usedIn: 'pipeline/config-generator', purpose: 'AI design vocabulary + anti-patterns' },

  // Infra
  { name: 'PostHog',           owner: 'PostHog',       repo: 'posthog',             usedIn: 'client sites (analytics)',  purpose: 'Analytics on deployed sites' },
  { name: 'Resend SDK',        owner: 'resend',        repo: 'resend-node',         usedIn: 'pipeline/outreach',         purpose: 'Email delivery' },

  // DevX
  { name: 'tsx',               owner: 'privatenumber', repo: 'tsx',                 usedIn: 'pipeline dev runner',       purpose: 'TypeScript executor' },
]

interface ReleaseInfo {
  tag: string
  published: string
  url: string
  breaking: boolean
}

async function getLatestRelease(owner: string, repo: string): Promise<ReleaseInfo | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'websitedeveloper-deps-tracker',
  }
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `token ${process.env.GITHUB_TOKEN}`
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, { headers })
    if (!res.ok) {
      // fallback: try tags
      const tagRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/tags`, { headers })
      if (!tagRes.ok) return null
      const tags = await tagRes.json() as any[]
      if (!tags.length) return null
      return { tag: tags[0].name, published: 'unknown', url: `https://github.com/${owner}/${repo}/releases`, breaking: false }
    }
    const data = await res.json() as any
    const tag = data.tag_name as string
    const prev = (data.body || '').toLowerCase()
    const breaking = prev.includes('breaking') || prev.includes('migration') || /v?\d+\.0\.0/.test(tag)
    return {
      tag,
      published: data.published_at?.split('T')[0] ?? 'unknown',
      url: data.html_url,
      breaking,
    }
  } catch {
    return null
  }
}

async function getCommitActivity(owner: string, repo: string): Promise<string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'websitedeveloper-deps-tracker',
  }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `token ${process.env.GITHUB_TOKEN}`

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers })
    if (!res.ok) return 'unknown'
    const data = await res.json() as any
    const pushed = data.pushed_at?.split('T')[0] ?? 'unknown'
    const stars = data.stargazers_count?.toLocaleString() ?? '?'
    return `${pushed} (${stars}★)`
  } catch {
    return 'unknown'
  }
}

function colorize(text: string, code: number) {
  return `\x1b[${code}m${text}\x1b[0m`
}

async function main() {
  console.log('\n' + colorize('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 36))
  console.log(colorize(' WebsiteDeveloper — Open Source Deps Status', 1))
  console.log(colorize(` Checked: ${new Date().toISOString().split('T')[0]}`, 2))
  console.log(colorize('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 36) + '\n')

  const results: Array<{ dep: TrackedRepo; release: ReleaseInfo | null; activity: string }> = []

  // Parallel fetch all repos
  await Promise.all(
    TRACKED_REPOS.map(async (dep) => {
      const [release, activity] = await Promise.all([
        getLatestRelease(dep.owner, dep.repo),
        getCommitActivity(dep.owner, dep.repo),
      ])
      results.push({ dep, release, activity })
    })
  )

  // Sort: breaking first, then alphabetical
  results.sort((a, b) => {
    if (a.release?.breaking && !b.release?.breaking) return -1
    if (!a.release?.breaking && b.release?.breaking) return 1
    return a.dep.name.localeCompare(b.dep.name)
  })

  const breaking: typeof results = []

  for (const { dep, release, activity } of results) {
    const version = release ? colorize(release.tag, release.breaking ? 31 : 32) : colorize('no releases', 33)
    const flag = release?.breaking ? colorize(' ⚠ BREAKING', 31) : ''
    const date = release?.published !== 'unknown' ? colorize(` (${release?.published})`, 2) : ''

    console.log(`${colorize(dep.name.padEnd(18), 1)} ${version}${date}${flag}`)
    console.log(`  ${colorize('Used in:', 2)} ${dep.usedIn}`)
    console.log(`  ${colorize('Purpose:', 2)} ${dep.purpose}`)
    console.log(`  ${colorize('Activity:', 2)} ${activity}`)
    if (release?.url) console.log(`  ${colorize('Release:', 2)} ${release.url}`)
    console.log()

    if (release?.breaking) breaking.push({ dep, release, activity })
  }

  if (breaking.length) {
    console.log(colorize('⚠  BREAKING CHANGES DETECTED:', 31))
    breaking.forEach(({ dep, release }) => {
      console.log(colorize(`  • ${dep.name} ${release!.tag} — ${release!.url}`, 31))
    })
    console.log()
  }

  console.log(colorize(`Tracked ${TRACKED_REPOS.length} repos. Add more in pipeline/src/scripts/deps-tracker.ts`, 2))
  console.log(colorize('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 36))
}

main().catch(console.error)
