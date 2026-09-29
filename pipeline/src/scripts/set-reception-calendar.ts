/**
 * set-reception-calendar.ts — connect a client's Cal.com calendar to their AI receptionist.
 *
 * Without this, a client's receptionist has NO booking tools (it takes messages
 * instead) — by design, so bookings can never land on WebCrew's own calendar.
 *
 * Usage (key via env so it stays out of shell history):
 *   CLIENT_CAL_API_KEY=cal_live_... npx tsx src/scripts/set-reception-calendar.ts <configId> <eventTypeId> <timezone>
 *   e.g. ... 6a1b...-uuid 123456 America/Los_Angeles
 *
 * The key + event type are verified against Cal.com before anything is saved.
 * Pass --clear to disconnect (receptionist goes back to message-only).
 */
import 'dotenv/config'
import { pool } from '../reception/db.js'
import { verifyCalCredentials } from '../reception/cal-booking.js'

const args = process.argv.slice(2).filter(a => a !== '--clear')
const clear = process.argv.includes('--clear')
const [configId, eventTypeArg, timezone] = args

async function main() {
  if (!configId) throw new Error('Usage: set-reception-calendar.ts <configId> <eventTypeId> <timezone>   (key in CLIENT_CAL_API_KEY; --clear to disconnect)')

  const { rows } = await pool.query(`SELECT id, business_name, website_url FROM reception_configs WHERE id=$1`, [configId])
  const config = rows[0]
  if (!config) throw new Error(`No reception config ${configId}`)
  if (config.website_url.replace(/\/$/, '') === 'https://webcrew.app') throw new Error('Refusing to change WebCrew\'s own line — it uses the CAL_DIY_API_KEY env var.')

  if (clear) {
    await pool.query(`UPDATE reception_configs SET cal_api_key=NULL, cal_event_type_id=NULL, updated_at=NOW() WHERE id=$1`, [configId])
    console.log(`Calendar disconnected for ${config.business_name}. Receptionist is message-only.`)
    return
  }

  const apiKey = process.env.CLIENT_CAL_API_KEY
  const eventTypeId = Number(eventTypeArg)
  if (!apiKey) throw new Error('Set CLIENT_CAL_API_KEY to the client\'s Cal.com API key')
  if (!Number.isInteger(eventTypeId) || eventTypeId <= 0) throw new Error('eventTypeId must be a positive integer')
  if (!timezone) throw new Error('timezone is required, e.g. America/Los_Angeles')
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }) } catch { throw new Error(`Unknown timezone: ${timezone}`) }

  const check = await verifyCalCredentials(apiKey, eventTypeId)
  if (!check.ok) throw new Error(`Cal.com rejected that key/event type: ${check.error}`)

  await pool.query(
    `UPDATE reception_configs SET cal_api_key=$2, cal_event_type_id=$3, timezone=$4, updated_at=NOW() WHERE id=$1`,
    [configId, apiKey, eventTypeId, timezone])
  console.log(`Calendar connected for ${config.business_name}: "${check.title}" (${check.lengthMinutes ?? '?'} min), ${timezone}.`)
  console.log('New calls pick this up immediately — no redeploy needed.')
}

main().catch(e => { console.error(`✗ ${e.message}`); process.exitCode = 1 }).finally(() => pool.end())
