// Voice quality eval for the client AI receptionist: drives a REAL GeminiLiveSession with the real client
// prompt + tool set, using macOS-synthesized phone audio, and scores tool use / latency / dead air.
// Tool results are canned (no Cal.com / Google / CRM writes).
//
//   Vertex 2.5 (current prod):  GOOGLE_APPLICATION_CREDENTIALS=$PWD/webcrew-vertex-sa.json \
//     node --env-file=.env ../node_modules/tsx/dist/cli.mjs src/scripts/voice-eval.ts --backend vertex
//   AI Studio 3.8-live:         node --env-file=.env ../node_modules/tsx/dist/cli.mjs src/scripts/voice-eval.ts --backend aistudio
//     (uses GEMINI_LIVE_AISTUDIO_KEY if set, else GOOGLE_AI_API_KEY — the free-tier key is fine for this synthetic test ONLY)
//
// One synthetic voice and clean audio is a smoke test of tool-calling and latency, not a substitute for real calls.
import { execFileSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { GeminiLiveSession } from '../reception/gemini-live.js'
import { getReceptionConfigById, pool } from '../reception/db.js'
import { buildClientRuntimeAddendum } from '../reception/client-tools.js'

const backend = process.argv.includes('--backend') ? process.argv[process.argv.indexOf('--backend') + 1] : 'vertex'
const CONFIG_ID = process.env.EVAL_CONFIG_ID ?? 'b1d47991-e700-4837-aac4-c48786d86bc2'   // "Pavan Test HVAC"
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null

if (backend === 'aistudio') {
  process.env.GEMINI_LIVE_PRIMARY = 'aistudio'
  process.env.GEMINI_LIVE_AISTUDIO_KEY = process.env.GEMINI_LIVE_AISTUDIO_KEY ?? process.env.GOOGLE_AI_API_KEY
} else {
  delete process.env.GEMINI_LIVE_PRIMARY
}

interface Scenario { id: string; lines: string[]; pass: (t: string[], reply: string) => boolean; expect: string }
const has = (t: string[], re: RegExp) => t.some(n => re.test(n))
const SCENARIOS: Scenario[] = [
  { id: 'emergency', expect: 'escalate/take_message, and NO routine booking', lines: [
      "Hi, my furnace just died and it's freezing in here, I have a newborn at home. I need someone right now.",
      "My name is Dave Miller and my number is 2 0 9, 5 5 5, 0 1 3 4.",
      "Yes, that's correct. Please have someone call me back as soon as possible.",
      "Yes, that's right, thank you." ],
    // Urgent (no heat + newborn) with the next opening days away: must escalate or take an urgent message, NOT book a routine slot.
    pass: t => has(t, /transfer|escalate|take_message/) && !has(t, /book_appointment/) },
  { id: 'book', expect: 'books WITHOUT an email', lines: [
      "Hi, I'd like to book a furnace tune-up for tomorrow morning.",
      "Nine o'clock works for me.",
      "It's Maria Lopez, my number is 2 0 9, 5 5 5, 0 1 3 4. Yes, please text me the confirmation.",
      "Yes, that's correct.",
      "I don't really use email, that's okay.",
      "Yes, that's right, go ahead and book it." ],
    pass: t => t.indexOf('check_availability') >= 0 && t.indexOf('book_appointment') > t.indexOf('check_availability') },
  { id: 'faq', expect: 'answers without tools', lines: ["Hi, do you guys charge for an estimate?"],
    pass: (t, reply) => t.length === 0 && reply.length > 15 },
  { id: 'reschedule', expect: 'find_appointment', lines: [
      "Hi, I need to move my appointment to a different day.",
      "It's under Maria Lopez, phone 2 0 9, 5 5 5, 0 1 3 4.",
      "Yes, that's the one." ],
    pass: t => has(t, /find_appointment/) },
  { id: 'robocall', expect: 'no booking / message tools', lines: [
      "Clients are currently having trouble finding you. Press one to speak with an agent immediately and verify your Google listing." ],
    pass: t => !has(t, /book_appointment|take_message|transfer/) },
]

const CANNED: Record<string, unknown> = {
  check_availability: { success: true, timezone: 'America/Los_Angeles', slots: [
    { time: '2026-09-22T09:00:00-07:00', label: 'Tue, Sep 22, 9:00 AM' }, { time: '2026-09-22T10:00:00-07:00', label: 'Tue, Sep 22, 10:00 AM' }, { time: '2026-09-22T13:00:00-07:00', label: 'Tue, Sep 22, 1:00 PM' } ] },
  book_appointment: { success: true, message: 'Booked for Tue, Sep 22 at 9:00 AM.' },
  find_appointment: { success: true, bookings: [{ booking_uid: 'bk_1', start: '2026-09-24T09:00:00-07:00', title: 'AC repair' }] },
}

function synth(text: string): Buffer {
  const dir = mkdtempSync(join(tmpdir(), 'veval-'))
  try {
    execFileSync('say', ['-v', 'Samantha', '-o', join(dir, 'a.aiff'), text])
    execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', join(dir, 'a.aiff'), join(dir, 'a.wav')])
    const w = readFileSync(join(dir, 'a.wav'))
    let i = 12
    while (i + 8 < w.length) { const id = w.toString('ascii', i, i + 4), sz = w.readUInt32LE(i + 4); if (id === 'data') return w.subarray(i + 8, i + 8 + sz); i += 8 + sz }
    throw new Error('no data chunk')
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function run(sc: Scenario, systemPrompt: string, websiteUrl: string, bizName: string) {
  const log: string[] = []
  const origLog = console.log, origWarn = console.warn, origErr = console.error
  const grab = (m: unknown[]) => log.push(m.map(String).join(' '))
  console.log = (...a) => grab(a); console.warn = (...a) => grab(a); console.error = (...a) => grab(a)

  const tools: string[] = []; let reply = ''; let turnAI = '', heard = ''; const turns: string[] = []; let lastActivity = 0; let firstResponseAt = 0; let speechEnd = 0
  let session: GeminiLiveSession | null = null
  const touch = () => { lastActivity = Date.now(); if (!firstResponseAt && speechEnd) firstResponseAt = Date.now() }
  try {
    session = new GeminiLiveSession({
      onReady: () => {}, onAudio: () => touch(), onText: t => { reply += t; turnAI += t; touch() }, onInputText: t => { heard += t },
      onInterrupted: () => {}, onError: e => grab([`ERROR ${e.message}`]), onClose: () => {},
      onToolCall: (name, _args, id) => { tools.push(name); touch(); setTimeout(() => session?.respondToTool(id, name, CANNED[name] ?? { success: true }), 150) },
    })
    await session.connect(systemPrompt, websiteUrl, { calendarEnabled: true })
    // Mirror the real relay (twilio-relay.ts ~L331-338): a greeting trigger ~300ms after ready, then wait for it to finish.
    await sleep(300)
    session.sendText(`[CALL CONNECTED] In your natural voice say: "Thanks for calling ${bizName}. I'm the AI receptionist. This call may be recorded for quality. How can I help today?" Then wait. Do not infer the caller's identity, business, location, or intent from Caller ID or any earlier call.`)
    const greetBy = Date.now() + 15_000
    while (Date.now() < greetBy && !(lastActivity && Date.now() - lastActivity > 2000)) await sleep(150)
    reply = ''; tools.length = 0   // score only what happens after the greeting
    let first: number | null = null
    for (const line of sc.lines) {
      const pcm = synth(line)
      firstResponseAt = 0; speechEnd = 0; turnAI = ''; heard = ''
      for (let o = 0; o < pcm.length; o += 3200) { session.sendAudio(pcm.subarray(o, o + 3200).toString('base64')); await sleep(100) }
      speechEnd = Date.now()
      for (let k = 0; k < 15; k++) { session.sendAudio(Buffer.alloc(3200).toString('base64')); await sleep(100) }   // trailing silence → end of turn
      const deadline = Date.now() + 25_000
      while (Date.now() < deadline && !(firstResponseAt && Date.now() - lastActivity > 2200)) await sleep(150)
      if (first === null && firstResponseAt) first = firstResponseAt - speechEnd
      turns.push(`   caller: ${line.slice(0, 60)}\n   heard : ${heard.replace(/\s+/g, ' ').trim().slice(0, 90) || '(NOTHING TRANSCRIBED)'}\n   AI    : ${turnAI.replace(/\s+/g, ' ').trim().slice(0, 160) || '(silence)'}`)
    }
    const attempts = log.filter(l => l.includes('[Gemini] attempt backend='))
    const served = (attempts[attempts.length - 1] ?? '').replace(/.*→ /, '') || '(unknown)'
    const model = served
    const fellBack = log.some(l => l.includes('trying next backend'))
    const failReason = (log.find(l => l.includes('failed (')) ?? '').replace(/.*\[Gemini\] /, '').slice(0, 220)
    const malformed = log.filter(l => l.includes('MALFORMED_FUNCTION_CALL (')).length
    return { turns, failReason, id: sc.id, pass: sc.pass(tools, reply.trim()), expect: sc.expect, model, fellBack, malformed, firstMs: first, tools, reply: reply.trim().replace(/\s+/g, ' ').slice(-150), dead: first === null }
  } finally {
    console.log = origLog; console.warn = origWarn; console.error = origErr
    session?.close()
  }
}

async function main() {
  const cfg = await getReceptionConfigById(CONFIG_ID)
  if (!cfg) throw new Error(`config ${CONFIG_ID} not found`)
  const prompt = `${cfg.system_prompt}\n\n${buildClientRuntimeAddendum(cfg, true)}`
  console.log(`\nVOICE EVAL — backend=${backend} — ${cfg.business_name}\n`)
  const rows = []
  for (const sc of SCENARIOS.filter(s => !only || s.id === only)) {
    const r = await run(sc, prompt, cfg.website_url, cfg.business_name)
    rows.push(r)
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id.padEnd(10)} model=${r.model} first=${r.firstMs ?? 'NONE'}ms tools=[${r.tools.join(', ')}] malformed=${r.malformed}${r.fellBack ? ` FELL-BACK (INVALID for ${backend}): ${r.failReason}` : ''}${r.dead ? ' DEAD-AIR' : ''}\n      expect: ${r.expect}\n${r.turns.join('\n')}`)
  }
  const passed = rows.filter(r => r.pass).length
  const lat = rows.map(r => r.firstMs).filter((n): n is number => n !== null).sort((a, b) => a - b)
  console.log(`\nSUMMARY ${backend}: ${passed}/${rows.length} pass · median first response ${lat.length ? lat[Math.floor(lat.length / 2)] : 'n/a'}ms · malformed ${rows.reduce((a, r) => a + r.malformed, 0)} · dead-air ${rows.filter(r => r.dead).length}`)
  await pool.end()
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
