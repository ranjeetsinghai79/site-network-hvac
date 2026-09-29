import { config } from 'dotenv'
config()
import { setRepoSecret } from '../tools/github.js'

async function main() {
  const owner = 'ranjeetsinghai79'
  const repo = 'webcrew'
  const cfToken = process.env.CLOUDFLARE_TOKEN
  const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID

  if (!cfToken || !cfAccountId) {
    console.error('Missing CLOUDFLARE_TOKEN or CLOUDFLARE_ACCOUNT_ID in .env')
    process.exit(1)
  }

  const [r1, r2] = await Promise.all([
    setRepoSecret({ owner, repo, secretName: 'CLOUDFLARE_API_TOKEN', secretValue: cfToken }),
    setRepoSecret({ owner, repo, secretName: 'CLOUDFLARE_ACCOUNT_ID', secretValue: cfAccountId }),
  ])
  console.log('CLOUDFLARE_API_TOKEN:', r1 ? 'ok' : 'fail')
  console.log('CLOUDFLARE_ACCOUNT_ID:', r2 ? 'ok' : 'fail')
}
main()
