/**
 * lead-audit.ts — counts SMS-able, email-able, dead rows per tab
 * Run: npx tsx --env-file=.env src/scripts/lead-audit.ts
 */
import { readSheetRows } from '../tools/google-sheets.js'

const SHEET = process.env.LEADS_SHEET_ID!
const TABS: string[] = [
  'Local SMBs','MEDSPAS','USA_Restaurants','USA_FinancialAdvisorsandInsuranceAgents',
  'USA_DentalOffices','USA_Salons','USA_BarberShops','USA_SkinClinics',
  'USA_IVTherapy','USA_NailStudios','USA_LawFirms','USA_RealEstateAgents',
  'USA_AutoDetailing','USA_HVAC','USA_Roofing','USA_Remodeling','USA_Plumbing',
  'INDIA_DentalOffices','INDIA_MEDSPAS','India_Restaurants','USA_CosmeticSurgeons',
]

async function main() {
let totSMS=0,totEmail=0,totBoth=0,totDead=0,totTotal=0

console.log('Tab'.padEnd(47)+'Total'.padStart(7)+'SMS✓'.padStart(8)+'Email✓'.padStart(8)+'Both'.padStart(6)+'Dead'.padStart(7))
console.log('─'.repeat(83))

for (const tab of TABS) {
  try {
    const rows = await readSheetRows({ spreadsheetId: SHEET, sheetName: tab, range: 'A:V' })
    const data = rows.slice(1)
    let sms=0,email=0,both=0,dead=0
    for (const r of data) {
      const canSms    = (r[21]??'').toUpperCase()  // col V
      const bizEmail  = r[18]??''                   // col S
      const ownerEmail= r[19]??''                   // col T
      const h7email   = r[7]??''                    // col H (raw email field)
      const hasEmail  = !!(bizEmail||ownerEmail||h7email)
      const hasSms    = canSms==='YES'
      if(hasSms&&hasEmail) both++
      else if(hasSms)      sms++
      else if(hasEmail)    email++
      else                 dead++
    }
    totTotal+=data.length; totSMS+=sms; totEmail+=email; totBoth+=both; totDead+=dead
    console.log(tab.padEnd(47)+data.length.toString().padStart(7)+sms.toString().padStart(8)+email.toString().padStart(8)+both.toString().padStart(6)+dead.toString().padStart(7))
  } catch(e:any) {
    console.log(tab.padEnd(47)+'  ERROR: '+e.message?.slice(0,40))
  }
}

console.log('─'.repeat(83))
console.log('TOTAL'.padEnd(47)+totTotal.toString().padStart(7)+totSMS.toString().padStart(8)+totEmail.toString().padStart(8)+totBoth.toString().padStart(6)+totDead.toString().padStart(7))
const reach = totSMS+totEmail+totBoth
console.log('')
console.log(`Reachable (SMS or email): ${reach.toLocaleString()} (${(reach/totTotal*100).toFixed(1)}%)`)
console.log(`  → SMS only:   ${totSMS.toLocaleString()}`)
console.log(`  → Email only: ${totEmail.toLocaleString()}`)
console.log(`  → Both:       ${totBoth.toLocaleString()}`)
console.log(`Dead (no phone, no email): ${totDead.toLocaleString()} (${(totDead/totTotal*100).toFixed(1)}%)`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
