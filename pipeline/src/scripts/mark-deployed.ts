/**
 * Checks GH Actions run status for all 'built' leads,
 * marks successful ones as 'deployed' in the DB.
 */
import { config } from 'dotenv'
config()
import pg from 'pg'

const GH_TOKEN = process.env.GITHUB_TOKEN!

async function getLatestRunStatus(owner: string, repo: string): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=1`,
    { headers: { Authorization: `token ${GH_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
  )
  const d = await res.json() as any
  const run = d.workflow_runs?.[0]
  if (!run) return null
  return `${run.status}/${run.conclusion}`
}

async function main() {
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const { rows } = await db.query(
    "SELECT id, name, github_repo, brand_data FROM leads WHERE status = 'built'"
  )

  for (const lead of rows) {
    const match = lead.github_repo?.match(/github\.com\/([^/]+)\/([^/]+)/)
    if (!match) continue
    const [, owner, repo] = match
    const projectName = repo.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 63)
    const status = await getLatestRunStatus(owner, repo)
    console.log(`${lead.name}: ${status}`)

    if (status === 'completed/success') {
      const url = `https://${projectName}.pages.dev`
      await db.query(
        "UPDATE leads SET status = 'deployed', vercel_url = $1 WHERE id = $2",
        [url, lead.id]
      )
      console.log(`  ✓ marked deployed → ${url}`)
    }
  }

  await db.end()
}
main()
