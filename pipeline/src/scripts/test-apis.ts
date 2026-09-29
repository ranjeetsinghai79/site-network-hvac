import { scrapeFoursquare } from '../sources/foursquare.js'
import { enrichByCompanyName } from '../sources/apollo.js'

async function main() {
  console.log('Testing Foursquare...')
  try {
    const leads = await scrapeFoursquare({ term:'hvac', city:'Austin', state:'TX', niche:'hvac', maxPages:1 })
    console.log(`✓ Foursquare: ${leads.length} leads`)
    if (leads[0]) console.log(`  First: ${leads[0].name} | ${leads[0].phone ?? '—'} | ${leads[0].website ?? '—'}`)
  } catch(e: any) { console.log(`✗ Foursquare: ${e.message}`) }

  console.log('\nTesting Apollo...')
  try {
    const r = await enrichByCompanyName('Stallion Air Conditioning', 'Austin', 'TX')
    console.log(`✓ Apollo: ${JSON.stringify(r)}`)
  } catch(e: any) { console.log(`✗ Apollo: ${e.message}`) }
}

main().catch(e => console.error(e))
