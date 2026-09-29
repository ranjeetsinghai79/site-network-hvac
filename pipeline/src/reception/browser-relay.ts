import type { WebSocketServer } from 'ws'
import WebSocket from 'ws'
import { GeminiLiveSession } from './gemini-live.js'
import {
  getReceptionConfig, getReceptionConfigById, insertCallLog, upsertReceptionLead,
  getWidgetSessionCountToday, incrementWidgetSessionCount, updateCallLogInsights, updateCallLogClassification, isTrialStartRateLimited,
} from './db.js'
import { getAvailableSlots, createBooking } from './cal-booking.js'
import { buildWidgetSystemPrompt } from './webcrew-prompt.js'
import { ClientCallSession, isClientConfig, buildClientRuntimeAddendum, clientClosingWasSpoken, generateClientCallInsights } from './client-tools.js'
import { logCost } from '../tools/cost-tracker.js'
import { hasSpeechEnergy, isValidEmail, callerSaidDone, closingWasSpoken, notifyOwner, sendCallerConfirmationSMS, sendBookingConfirmationSMS, sendCallerConfirmationEmail, generateCallInsights, createTrialCheckoutLink, sendTrialCheckoutSMS, mergeTranscript } from './relay-shared.js'
import { getReceptionPricingToolResponse } from './reception-contract.js'
import type { ReceptionConfig } from './types.js'
import { clientIp, verifyTurnstile } from './turnstile.js'

// Bridges a browser widget ↔ Gemini Live — either webcrew.app's own sales
// widget (no ?config= param, legacy default) or a paying client's widget
// embedded on their own site (public/widget.js, ?config=<configId>).
// Unlike twilio-relay.ts, there is no phone carrier gating who can connect —
// anyone loading a page with the widget script can open this socket, so this
// file owns the abuse-protection layer (Turnstile, origin allowlist, per-IP
// daily cap, hard session-duration cap) that twilio-relay.ts never needed.

const WEBCREW_URL           = 'https://webcrew.app'
const CAL_EVENT_TYPE_ID     = parseInt(process.env.CAL_EVENT_TYPE_ID ?? '6126925')
const CAL_TIMEZONE          = process.env.CAL_TIMEZONE ?? 'America/Los_Angeles'
// localhost:3002 is webcrew's local dev port (npm run dev:webcrew) — included by
// default so local dev can exercise the real deployed backend without extra
// config. Only used for the WebCrew/demo widget (no ?config= param); a
// client's widget is scoped by resolveAllowedOrigins() below instead. Origin
// is a defense-in-depth layer (a non-browser client can forge it), not the
// primary gate — Turnstile + the per-IP cap do that job.
const ALLOWED_ORIGINS       = (process.env.WIDGET_ALLOWED_ORIGINS ?? 'https://webcrew.app,http://localhost:3002').split(',').map(s => s.trim()).filter(Boolean)
const WIDGET_DAILY_IP_CAP   = Number(process.env.WIDGET_DAILY_IP_CAP ?? 20)
const WIDGET_MAX_SESSION_MS = Number(process.env.WIDGET_MAX_SESSION_MS ?? 4 * 60_000)
const SPEECH_RMS_THRESHOLD  = Number(process.env.CALLER_SPEECH_RMS_THRESHOLD ?? 350)

/** Which origins a client's own widget may connect from. No column set → derive from the site already on file. */
function resolveAllowedOrigins(config: ReceptionConfig): string[] {
  if (config.widget_allowed_origins?.length) return config.widget_allowed_origins
  try { return [new URL(config.website_url).origin] } catch { return [] }
}

function send(ws: WebSocket, msg: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

export function attachWidgetRelay(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req) => {
    // Origin is checked once configData is loaded in the 'start' handler below
    // (a client's allowlist depends on which config the connection is for),
    // not here — the raw WS connection itself is cheap, same as twilio-relay.ts's.
    const origin = req.headers.origin
    const ip = clientIp(req)
    const params = new URL(req.url ?? '/', 'http://localhost').searchParams
    const configIdParam = params.get('config')

    let gemini: GeminiLiveSession | null = null
    let configData: Awaited<ReturnType<typeof getReceptionConfigById>> = null
    // Set for a paying client's widget (not WebCrew's own sales widget). Owns
    // the client tool set, per-client calendar, and CRM writes for this session.
    let clientSession: ClientCallSession | null = null
    let sessionStart = Date.now()
    let transcript: string[] = []
    let escalated = false
    let takenMessage: string | undefined
    let sessionEnding = false
    let visitorInputReceived = false
    let leadId: string | undefined
    let latestVisitorTurn = ''
    let visitorUtterance = ''
    let aiSinceLastVisitor = ''
    let leadCaptured = false
    let bookingOfferSpoken = false
    let appointmentBooked = false
    let pricingLookupCompleted = false
    // TCPA disclosure ("Message and data rates may apply. Reply STOP...")
    // only needs to be read once per session, not before every text sent.
    let smsDisclosureGiven = false
    let hardCapTimer: ReturnType<typeof setTimeout> | null = null
    let hardCapWarnTimer: ReturnType<typeof setTimeout> | null = null

    function stopTimers() {
      if (hardCapTimer) { clearTimeout(hardCapTimer); hardCapTimer = null }
      if (hardCapWarnTimer) { clearTimeout(hardCapWarnTimer); hardCapWarnTimer = null }
    }

    function endSession(reason: string) {
      if (sessionEnding) return
      sessionEnding = true
      stopTimers()
      const durationSec = Math.round((Date.now() - sessionStart) / 1000)
      console.log(`[Widget] Session ended (${reason}) — ${durationSec}s`)
      if (configData) {
        const fullTranscript = mergeTranscript(transcript)
        insertCallLog({
          configId:    configData.id,
          leadId:      leadId ?? configData.lead_id,
          caller:      null,
          channel:     'widget',
          durationSec,
          transcript:  fullTranscript,
          escalated,
          message:     takenMessage,
        }).then(async callLogId => {
          if (durationSec < 8 || !callLogId) return
          if (clientSession) {
            const clientInsights = await generateClientCallInsights(fullTranscript)
            if (!clientInsights) return
            await updateCallLogInsights(callLogId, clientInsights.summary, clientInsights.sentiment)
            await updateCallLogClassification(callLogId, clientInsights.intent, clientInsights.urgency, clientSession.outcomeRoute())
            await clientSession.finishCall(clientInsights, durationSec)
            return
          }
          const insights = await generateCallInsights(fullTranscript)
          if (insights) await updateCallLogInsights(callLogId, insights.summary, insights.sentiment)
        }).catch(e => console.error('[Widget] call log write failed:', e.message))
        logCost({ service: 'gemini_live_voice', units: durationSec / 60, leadId: leadId ?? configData.lead_id, leadName: configData.business_name, note: clientSession ? 'client website widget' : 'webcrew.app avatar widget', force: true })
          .catch(e => console.error('[Widget] cost logging failed:', e.message))
      }
      gemini?.close()
      gemini = null
      send(ws, { type: 'closed', reason })
      setTimeout(() => ws.close(), 500)
    }

    ws.on('message', async (raw: Buffer) => {
      let msg: any
      try { msg = JSON.parse(raw.toString()) } catch { return }
      if (sessionEnding) return

      if (msg.type === 'start') {
        configData = configIdParam
          ? await getReceptionConfigById(configIdParam)
          : await getReceptionConfig(WEBCREW_URL)
        if (!configData) {
          console.error('[Widget] No reception config found for widget session')
          send(ws, { type: 'error', message: 'Assistant is not configured yet.' })
          ws.close(1011, 'config missing')
          return
        }
        if (configData.active === false) {
          send(ws, { type: 'error', message: 'This assistant is not currently active.' })
          ws.close(1011, 'config inactive')
          return
        }

        // A client's widget is scoped to the site(s) it's embedded on; the
        // WebCrew/demo widget (no ?config=) keeps the global env-driven list.
        const allowedOrigins = configIdParam ? resolveAllowedOrigins(configData) : ALLOWED_ORIGINS
        if (!origin || !allowedOrigins.includes(origin)) {
          console.warn(`[Widget] Rejected — origin not allowed: ${origin ?? '(none)'} for config ${configData.id}`)
          send(ws, { type: 'error', message: 'This assistant is not enabled for this site.' })
          ws.close(1008, 'origin not allowed')
          return
        }

        const ok = await verifyTurnstile(msg.turnstileToken, ip)
        if (!ok) { send(ws, { type: 'error', message: 'Verification failed.' }); ws.close(1008, 'turnstile failed'); return }

        const usedToday = await getWidgetSessionCountToday(ip).catch(() => 0)
        if (usedToday >= WIDGET_DAILY_IP_CAP) {
          send(ws, { type: 'error', message: 'Daily session limit reached. Please try again tomorrow.' })
          ws.close(1008, 'daily cap reached')
          return
        }
        incrementWidgetSessionCount(ip).catch(e => console.warn('[Widget] session-count increment failed:', e.message))

        sessionStart = Date.now()

        const callbacks = {
          onReady: () => {
            console.log(`[Widget] Gemini ready — ${configData!.business_name} | ip: ${ip}`)
            setTimeout(() => {
              gemini?.sendText(`[WIDGET CONNECTED] A visitor just opened the chat/voice widget on ${configData!.business_name}'s site. Say your opening line NOW, in one short friendly sentence, then wait for their response.`)
            }, 700)
            send(ws, { type: 'ready' })
            hardCapWarnTimer = setTimeout(() => {
              gemini?.sendText('This widget session is close to its time limit. Wrap up now: summarize the next step and move toward the closing.')
            }, Math.max(0, WIDGET_MAX_SESSION_MS - 30_000))
            hardCapTimer = setTimeout(() => {
              console.log('[Widget] Hard session cap reached — forcing close')
              gemini?.sendText('Time is up. Say a brief goodbye now.')
              setTimeout(() => endSession('max_duration'), 3_000)
            }, WIDGET_MAX_SESSION_MS)
          },
          onClose: () => console.log('[Widget] Gemini closed'),
          onError: (e: Error) => { console.error('[Widget] Gemini error:', e.message); send(ws, { type: 'error', message: 'Assistant connection error.' }) },
          onText: (text: string) => {
            aiSinceLastVisitor += text
            if (leadCaptured && /(?:free\s+)?15[ -]?minute|schedule (?:a )?(?:call|demo)|book (?:a )?(?:call|demo)/i.test(aiSinceLastVisitor)) {
              bookingOfferSpoken = true
            }
            transcript.push(`AI: ${text}`)
            send(ws, { type: 'text', role: 'ai', text })
          },
          onInputText: (text: string) => {
            visitorInputReceived = true
            visitorUtterance += text
            latestVisitorTurn = text.trim()
            aiSinceLastVisitor = ''
            transcript.push(`Visitor: ${text}`)
            send(ws, { type: 'text', role: 'visitor', text })
          },
          onInterrupted: () => send(ws, { type: 'interrupted' }),
          onAudio: (pcm24Base64: string) => send(ws, { type: 'audio', data: pcm24Base64 }),
          onToolCall: async (name: string, args: Record<string, unknown>, callId: string) => {
            console.log(`[Widget] Tool: ${name}`, args)

            if (clientSession) {
              const outcome = await clientSession.handle(name, args, {
                callerHasSpoken: visitorInputReceived,
                latestCallerTurn: latestVisitorTurn,
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
              const a = args as { caller_confirmed?: boolean; sms_consent_confirmed?: boolean; caller_phone?: string; caller_phone_confirmed?: boolean }
              if (a.caller_confirmed !== true) {
                gemini?.respondToTool(callId, name, { success: false, message: 'Ask the visitor to explicitly confirm they want to start the trial right now, then try again with caller_confirmed=true.' })
                return
              }
              if (a.sms_consent_confirmed !== true) {
                gemini?.respondToTool(callId, name, {
                  success: false,
                  message: smsDisclosureGiven
                    ? 'You already showed the SMS disclosure earlier this session — do not repeat it. Just ask a short yes/no: "Want me to text the trial link now?" Wait for an explicit yes, then try again with sms_consent_confirmed=true.'
                    : 'Show or read the required SMS disclosure, wait for an explicit yes, then try again with sms_consent_confirmed=true.',
                })
                return
              }
              smsDisclosureGiven = true
              if (a.caller_phone_confirmed !== true || !String(a.caller_phone ?? '').trim()) {
                gemini?.respondToTool(callId, name, { success: false, message: 'There is no verified phone number for this widget session. Ask for their mobile number, read it back digit by digit, and confirm before trying again with caller_phone_confirmed=true.' })
                return
              }
              if (await isTrialStartRateLimited(a.caller_phone!)) {
                gemini?.respondToTool(callId, name, { success: true, alreadySent: true, message: 'A trial checkout link was already texted to this number recently. Tell them to check their texts — do not send another.' })
                return
              }
              const trialLeadId = leadId ?? await upsertReceptionLead({
                caller: a.caller_phone!, name: '', configId: configData!.id,
              }) ?? undefined
              if (!trialLeadId) {
                gemini?.respondToTool(callId, name, { success: false, message: 'Could not start the trial — apologize and offer escalate_to_human instead.' })
                return
              }
              leadId = trialLeadId
              const checkoutUrl = await createTrialCheckoutLink(trialLeadId, configData!.business_name)
              if (!checkoutUrl) {
                gemini?.respondToTool(callId, name, { success: false, message: 'The checkout link could not be created. Apologize and offer escalate_to_human instead.' })
                return
              }
              const sent = await sendTrialCheckoutSMS(a.caller_phone!, checkoutUrl)
              gemini?.respondToTool(callId, name, {
                success: sent,
                message: sent
                  ? 'Tell them a text just went out with their trial signup link — card required, nothing charged until the 30-day trial ends.'
                  : 'The text could not be sent. Apologize and offer escalate_to_human instead.',
              })
              return
            }

            if (name === 'escalate_to_human') {
              const a = args as any
              if (a.caller_confirmed_transfer !== true || !/\b(?:yes|yeah|yep|please|connect|transfer|human|person|someone)\b/i.test(latestVisitorTurn)) {
                gemini?.respondToTool(callId, name, { success: false, message: 'Ask whether they want a team member to follow up and wait for an explicit yes before trying again.' })
                return
              }
              if (!clientSession && /pric|cost|discount|negotiat|lowest|cheapest/i.test(String(a.reason ?? '')) && !pricingLookupCompleted) {
                gemini?.respondToTool(callId, name, { success: false, message: 'First call get_webcrew_pricing and answer the pricing question accurately.' })
                return
              }
              // No live phone transfer exists from a browser widget — always the notify-only path.
              escalated = true
              transcript.push(`[ESCALATION] ${a.reason ?? ''}`)
              await notifyOwner('escalation', a, configData!, null)
              if (clientSession) void clientSession.onEscalated(String(a.reason ?? 'visitor requested a person'))
              gemini?.respondToTool(callId, name, { success: false, message: 'Live transfer is unavailable from this widget. Do not say they are being connected. Apologize briefly, take their details, and say a team member will follow up by email or text shortly.' })
              return
            }

            if (name === 'verify_email_by_sms') {
              gemini?.respondToTool(callId, name, {
                success: false,
                message: 'SMS verification is not used in this widget. Ask the visitor to type their complete email address in the chat box, read it back once, and confirm before continuing.',
              })
              return
            }

            if (name === 'take_message') {
              if (!visitorInputReceived) {
                gemini?.respondToTool(callId, name, { success: false, message: 'The visitor has not said or typed anything yet. Ask your opening question and wait for their reply.' })
                return
              }
              const a = args as any
              const email = String(a.caller_email ?? '').trim()
              if (!isValidEmail(email)) {
                gemini?.respondToTool(callId, name, { success: false, message: 'The email is incomplete or invalid. Ask the visitor to type the full address including the domain, then confirm it before trying again.' })
                return
              }
              if (a.email_confirmed !== true) {
                gemini?.respondToTool(callId, name, { success: false, message: 'Confirm the email address with the visitor and wait for an explicit confirmation before trying again with email_confirmed=true.' })
                return
              }
              if (a.business_name_confirmed !== true || !String(a.business_name ?? '').trim()) {
                gemini?.respondToTool(callId, name, { success: false, message: 'Ask for the actual business name and wait for the visitor to confirm it. Do not invent a generic name from their industry.' })
                return
              }
              if (String(a.appointment_intent ?? '').toLowerCase() === 'booked' && !appointmentBooked) {
                gemini?.respondToTool(callId, name, { success: false, message: 'No appointment has been booked yet. Use appointment_intent="wants_to_book" or "not_decided" unless book_appointment already succeeded.' })
                return
              }
              if (a.sms_consent_answered !== true) {
                gemini?.respondToTool(callId, name, {
                  success: false,
                  message: smsDisclosureGiven
                    ? 'You already showed the SMS disclosure earlier this session — do not repeat it. Just ask a short yes/no for this confirmation text, wait for a clear answer, then try again with sms_consent_answered=true.'
                    : 'You have not completed the SMS consent question. Ask it, wait for a clear yes or no, then try again with sms_consent_answered=true.',
                })
                return
              }
              smsDisclosureGiven = true
              takenMessage = a.message ?? ''
              transcript.push(`[MESSAGE] ${takenMessage}`)
              leadId = await upsertReceptionLead({
                caller: String(a.caller_phone ?? ''),
                name: a.caller_name ?? '',
                email,
                niche: a.niche ?? a.industry,
                configId: configData!.id,
                notes: takenMessage,
                smsConsent: a.sms_consent === true,
              }) ?? undefined
              await notifyOwner('message', a, configData!, null)

              const destPhone = a.caller_phone_confirmed === true ? a.caller_phone : undefined
              // Run concurrently, not sequentially — see twilio-relay.ts's take_message for why.
              const [smsSent, emailSent] = await Promise.all([
                destPhone && a.sms_consent === true ? sendCallerConfirmationSMS(destPhone, a.caller_name ?? 'there', configData!.business_name) : Promise.resolve(false),
                email ? sendCallerConfirmationEmail(email, a.caller_name ?? 'there', configData!.business_name) : Promise.resolve(false),
              ])

              leadCaptured = true
              gemini?.respondToTool(callId, name, {
                success: true,
                smsSent,
                emailSent,
                nextStep: `Lead recorded. SMS sent: ${smsSent}. Email sent: ${emailSent}. Never claim an unsent confirmation. Now: (1) briefly confirm only what actually succeeded; (2) offer a free 15-minute call with the WebCrew team and use check_availability if accepted; (3) ask exactly "Before we wrap up, is there anything else I can help you with today?" and WAIT; (4) answer any questions; (5) only after they clearly say no, done, or goodbye, give the closing and call end_call.`,
              })
              return
            }

            if (name === 'check_availability') {
              const result = await getAvailableSlots(CAL_EVENT_TYPE_ID, CAL_TIMEZONE)
              if (result.error || result.slots.length === 0) {
                gemini?.respondToTool(callId, name, { success: false, message: result.error ?? 'No available slots found in the next 5 days.', slots: [] })
              } else {
                const slotList = result.slots.map((s, i) => `${i + 1}. ${s.label}`).join('\n')
                gemini?.respondToTool(callId, name, { success: true, message: `Here are the next available slots (${result.timezone}):`, slots: result.slots, slotList })
              }
              return
            }

            if (name === 'book_appointment') {
              const a = args as any
              const result = await createBooking({
                eventTypeId: CAL_EVENT_TYPE_ID,
                start:       a.slot_time,
                name:        a.caller_name,
                email:       a.caller_email,
                phone:       a.caller_phone ?? undefined,
                notes:       a.notes,
                timezone:    CAL_TIMEZONE,
              })
              if (!result.ok) {
                gemini?.respondToTool(callId, name, { success: false, error: result.error })
              } else {
                appointmentBooked = true
                transcript.push(`[BOOKING] ${a.caller_name} booked at ${result.start} | ID:${result.bookingId}`)
                const destPhone = a.caller_phone_confirmed === true ? a.caller_phone : undefined
                if (a.sms_consent === true) smsDisclosureGiven = true
                const smsSent = destPhone && a.sms_consent === true
                  ? await sendBookingConfirmationSMS(destPhone, a.caller_name, result.start ?? a.slot_time, result.meetingUrl, CAL_TIMEZONE, configData!.business_name)
                  : false
                gemini?.respondToTool(callId, name, {
                  success: true, bookingId: result.bookingId, start: result.start, meetingUrl: result.meetingUrl, smsSent,
                  message: `Appointment confirmed for ${a.caller_name} at ${result.start}. Confirmation SMS sent: ${smsSent}. Never claim a text was sent unless smsSent is true.`,
                })
              }
              return
            }

            if (name === 'end_call') {
              if (!visitorInputReceived) {
                gemini?.respondToTool(callId, name, { success: false, message: 'Do not end yet — the visitor has not said or typed anything. Ask your opening question and wait.' })
                return
              }
              const a = args as any
              const confirmedDone = a.caller_confirmed_done === true && callerSaidDone(visitorUtterance + ' ' + latestVisitorTurn)
              if (!confirmedDone) {
                gemini?.respondToTool(callId, name, { success: false, message: 'Do not end yet. Ask: "Before we wrap up, is there anything else I can help you with today?" Then wait for a clear no/done/goodbye.' })
                return
              }
              if (!clientSession && leadCaptured && !bookingOfferSpoken && !appointmentBooked) {
                gemini?.respondToTool(callId, name, { success: false, message: 'Before ending, offer a free 15-minute call with the WebCrew team and wait for their answer.' })
                return
              }
              const closingOk = clientSession ? clientClosingWasSpoken(aiSinceLastVisitor) : closingWasSpoken(aiSinceLastVisitor)
              if (!closingOk) {
                gemini?.respondToTool(callId, name, {
                  success: false,
                  message: clientSession
                    ? `Say a brief warm goodbye such as "Thanks for chatting with ${configData!.business_name}, have a great day!" Then immediately call end_call again.`
                    : 'Say exactly: "Thank you for chatting with WebCrew. We\'ve got your next step noted, and our team will follow up as discussed. Have a great day!" Then immediately call end_call again.',
                })
                return
              }
              gemini?.respondToTool(callId, name, { success: true })
              setTimeout(() => endSession('goodbye'), 2_500)
              return
            }
          },
        }

        let systemPrompt = buildWidgetSystemPrompt()
        let connectUrl = WEBCREW_URL
        let calendarEnabled = false
        if (isClientConfig(configData)) {
          clientSession = new ClientCallSession(configData, null, null)
          void clientSession.init()
          calendarEnabled = clientSession.calendar !== null
          systemPrompt = `${configData.system_prompt}\n\n${buildClientRuntimeAddendum(configData, calendarEnabled)}\n\nCHANNEL: This conversation is happening through ${configData.business_name}'s website chat/voice widget, not a phone call. There is no caller ID — refer to the person you're talking with as "you," not "the caller."`
          connectUrl = configData.website_url
          console.log(`[Widget] Client mode — ${configData.business_name} | calendar ${calendarEnabled ? 'connected' : 'NOT connected'}`)
        }

        gemini = new GeminiLiveSession(callbacks)
        try {
          await gemini.connect(systemPrompt, connectUrl, { calendarEnabled })
        } catch (e: any) {
          console.error(`[Widget] Gemini connect failed: ${e.message}`)
          send(ws, { type: 'error', message: 'Assistant is unavailable right now.' })
          ws.close(1011, 'gemini connect failed')
        }
        return
      }

      if (msg.type === 'audio') {
        if (!gemini || !msg.data) return
        if (hasSpeechEnergy(msg.data, SPEECH_RMS_THRESHOLD)) visitorInputReceived = true
        gemini.sendAudio(msg.data)
        return
      }

      if (msg.type === 'text') {
        if (!gemini || !String(msg.text ?? '').trim()) return
        visitorInputReceived = true
        visitorUtterance += msg.text
        latestVisitorTurn = String(msg.text).trim()
        aiSinceLastVisitor = ''
        transcript.push(`Visitor: ${msg.text}`)
        gemini.sendText(String(msg.text))
        return
      }

      if (msg.type === 'stop') {
        endSession('client_stop')
        return
      }
    })

    ws.on('close', () => endSession('ws_close'))
    ws.on('error', (e) => console.error(`[Widget] WS error: ${e.message}`))
  })
}
