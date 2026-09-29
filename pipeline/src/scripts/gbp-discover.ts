// One-off: discover GBP account + location IDs via the service account.
// Run: cd pipeline && node --env-file=.env --import=tsx/esm src/scripts/gbp-discover.ts
import { listAccounts, listLocations } from '../tools/google-my-business.js'

async function main() {
  const accounts = await listAccounts()
  if (accounts.length === 0) {
    console.log('No accounts visible. Likely cause: service account not added as Manager on the Business Profile,')
    console.log('or Business Profile / My Business Account Management API not enabled/approved for this GCP project.')
    return
  }

  for (const acc of accounts) {
    console.log(`\nAccount: ${acc.accountName}  id=${acc.name}`)
    const locations = await listLocations(acc.name.replace('accounts/', ''))
    for (const loc of locations) {
      console.log(`  Location: ${loc.title}  id=${loc.name}`)
    }
  }
}

main()
