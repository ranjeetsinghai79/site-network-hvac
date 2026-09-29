/**
 * Patches next.config.ts in failing site repos to add output: 'export'
 * Run: npx tsx pipeline/src/scripts/patch-nextconfig.ts
 */
import { config } from 'dotenv'
config({ path: 'pipeline/.env' })

const OWNER = 'ranjeetsinghai79'
const GH_TOKEN = process.env.GITHUB_TOKEN!

// repo → templateDir mapping
const REPOS: Record<string, string> = {
  'site-clearwater-dentistry': 'templates/dentist',
  'site-happy-junk-removal': 'templates/junk-removal',
  'site-luxury-homes-in-riverside': 'templates/luxury-realestate',
  'site-san-jose-daycare': 'templates/daycare',
  'site-ocd-cleaners-house-cleaning-service-san-': 'templates/cleaning',
}

const FIXED_CONFIG = `import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ["@core/web"],
  turbopack: {
    root: path.resolve(__dirname, "../../"),
  },
};

export default nextConfig;
`

async function getFileSha(repo: string, filePath: string): Promise<string | null> {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${repo}/contents/${filePath}`, {
    headers: { Authorization: `token ${GH_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28' },
  })
  if (!res.ok) return null
  const data = await res.json() as any
  return data.sha
}

async function updateFile(repo: string, filePath: string, content: string, sha: string): Promise<boolean> {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${repo}/contents/${filePath}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      message: 'fix: add output export config for CF Pages deployment',
      content: Buffer.from(content).toString('base64'),
      sha,
    }),
  })
  return res.ok
}

async function main() {
  console.log('Patching next.config.ts in failing repos...\n')

  for (const [repo, templateDir] of Object.entries(REPOS)) {
    const configPath = `${templateDir}/next.config.ts`
    console.log(`── ${repo} (${configPath})`)
    
    const sha = await getFileSha(repo, configPath)
    if (!sha) { console.log(`   ✗ file not found`); continue }
    
    const ok = await updateFile(repo, configPath, FIXED_CONFIG, sha)
    console.log(`   ${ok ? '✓ patched (build re-triggered)' : '✗ failed'}`)
  }

  console.log('\nDone. Builds re-triggered via push event.')
}

main().catch(e => { console.error(e); process.exit(1) })
