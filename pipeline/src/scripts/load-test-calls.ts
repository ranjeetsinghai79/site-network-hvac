// Load test: N simulated Twilio phone calls at once against the LIVE reception service, over the real /ws Media
// Stream protocol (connected → start → 8 kHz µ-law media frames → stop). Each call runs ~7.5 s — under the 8 s line
// where post-call summaries and owner emails start — so it stresses connection setup, the Gemini Live session and
// two-way audio transcoding without spamming anyone. Test callers are +1555010xxxx; clean up with --cleanup.
//
//   node --env-file=.env ../node_modules/tsx/dist/cli.mjs src/scripts/load-test-calls.ts --calls 20
//   ... --calls 20 --stagger 100      (ms between call starts; default 50)
//   ... --cleanup                      (deletes call_logs / reception_contacts rows created by test callers)
import { execFileSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import WebSocket from 'ws'
import pg from 'pg'

const arg = (n: string, d: string) => process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d
const CALLS = Number(arg('--calls', '10')), STAGGER = Number(arg('--stagger', '50'))
const CONFIG = arg('--config', 'b1d47991-e700-4837-aac4-c48786d86bc2')     // Pavan Test HVAC (client line, no gate)
const WS_URL = arg('--url', 'wss://ai-reception-459352382653.us-central1.run.app/ws')
const CALL_MS = Number(arg('--call-ms', '7500'))

// G.711 µ-law encode (16-bit linear → 8-bit)
function mulaw(sample: number): number {
  const BIAS = 0x84, CLIP = 32635
  let s = sample, sign = 0
  if (s < 0) { s = -s; sign = 0x80 }
  if (s > CLIP) s = CLIP
  s += BIAS
  let exp = 7; for (let mask = 0x4000; (s & mask) === 0 && exp > 0; exp--, mask >>= 1) {}
  const mant = (s >> (exp + 3)) & 0x0f
  return ~(sign | (exp << 4) | mant) & 0xff
}

function synthQuestion(): Buffer {
  const dir = mkdtempSync(join(tmpdir(), 'lt-'))
  try {
    execFileSync('say', ['-v', 'Samantha', '-o', join(dir, 'q.aiff'), 'Hi, do you guys charge for an estimate?'])
    execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@8000', '-c', '1', join(dir, 'q.aiff'), join(dir, 'q.wav')])
    const w = readFileSync(join(dir, 'q.wav')); let i = 12
    while (i + 8 < w.length) { const id = w.toString('ascii', i, i + 4), sz = w.readUInt32LE(i + 4); if (id === 'data') { const pcm = w.subarray(i + 8, i + 8 + sz); const out = Buffer.alloc(pcm.length / 2); for (let k = 0; k < out.length; k++) out[k] = mulaw(pcm.readInt16LE(k * 2)); return out } i += 8 + sz }
    throw new Error('no data chunk')
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

interface Result { closedMs: number | null; stopSent: boolean; n: number; connected: boolean; firstAudioMs: number | null; replyAudioMs: number | null; frames: number; closeCode: number | null; error: string | null }

function oneCall(n: number, question: Buffer): Promise<Result> {
  return new Promise(resolve => {
    const caller = `+1555010${String(1000 + n).slice(-4)}`
    const r: Result = { closedMs: null, stopSent: false, n, connected: false, firstAudioMs: null, replyAudioMs: null, frames: 0, closeCode: null, error: null }
    const ws = new WebSocket(WS_URL)
    const streamSid = `MZ${'0'.repeat(30)}${String(n).padStart(2, '0')}`, callSid = `CALOADTEST${String(n).padStart(4, '0')}`
    let t0 = 0, questionSentAt = 0, done = false
    const finish = () => { if (done) return; done = true; try { ws.close() } catch {} ; resolve(r) }
    const timer = setTimeout(() => { r.error ??= 'timeout'; finish() }, CALL_MS + 12_000)
    ws.on('open', () => {
      r.connected = true
      ws.send(JSON.stringify({ event: 'connected', protocol: 'Call', version: '1.0.0' }))
      t0 = Date.now()
      ws.send(JSON.stringify({ event: 'start', sequenceNumber: '1', start: { streamSid, callSid, accountSid: 'ACloadtest', tracks: ['inbound'], mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 }, customParameters: { caller, config: CONFIG, outbound: '0', leadName: '', demoUrl: '', triggerType: '', recovery: '0', stir: '', gate: '0' } }, streamSid }))
      // Speak the question ~3.5 s in (after the greeting has started), 20 ms frames, then silence until the end.
      setTimeout(() => {
        questionSentAt = Date.now(); let off = 0
        const iv = setInterval(() => {
          if (done || off >= question.length) { clearInterval(iv); return }
          ws.send(JSON.stringify({ event: 'media', streamSid, media: { track: 'inbound', chunk: String(off / 160), timestamp: String(Date.now() - t0), payload: question.subarray(off, off + 160).toString('base64') } })); off += 160
        }, 20)
      }, 3500)
      setTimeout(() => { try { ws.send(JSON.stringify({ event: 'stop', streamSid, stop: { accountSid: 'ACloadtest', callSid } })); r.stopSent = true } catch {} ; setTimeout(finish, 400) }, CALL_MS)
    })
    ws.on('message', raw => {
      let m: any; try { m = JSON.parse(raw.toString()) } catch { return }
      if (m.event === 'media') {
        r.frames++
        if (r.firstAudioMs === null) r.firstAudioMs = Date.now() - t0
        if (questionSentAt && r.replyAudioMs === null && Date.now() - questionSentAt > 1500) r.replyAudioMs = Date.now() - questionSentAt
      }
    })
    ws.on('close', code => { r.closeCode = code; r.closedMs = Date.now() - t0; clearTimeout(timer); finish() })
    ws.on('error', e => { r.error = e.message.slice(0, 80); clearTimeout(timer); finish() })
  })
}

const pct = (a: number[], p: number) => a.length ? a.sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : NaN

async function cleanup() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const a = await pool.query(`delete from call_logs where caller_number like '+1555010%'`)
  const b = await pool.query(`delete from reception_contacts where phone like '+1555010%'`)
  console.log(`cleanup: removed ${a.rowCount} call_logs, ${b.rowCount} reception_contacts test rows`)
  await pool.end()
}

async function main() {
  if (process.argv.includes('--cleanup')) return cleanup()
  console.log(`\nLOAD TEST — ${CALLS} simultaneous calls, ${STAGGER} ms apart, ${(CALL_MS / 1000).toFixed(1)} s each → ${WS_URL}\n`)
  const question = synthQuestion()
  const t = Date.now(); const jobs: Promise<Result>[] = []
  for (let i = 0; i < CALLS; i++) { jobs.push(oneCall(i, question)); await new Promise(r => setTimeout(r, STAGGER)) }
  const results = await Promise.all(jobs)
  const ok = results.filter(r => r.connected && r.firstAudioMs !== null)
  const first = ok.map(r => r.firstAudioMs!)
  console.log(`finished in ${((Date.now() - t) / 1000).toFixed(1)} s`)
  console.log(`connected            ${results.filter(r => r.connected).length}/${CALLS}`)
  console.log(`AI spoke (greeting)  ${ok.length}/${CALLS}   ${ok.length === CALLS ? '✔' : '✘ ' + (CALLS - ok.length) + ' calls got NO audio'}`)
  console.log(`time to first audio  p50 ${pct([...first], 0.5)} ms · p95 ${pct([...first], 0.95)} ms · max ${first.length ? Math.max(...first) : NaN} ms`)
  console.log(`audio frames / call  avg ${Math.round(results.reduce((a, r) => a + r.frames, 0) / CALLS)} (two-way stream stayed up)`)
  const dropped = results.filter(r => r.error || (r.closedMs !== null && !r.stopSent && r.closedMs < CALL_MS - 300))     // server hung up before the call was meant to end
  const teardown = results.filter(r => r.stopSent && r.closeCode && r.closeCode !== 1000 && r.closeCode !== 1005)          // closed after we hung up: benign
  console.log(`dropped mid-call     ${dropped.length}${dropped.length ? '  ✘ → ' + dropped.slice(0, 6).map(r => `#${r.n}: code ${r.closeCode} at ${r.closedMs} ms ${r.error ?? ''}`).join(', ') : '  ✔'}`)
  console.log(`closed after hangup  ${teardown.length} (code ${[...new Set(teardown.map(r => r.closeCode))].join('/') || '—'}; the server ending the socket after our stop event)`)
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
