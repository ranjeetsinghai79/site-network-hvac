import type { WebSocketServer } from 'ws'
import WebSocket from 'ws'
import { GeminiLiveSession } from './gemini-live.js'
import { twilioToGeminiAudio, geminiToTwilioAudio } from './audio-codec.js'
import { getReceptionConfigById, insertCallLog, upsertReceptionLead, startEmailVerification, getVerifiedEmail, getMonthlyVoiceMinutes, markCapAlertSent, updateCallLogInsights, updateCallLogClassification, isTrialStartRateLimited } from './db.js'
import { getAvailableSlots, createBooking } from './cal-booking.js'
import { last10 } from './client-comms.js'
import { looksLikeRobocall } from './call-screen.js'
import { ClientCallSession, isClientConfig, buildClientRuntimeAddendum, clientClosingWasSpoken, generateClientCallInsights } from './client-tools.js'
import { callMeta } from './call-context.js'
import { logCost } from '../tools/cost-tracker.js'
import { hasSpeechEnergy, isValidEmail, callerSaidDone, closingWasSpoken, notifyOwner, sendCallerConfirmationSMS, sendBookingConfirmationSMS, sendCallerConfirmationEmail, sendCallSummary, generateCallInsights, createTrialCheckoutLink, sendTrialCheckoutSMS, mergeTranscript } from './relay-shared.js'
import { getReceptionPricingToolResponse } from './reception-contract.js'
import { redirectCallToVoiceFallback, withTimeout } from './call-fallback.js'

const CAL_EVENT_TYPE_ID = parseInt(process.env.CAL_EVENT_TYPE_ID ?? '6126925')
const CAL_TIMEZONE      = process.env.CAL_TIMEZONE ?? 'America/Los_Angeles'
const BASE_URL          = process.env.RECEPTION_BASE_URL ?? 'http://localhost:3030'
const VOICE_CAP_MINUTES = parseInt(process.env.RECEPTION_VOICE_CAP_MINUTES ?? '100')
const GEMINI_RELAY_READY_TIMEOUT_MS = Number(process.env.GEMINI_RELAY_READY_TIMEOUT_MS ?? 6_000)
const GEMINI_FIRST_AUDIO_TIMEOUT_MS = Number(process.env.GEMINI_FIRST_AUDIO_TIMEOUT_MS ?? 6_500)
const GEMINI_TURN_RESPONSE_TIMEOUT_MS = Number(process.env.GEMINI_TURN_RESPONSE_TIMEOUT_MS ?? 10_000)

/** Fire-and-forget internal alert — same raw Resend pattern as agents/leads-agent.ts. */
async function sendCapAlertEmail(businessName: string, configId: string, minutesUsed: number, cap: number): Promise<void> {
  const ownerEmail = process.env.BUSINESS_OWNER_EMAIL
  const apiKey = process.env.RESEND_API_KEY
  if (!ownerEmail || !apiKey) { console.warn('[VoiceCap] alert not sent — BUSINESS_OWNER_EMAIL/RESEND_API_KEY not set'); return }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.OUTREACH_FROM_EMAIL || 'alerts@webcrew.app',
        to: ownerEmail,
        subject: `[Voice cap] ${businessName} used ${minutesUsed}/${cap} min this month`,
        html: `<p><strong>${businessName}</strong> (config ${configId}) has used <strong>${minutesUsed} minutes</strong> of AI Reception voice this month — over the ${cap}-minute included cap.</p><p>No action taken automatically (soft alert only, call was not interrupted). Review usage and confirm an overage agreement if this continues.</p>`,
      }),
    })
  } catch (e: any) {
    console.error('[VoiceCap] alert email failed:', e.message)
  }
}

/** Logs real per-call cost and checks the monthly voice-minute cap. Fire-and-forget — never blocks call teardown. */
async function trackCallCostAndCap(configId: string, businessName: string, leadId: string | null | undefined, leadName: string, durationSec: number): Promise<void> {
  const minutes = durationSec / 60
  // pipeline_costs.units is an integer and Twilio bills voice in rounded call
  // increments. Store whole billed minutes instead of rejecting fractional
  // minutes and losing the usage record entirely.
  const billedMinutes = Math.max(1, Math.ceil(minutes))
  await Promise.all([
    logCost({ service: 'twilio_voice_leg', units: billedMinutes, leadId: leadId ?? undefined, leadName, note: `config ${configId}; ${durationSec}s actual` }),
    logCost({ service: 'gemini_live_voice', units: billedMinutes, leadId: leadId ?? undefined, leadName, note: `config ${configId}; ${durationSec}s actual`, force: true }),
  ]).catch(e => console.error('[VoiceCap] cost logging failed:', e.message))

  try {
    const monthlyMinutes = await getMonthlyVoiceMinutes(configId)
    if (monthlyMinutes > VOICE_CAP_MINUTES) {
      const firstAlertThisMonth = await markCapAlertSent(configId, monthlyMinutes)
      if (firstAlertThisMonth) await sendCapAlertEmail(businessName, configId, monthlyMinutes, VOICE_CAP_MINUTES)
    }
  } catch (e: any) {
    console.error('[VoiceCap] cap check failed:', e.message)
  }
}

function normalizeCallerPhone(value: string | null): string | null {
  if (!value || value.startsWith('client:')) return null
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 ? `+1${digits.slice(-10)}` : null
}

// Bridges Twilio Media Streams ↔ Gemini Live
// Flow: inbound call → TwiML <Stream> → WebSocket here → Gemini Live → audio back to Twilio

export function attachTwilioRelay(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req) => {
    const params = new URL(req.url ?? '/', 'http://localhost').searchParams
    let configId = params.get('config')

    let gemini: GeminiLiveSession | null = null
    let streamSid: string | null = null
    let callSid: string | null = null
    let callerPhone: string | null = null
    let configData: Awaited<ReturnType<typeof getReceptionConfigById>> = null
    let callStart: number = Date.now()
    let transcript: string[] = []
    let escalated = false
    let takenMessage: string | undefined
    let greetingReady = false
    let callEnding = false
    let callerAudioReceived = false  // true only after real caller audio bytes arrive
    let callLeadId: string | undefined
    let callerUtterance = ''
    let latestCallerTurn = ''
    // Transcription arrives in word-sized fragments, so a lone "yes" can be split
    // from the phrase around it. Confirmations are judged on the last ~12s of caller speech.
    const callerChunks: Array<{ t: number; text: string }> = []
    const recentCallerSpeech = () => {
      const cutoff = Date.now() - 12_000
      return callerChunks.filter(c => c.t >= cutoff).map(c => c.text).join(' ').replace(/\s+/g, ' ').trim()
    }
    let aiSinceLastCaller = ''
    let leadCaptured = false
    // Screening: raw Twilio STIR attestation, whether the caller passed the press-1 gate, and recorded-message detection.
    let stirVerstat: string | null = null
    let gatePassed = false
    let robocallDetected = false
    let bookingOfferSpoken = false
    let appointmentBooked = false
    // Set for a paying client's line (not WebCrew's own sales line). Owns the
    // client tool set, per-client calendar, and CRM writes for this call.
    let clientSession: ClientCallSession | null = null
    let verifiedSmsEmail: string | null = null
    let emailVerificationPolling = false
    let pricingLookupCompleted = false
    // TCPA disclosure ("Message and data rates may apply. Reply STOP...")
    // only needs to be read once per call, not before every text sent.
    let smsDisclosureGiven = false
    let transferTimer: ReturnType<typeof setTimeout> | null = null
    let firstAudioTimer: ReturnType<typeof setTimeout> | null = null
    let turnResponseTimer: ReturnType<typeof setTimeout> | null = null
    let fallbackStarted = false
    let aiAudioReceived = false
    let recoveryAttempt = 0
    let responsePendingSince: number | null = null
    let trialCheckoutSent = false
    let mediaFramesReceived = 0
    let speechFramesReceived = 0
    let queuedFramesTotal = 0
    const pendingCallerAudio: string[] = []
    const MAX_PENDING_AUDIO_FRAMES = 150 // latest ~3 seconds at Twilio's 20ms cadence

    // Idle detection — prompt caller after silence, end call if no response
    let idleTimer: ReturnType<typeof setTimeout> | null = null
    const IDLE_WARN_MS = Number(process.env.CALLER_IDLE_CHECKIN_MS ?? 30_000)
    const IDLE_END_MS  = Number(process.env.CALLER_IDLE_CLOSE_MS ?? 60_000)
    const SPEECH_RMS_THRESHOLD = Number(process.env.CALLER_SPEECH_RMS_THRESHOLD ?? 350)

    function clearIdle() {
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
    }

    function scheduleIdle() {
      clearIdle()
      idleTimer = setTimeout(() => {
        if (callEnding) return
        gemini?.sendText('The caller has been silent. Briefly ask if they are still there, then wait without ending the call.')
        idleTimer = setTimeout(() => {
          if (callEnding) return
          gemini?.sendText('The caller has remained silent after a check-in. Say a warm goodbye, invite them to call back anytime, then use the end_call tool.')
        }, IDLE_END_MS)
      }, IDLE_WARN_MS)
    }

    // Twilio keepalive — send mark event every 30s to prevent 60s WebSocket timeout
    let twilioKeepalive: ReturnType<typeof setInterval> | null = null

    function startTwilioKeepalive() {
      twilioKeepalive = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN || !streamSid || callEnding) return
        ws.send(JSON.stringify({ event: 'mark', streamSid, mark: { name: 'keepalive' } }))
      }, 30_000)
    }

    function stopAll() {
      clearIdle()
      if (transferTimer) { clearTimeout(transferTimer); transferTimer = null }
      if (firstAudioTimer) { clearTimeout(firstAudioTimer); firstAudioTimer = null }
      if (turnResponseTimer) { clearTimeout(turnResponseTimer); turnResponseTimer = null }
      if (twilioKeepalive) { clearInterval(twilioKeepalive); twilioKeepalive = null }
    }

    function scheduleTurnResponseDeadline(isOutbound = false) {
      if (!greetingReady || callEnding || fallbackStarted) return
      if (turnResponseTimer) clearTimeout(turnResponseTimer)
      turnResponseTimer = setTimeout(() => {
        turnResponseTimer = null
        void startVoiceFallback('gemini_turn_response_timeout', isOutbound)
      }, GEMINI_TURN_RESPONSE_TIMEOUT_MS)
    }

    function forwardCallerAudio(payload: string) {
      if (!gemini || !payload || callEnding) return
      const pcm16 = twilioToGeminiAudio(payload)
      if (hasSpeechEnergy(pcm16, SPEECH_RMS_THRESHOLD)) {
        callerAudioReceived = true
        speechFramesReceived++
        scheduleIdle()
      }
      gemini.sendAudio(pcm16)
    }

    function flushPendingCallerAudio() {
      if (!greetingReady || !gemini || pendingCallerAudio.length === 0) return
      const buffered = pendingCallerAudio.splice(0)
      console.log(`[Relay] Forwarding ${buffered.length} buffered caller-audio frames`)
      for (const payload of buffered) forwardCallerAudio(payload)
    }

    async function startVoiceFallback(reason: string, isOutbound = false) {
      if (fallbackStarted || callEnding) return
      fallbackStarted = true
      callEnding = true
      stopAll()
      gemini?.close()
      gemini = null

      if (!callSid || !configId) {
        console.error(`[Fallback] Cannot recover live call: callSid=${callSid ?? 'missing'} configId=${configId ?? 'missing'} reason=${reason}`)
        ws.close()
        return
      }

      // Keep the experience native-audio only. A bounded reconnect avoids an
      // infinite loop if Gemini itself is unavailable across fresh sessions.
      if (recoveryAttempt >= 2) {
        console.error(`[Recovery] Gemini recovery exhausted for ${callSid} | reason=${reason}`)
        ws.close()
        return
      }

      const redirected = await redirectCallToVoiceFallback({
        callSid,
        configId,
        mode: isOutbound ? 'outbound' : 'inbound',
        reason,
        recoveryAttempt: recoveryAttempt + 1,
      })
      if (!redirected) ws.close()
    }

    ws.on('message', async (raw: Buffer) => {
      let msg: any
      try { msg = JSON.parse(raw.toString()) } catch { return }

      switch (msg.event) {
        case 'connected':
          console.log(`[Relay] Twilio connected — config: ${configId}`)
          break

        case 'start': {
          streamSid   = msg.start?.streamSid ?? null
          callSid     = msg.start?.callSid ?? null
          callerPhone = normalizeCallerPhone(msg.start?.customParameters?.caller ?? null)
          stirVerstat = msg.start?.customParameters?.stir || null
          gatePassed  = msg.start?.customParameters?.gate === '1'
          robocallDetected = false
          if (!configId) configId = msg.start?.customParameters?.config ?? null

          if (!configId) {
            console.error('[Relay] No configId in start event — missing <Parameter name="config">')
            ws.close()
            return
          }

          callStart = Date.now()
          transcript = []
          escalated = false
          takenMessage = undefined
          greetingReady = false
          callEnding = false
          fallbackStarted = false
          aiAudioReceived = false
          mediaFramesReceived = 0
          speechFramesReceived = 0
          queuedFramesTotal = 0
          pendingCallerAudio.length = 0

          const streamParams = msg.start?.customParameters ?? {}
          recoveryAttempt = Math.max(0, Number(streamParams.recovery ?? '0') || 0)
          const inProcessMeta = callSid ? callMeta.get(callSid) : undefined
          const meta = inProcessMeta ?? (streamParams.outbound === '1' ? {
            configId,
            isOutbound: true,
            leadName: streamParams.leadName || undefined,
            demoUrl: streamParams.demoUrl || undefined,
            triggerType: streamParams.triggerType || undefined,
          } : undefined)

          // Callbacks defined here — reference outer let-variables by closure
          const callbacks = {
            onReady: async () => {
              // A setup promise can finish just after our caller-experience
              // deadline. The call has already been redirected by then, so do
              // not revive the abandoned Live session or start new timers.
              if (callEnding || fallbackStarted) {
                gemini?.close()
                return
              }
              console.log(`[Relay] Gemini ready — ${configData!.business_name}`)

              // Start call recording via Twilio REST API (works with Media Streams)
              const sid  = process.env.TWILIO_ACCOUNT_SID
              const auth = process.env.TWILIO_AUTH_TOKEN
              if (sid && auth && callSid) {
                fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${callSid}/Recordings.json`, {
                  method:  'POST',
                  headers: {
                    Authorization:  `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                  body: new URLSearchParams({
                    RecordingChannels: 'dual',
                    RecordingStatusCallback: `${BASE_URL}/recording-status`,
                    RecordingStatusCallbackMethod: 'POST',
                    RecordingStatusCallbackEvent: 'completed',
                  }).toString(),
                }).then(r => {
                  if (r.ok) console.log('[Relay] Recording started')
                  else r.json().then((e: any) => console.warn('[Relay] Recording start failed:', e?.message))
                }).catch(e => console.warn('[Relay] Recording start error:', e.message))
              }

              let greeting: string
              if (meta?.isOutbound) {
                const nameCtx  = meta.leadName ? ` You're calling ${meta.leadName}.` : ''
                const demoCtx  = meta.demoUrl  ? ` Their demo site is at ${meta.demoUrl}.` : ''
                const trigCtx  = meta.triggerType === 'email_click'          ? ' They clicked our email, so they showed interest.'
                               : meta.triggerType === 'sms_reply'            ? ' They replied to our SMS, so they showed interest.'
                               : meta.triggerType === 'form_submit'          ? ' They just submitted our contact form.'
                               : meta.triggerType === 'missed_call_callback' ? ' They called a few minutes ago, the call was missed, and they just texted back asking for a callback.'
                               : ''
                greeting = meta.triggerType === 'missed_call_callback'
                  ? `You just placed a callback the caller specifically requested by text a moment ago, after their call to ${configData!.business_name} went unanswered. Introduce yourself as an AI assistant from ${configData!.business_name} and get straight to helping them with whatever they originally called about. Keep it natural and brief.`
                  : `You just placed an outbound call.${nameCtx}${demoCtx}${trigCtx} Introduce yourself warmly as an AI assistant from ${configData!.business_name}, mention you're following up on their interest, and ask how you can help. Keep it natural and brief.`
              } else {
                const phoneCtx = callerPhone ? ` Caller ID from Twilio: ${callerPhone}. Treat it as the callback number, but confirm it with the caller before using it.` : ''
                greeting = recoveryAttempt > 0
                  ? `[CALL RECONNECTED] In your natural voice say: "I'm sorry, I briefly lost the audio connection. I'm back now—please repeat the last thing you said." Then wait.${phoneCtx}`
                  : `[CALL CONNECTED] In your natural voice say: "Thanks for calling ${configData!.business_name}. I'm the AI receptionist. This call may be recorded for quality. How can I help today?" Then wait.${phoneCtx} Do not infer the caller's identity, business, location, or intent from Caller ID or any earlier call.`
              }
              // The very first realtime input sent in the same tick as setupComplete
              // gets silently dropped by Gemini's live backend (confirmed via local
              // testing against the widget path — identical onReady->sendText shape).
              // A short delay before the first send avoids the race.
              setTimeout(() => { gemini?.sendText(greeting) }, 300)
              // Start Twilio keepalive immediately; delay idle detection so the
              // opening question has time to finish playing.
              startTwilioKeepalive()
              setTimeout(() => scheduleIdle(), 12_000)
              firstAudioTimer = setTimeout(() => {
                if (!aiAudioReceived) void startVoiceFallback('gemini_first_audio_timeout', meta?.isOutbound === true)
              }, GEMINI_FIRST_AUDIO_TIMEOUT_MS)
            },

            onClose: () => {
              console.log(`[Relay] Gemini closed`)
              if (!callEnding) void startVoiceFallback('gemini_closed_mid_call', meta?.isOutbound === true)
            },
            onError: (e: Error) => {
              console.error(`[Relay] Gemini error: ${e.message}`)
              if (!callEnding) void startVoiceFallback('gemini_error_mid_call', meta?.isOutbound === true)
            },
            onText:     (text: string) => {
              aiSinceLastCaller += text
              if (leadCaptured && /(?:free\s+)?15[ -]?minute|schedule (?:a )?(?:call|demo)|book (?:a )?(?:call|demo)/i.test(aiSinceLastCaller)) {
                bookingOfferSpoken = true
              }
              transcript.push(`AI: ${text}`)
            },
            onInputText: (text: string) => {
              callerUtterance += text
              latestCallerTurn = text.trim()
              if (/[a-z0-9]/i.test(text)) { callerChunks.push({ t: Date.now(), text: text.trim() }); if (callerChunks.length > 40) callerChunks.shift() }
              if (!robocallDetected && !callEnding && looksLikeRobocall(recentCallerSpeech())) {
                // A recorded message / IVR is on the line, not a person. Drop it now instead of paying for the AI to talk to it.
                robocallDetected = true
                callEnding = true
                stopAll()
                console.log(`[Relay] Robocall/IVR detected from ${callerPhone ?? 'unknown'} — hanging up`)
                void hangUpCall(callSid)
              }
              aiSinceLastCaller = ''
              transcript.push(`Caller: ${text}`)
              responsePendingSince = Date.now()
              if (!/^\s*<noise>\s*$/i.test(text) && /[a-z0-9]/i.test(text)) {
                scheduleTurnResponseDeadline(meta?.isOutbound === true)
              }
              if (transferTimer && /^(?:no|nope|cancel|don't|do not|never mind|nevermind)\b/i.test(latestCallerTurn)) {
                clearTimeout(transferTimer)
                transferTimer = null
                escalated = false
                gemini?.sendText('The caller cancelled the transfer. Acknowledge that briefly, continue helping, and do not end the call.')
              }
            },
            onInterrupted: () => {
              if (ws.readyState === WebSocket.OPEN && streamSid) {
                // Drop audio Twilio already buffered from the interrupted AI
                // turn so the caller is heard immediately.
                ws.send(JSON.stringify({ event: 'clear', streamSid }))
              }
            },

            onAudio: (pcm24Base64: string) => {
              if (ws.readyState !== WebSocket.OPEN || !streamSid || callEnding) return
              if (!aiAudioReceived) {
                aiAudioReceived = true
                // Once Gemini's first native-audio packet proves the turn is
                // active, release audio Twilio delivered during setup/greeting.
                // This preserves barge-in instead of silently discarding it.
                greetingReady = true
                flushPendingCallerAudio()
              }
              if (firstAudioTimer) { clearTimeout(firstAudioTimer); firstAudioTimer = null }
              if (turnResponseTimer) { clearTimeout(turnResponseTimer); turnResponseTimer = null }
              if (responsePendingSince) {
                console.log(`[Relay] Caller-to-AI audio latency: ${Date.now() - responsePendingSince}ms`)
                responsePendingSince = null
              }
              const mulaw = geminiToTwilioAudio(pcm24Base64)
              ws.send(JSON.stringify({ event: 'media', streamSid, media: { payload: mulaw } }))
            },

            onToolCall: async (name: string, args: Record<string, unknown>, callId: string) => {
              console.log(`[Relay] Tool: ${name}`, args)

              if (clientSession) {
                const outcome = await clientSession.handle(name, args, {
                  callerHasSpoken: callerAudioReceived || (Date.now() - callStart) >= 20_000,
                  latestCallerTurn: recentCallerSpeech(),
                })
                if (outcome) {
                  if (outcome.transcriptNote) transcript.push(outcome.transcriptNote)
                  if (clientSession.messageTaken) { takenMessage = clientSession.messageTaken; leadCaptured = true }
                  if (clientSession.bookedThisCall) appointmentBooked = true
                  gemini?.respondToTool(callId, name, outcome.result)
                  return
                }
              }

              if (name === 'get_webcrew_pricing') {
                pricingLookupCompleted = true
                gemini?.respondToTool(callId, name, getReceptionPricingToolResponse())
                return
              }

              if (name === 'build_founder_offer') {
                pricingLookupCompleted = true
                gemini?.respondToTool(callId, name, {
                  success: false,
                  message: 'Discounting and custom packages require a human. Offer a free team consultation; do not quote another price or repeat the sales pitch after a clear refusal.',
                })
                return
              }

              if (name === 'start_trial') {
                const a = args as { caller_confirmed?: boolean; sms_consent_confirmed?: boolean }
                if (a.caller_confirmed !== true) {
                  gemini?.respondToTool(callId, name, { success: false, message: 'Ask the caller to explicitly confirm they want to start the trial right now, then try again with caller_confirmed=true.' })
                  return
                }
                if (a.sms_consent_confirmed !== true) {
                  gemini?.respondToTool(callId, name, {
                    success: false,
                    message: smsDisclosureGiven
                      ? 'You already read the SMS disclosure earlier this call — do not repeat it. Just ask a short yes/no: "Want me to text the trial link now?" Wait for an explicit yes, then try again with sms_consent_confirmed=true.'
                      : 'Read the required SMS disclosure, wait for an explicit yes, then try again with sms_consent_confirmed=true.',
                  })
                  return
                }
                const phone = callerPhone
                if (!phone) {
                  gemini?.respondToTool(callId, name, { success: false, message: 'No callback number is available for this caller. Ask for and confirm a mobile number using take_message instead.' })
                  return
                }
                smsDisclosureGiven = true
                if (await isTrialStartRateLimited(phone)) {
                  trialCheckoutSent = true
                  gemini?.respondToTool(callId, name, { success: true, alreadySent: true, message: 'A trial checkout link was already texted to this number recently. Tell the caller to check their texts — do not send another.' })
                  return
                }
                const leadId = callLeadId ?? await upsertReceptionLead({
                  caller: phone, name: '', configId: configData!.id,
                }) ?? undefined
                if (!leadId) {
                  gemini?.respondToTool(callId, name, { success: false, message: 'Could not start the trial — apologize and offer escalate_to_human instead.' })
                  return
                }
                callLeadId = leadId
                const checkoutUrl = await createTrialCheckoutLink(leadId, configData!.business_name)
                if (!checkoutUrl) {
                  gemini?.respondToTool(callId, name, { success: false, message: 'The checkout link could not be created. Apologize and offer escalate_to_human instead.' })
                  return
                }
                const sent = await sendTrialCheckoutSMS(phone, checkoutUrl)
                trialCheckoutSent = sent
                gemini?.respondToTool(callId, name, {
                  success: sent,
                  message: sent
                    ? 'Tell the caller a text just went out with their trial signup link — card required, nothing charged until the 30-day trial ends.'
                    : 'The text could not be sent. Apologize and offer escalate_to_human instead.',
                })
              }

              if (name === 'escalate_to_human') {
                const a = args as any
                const ownerPhone = clientSession ? await clientSession.resolveEscalationPhone() : configData?.brain?.owner_phone
                if (a.caller_confirmed_transfer !== true || !/\b(?:yes|yeah|yep|please|connect|transfer|human|person|someone)\b/i.test(recentCallerSpeech())) {
                  gemini?.respondToTool(callId, name, { success: false, message: 'Ask whether the caller wants to be transferred now and wait for an explicit yes before trying again.' })
                  return
                }
                if (!clientSession && /pric|cost|discount|negotiat|lowest|cheapest/i.test(String(a.reason ?? '')) && !pricingLookupCompleted) {
                  gemini?.respondToTool(callId, name, { success: false, message: 'First call get_webcrew_pricing and answer the pricing question accurately. Then offer a team call if they want custom commercial help.' })
                  return
                }
                if (!ownerPhone || !callSid) {
                  await notifyOwner('escalation', args as any, configData!, callerPhone)
                  gemini?.respondToTool(callId, name, {
                    success: false,
                    message: clientSession
                      ? 'Live transfer is unavailable right now. Do not say the caller is being connected and do not end the call. Apologize briefly, tell them the team has been alerted, and take their details with take_message so someone calls them back as soon as possible.'
                      : 'Live transfer is unavailable. Do not say the caller is being connected and do not end the call. Apologize briefly, offer to take their details and arrange a free 15-minute team call.',
                  })
                  return
                }
                escalated = true
                transcript.push(`[ESCALATION] ${(args as any).reason ?? ''}`)
                await notifyOwner('escalation', args as any, configData!, callerPhone)
                if (clientSession) void clientSession.onEscalated(String((args as any).reason ?? 'caller requested a person'))
                gemini?.respondToTool(callId, name, {
                  success: true,
                  message: 'I\'m connecting you to a team member now. Please hold for just a moment.',
                })
                transferTimer = setTimeout(() => {
                  transferTimer = null
                  void liveTransfer(callSid!, ownerPhone)
                }, 4000)
                return
              }

              if (name === 'take_message') {
                // Block fake take_message calls before caller has spoken
                if (!callerAudioReceived && (Date.now() - callStart) < 20_000) {
                  console.log('[Relay] take_message BLOCKED — caller has not spoken yet')
                  gemini?.respondToTool(callId, name, {
                    success: false,
                    message: 'The caller is still on the line and has not spoken yet. Continue the conversation — ask your opening question and wait for their reply.',
                  })
                  return
                }
                const a = args as any
                const email = (verifiedSmsEmail ?? String(a.caller_email ?? '')).trim()
                if (!isValidEmail(email)) {
                  console.log(`[Relay] take_message BLOCKED — invalid email: ${email || 'missing'}`)
                  gemini?.respondToTool(callId, name, {
                    success: false,
                    message: 'The email is incomplete or invalid. Ask the caller for the full address including the domain (for example, name at gmail dot com), spell the complete address back, and wait for confirmation before trying again.',
                  })
                  return
                }
                if (!verifiedSmsEmail && a.email_confirmed !== true) {
                  console.log('[Relay] take_message BLOCKED — email was not confirmed')
                  gemini?.respondToTool(callId, name, {
                    success: false,
                    message: 'Spell the complete email address back to the caller, including at and the domain, and wait for an explicit confirmation before trying again with email_confirmed=true.',
                  })
                  return
                }
                if (a.business_name_confirmed !== true || !String(a.business_name ?? '').trim()) {
                  console.log('[Relay] take_message BLOCKED — business name was not confirmed')
                  gemini?.respondToTool(callId, name, {
                    success: false,
                    message: 'Ask for the actual business name and wait for the caller to confirm it. Do not invent a generic name from their industry. Then try again with business_name_confirmed=true.',
                  })
                  return
                }
                if (String(a.appointment_intent ?? '').toLowerCase() === 'booked' && !appointmentBooked) {
                  console.log('[Relay] take_message BLOCKED — appointment marked booked without a booking')
                  gemini?.respondToTool(callId, name, {
                    success: false,
                    message: 'No appointment has been booked. Use appointment_intent="wants_to_book" or "not_decided" as accurate. Only a successful book_appointment tool call creates a booking.',
                  })
                  return
                }
                if (a.sms_consent_answered !== true) {
                  console.log('[Relay] take_message BLOCKED — SMS consent question not answered')
                  gemini?.respondToTool(callId, name, {
                    success: false,
                    message: smsDisclosureGiven
                      ? 'You already read the SMS disclosure earlier this call — do not repeat it. Just ask a short yes/no for this confirmation text, wait for a clear answer, then try again with sms_consent_answered=true.'
                      : 'You have not completed the SMS consent question. Read the required disclosure, wait for a clear yes or no, then try again with sms_consent_answered=true.',
                  })
                  return
                }
                smsDisclosureGiven = true
                takenMessage = a.message ?? ''
                transcript.push(`[MESSAGE] ${takenMessage}`)
                callLeadId = await upsertReceptionLead({
                  caller: callerPhone ?? a.caller_phone ?? '',
                  name: a.caller_name ?? '',
                  email,
                  niche: a.niche ?? a.industry,
                  configId: configData!.id,
                  notes: takenMessage,
                  smsConsent: a.sms_consent === true,
                }) ?? undefined
                await notifyOwner('message', a, configData!, callerPhone)

                // Send confirmation SMS + email to caller. Prefer the real, carrier-
                // verified caller ID over whatever Gemini claims — it can't be
                // fabricated. Only fall back to Gemini's stated number (no caller ID,
                // e.g. blocked/unknown) if it was actually read back and confirmed.
                const destPhone = callerPhone ?? (a.caller_phone_confirmed === true ? a.caller_phone : undefined)
                const destEmail = email
                const callerName = a.caller_name ?? 'there'
                // Run concurrently, not sequentially — Gemini can't speak again
                // until this tool responds, so two back-to-back external API
                // calls here is dead air on the call.
                const [smsSent, emailSent] = await Promise.all([
                  destPhone && a.sms_consent === true ? sendCallerConfirmationSMS(destPhone, callerName, configData!.business_name) : Promise.resolve(false),
                  destEmail ? sendCallerConfirmationEmail(destEmail, callerName, configData!.business_name) : Promise.resolve(false),
                ])

                console.log(`[Relay] Caller confirmations — SMS: ${smsSent}, Email: ${emailSent}`)
                leadCaptured = true

                const requestedNextAction = String(a.requested_next_action ?? 'none').toLowerCase()
                const nextStep = requestedNextAction === 'start_trial'
                  ? `Lead recorded. SMS sent: ${smsSent}. Email sent: ${emailSent}. The caller already agreed to start the trial. Do not offer a consultation. You already read the SMS disclosure earlier this call — do not repeat "message and data rates may apply". Just ask a short "Want me to text that trial link now?", and after a clear yes, immediately call start_trial with caller_confirmed=true and sms_consent_confirmed=true. Only then confirm whether the checkout link was actually sent.`
                  : `Lead recorded. SMS sent: ${smsSent}. Email sent: ${emailSent}. Never claim an unsent confirmation. Now: (1) briefly confirm only what actually succeeded; (2) offer a free 15-minute call with the WebCrew team and use check_availability if accepted; (3) ask exactly "Before we wrap up, is there anything else I can help you with today?" and WAIT; (4) answer any questions; (5) only after the caller clearly says no, done, or goodbye, give the professional closing and call end_call with caller_confirmed_done=true.`

                gemini?.respondToTool(callId, name, {
                  success: true,
                  smsSent,
                  emailSent,
                  nextStep,
                })
              }

              if (name === 'verify_email_by_sms') {
                const a = args as any
                const phone = normalizeCallerPhone(String(a.caller_phone ?? callerPhone ?? ''))
                if (a.sms_consent_confirmed !== true || !phone || !callSid || !configData) {
                  gemini?.respondToTool(callId, name, {
                    success: false,
                    message: a.sms_consent_confirmed !== true && smsDisclosureGiven
                      ? 'You already read the SMS disclosure earlier this call — do not repeat it. Just ask a short yes/no, wait for a clear answer, then try again.'
                      : 'Explicit SMS consent and a valid caller phone are required. Ask the consent disclosure and wait for yes before trying again.',
                  })
                  return
                }
                smsDisclosureGiven = true
                const sent = await sendEmailVerificationSMS(phone)
                if (!sent) {
                  gemini?.respondToTool(callId, name, { success: false, message: 'The verification text could not be sent. Collect and confirm the email by voice instead.' })
                  return
                }
                await startEmailVerification(phone, callSid, configData.id)
                gemini?.respondToTool(callId, name, {
                  success: true,
                  message: 'Verification text sent. Ask the caller to reply to that text with their complete email address while staying on the call.',
                })
                if (!emailVerificationPolling) {
                  emailVerificationPolling = true
                  void waitForVerifiedEmail(callSid, 90_000).then(email => {
                    emailVerificationPolling = false
                    if (!email || callEnding) return
                    verifiedSmsEmail = email
                    gemini?.sendText(`The caller replied by SMS with the verified email ${email}. Tell them you received it and repeat it once for confirmation. Use this exact address in take_message; email_confirmed may be true because the SMS reply proves ownership.`)
                  })
                }
              }

              if (name === 'check_availability') {
                console.log(`[Relay] Checking Cal.com availability`)
                const result = await getAvailableSlots(CAL_EVENT_TYPE_ID, CAL_TIMEZONE)
                if (result.error || result.slots.length === 0) {
                  gemini?.respondToTool(callId, name, {
                    success: false,
                    message: result.error ?? 'No available slots found in the next 5 days.',
                    slots:   [],
                  })
                } else {
                  const slotList = result.slots.map((s, i) => `${i + 1}. ${s.label}`).join('\n')
                  gemini?.respondToTool(callId, name, {
                    success: true,
                    message: `Here are the next available slots (${result.timezone}):`,
                    slots:   result.slots,
                    slotList,
                  })
                }
              }

              if (name === 'end_call') {
                // Block premature hang-ups before any real conversation
                if (!callerAudioReceived && (Date.now() - callStart) < 20_000) {
                  console.log('[Relay] end_call BLOCKED — caller has not spoken yet')
                  gemini?.respondToTool(callId, name, {
                    success: false,
                    message: 'Do not end the call yet — the caller is still there. Ask your opening question and wait for their response.',
                  })
                  return
                }
                const a = args as any
                const reason = String(a.reason ?? '').toLowerCase()
                // Vendor/solicitation calls have nothing further to confirm — end without the "anything else?" ritual.
                const systemClose = /silence|robocall|spam|vendor|solicit|wrong number/.test(reason)
                const confirmedDone = a.caller_confirmed_done === true && callerSaidDone(callerUtterance)
                if (!systemClose && !confirmedDone) {
                  console.log(`[Relay] end_call BLOCKED — caller has not confirmed they are done | last: ${callerUtterance}`)
                  gemini?.respondToTool(callId, name, {
                    success: false,
                    message: 'Do not end yet. Ask: "Before we wrap up, is there anything else I can help you with today?" Then wait. Only try end_call again after the caller clearly says no, done, nothing else, or goodbye.',
                  })
                  return
                }
                if (!systemClose && !clientSession && leadCaptured && !trialCheckoutSent && !bookingOfferSpoken && !appointmentBooked) {
                  console.log('[Relay] end_call BLOCKED — required booking offer was skipped')
                  gemini?.respondToTool(callId, name, {
                    success: false,
                    message: 'Before ending, offer the caller a free 15-minute call with the WebCrew team and wait for their answer. If accepted, use check_availability. If declined, then continue to the closing.',
                  })
                  return
                }
                if (!systemClose && !(clientSession ? clientClosingWasSpoken(aiSinceLastCaller) : closingWasSpoken(aiSinceLastCaller))) {
                  console.log('[Relay] end_call BLOCKED — professional closing was not spoken')
                  gemini?.respondToTool(callId, name, {
                    success: false,
                    message: clientSession
                      ? `Say a brief warm goodbye such as "Thanks for calling ${configData!.business_name}, have a great day!" Then immediately call end_call again.`
                      : 'Say exactly: "Thank you for calling WebCrew. We\'ve got your next step noted, and our team will follow up as discussed. Have a great day!" Then immediately call end_call again.',
                  })
                  return
                }
                console.log(`[Relay] Gemini ending call gracefully`)
                callEnding = true
                stopAll()
                setTimeout(async () => {
                  const sid  = process.env.TWILIO_ACCOUNT_SID
                  const auth = process.env.TWILIO_AUTH_TOKEN
                  if (sid && auth && callSid) {
                    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${callSid}.json`, {
                      method:  'POST',
                      headers: {
                        Authorization:  `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                      },
                      body: 'Status=completed',
                    }).catch(e => console.error('[Relay] hangup failed:', e.message))
                  }
                }, 8000)  // 8s: enough for goodbye audio to fully play before hangup
              }

              if (name === 'book_appointment') {
                const a = args as any
                console.log(`[Relay] Booking appointment for ${a.caller_name} at ${a.slot_time}`)
                const result = await createBooking({
                  eventTypeId: CAL_EVENT_TYPE_ID,
                  start:       a.slot_time,
                  name:        a.caller_name,
                  email:       a.caller_email,
                  phone:       a.caller_phone ?? callerPhone ?? undefined,
                  notes:       a.notes,
                  timezone:    CAL_TIMEZONE,
                })
                if (!result.ok) {
                  gemini?.respondToTool(callId, name, { success: false, error: result.error })
                } else {
                  appointmentBooked = true
                  transcript.push(`[BOOKING] ${a.caller_name} booked at ${result.start} | ID:${result.bookingId}`)
                  const destPhone = callerPhone ?? (a.caller_phone_confirmed === true ? a.caller_phone : undefined)
                  if (a.sms_consent === true) smsDisclosureGiven = true
                  const smsSent = destPhone && a.sms_consent === true
                    ? await sendBookingConfirmationSMS(destPhone, a.caller_name, result.start ?? a.slot_time, result.meetingUrl, CAL_TIMEZONE, configData!.business_name)
                    : false
                  gemini?.respondToTool(callId, name, {
                    success:    true,
                    bookingId:  result.bookingId,
                    start:      result.start,
                    meetingUrl: result.meetingUrl,
                    smsSent,
                    message:    `Appointment confirmed for ${a.caller_name} at ${result.start}. Confirmation SMS sent: ${smsSent}. Never claim a text was sent unless smsSent is true.`,
                  })
                }
              }
            },
          }

          if (!gemini) {
            configData = await getReceptionConfigById(configId)
            if (!configData) {
              console.error(`[Relay] Config ${configId} not found`)
              ws.close()
              return
            }
            console.log(`[Relay] Call started (fresh connect) — ${configData.business_name} | caller: ${callerPhone ?? 'unknown'}`)
            let systemPrompt = configData.system_prompt
            let calendarEnabled = false
            if (isClientConfig(configData)) {
              // Some carriers/VoIP forwards present the FORWARDING number as caller ID.
              // Treating the business's own number as the caller would text/contact the
              // wrong person and mis-match appointments — ask the caller for a number instead.
              if (callerPhone && [configData.brain?.phone, configData.twilio_phone].some(n => last10(n) && last10(n) === last10(callerPhone))) {
                console.warn(`[Relay] Caller ID ${callerPhone} is the business's own number (forwarded call) — treating caller as unknown`)
                callerPhone = null
              }
              clientSession = new ClientCallSession(configData, callSid, callerPhone)
              void clientSession.init()
              calendarEnabled = clientSession.calendar !== null
              systemPrompt = `${systemPrompt}\n\n${buildClientRuntimeAddendum(configData, calendarEnabled)}`
              console.log(`[Relay] Client mode — calendar ${calendarEnabled ? 'connected' : 'NOT connected'}`)
            }
            const connectingSession = new GeminiLiveSession(callbacks)
            gemini = connectingSession
            const connectPromise = connectingSession.connect(systemPrompt, configData.website_url, { calendarEnabled })
            try {
              await withTimeout(
                connectPromise,
                GEMINI_RELAY_READY_TIMEOUT_MS,
                'Gemini fresh connect',
              )
            } catch (e: any) {
              console.error(`[Relay] Gemini connect failed: ${e.message}`)
              // If the deadline won the race, dispose any session that becomes
              // ready afterward instead of leaking a quota-consuming socket.
              connectPromise.then(() => connectingSession.close()).catch(() => {})
              await startVoiceFallback('gemini_setup_failed', meta?.isOutbound === true)
            }
          }
          break
        }

        case 'media': {
          const payload = msg.media?.payload
          if (!payload) break
          mediaFramesReceived++
          if (!gemini || !greetingReady) {
            queuedFramesTotal++
            pendingCallerAudio.push(payload)
            if (pendingCallerAudio.length > MAX_PENDING_AUDIO_FRAMES) pendingCallerAudio.shift()
            break
          }
          forwardCallerAudio(payload)
          break
        }

        case 'stop': {
          // Twilio ended the call normally. Mark it before closing Gemini so
          // the asynchronous Gemini onClose callback cannot mistake teardown
          // for a mid-call failure and attempt an impossible redirect.
          callEnding = true
          stopAll()
          const durationSec = Math.round((Date.now() - callStart) / 1000)
          console.log(`[Relay] Call ended — ${durationSec}s | caller: ${callerPhone ?? 'unknown'} | media=${mediaFramesReceived} speech=${speechFramesReceived} queued=${queuedFramesTotal} callerAudio=${callerAudioReceived}`)
          gemini?.close()
          gemini = null

          if (configId && configData) {
            const fullTranscript = mergeTranscript(transcript)
            insertCallLog({
              configId,
              leadId:      callLeadId ?? configData.lead_id,
              caller:      callerPhone,
              durationSec,
              transcript:  fullTranscript,
              escalated,
              message:     takenMessage,
              callSid:     callSid ?? undefined,
              stir:        stirVerstat,
              gatePassed,
              selfNumbers: [configData.twilio_phone, configData.brain?.phone],
            }).then(async callLogId => {
              if (durationSec < 8 || robocallDetected) return // skip insights for wrong numbers/immediate hangups/robocall probes
              if (clientSession) {
                const clientInsights = await generateClientCallInsights(fullTranscript)
                if (!clientInsights) return
                if (callLogId) {
                  await updateCallLogInsights(callLogId, clientInsights.summary, clientInsights.sentiment)
                  await updateCallLogClassification(callLogId, clientInsights.intent, clientInsights.urgency, clientSession.outcomeRoute())
                }
                const finish = await clientSession.finishCall(clientInsights, durationSec)
                if (!takenMessage && !escalated && !finish.ownerAlerted && clientInsights.intent !== 'vendor_sales' && clientInsights.intent !== 'spam_or_wrong_number') {
                  sendCallSummary(configData!, callerPhone, clientInsights.summary, fullTranscript, durationSec, finish.actionUrl)
                    .catch(e => console.error('[Relay] call summary failed:', e.message))
                }
                return
              }
              const insights = await generateCallInsights(fullTranscript)
              if (!insights) return
              if (callLogId) await updateCallLogInsights(callLogId, insights.summary, insights.sentiment)
              // Lead-capture/escalation calls already notified the owner above —
              // this covers every other completed call (questions answered, no
              // action needed) so a summary goes out no matter how the call ended.
              if (!takenMessage && !escalated) {
                sendCallSummary(configData!, callerPhone, insights.summary, fullTranscript, durationSec)
                  .catch(e => console.error('[Relay] call summary failed:', e.message))
              }
            }).catch(e => console.error('[Relay] call log write failed:', e.message))

            trackCallCostAndCap(configId, configData.business_name, callLeadId ?? configData.lead_id, configData.business_name, durationSec)
              .catch(e => console.error('[VoiceCap] tracking failed:', e.message))
          }
          break
        }
      }
    })

    ws.on('close', () => {
      callEnding = true
      stopAll()
      gemini?.close()
      gemini = null
    })

    ws.on('error', (e) => console.error(`[Relay] Twilio WS error: ${e.message}`))
  })
}

/** Ends a live Twilio call immediately. */
async function hangUpCall(callSid: string | null) {
  const sid  = process.env.TWILIO_ACCOUNT_SID
  const auth = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !auth || !callSid) return
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${callSid}.json`, {
    method:  'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'Status=completed',
  }).catch(e => console.error('[Relay] hangup failed:', e.message))
}

// ─── Live transfer via Twilio call redirect ───────────────────────────────────

async function liveTransfer(callSid: string, ownerPhone: string) {
  const sid  = process.env.TWILIO_ACCOUNT_SID
  const auth = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !auth) return

  const transferUrl = `${BASE_URL}/transfer-twiml?to=${encodeURIComponent(ownerPhone)}`
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${callSid}.json`, {
      method:  'POST',
      headers: {
        Authorization:  `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ Url: transferUrl, Method: 'GET' }).toString(),
    })
    if (res.ok) {
      console.log(`[Relay] Live transfer → ${ownerPhone}`)
    } else {
      const err = await res.json() as any
      console.error(`[Relay] Live transfer failed: ${err.message}`)
    }
  } catch (e: any) {
    console.error(`[Relay] Live transfer error: ${e.message}`)
  }
}

async function sendEmailVerificationSMS(toPhone: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const auth = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER ?? process.env.TWILIO_PHONE_NUMBER
  if (!sid || !auth || !from) return false
  const body = 'Hi, this is WebCrew. Please reply to this text with your complete email address so our receptionist can verify it while you are on the call. Reply STOP to opt out. – WebCrew'
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: from, To: toPhone, Body: body }).toString(),
  }).catch(() => null)
  if (!res?.ok) console.warn('[Relay] Email verification SMS failed')
  return res?.ok === true
}

async function waitForVerifiedEmail(callSid: string, timeoutMs: number): Promise<string | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const email = await getVerifiedEmail(callSid).catch(() => null)
    if (email) return email
    await new Promise(resolve => setTimeout(resolve, 1_500))
  }
  return null
}
