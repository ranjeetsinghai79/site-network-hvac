/**
 * domain.ts — domain workflow CLI
 *
 * Commands:
 *   npx tsx src/scripts/domain.ts check  jazzheating.com
 *   npx tsx src/scripts/domain.ts suggest "Jazz Heating & Air" "Tracy"
 *   npx tsx src/scripts/domain.ts connect "jazz heating" jazzheating.com
 *   npx tsx src/scripts/domain.ts list
 */
import 'dotenv/config'
import { checkDomainAvailability, suggestDomains, listRegistrarDomains } from '../tools/domain-registrar.js'
import { addCustomDomainToPages } from '../tools/cloudflare.js'
import pg from 'pg'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const [,, command, arg1, arg2] = process.argv

function bold(s: string)  { return `\x1b[1m${s}\x1b[0m` }
function green(s: string) { return `\x1b[32m${s}\x1b[0m` }
function red(s: string)   { return `\x1b[31m${s}\x1b[0m` }
function cyan(s: string)  { return `\x1b[36m${s}\x1b[0m` }
function dim(s: string)   { return `\x1b[2m${s}\x1b[0m` }

async function cmdCheck(domain: string) {
  if (!domain) { console.error('Usage: domain.ts check <domain>'); process.exit(1) }
  console.log(`\nChecking ${bold(domain)}…\n`)

  const result = await checkDomainAvailability(domain)

  if (result.available === true) {
    console.log(green(`✅ AVAILABLE — ${result.domain}`))
    console.log(`   Estimated price: $${result.estimatedPriceUsd}/yr (at cost via Cloudflare)`)
    console.log(`   Buy at CF:       ${cyan(result.purchaseUrl)}`)
    console.log(`\n   After purchase, connect with:`)
    console.log(`   ${dim(`npm run add-domain -- "<business name>" ${domain}`)}`)
  } else if (result.available === false) {
    console.log(red(`❌ TAKEN — ${result.domain}`))
    if (result.registrar)  console.log(`   Registrar: ${result.registrar}`)
    if (result.expiresAt)  console.log(`   Expires:   ${result.expiresAt}`)
    console.log(`\n   Try variations: ${dim(`npm run domain -- suggest "<name>"`)}`)
  } else {
    console.log(`⚠️  Could not determine: ${result.error}`)
  }
  console.log('')
}

async function cmdSuggest(businessName: string, city?: string) {
  if (!businessName) { console.error('Usage: domain.ts suggest "<business name>" [city]'); process.exit(1) }
  console.log(`\nDomain suggestions for ${bold(businessName)}${city ? ` in ${city}` : ''}:\n`)

  const candidates = suggestDomains(businessName, city)
  console.log(`Checking ${candidates.length} candidates…\n`)

  for (const domain of candidates) {
    const result = await checkDomainAvailability(domain)
    if (result.available === true) {
      console.log(`  ${green('✅')} ${bold(domain).padEnd(40)} $${result.estimatedPriceUsd}/yr`)
    } else if (result.available === false) {
      console.log(`  ${red('❌')} ${dim(domain)}`)
    } else {
      console.log(`  ${dim('?')}  ${dim(domain)}  (check failed)`)
    }
    // Small delay to avoid rate-limiting RDAP
    await new Promise(r => setTimeout(r, 300))
  }
  console.log('')
}

async function cmdConnect(leadFragment: string, domain: string) {
  if (!leadFragment || !domain) {
    console.error('Usage: domain.ts connect "<lead name fragment>" <domain>')
    process.exit(1)
  }

  const { rows } = await pool.query(
    `SELECT id, name, cloudflare_url FROM leads WHERE name ILIKE $1 LIMIT 1`,
    [`%${leadFragment}%`]
  )

  if (!rows[0]) { console.error(`No lead matching "${leadFragment}"`); process.exit(1) }
  const lead = rows[0]

  if (!lead.cloudflare_url) {
    console.error(`${lead.name} — no cloudflare_url. Deploy first.`)
    process.exit(1)
  }

  const projectName = lead.cloudflare_url
    .replace('https://', '').replace('.pages.dev', '').replace(/\/$/, '')

  console.log(`\n🌐 Connecting ${bold(domain)} → ${bold(lead.name)}\n`)

  // First check domain resolves / is registered
  const check = await checkDomainAvailability(domain)
  if (check.available === true) {
    console.error(`❌ ${domain} is NOT registered yet — buy it first.`)
    console.error(`   ${check.purchaseUrl}`)
    process.exit(1)
  }

  const result = await addCustomDomainToPages({ projectName, customDomain: domain })
  if (!result) {
    console.error('❌ CF API failed — check CLOUDFLARE_TOKEN has Pages:Edit permission')
    process.exit(1)
  }

  await pool.query(`UPDATE leads SET custom_domain = $1 WHERE id = $2`, [domain, lead.id])

  console.log(green(`✅ Domain added: ${result.domain}  (${result.status})\n`))
  console.log(bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log(bold('  DNS INSTRUCTIONS — send to client'))
  console.log(bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log('')
  console.log(`  At your domain registrar (Cloudflare / GoDaddy / Namecheap):`)
  console.log('')
  console.log(`  ${bold('For www:')}`)
  console.log(`    Type:  CNAME`)
  console.log(`    Name:  www`)
  console.log(`    Value: ${cyan(result.cname_target)}`)
  console.log(`    TTL:   Auto`)
  console.log('')
  console.log(`  ${bold('For bare domain (apex):')}`)
  console.log(`    Type:  CNAME  (or A record if your registrar doesn't support CNAME at @)`)
  console.log(`    Name:  @`)
  console.log(`    Value: ${cyan(result.cname_target)}`)
  console.log('')
  console.log(`  SSL auto-provisions. Site live at ${cyan(`https://${domain}`)}`)
  console.log(`  within 15 minutes once DNS propagates.`)
  console.log('')
  console.log(`  ${dim(`Demo site still works: ${lead.cloudflare_url}`)}`)
  console.log(bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'))
}

async function cmdList() {
  console.log('\nDomains in Cloudflare Registrar account:\n')
  const domains = await listRegistrarDomains()
  if (!domains.length) {
    console.log('  None found (or CLOUDFLARE_ACCOUNT_ID not set)')
  } else {
    for (const d of domains) {
      console.log(`  ${d.name.padEnd(35)} ${d.status.padEnd(15)} expires: ${d.expires_at ?? 'unknown'}`)
    }
  }
  console.log('')
}

void (async () => {
  try {
    switch (command) {
      case 'check':   await cmdCheck(arg1); break
      case 'suggest': await cmdSuggest(arg1, arg2); break
      case 'connect': await cmdConnect(arg1, arg2); break
      case 'list':    await cmdList(); break
      default:
        console.log(`\nUsage:`)
        console.log(`  npm run domain -- check  jazzheating.com`)
        console.log(`  npm run domain -- suggest "Jazz Heating" "Tracy CA"`)
        console.log(`  npm run domain -- connect "jazz heating" jazzheating.com`)
        console.log(`  npm run domain -- list\n`)
    }
  } finally {
    await pool.end()
  }
})()
