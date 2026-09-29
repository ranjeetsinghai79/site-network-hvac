import http from 'http'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import { WebSocketServer } from 'ws'
import { attachTwilioRelay } from './twilio-relay.js'
import { attachWidgetRelay } from './browser-relay.js'
import { buildBrain, buildSystemPrompt } from './brain-builder.js'
import { saveReceptionConfig, getReceptionConfig, getReceptionConfigById, updateTwilioPhone, updateCallLogRecording, countRecentCallsFromNumber, getRecentVoiceSeconds, pool, peekCachedConfig, warmConfigCache, createPreviewJob, getPreviewJob, isRateLimited } from './db.js'
import { gateEnabled, gateTwiml, declineTwiml, isOwnerPhone, outageTwiml } from './call-screen.js'
import { isClientConfig, isDemoConfig } from './client-tools.js'
import { clientIp, verifyTurnstile } from './turnstile.js'
import { runPreviewJob } from './preview-pipeline.js'
import { renderPreviewHtml } from './preview-page.js'
import { cleanupExpiredPreviews } from '../scripts/cleanup-expired-previews.js'
import Twilio from 'twilio'
import { WEBCREW_SYSTEM_PROMPT } from './webcrew-prompt.js'
import { verifyOpportunityToken, markContacted } from './crm.js'
import { runDueFollowUps } from './follow-ups.js'

const WEBCREW_URL = 'https://webcrew.app'
import { callMeta } from './call-context.js'
import { GeminiLiveSession } from './gemini-live.js'

// A bug in one call's async tool-call handling must never kill the whole
// process — that would drop every other concurrent call on this instance.
process.on('unhandledRejection', (err) => console.error('[Server] Unhandled rejection:', err))
process.on('uncaughtException',  (err) => console.error('[Server] Uncaught exception:', err))

// Reception server routes:
//   GET  /widget.js             → embeddable client widget script (any site)
//   POST /preview/start         → landing-page "paste your URL" instant preview — start a job
//   GET  /preview/status/:id    → poll a preview job's progress
//   GET  /preview/:id           → rendered preview page (hand-built HTML, embeds widget.js)
//   POST /preview/cleanup       → delete expired anonymous previews (Bearer auth)
//   POST /voice/:configId       → TwiML (Twilio inbound/outbound webhook)
//   POST /amd-status            → AMD callback (machine → redirect to voicemail)
//   GET  /voicemail/:configId   → TwiML voicemail message
//   GET  /transfer-twiml        → TwiML live transfer (?to=+1xxx)
//   POST /call-status           → Call lifecycle logging
//   POST /call                  → Initiate outbound call (Bearer auth)
//   POST /warm-trigger          → Outbound to warm lead (email click / SMS reply)
//   POST /provision             → Auto-provision reception config
//   GET  /crm/contacted         → One-tap "mark lead contacted" (signed link)
//   POST /follow-ups/run        → Drain appointment reminders + owner nudges (Bearer auth)
//   GET  /health                → Health check

const PORT     = parseInt(process.env.RECEPTION_PORT ?? process.env.PORT ?? '3030')
const BASE_URL = process.env.RECEPTION_BASE_URL ?? `http://localhost:${PORT}`

let voiceProbeCache: { at: number; ok: boolean; body: string } | null = null

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export function startReceptionServer() {
  warmConfigCache().then(n => console.log(`[Server] warmed config cache: ${n} active line(s)`)).catch(e => console.warn(`[Server] config cache warm-up skipped: ${e.message}`))
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

    // ── Health ────────────────────────────────────────────────────────────────
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, service: 'ai-reception', port: PORT }))
      return
    }

    // ── Embeddable widget: GET /widget.js ──────────────────────────────────────
    // <script src=".../widget.js" data-config="<configId>"></script> on any
    // client's own site. Talks to the client-mode branch of /widget-ws (see
    // browser-relay.ts's isClientConfig branch). Short cache so a fix ships
    // to already-embedded sites within minutes, not a full CDN TTL.
    if (req.method === 'GET' && url.pathname === '/widget.js') {
      try {
        const filePath = fileURLToPath(new URL('./public/widget.js', import.meta.url))
        const content = await fs.readFile(filePath)
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' })
        res.end(content)
      } catch (e: any) {
        console.error('[Server] /widget.js read failed:', e.message)
        res.writeHead(404); res.end('Not found')
      }
      return
    }

    // ── Landing-page "paste your URL" instant preview flow ─────────────────────
    // Public, cross-origin (called from webcrew.app's JS), rate-limited + Turnstile-gated.
    const PREVIEW_CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }

    if (req.method === 'OPTIONS' && (url.pathname === '/preview/start' || url.pathname.startsWith('/preview/status/'))) {
      res.writeHead(204, PREVIEW_CORS); res.end()
      return
    }

    if (req.method === 'POST' && url.pathname === '/preview/start') {
      let body = ''
      req.on('data', c => { body += c })
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}')
          const rawUrl = String(parsed.url ?? '').trim()
          const turnstileToken = String(parsed.turnstileToken ?? '')
          if (!rawUrl) { res.writeHead(400, { ...PREVIEW_CORS, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'A website address is required.' })); return }

          let normalized: string
          try { normalized = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).toString() }
          catch { res.writeHead(400, { ...PREVIEW_CORS, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Enter a valid website address, like yourbusiness.com' })); return }

          const ip = clientIp(req)
          const verified = await verifyTurnstile(turnstileToken, ip)
          if (!verified) { res.writeHead(403, { ...PREVIEW_CORS, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Verification failed. Please try again.' })); return }
          if (await isRateLimited(ip, 'preview-start', 3, 10)) { res.writeHead(429, { ...PREVIEW_CORS, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Too many requests — please try again in a few minutes.' })); return }

          const jobId = await createPreviewJob(normalized, ip)
          res.writeHead(200, { ...PREVIEW_CORS, 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ previewId: jobId }))

          // Respond immediately, run the 60-90s Firecrawl+Gemini job in the background —
          // same "respond now, work async" idiom as /pipeline-trigger below.
          runPreviewJob(jobId, normalized).catch((e: any) => console.error(`[Preview] job ${jobId} crashed:`, e.message))
        } catch (e: any) {
          console.error('[Server] /preview/start error:', e.message)
          if (!res.headersSent) { res.writeHead(500, { ...PREVIEW_CORS, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Something went wrong. Please try again.' })) }
        }
      })
      return
    }

    if (req.method === 'GET' && url.pathname.startsWith('/preview/status/')) {
      const previewId = url.pathname.slice('/preview/status/'.length)
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(previewId)) {
        res.writeHead(400, { ...PREVIEW_CORS, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid preview ID' })); return
      }
      try {
        const job = await getPreviewJob(previewId)
        if (!job) { res.writeHead(404, { ...PREVIEW_CORS, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Preview not found' })); return }
        // Once ready, the landing page's claim form needs the business name to
        // pre-fill/display it — a cheap extra lookup only on the ready path.
        const businessName = (job.stage === 'ready' && job.configId) ? (await getReceptionConfigById(job.configId))?.business_name : undefined
        res.writeHead(200, { ...PREVIEW_CORS, 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ stage: job.stage, progressPct: job.progressPct, ready: job.stage === 'ready', configId: job.configId ?? undefined, businessName, error: job.error ?? undefined }))
      } catch (e: any) {
        console.error('[Server] /preview/status error:', e.message)
        res.writeHead(500, { ...PREVIEW_CORS, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Something went wrong.' }))
      }
      return
    }

    // ── Rendered preview page: GET /preview/:previewId ─────────────────────────
    // Meant to be iframed from webcrew.app once a job's status is 'ready'.
    // Plain HTML, no auth — same "share the link, no login" posture as the
    // preview job itself; the config it renders is an anonymous is_preview row.
    if (req.method === 'GET' && url.pathname.startsWith('/preview/')
        && !url.pathname.startsWith('/preview/status/') && url.pathname !== '/preview/start') {
      const previewId = url.pathname.slice('/preview/'.length)
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(previewId)) {
        res.writeHead(400, { 'Content-Type': 'text/plain' }); res.end('Invalid preview ID'); return
      }
      try {
        const job = await getPreviewJob(previewId)
        if (!job || job.stage !== 'ready' || !job.configId) {
          res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('This preview is not ready yet.'); return
        }
        const config = await getReceptionConfigById(job.configId)
        if (!config) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Preview not found.'); return }
        const html = renderPreviewHtml(config, job.displayConfig, BASE_URL)
        // No X-Frame-Options / frame-ancestors restriction — this page is designed to be iframed
        // from webcrew.app (and nothing here is sensitive; it's an anonymous marketing preview).
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
        res.end(html)
      } catch (e: any) {
        console.error('[Server] /preview/:id render failed:', e.message)
        res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end('Something went wrong.')
      }
      return
    }

    // ── Ready (voice): opens a real Gemini Live session and closes it. Catches what /ready cannot — model access
    // withdrawn, depleted credits, quota, region trouble. Bearer-protected and cached 60 s so it can't be used to burn
    // sessions. Watched by a Cloud Monitoring uptime check every 5 minutes.
    if (url.pathname === '/ready/voice') {
      const secret = process.env.RECEPTION_PROVISION_SECRET
      if (!secret || (req.headers.authorization ?? '') !== `Bearer ${secret}`) { res.writeHead(401); res.end('Unauthorized'); return }
      const cached = voiceProbeCache
      if (cached && Date.now() - cached.at < 60_000) { res.writeHead(cached.ok ? 200 : 503, { 'Content-Type': 'application/json' }); res.end(cached.body); return }
      const t0 = Date.now(); let session: GeminiLiveSession | null = null
      let ok = false, body = ''
      try {
        session = new GeminiLiveSession({ onReady() {}, onAudio() {}, onToolCall() {}, onError() {}, onClose() {} })
        await Promise.race([session.connect('You are a health probe. Reply with one word.', WEBCREW_URL), new Promise((_, rej) => setTimeout(() => rej(new Error('voice setup timed out after 12s')), 12_000))])
        ok = true; body = JSON.stringify({ ok: true, voice: true, ms: Date.now() - t0 })
      } catch (e: any) { body = JSON.stringify({ ok: false, voice: false, error: String(e.message).slice(0, 160) }) }
      finally { try { session?.close() } catch {} }
      voiceProbeCache = { at: Date.now(), ok, body }
      res.writeHead(ok ? 200 : 503, { 'Content-Type': 'application/json' }); res.end(body)
      return
    }

    // ── Ready: proves a call could actually be answered (database reachable + a real config read) ──
    // /health above stays cheap and DB-free; uptime monitoring should watch THIS one — during the 2026-09-21 outage
    // /health stayed green while every call hung.
    if (url.pathname === '/ready') {
      const t0 = Date.now()
      try {
        await pool.query('select 1')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, db: true, ms: Date.now() - t0 }))
      } catch (e: any) {
        res.writeHead(503, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, db: false, error: String(e.message).slice(0, 120) }))
      }
      return
    }

    // ── Twilio inbound/outbound webhook: POST /voice/:configId ────────────────
    if (req.method === 'POST' && url.pathname.startsWith('/voice/')) {
      const configId = url.pathname.slice('/voice/'.length)
      if (!configId) { res.writeHead(400); res.end('Missing config ID'); return }

      let body = ''
      req.on('data', c => { body += c })
      req.on('end', async () => { try {
        const caller   = extractFormParam(body, 'From')
        const wsScheme = BASE_URL.startsWith('https') ? 'wss' : 'ws'
        const wsHost   = BASE_URL.replace(/^https?:\/\//, '')

        // Gate on subscription status before ever opening a media stream —
        // reception_configs.active has existed since this table was created
        // (with an index built specifically for `WHERE active = true`) but
        // was never actually checked anywhere: a canceled subscription kept
        // answering calls, and costing real Gemini/Twilio money, forever.
        // Set to false by the Stripe webhook on customer.subscription.deleted
        // / a non-active subscription.updated status (admin/src/app/api/
        // stripe/webhook/route.ts).
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(configId)) {
          res.writeHead(400); res.end('Invalid config ID'); return
        }
        const configData = await getReceptionConfigById(configId)
        if (!configData) {
          res.writeHead(404); res.end('Config not found'); return
        }
        if (configData.active === false) {
          const inactiveTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">This number is not currently active. Please contact the business directly.</Say>
  <Hangup/>
</Response>`
          res.writeHead(200, { 'Content-Type': 'text/xml' })
          res.end(inactiveTwiml)
          console.log(`[Server] Inactive config ${configId} — call declined`)
          return
        }

        // ── Screening for WebCrew's OWN lines (sales + demo) only. Paying clients' lines are never
        // gated or capped — a real customer must not hit an extra step. See call-screen.ts.
        const stir       = extractFormParam(body, 'StirVerstat')
        const isInbound  = !!caller && url.searchParams.get('outbound') !== '1' && !/outbound/i.test(extractFormParam(body, 'Direction'))
        const ownLine    = !isClientConfig(configData) || isDemoConfig(configData)
        let gatePassed   = false
        if (isInbound && ownLine && gateEnabled() && !isOwnerPhone(caller)) {
          const send = (xml: string) => { res.writeHead(200, { 'Content-Type': 'text/xml' }); res.end(xml) }
          try {
            const dailyCapSec = Number(process.env.OWN_LINE_DAILY_SECONDS_CAP ?? 90 * 60)
            const perNumberCap = Number(process.env.OWN_LINE_PER_NUMBER_DAILY_CAP ?? 4)
            if (await getRecentVoiceSeconds(configId) >= dailyCapSec) {
              console.warn(`[Screen] ${configId} daily voice budget reached — declined ${caller}`)
              return send(declineTwiml("Our A I receptionist is at capacity right now. Please visit webcrew dot app to chat with us. Goodbye."))
            }
            if (await countRecentCallsFromNumber(configId, caller) >= perNumberCap) {
              console.warn(`[Screen] ${caller} over per-number cap — declined`)
              return send(declineTwiml("Thanks for calling. Please visit webcrew dot app to continue. Goodbye."))
            }
          } catch (e: any) {
            console.error('[Screen] cap check failed (continuing):', e.message)   // never block a call on a DB hiccup
          }
          if (url.searchParams.get('gate') !== '1') {
            console.log(`[Screen] press-1 gate presented → ${caller} | stir=${stir || 'none'}`)
            return send(gateTwiml(configData.business_name, `${BASE_URL}/voice/${configId}?gate=1`))
          }
          if (extractFormParam(body, 'Digits') !== '1') {
            console.log(`[Screen] gate NOT passed → ${caller} | digits='${extractFormParam(body, 'Digits')}' stir=${stir || 'none'}`)
            return send(declineTwiml('Goodbye.'))
          }
          gatePassed = true
          console.log(`[Screen] gate passed → ${caller} | stir=${stir || 'none'}`)
        }

        // Call metadata travels with Twilio instead of living only in this
        // process. The HTTP webhook and WebSocket may land on different Cloud
        // Run instances when the service scales.
        const outbound   = url.searchParams.get('outbound') === '1'
        const recovery   = Math.max(0, Number(url.searchParams.get('recovery') ?? '0') || 0)
        const leadName   = url.searchParams.get('leadName') ?? ''
        const demoUrl    = url.searchParams.get('demoUrl') ?? ''
        const trigger    = url.searchParams.get('triggerType') ?? ''
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsScheme}://${wsHost}/ws">
      <Parameter name="caller" value="${xmlEscape(caller)}"/>
      <Parameter name="config" value="${xmlEscape(configId)}"/>
      <Parameter name="outbound" value="${outbound ? '1' : '0'}"/>
      <Parameter name="leadName" value="${xmlEscape(leadName)}"/>
      <Parameter name="demoUrl" value="${xmlEscape(demoUrl)}"/>
      <Parameter name="triggerType" value="${xmlEscape(trigger)}"/>
      <Parameter name="recovery" value="${recovery}"/>
      <Parameter name="stir" value="${xmlEscape(stir)}"/>
      <Parameter name="gate" value="${gatePassed ? '1' : '0'}"/>
    </Stream>
  </Connect>
</Response>`

        console.log(`[Server] ${caller ? 'Inbound' : 'Outbound connected'} → config ${configId} | caller ${caller}`)
        res.writeHead(200, { 'Content-Type': 'text/xml' })
        res.end(twiml)

      } catch (e: any) {
        // Database down, bad data, anything unexpected: a caller must never get silence or Twilio's "application error".
        console.error(`[Server] /voice failed for ${configId}: ${e.message} — sending fallback`)
        if (!res.headersSent) { res.writeHead(200, { 'Content-Type': 'text/xml' }); { const c = peekCachedConfig(configId); res.end(outageTwiml(c?.brain?.owner_phone, c?.twilio_phone)) } }
      } })
      return
    }

    // ── AMD status callback: POST /amd-status ─────────────────────────────────
    // Twilio fires async after answering machine detection on outbound calls.
    // AnsweredBy: human | machine_start | machine_end_beep | machine_end_silence | fax | unknown
    if (req.method === 'POST' && url.pathname === '/amd-status') {
      let body = ''
      req.on('data', c => { body += c })
      req.on('end', async () => {
        const callSid    = extractFormParam(body, 'CallSid')
        const answeredBy = extractFormParam(body, 'AnsweredBy')
        console.log(`[AMD] ${callSid} → ${answeredBy}`)
        res.writeHead(204); res.end()

        // Machine detected — redirect call to voicemail TwiML
        if (answeredBy === 'machine_end_beep' || answeredBy === 'machine_end_silence') {
          const meta     = callMeta.get(callSid)
          const configId = meta?.configId ?? url.searchParams.get('configId') ?? undefined
          if (!configId) { console.log(`[AMD] No configId for ${callSid} — skipping voicemail`); return }

          const sid  = process.env.TWILIO_ACCOUNT_SID
          const auth = process.env.TWILIO_AUTH_TOKEN
          if (!sid || !auth) return

          // Redirect call to voicemail TwiML
          await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${callSid}.json`, {
            method:  'POST',
            headers: {
              Authorization:  `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              Url:    `${BASE_URL}/voicemail/${configId}`,
              Method: 'GET',
            }).toString(),
          }).catch(e => console.error('[AMD] redirect failed:', e.message))
        }
      })
      return
    }

    // ── Voicemail TwiML: GET /voicemail/:configId ─────────────────────────────
    // Plays a short voicemail message after machine detected.
    if (req.method === 'GET' && url.pathname.startsWith('/voicemail/')) {
      const configId = url.pathname.slice('/voicemail/'.length)
      let businessName = 'us'
      let callbackNum  = process.env.TWILIO_PHONE_NUMBER ?? ''

      try {
        const config = await getReceptionConfigById(configId)
        if (config) {
          businessName = config.business_name
          callbackNum  = config.brain?.phone ?? callbackNum
        }
      } catch { /* use defaults */ }

      const message = callbackNum
        ? `Hi there! This is an AI assistant for ${businessName}. We tried reaching you to discuss how we can help your business. Please give us a call back at ${callbackNum.split('').join(', ')} and we'd love to connect. Have a wonderful day!`
        : `Hi there! This is an AI assistant for ${businessName}. We tried reaching you — please call us back when you get a chance. Have a wonderful day!`

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">${message}</Say>
  <Hangup/>
</Response>`

      res.writeHead(200, { 'Content-Type': 'text/xml' })
      res.end(twiml)
      return
    }

    // ── Live transfer TwiML: GET /transfer-twiml ──────────────────────────────
    // Used by escalate_to_human to dial owner directly.
    // Query: ?to=+1xxx&announce=0|1
    if (url.pathname === '/transfer-twiml') {
      const to       = url.searchParams.get('to') ?? ''
      const announce = url.searchParams.get('announce') !== '0'

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${announce ? '<Say voice="Polly.Joanna-Neural">Please hold while I connect you with a team member.</Say>' : ''}
  <Dial timeout="30" action="${BASE_URL}/transfer-complete">${to}</Dial>
</Response>`

      res.writeHead(200, { 'Content-Type': 'text/xml' })
      res.end(twiml)
      return
    }

    // ── Transfer complete (Dial fallback): POST /transfer-complete ────────────
    if (req.method === 'POST' && url.pathname === '/transfer-complete') {
      let body = ''
      req.on('data', c => { body += c })
      req.on('end', () => {
        const status = extractFormParam(body, 'DialCallStatus')
        console.log(`[Transfer] Dial complete — status: ${status}`)
        const twiml = status === 'completed' || status === 'answered'
          ? `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`
          : `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna-Neural">I'm sorry, no one is available right now. Please leave a message after the tone.</Say><Record maxLength="120"/></Response>`
        res.writeHead(200, { 'Content-Type': 'text/xml' })
        res.end(twiml)
      })
      return
    }

    // ── Call status logging: POST /call-status ────────────────────────────────
    if (req.method === 'POST' && url.pathname === '/call-status') {
      let body = ''
      req.on('data', c => { body += c })
      req.on('end', () => {
        const sid      = extractFormParam(body, 'CallSid')
        const status   = extractFormParam(body, 'CallStatus')
        const duration = extractFormParam(body, 'CallDuration')
        console.log(`[CallStatus] ${sid} → ${status}${duration ? ` (${duration}s)` : ''}`)
        if (status === 'completed' || status === 'failed' || status === 'no-answer') {
          callMeta.delete(sid)
        }
        res.writeHead(204); res.end()
      })
      return
    }

    // ── Recording status callback: POST /recording-status ────────────────────
    // Twilio's Recordings.json POST in twilio-relay.ts's onReady doesn't return
    // the recording URL synchronously (rendering happens async) — this is
    // where it actually arrives, once the recording finishes.
    if (req.method === 'POST' && url.pathname === '/recording-status') {
      let body = ''
      req.on('data', c => { body += c })
      req.on('end', async () => {
        const authToken = process.env.TWILIO_AUTH_TOKEN
        const signature  = req.headers['x-twilio-signature'] as string | undefined
        const params: Record<string, string> = {}
        for (const [k, v] of new URLSearchParams(body)) params[k] = v

        if (authToken && signature) {
          const fullUrl = `${BASE_URL}/recording-status`
          if (!Twilio.validateRequest(authToken, signature, fullUrl, params)) {
            console.warn('[RecordingStatus] Invalid Twilio signature — rejecting')
            res.writeHead(403); res.end()
            return
          }
        } else {
          console.warn('[RecordingStatus] Missing Twilio auth token or signature — rejecting')
          res.writeHead(403); res.end()
          return
        }

        const callSid = params.CallSid
        const status  = params.RecordingStatus
        const recordingUrl = params.RecordingUrl
        if (status === 'completed' && callSid && recordingUrl) {
          await updateCallLogRecording(callSid, `${recordingUrl}.mp3`)
          console.log(`[RecordingStatus] ${callSid} → recording saved`)
        }
        res.writeHead(204); res.end()
      })
      return
    }

    // ── Auth check helper (shared by /call, /warm-trigger, /provision) ────────
    const isAuthed = (authHeader: string) => {
      const secret = process.env.RECEPTION_PROVISION_SECRET
      return !!secret && authHeader === `Bearer ${secret}`
    }

    // ── Outbound call: POST /call ─────────────────────────────────────────────
    // Body: { to, configId, from? }
    if (req.method === 'POST' && url.pathname === '/call') {
      if (!isAuthed(req.headers.authorization ?? '')) { res.writeHead(401); res.end('Unauthorized'); return }

      let body = ''
      req.on('data', c => { body += c })
      req.on('end', async () => {
        try {
          const { to, configId, from } = JSON.parse(body)
          if (!to || !configId) { res.writeHead(400); res.end(JSON.stringify({ error: 'to and configId required' })); return }
          const result = await initiateCall({ to, configId, from })
          if (!result.ok) { res.writeHead(500); res.end(JSON.stringify({ error: result.error })); return }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(result))
        } catch (e: any) {
          console.error('[Server] /call error:', e.message)
          res.writeHead(500); res.end(JSON.stringify({ error: e.message }))
        }
      })
      return
    }

    // ── Warm trigger: POST /warm-trigger ──────────────────────────────────────
    // Called when lead clicks email link, replies to SMS, or submits form.
    // Fires outbound call within seconds; relay uses outbound-aware greeting.
    // Body: { to, configId, leadName?, demoUrl?, triggerType?, from? }
    if (req.method === 'POST' && url.pathname === '/warm-trigger') {
      if (!isAuthed(req.headers.authorization ?? '')) { res.writeHead(401); res.end('Unauthorized'); return }

      let body = ''
      req.on('data', c => { body += c })
      req.on('end', async () => {
        try {
          const { to, configId, leadName, demoUrl, triggerType, from } = JSON.parse(body)
          if (!to || !configId) { res.writeHead(400); res.end(JSON.stringify({ error: 'to and configId required' })); return }

          const result = await initiateCall({ to, configId, from, meta: { configId, leadName, demoUrl, triggerType, isOutbound: true } })
          if (!result.ok) { res.writeHead(500); res.end(JSON.stringify({ error: result.error })); return }

          console.log(`[WarmTrigger] ${triggerType ?? 'unknown'} → calling ${to}${leadName ? ` (${leadName})` : ''}`)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(result))
        } catch (e: any) {
          console.error('[Server] /warm-trigger error:', e.message)
          res.writeHead(500); res.end(JSON.stringify({ error: e.message }))
        }
      })
      return
    }

    // ── Provision: POST /provision ────────────────────────────────────────────
    if (req.method === 'POST' && url.pathname === '/provision') {
      if (!isAuthed(req.headers.authorization ?? '')) { res.writeHead(401); res.end('Unauthorized'); return }

      let body = ''
      req.on('data', c => { body += c })
      req.on('end', async () => {
        try {
          const { websiteUrl: suppliedWebsite, businessName, leadId, phone, email, industry, city, paymentConfirmed } = JSON.parse(body)
          if (!leadId || !businessName) { res.writeHead(400); res.end(JSON.stringify({ error: 'leadId and businessName required' })); return }
          const websiteUrl = suppliedWebsite || `https://onboarding.webcrew.app/client/${leadId}`

          // Idempotency: an Admin retry must reuse the same receptionist and
          // Twilio number instead of purchasing another number.
          const existing = await getReceptionConfig(websiteUrl)
          if (existing?.twilio_phone) {
            const messaging = paymentConfirmed === true
              ? await ensureTwilioNumberMessagingReady(existing.twilio_phone)
              : { messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID ?? null, messagingReady: false }
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
              ok: true, reused: true, configId: existing.id,
              businessName: existing.business_name, twilioNumber: existing.twilio_phone,
              twilioWebhook: `${BASE_URL}/voice/${existing.id}`,
              ...messaging,
              forwardingNote: `Client forwards their business number to: ${existing.twilio_phone}`,
            }))
            return
          }

          console.log(`[Provision] Building reception brain for: ${websiteUrl}`)
          // WebCrew's own number uses a hand-crafted sales prompt, not a scraped brain
          const isWebCrew    = websiteUrl.replace(/\/$/, '') === WEBCREW_URL
          const isPlaceholder = !suppliedWebsite
          const brain        = isWebCrew
            ? { name: 'WebCrew', type: 'AI web agency', email: 'hello@webcrew.app', hours: {}, services: [], faqs: [] } as unknown as import('./types.js').BusinessBrain
            : isPlaceholder
              ? { name: businessName, type: industry || 'local business', phone: phone || undefined, email: email || undefined, address: city || undefined, hours: {}, services: [], faqs: [], special_notes: 'New client onboarding is incomplete. Capture caller details accurately and escalate any unanswered business-specific question for human follow-up.' } as unknown as import('./types.js').BusinessBrain
              : await buildBrain(websiteUrl)
          const systemPrompt = isWebCrew ? WEBCREW_SYSTEM_PROMPT : buildSystemPrompt(brain)
          const config       = await saveReceptionConfig(websiteUrl, businessName ?? brain.name, brain, systemPrompt, leadId)
          const webhookUrl   = `${BASE_URL}/voice/${config.id}`

          console.log(`[Provision] Done: ${config.business_name} | ${config.id}`)
          console.log(`[Provision] Twilio webhook: ${webhookUrl}`)

          // Auto-buy a local Twilio number and wire it to this config
          let twilioNumber: string | null = null
          let twilioSid: string | null = null
          let messagingServiceSid: string | null = null
          let messagingReady = false
          try {
            if (paymentConfirmed !== true) {
              throw new Error('Stripe payment confirmation is required before purchasing a Twilio number')
            }
            const result = await buyLocalTwilioNumber(brain.phone ?? null, webhookUrl, config.id, config.business_name)
            if (result) {
              twilioNumber = result.phoneNumber
              twilioSid    = result.sid
              messagingServiceSid = result.messagingServiceSid
              messagingReady = result.messagingReady
              await updateTwilioPhone(config.id, twilioNumber)
              console.log(`[Provision] Twilio number provisioned: ${twilioNumber}`)
            }
          } catch (e: any) {
            console.warn(`[Provision] Twilio number buy failed (non-fatal): ${e.message}`)
          }

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            ok: true,
            configId:      config.id,
            businessName:  config.business_name,
            twilioWebhook: webhookUrl,
            twilioNumber,   // local number to give to client for call forwarding
            twilioSid,
            messagingServiceSid,
            messagingReady,
            forwardingNote: twilioNumber
              ? `Client forwards their business number to: ${twilioNumber}`
              : 'Twilio number not provisioned — set webhook manually',
            servicesCount: brain.services.length,
            faqsCount:     brain.faqs.length,
          }))
        } catch (e: any) {
          console.error('[Provision] Error:', e.message)
          res.writeHead(500); res.end(JSON.stringify({ error: e.message }))
        }
      })
      return
    }

    // ── Pipeline trigger: POST /pipeline-trigger ──────────────────────────────
    // Body: { leadId, niche?, config? }
    // Kicks off full pipeline for an existing DB lead (skips lead-hunter).
    if (req.method === 'POST' && url.pathname === '/pipeline-trigger') {
      if (!isAuthed(req.headers.authorization ?? '')) { res.writeHead(401); res.end('Unauthorized'); return }

      let body = ''
      req.on('data', c => { body += c })
      req.on('end', async () => {
        try {
          const { leadId, config } = JSON.parse(body)
          if (!leadId) { res.writeHead(400); res.end(JSON.stringify({ error: 'leadId required' })); return }

          // Return immediately — pipeline runs async in background
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true, leadId, message: 'Pipeline started' }))

          // Fire-and-forget
          const { runPipelineForLead } = await import('../orchestrator.js')
          runPipelineForLead(leadId, config ?? {}).catch((e: any) => {
            console.error(`[PipelineTrigger] Failed for ${leadId}:`, e.message)
          })
        } catch (e: any) {
          console.error('[Server] /pipeline-trigger error:', e.message)
          if (!res.headersSent) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })) }
        }
      })
      return
    }

    // ── Retention: POST /retention ────────────────────────────────────────────
    // Called daily by GCP Cloud Scheduler at 7am PST.
    if (req.method === 'POST' && url.pathname === '/retention') {
      if (!isAuthed(req.headers.authorization ?? '')) { res.writeHead(401); res.end('Unauthorized'); return }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, message: 'Retention run started' }))

      import('../scripts/run-retention-all.js').catch(() =>
        import('../retention.js').then(({ default: runRetention }) => runRetention())
      ).catch((e: any) => console.error('[Retention] failed:', e.message))
      return
    }

    // ── Drip follow-up: POST /drip ────────────────────────────────────────────
    // Called daily at 9am PST. Day-3 + Day-10 follow-ups for non-replying leads.
    if (req.method === 'POST' && url.pathname === '/drip') {
      if (!isAuthed(req.headers.authorization ?? '')) { res.writeHead(401); res.end('Unauthorized'); return }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, message: 'Drip run started' }))

      import('../scripts/drip-followup.js').catch((e: any) =>
        console.error('[Drip] Import failed:', e.message)
      )
      return
    }

    // ── Review requests: POST /review-requests ────────────────────────────────
    // Called hourly. Sends review SMS 60min after appointment ends.
    if (req.method === 'POST' && url.pathname === '/review-requests') {
      if (!isAuthed(req.headers.authorization ?? '')) { res.writeHead(401); res.end('Unauthorized'); return }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, message: 'Review requests run started' }))

      import('../scripts/send-review-requests.js').catch((e: any) =>
        console.error('[ReviewReq] Import failed:', e.message)
      )
      return
    }

    // ── CRM: GET /crm/contacted?o=<opportunityId>&t=<token> ───────────────────
    // One-tap link in owner lead alerts. Signed (HMAC), idempotent, and only
    // moves an unanswered card to "contacted".
    if (req.method === 'GET' && url.pathname === '/crm/contacted') {
      const oppId = url.searchParams.get('o') ?? ''
      const token = url.searchParams.get('t') ?? ''
      const page = (title: string, body: string) => `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 20px;text-align:center"><h2>${title}</h2><p>${body}</p></body>`
      if (!/^[0-9a-f-]{36}$/i.test(oppId) || !verifyOpportunityToken(oppId, token)) {
        res.writeHead(403, { 'Content-Type': 'text/html' }); res.end(page('Link not valid', 'This link is invalid or has been altered.')); return
      }
      const result = await markContacted(oppId)
      res.writeHead(result.ok ? 200 : 404, { 'Content-Type': 'text/html' })
      res.end(result.ok ? page('Marked as contacted', `Thanks — ${xmlEscape(result.business ?? 'this lead')} is marked as contacted and reminders are cleared.`) : page('Lead not found', 'We could not find this lead.'))
      return
    }

    // ── Follow-ups: POST /follow-ups/run ──────────────────────────────────────
    // Drains due appointment reminders + owner callback nudges. Idempotent
    // (rows are claimed with SKIP LOCKED), so any scheduler can hit it.
    if (req.method === 'POST' && url.pathname === '/follow-ups/run') {
      if (!isAuthed(req.headers.authorization ?? '')) { res.writeHead(401); res.end('Unauthorized'); return }
      try {
        const totals = await runDueFollowUps()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, ...totals }))
      } catch (e: any) {
        console.error('[FollowUps] run failed:', e.message)
        res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // ── Preview cleanup: POST /preview/cleanup ─────────────────────────────────
    // Deletes expired anonymous "paste your URL" preview rows (48h TTL) — never
    // touches a real client's permanent reception config. Meant for a daily
    // Cloud Scheduler hit, same auth pattern as /follow-ups/run above.
    if (req.method === 'POST' && url.pathname === '/preview/cleanup') {
      if (!isAuthed(req.headers.authorization ?? '')) { res.writeHead(401); res.end('Unauthorized'); return }
      try {
        const result = await cleanupExpiredPreviews()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, ...result }))
      } catch (e: any) {
        console.error('[Preview Cleanup] run failed:', e.message)
        res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    res.writeHead(404); res.end('Not found')
  })

  // `{ server, path }` mode can't be used twice on one http.Server — each
  // instance's handleUpgrade fires for every upgrade regardless of path, and
  // aborts with 400 if it doesn't own that path, racing whichever instance
  // was registered first. Use noServer + manual dispatch on one 'upgrade'
  // listener instead (the pattern ws's own docs recommend for multiple paths).
  const wss = new WebSocketServer({ noServer: true })
  attachTwilioRelay(wss)

  const widgetWss = new WebSocketServer({ noServer: true })
  attachWidgetRelay(widgetWss)

  server.on('upgrade', (req, socket, head) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
    } else if (pathname === '/widget-ws') {
      widgetWss.handleUpgrade(req, socket, head, (ws) => widgetWss.emit('connection', ws, req))
    } else {
      socket.destroy()
    }
  })

  server.listen(PORT, () => {
    console.log(`\n[Reception Server] Running on port ${PORT}`)
    console.log(`  Health:       GET  ${BASE_URL}/health`)
    console.log(`  Inbound:      POST ${BASE_URL}/voice/:configId`)
    console.log(`  Stream:       WS   ${BASE_URL.replace('http', 'ws')}/ws`)
    console.log(`  Widget:       WS   ${BASE_URL.replace('http', 'ws')}/widget-ws`)
    console.log(`  Widget script: GET ${BASE_URL}/widget.js`)
    console.log(`  Preview start: POST ${BASE_URL}/preview/start`)
    console.log(`  Preview clean: POST ${BASE_URL}/preview/cleanup`)
    console.log(`  Outbound:     POST ${BASE_URL}/call`)
    console.log(`  Warm trigger: POST ${BASE_URL}/warm-trigger`)
    console.log(`  Provision:    POST ${BASE_URL}/provision\n`)
  })

  return server
}

// ─── Shared outbound call initiator ──────────────────────────────────────────

interface InitiateCallOpts {
  to: string
  configId: string
  from?: string
  meta?: import('./call-context.js').CallMeta
}

async function initiateCall(opts: InitiateCallOpts): Promise<{ ok: boolean; callSid?: string; to?: string; from?: string; status?: string; error?: string }> {
  const sid  = process.env.TWILIO_ACCOUNT_SID
  const auth = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !auth) return { ok: false, error: 'Twilio credentials not configured' }

  const fromNumber = opts.from ?? process.env.TWILIO_PHONE_NUMBER
  if (!fromNumber) return { ok: false, error: 'from number required (or set TWILIO_PHONE_NUMBER)' }

  const voiceUrl = new URL(`${BASE_URL}/voice/${opts.configId}`)
  if (opts.meta?.isOutbound) voiceUrl.searchParams.set('outbound', '1')
  if (opts.meta?.leadName) voiceUrl.searchParams.set('leadName', opts.meta.leadName)
  if (opts.meta?.demoUrl) voiceUrl.searchParams.set('demoUrl', opts.meta.demoUrl)
  if (opts.meta?.triggerType) voiceUrl.searchParams.set('triggerType', opts.meta.triggerType)

  const statusUrl = new URL(`${process.env.API_BASE_URL ?? 'https://api.webcrew.app'}/call-status`)
  statusUrl.searchParams.set('configId', opts.configId)
  statusUrl.searchParams.set('biz', 'WebCrew')
  statusUrl.searchParams.set('flow', 'outbound_outreach')

  const callBody = new URLSearchParams({
    To:                        opts.to,
    From:                      fromNumber,
    Url:                       voiceUrl.toString(),
    Method:                    'POST',
    StatusCallback:            statusUrl.toString(),
    StatusCallbackMethod:      'POST',
    StatusCallbackEvent:       'initiated ringing answered completed',
    MachineDetection:          'Enable',
    AsyncAmdStatusCallback:    `${BASE_URL}/amd-status?configId=${encodeURIComponent(opts.configId)}`,
    AsyncAmdStatusCallbackMethod: 'POST',
  })

  const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
    method:  'POST',
    headers: {
      Authorization:  `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: callBody.toString(),
  })

  const result = await twilioRes.json() as any
  if (!twilioRes.ok) return { ok: false, error: result.message ?? 'Twilio call failed' }

  // Store metadata for AMD callback and relay greeting
  callMeta.set(result.sid, opts.meta ?? { configId: opts.configId })
  console.log(`[Server] Outbound call → ${opts.to} | SID: ${result.sid}`)

  return { ok: true, callSid: result.sid, to: opts.to, from: fromNumber, status: result.status }
}

// ─── Auto-provision Twilio local number ───────────────────────────────────────
// Buys a local US number matching the business area code, wires voice webhook.
// Returns null if Twilio creds not set or no numbers available.

async function buyLocalTwilioNumber(
  businessPhone: string | null,
  voiceWebhookUrl: string,
  configId: string,
  businessName: string
): Promise<{ phoneNumber: string; sid: string; messagingServiceSid: string | null; messagingReady: boolean } | null> {
  const sid  = process.env.TWILIO_ACCOUNT_SID
  const auth = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !auth) return null

  // Extract area code from business phone (US: +1AAANXXXXXX → AAA)
  const areaCode = businessPhone?.replace(/\D/g, '').slice(-10, -7) ?? null
  const base = `https://api.twilio.com/2010-04-01/Accounts/${sid}`
  const headers = { Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}` }

  // Search for available local numbers (area code match first, fallback to any US)
  const searchUrl = areaCode
    ? `${base}/AvailablePhoneNumbers/US/Local.json?AreaCode=${areaCode}&VoiceEnabled=true&Limit=1`
    : `${base}/AvailablePhoneNumbers/US/Local.json?VoiceEnabled=true&InRegion=CA&Limit=1`

  const searchRes = await fetch(searchUrl, { headers })
  const searchData = await searchRes.json() as any
  const available  = searchData.available_phone_numbers ?? []
  if (!available.length) {
    // Fallback: any US number
    const fallback = await fetch(`${base}/AvailablePhoneNumbers/US/Local.json?VoiceEnabled=true&Limit=1`, { headers })
    const fd = await fallback.json() as any
    available.push(...(fd.available_phone_numbers ?? []))
  }
  if (!available.length) throw new Error('No available Twilio numbers found')

  const numberToBuy = available[0].phone_number

  // Missed-call recovery (api/src/index.ts handleCallStatus) needs this fired
  // on no-answer/busy/failed — without it, calls that never reach the AI are
  // never followed up.
  const statusCallbackUrl = new URL(`${process.env.API_BASE_URL ?? 'https://api.webcrew.app'}/call-status`)
  statusCallbackUrl.searchParams.set('configId', configId)
  statusCallbackUrl.searchParams.set('biz', businessName)
  statusCallbackUrl.searchParams.set('flow', 'inbound')

  // Buy the number and set the voice + status-callback webhooks
  const buyRes = await fetch(`${base}/IncomingPhoneNumbers.json`, {
    method:  'POST',
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      PhoneNumber:          numberToBuy,
      VoiceUrl:             voiceWebhookUrl,
      VoiceFallbackUrl:     process.env.VOICE_FALLBACK_URL ?? 'https://api.webcrew.app/voice-fallback',
      VoiceFallbackMethod:  'POST',
      VoiceMethod:          'POST',
      StatusCallback:       statusCallbackUrl.toString(),
      StatusCallbackMethod: 'POST',
    }).toString(),
  })
  const bought = await buyRes.json() as any
  if (!buyRes.ok) throw new Error(bought?.message ?? 'Twilio buy failed')

  // All WebCrew-branded messaging numbers share the verified WebCrew sender
  // pool. This happens only after the caller has passed the Stripe payment gate.
  const { messagingServiceSid, messagingReady } = await attachTwilioNumberToMessagingService(bought.sid, headers)

  return { phoneNumber: bought.phone_number, sid: bought.sid, messagingServiceSid, messagingReady }
}

async function attachTwilioNumberToMessagingService(
  phoneNumberSid: string,
  headers: Record<string, string>
): Promise<{ messagingServiceSid: string | null; messagingReady: boolean }> {
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID ?? null
  if (!messagingServiceSid) {
    console.warn('[Provision] TWILIO_MESSAGING_SERVICE_SID is not configured; SMS remains pending')
    return { messagingServiceSid: null, messagingReady: false }
  }
  const attachRes = await fetch(
    `https://messaging.twilio.com/v1/Services/${messagingServiceSid}/PhoneNumbers`,
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ PhoneNumberSid: phoneNumberSid }).toString(),
    }
  )
  if (attachRes.ok) return { messagingServiceSid, messagingReady: true }
  const error = await attachRes.json().catch(() => ({})) as any
  if (error?.code === 21710 || /already exists/i.test(error?.message ?? '')) {
    return { messagingServiceSid, messagingReady: true }
  }
  console.warn(`[Provision] Messaging Service association failed: ${error?.message ?? attachRes.status}`)
  return { messagingServiceSid, messagingReady: false }
}

async function ensureTwilioNumberMessagingReady(phoneNumber: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const auth = process.env.TWILIO_AUTH_TOKEN
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID ?? null
  if (!sid || !auth || !messagingServiceSid) return { messagingServiceSid, messagingReady: false }
  const headers = { Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}` }
  const lookup = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumber)}&PageSize=1`,
    { headers }
  )
  const data = await lookup.json() as any
  const phoneSid = data?.incoming_phone_numbers?.[0]?.sid
  if (!lookup.ok || !phoneSid) return { messagingServiceSid, messagingReady: false }
  return attachTwilioNumberToMessagingService(phoneSid, headers)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractFormParam(body: string, param: string): string {
  try {
    const decoded = decodeURIComponent(body.replace(/\+/g, ' '))
    const match   = decoded.match(new RegExp(`(?:^|&)${param}=([^&]*)`, 'i'))
    return match?.[1] ?? ''
  } catch {
    return ''
  }
}
