import 'dotenv/config'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const PHONE = '+14156060079'

async function main() {
  // 1. Reset conversation state
  await pool.query(`DELETE FROM sms_conversations WHERE phone=$1`, [PHONE])
  await pool.query(`DELETE FROM build_requests WHERE phone=$1`, [PHONE])
  console.log('State reset')

  // 2. Update existing lead (phone unique) so Sofia knows the business on reply
  const r = await pool.query(`
    UPDATE leads SET name='LusterFinish Mobile Auto Detailing', niche='auto-detailing', city='Manteca', state='CA',
      tier='tier1', status='sms_sent', sms_sent=true, sms_sent_at=NOW(),
      sms_opt_out=false, cloudflare_url=NULL, vercel_url=NULL, updated_at=NOW()
    WHERE phone=$1 RETURNING id
  `, [PHONE])
  console.log(`Lead updated: ${r.rows[0]?.id}`)

  // 3. Send T1 outreach — Sofia voice
  const body = `Hi! Sorry to text out of the blue — this is Sofia from WebCrew.\n\nWe built LusterFinish Mobile Auto Detailing a brand-new website. No upfront or setup fees — if you love it, you pay whatever feels fair. If not, no big deal.\n\nSounds like a plan? Reply YES to see it. Reply STOP to opt out.`
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: PHONE, From: process.env.TWILIO_FROM_NUMBER!, Body: body }).toString(),
  })
  const data: any = await res.json()
  console.log(res.ok ? `SMS sent: ${data.sid}` : `SMS FAILED: ${data.message}`)
  await pool.end()
}
main()
