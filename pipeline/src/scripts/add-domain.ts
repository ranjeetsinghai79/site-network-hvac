/**
 * add-domain.ts — attach a custom domain to a deployed lead's CF Pages project
 *
 * Usage:
 *   npx tsx src/scripts/add-domain.ts <lead-name-fragment> <domain>
 *
 * Example:
 *   npx tsx src/scripts/add-domain.ts "jazz heating" jazzheating.com
 *
 * What happens:
 *   1. Looks up lead by name fragment in DB
 *   2. Extracts CF Pages project name from cloudflare_url
 *   3. Calls CF API to add the domain
 *   4. Prints DNS instructions to give the client
 *   5. Updates DB with custom_domain
 */
import 'dotenv/config'
import pg from 'pg'
import { addCustomDomainToPages } from '../tools/cloudflare.js'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const [,, nameFragment, domain] = process.argv

if (!nameFragment || !domain) {
  console.error('Usage: npx tsx src/scripts/add-domain.ts <name-fragment> <domain>')
  console.error('  e.g. npx tsx src/scripts/add-domain.ts "jazz heating" jazzheating.com')
  process.exit(1)
}

void (async () => {
  const { rows } = await pool.query(
    `SELECT id, name, cloudflare_url FROM leads WHERE name ILIKE $1 LIMIT 1`,
    [`%${nameFragment}%`]
  )

  if (!rows[0]) {
    console.error(`No lead found matching "${nameFragment}"`)
    await pool.end()
    process.exit(1)
  }

  const lead = rows[0]
  console.log(`\n✅ Found: ${lead.name}`)
  console.log(`   Live URL: ${lead.cloudflare_url}`)

  if (!lead.cloudflare_url) {
    console.error('❌ No cloudflare_url — site not deployed yet')
    await pool.end()
    process.exit(1)
  }

  // Extract project name from URL  e.g. https://site-xxx.pages.dev → site-xxx
  const projectName = lead.cloudflare_url.replace('https://', '').replace('.pages.dev', '').replace(/\/$/, '')
  console.log(`   CF Project: ${projectName}`)
  console.log(`   Domain to add: ${domain}\n`)

  const result = await addCustomDomainToPages({ projectName, customDomain: domain })

  if (!result) {
    console.error('❌ Failed to add domain — check CLOUDFLARE_TOKEN has Pages:Edit permission')
    await pool.end()
    process.exit(1)
  }

  // Save to DB
  await pool.query(
    `UPDATE leads SET custom_domain = $1 WHERE id = $2`,
    [domain, lead.id]
  )

  console.log(`✅ Domain added: ${result.domain}  (status: ${result.status})\n`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋  DNS INSTRUCTIONS TO SEND CLIENT')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log(`At your domain registrar (GoDaddy / Namecheap / Google Domains etc):`)
  console.log('')
  console.log(`  Type:  CNAME`)
  console.log(`  Name:  ${domain.startsWith('www.') ? 'www' : '@'}`)
  console.log(`  Value: ${result.cname_target}`)
  console.log(`  TTL:   Auto (or 1 hour)`)
  console.log('')
  console.log(`  For bare domain (${domain.replace(/^www\./,'')}), add:`)
  console.log(`  Type:  CNAME  Name: @  Value: ${result.cname_target}`)
  console.log(`  (some registrars use A record instead — contact us if needed)`)
  console.log('')
  console.log(`  SSL is automatic — site will be live at https://${domain}`)
  console.log(`  within 15 minutes once DNS propagates.`)
  console.log('')
  console.log(`  Your demo site remains at: ${lead.cloudflare_url}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  await pool.end()
})()
