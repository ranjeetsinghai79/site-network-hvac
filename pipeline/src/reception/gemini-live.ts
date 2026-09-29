import { EndSensitivity, GoogleGenAI, Modality, StartSensitivity, ThinkingLevel } from '@google/genai'
import { CLIENT_TOOL_DECLARATIONS } from './client-tools.js'

// Gemini Live API via @google/genai SDK, Vertex AI backend only.
// Vertex uses Application Default Credentials (automatic in Cloud Run) — no API key.
const PROJECT  = process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCP_PROJECT_ID ?? 'webcrew-501006'
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? process.env.GCP_REGION ?? 'us-central1'
// GA Vertex Live endpoint (verified 2026-09-18 on webcrew-501006: only
// gemini-live-2.5-flash-native-audio in us-central1 resolves — 'global' and the
// AI Studio-only 3.x preview names return 404/1008, i.e. dead air on client calls).
// The project must be entitled by Google;
// do not substitute a Gemini Developer API key when access is unavailable.
const VERTEX_MODEL = process.env.GEMINI_LIVE_MODEL_VERTEX ?? 'gemini-live-2.5-flash-native-audio'

const MAX_MALFORMED_RETRIES = 2

// Duplicated from server.ts/setup-reception.ts rather than imported — matches
// this repo's convention of duplicating small stable constants across reception files.
const WEBCREW_URL = 'https://webcrew.app'

type Backend = 'vertex' | 'aistudio'
interface Candidate { backend: Backend; keyName: string; model: string }

// Voice runs on Vertex AI by default (product decision 2026-09-18): one billed, contractual
// data path for every caller — WebCrew's own line, the widget, and paying clients.
//
// 2026-09-19 opt-in exception: gemini-3.8-live (GA 2026-09-15) is gated on Vertex for this project
// (Live WS closes 1008) but works through the Gemini Developer API. It is used ONLY when both
//   GEMINI_LIVE_PRIMARY=aistudio  and  GEMINI_LIVE_AISTUDIO_KEY=<key from a BILLED, paid-tier project>
// are set — never the free-tier GOOGLE_AI_API_KEY, whose data terms suit none of our callers.
// Vertex stays in the chain as the fallback, so a depleted-credits/quota/access failure on the AI Studio
// path (e.g. close 1011 "prepayment credits are depleted") falls through to Vertex 2.5 instead of dead air.
async function buildChain(_websiteUrl: string): Promise<Candidate[]> {
  const chain: Candidate[] = []
  if (process.env.GEMINI_LIVE_PRIMARY === 'aistudio' && process.env.GEMINI_LIVE_AISTUDIO_KEY) {
    chain.push({ backend: 'aistudio', keyName: 'aistudio-paid', model: process.env.GEMINI_LIVE_MODEL_AISTUDIO ?? 'gemini-3.8-live' })
  }
  chain.push({ backend: 'vertex', keyName: 'vertex', model: VERTEX_MODEL })
  return chain
}

function makeClient(candidate: Candidate) {
  if (candidate.backend === 'aistudio') return new GoogleGenAI({ apiKey: process.env.GEMINI_LIVE_AISTUDIO_KEY! })
  return new GoogleGenAI({ vertexai: true, project: PROJECT, location: LOCATION })
}

export interface GeminiLiveCallbacks {
  onReady: () => void
  onAudio: (base64Pcm24kHz: string) => void
  onText?: (text: string) => void
  onInputText?: (text: string) => void
  onInterrupted?: () => void
  onToolCall: (name: string, args: Record<string, unknown>, callId: string) => void
  onError: (err: Error) => void
  onClose: () => void
}

export class GeminiLiveSession {
  private session: Awaited<ReturnType<typeof GoogleGenAI.prototype.live.connect>> | null = null
  private callbacks: GeminiLiveCallbacks
  private _ready = false
  private attemptSeq = 0
  // The Live model can emit an invalid tool call (turnCompleteReason
  // MALFORMED_FUNCTION_CALL). The turn then ends with no speech and no tool
  // call — dead air on a phone line. Nudge it to speak and retry, a bounded
  // number of times in a row.
  private malformedStreak = 0

  get isReady() { return this._ready }

  constructor(callbacks: GeminiLiveCallbacks) {
    this.callbacks = callbacks
  }

  // Swap in real callbacks after pre-warm. If already ready, fires onReady immediately.
  setCallbacks(callbacks: GeminiLiveCallbacks) {
    this.callbacks = callbacks
    if (this._ready) setTimeout(() => callbacks.onReady(), 0)
  }

  // Tries each backend in the chain in order (the opt-in paid AI Studio backend first when
  // enabled, Vertex last) until one connects. A call should never audibly fail just because
  // a quota or credit balance ran out — Vertex is always the final, guaranteed-to-work candidate.
  async connect(systemPrompt: string, websiteUrl: string, opts: { calendarEnabled?: boolean } = {}): Promise<void> {
    const chain = await buildChain(websiteUrl)
    const toolMode: ToolMode = websiteUrl.replace(/\/$/, '') === WEBCREW_URL ? 'webcrew' : 'client'
    let lastErr: unknown

    for (const candidate of chain) {
      try {
        await this.attemptConnect(candidate, systemPrompt, toolMode, opts.calendarEnabled === true)
        return
      } catch (err: any) {
        lastErr = err
        console.warn(`[Gemini] ${candidate.keyName} failed (${err.message}) — trying next backend`)
        this.close()
        this._ready = false
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('All Gemini Live backends failed')
  }

  private async attemptConnect(candidate: Candidate, systemPrompt: string, toolMode: ToolMode, calendarEnabled: boolean): Promise<void> {
    const attemptId = ++this.attemptSeq
    const ai    = makeClient(candidate)
    const model = candidate.model
    console.log(candidate.backend === 'vertex'
      ? `[Gemini] attempt backend=vertex project=${PROJECT} location=${LOCATION} → ${model}`
      : `[Gemini] attempt backend=aistudio (paid key) → ${model}`)

    // thinkingLevel is a gemini-3.1 Live feature; gemini-3.8-live rejects it (close 1007 "Thinking level is not
    // supported for this model", bisected 2026-09-19) and, like 2.5, takes a zero thinking budget instead.
    const thinkingConfig = model.includes('3.1')
      ? { thinkingLevel: ThinkingLevel.MINIMAL, includeThoughts: false }
      : { thinkingBudget: 0, includeThoughts: false }

    // Set by onerror/onclose if this attempt dies before setupComplete — lets the
    // poll loop below fail fast instead of waiting out the full setup timeout.
    let setupFailure: Error | null = null

    const functionDeclarations = selectToolDeclarations(toolMode, calendarEnabled)

    this.session = await ai.live.connect({
      model,
      config: {
        responseModalities:  [Modality.AUDIO],
        // Phone conversations need immediate answers, not hidden multi-step
        // deliberation that leaves the caller listening to dead air.
        thinkingConfig,
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
        },
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools:             [{ functionDeclarations: functionDeclarations as any }],
        inputAudioTranscription:  {},
        outputAudioTranscription: {},
        // Keep the current objective and recent turns available during long
        // calls without allowing conversation history to exhaust the context.
        contextWindowCompression: {
          triggerTokens: '20000',
          slidingWindow: { targetTokens: '12000' },
        },
        // Server-side VAD retains a pre-speech buffer and is substantially more
        // robust to phone noise than the relay's former RMS/manual endpointing.
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
            prefixPaddingMs: 80,
            silenceDurationMs: 800,
          },
        },
      },
      callbacks: {
        onopen: () => {
          if (attemptId !== this.attemptSeq) return
          console.log(`[Gemini] Connected — ${model}`)
        },
        onmessage: (msg: any) => {
          if (attemptId !== this.attemptSeq) return // stray message from an abandoned attempt
          try {
            this.handle(msg)
          } catch (err: any) {
            console.warn('[Gemini] handle error:', err.message)
          }
        },
        onerror: (e: any) => {
          if (attemptId !== this.attemptSeq) return
          const err = new Error(e?.error?.message ?? e?.message ?? 'Gemini WS error')
          console.error('[Gemini] error:', err.message)
          if (this._ready) {
            // Mid-call failure on the winning session — propagate as before.
            this.callbacks.onError(err)
          } else {
            // Failed during setup — let the poll loop below fail fast and move
            // connect() on to the next backend in the chain.
            setupFailure = err
          }
        },
        onclose: (e: any) => {
          if (attemptId !== this.attemptSeq) return
          console.log(`[Gemini] closed — code: ${e?.code}, reason: ${e?.reason ?? ''}`)
          if (this._ready) {
            this.callbacks.onClose()
          } else {
            setupFailure = setupFailure ?? new Error(`closed before setup, code: ${e?.code}`)
          }
        },
      },
    })

    // A WebSocket open is not a usable Gemini session. Wait for setupComplete
    // so callers never sit on a connected-but-unsupported model endpoint.
    const setupDeadline = Date.now() + Number(process.env.GEMINI_SETUP_TIMEOUT_MS ?? 10_000)
    while (!this._ready && !setupFailure && Date.now() < setupDeadline) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    if (setupFailure) throw setupFailure
    if (!this._ready) {
      throw new Error(`Gemini Live setup timed out for ${model} (backend=${candidate.backend}, key=${candidate.keyName})`)
    }
  }

  private handle(msg: any) {
    // The WebSocket opening only means the transport is connected. Gemini
    // cannot accept user input until it acknowledges the session setup.
    if (msg.setupComplete && !this._ready) {
      this._ready = true
      console.log('[Gemini] Session setup complete')
      this.callbacks.onReady()
    }

    const serverContent = msg.serverContent
    const parts = serverContent?.modelTurn?.parts ?? []
    for (const part of parts) {
      const data = part.inlineData?.data
      const mime = part.inlineData?.mimeType ?? ''
      if (data && mime.startsWith('audio/pcm')) this.callbacks.onAudio(data)
    }

    // Store what was actually spoken, not model thought/planning parts.
    const spokenText = serverContent?.outputTranscription?.text
    if (spokenText && this.callbacks.onText) this.callbacks.onText(spokenText)
    const callerText = serverContent?.inputTranscription?.text
    if (callerText && this.callbacks.onInputText) this.callbacks.onInputText(callerText)
    if (serverContent?.interrupted && this.callbacks.onInterrupted) this.callbacks.onInterrupted()

    if (serverContent?.turnCompleteReason === 'MALFORMED_FUNCTION_CALL') {
      if (this.malformedStreak < MAX_MALFORMED_RETRIES) {
        this.malformedStreak++
        console.warn(`[Gemini] MALFORMED_FUNCTION_CALL (${this.malformedStreak}/${MAX_MALFORMED_RETRIES}) — nudging the model to recover`)
        this.sendText('[SYSTEM] Your last tool call was malformed and was ignored. Do not stay silent: say one short sentence to the caller, then retry the tool call using only the declared parameter names and valid values.')
      } else {
        console.error('[Gemini] MALFORMED_FUNCTION_CALL retries exhausted')
      }
    }

    const functionCalls = msg.toolCall?.functionCalls ?? []
    if (functionCalls.length) this.malformedStreak = 0
    for (const fc of functionCalls) {
      this.callbacks.onToolCall(fc.name, fc.args ?? {}, fc.id)
    }
  }

  sendText(text: string) {
    this.session?.sendRealtimeInput({ text } as any)
  }

  sendAudio(base64Pcm16kHz: string) {
    this.session?.sendRealtimeInput({
      audio: { data: base64Pcm16kHz, mimeType: 'audio/pcm;rate=16000' },
    } as any)
  }

  startActivity() {
    this.session?.sendRealtimeInput({ activityStart: {} } as any)
  }

  endActivity() {
    this.session?.sendRealtimeInput({ activityEnd: {} } as any)
  }

  respondToTool(callId: string, name: string, output: unknown) {
    try {
      this.session?.sendToolResponse({
        functionResponses: [{ id: callId, name, response: { output } }],
      } as any)
    } catch (e: any) {
      console.error('[Gemini] sendToolResponse failed:', e.message)
    }
  }

  close() {
    try { (this.session as any)?.close?.() } catch { /* ignore */ }
    this.session = null
  }
}

// ── Tool declarations ─────────────────────────────────────────────────────────

export type ToolMode = 'webcrew' | 'client'

interface ToolDecl {
  name: string
  description: string
  parameters: unknown
  webcrewOnly?: boolean   // only the WebCrew sales line
  clientOnly?: boolean    // only a paying client's receptionist
  needsCalendar?: boolean // client mode: only when the client has a calendar connected
}

export const TOOL_DECLARATIONS: ToolDecl[] = [
  {
    name: 'get_webcrew_pricing',
    description: 'Get the current authoritative WebCrew plan prices and inclusions. MUST be called before answering any question about price, cost, discounts, negotiation, or the lowest plan.',
    parameters: { type: 'OBJECT', properties: {}, required: [] },
    webcrewOnly: true, // only makes sense when the caller is shopping for WebCrew's own service
  },
  {
    name: 'build_founder_offer',
    description: 'Deprecated compatibility tool. It never authorizes a discount. If invoked, offer a human consultation for custom pricing or scope.',
    parameters: {
      type: 'OBJECT',
      properties: {
        desired_plan: { type: 'STRING', enum: ['website_only', 'website_hosted', 'ai_front_office', 'ai_reception_only', 'everything', 'marketing_only'], description: 'Which plan the caller actually wants, based on what they asked for. Default ai_front_office if unclear.' },
        comfortable_monthly_budget: { type: 'NUMBER', description: 'The monthly USD amount the caller said they can comfortably afford, or 0 if they only asked for a discount without naming a number' },
      },
      required: ['desired_plan', 'comfortable_monthly_budget'],
    },
    webcrewOnly: true,
  },
  {
    name: 'escalate_to_human',
    description: 'Transfer the call only after offering a human handoff and the caller explicitly confirms they want the transfer now.',
    parameters: {
      type: 'OBJECT',
      properties: {
        reason: { type: 'STRING', description: 'Brief reason for escalation' },
        caller_confirmed_transfer: { type: 'BOOLEAN', description: 'True only when the caller explicitly said yes to being transferred now' },
      },
      required: ['reason', 'caller_confirmed_transfer'],
    },
  },
  {
    name: 'verify_email_by_sms',
    description: 'After explicit SMS consent, send the caller a verification text and ask them to reply with their complete email while remaining on the call. Prefer this over voice spelling for accurate lead capture.',
    parameters: {
      type: 'OBJECT',
      properties: {
        caller_phone: { type: 'STRING', description: 'Confirmed caller mobile number' },
        sms_consent_confirmed: { type: 'BOOLEAN', description: 'True only after the caller heard the SMS disclosure and explicitly agreed' },
      },
      required: ['caller_phone', 'sms_consent_confirmed'],
    },
    webcrewOnly: true, // sends from WebCrew's number; replies would land in WebCrew's inbox
  },
  {
    name: 'take_message',
    description: 'Record lead info from a caller who has SPOKEN and provided their details. ONLY call after real two-way conversation. Never call before the caller responds to your greeting.',
    parameters: {
      type: 'OBJECT',
      properties: {
        caller_name:  { type: 'STRING', description: "Caller's full name (must be provided by caller)" },
        caller_phone: { type: 'STRING', description: "Caller's callback number" },
        caller_email: { type: 'STRING', description: "Caller's complete, confirmed email address including domain" },
        email_confirmed: { type: 'BOOLEAN', description: 'True only after the assistant spelled the full email back and the caller explicitly confirmed it' },
        business_name: { type: 'STRING', description: "Caller's confirmed business name" },
        business_name_confirmed: { type: 'BOOLEAN', description: 'True only after the caller provided or explicitly confirmed the actual business name; an industry label is not a business name' },
        industry: { type: 'STRING', description: "Caller's industry or business category" },
        city: { type: 'STRING', description: "Primary city or service area" },
        pain_point: { type: 'STRING', description: 'The real problem stated by the caller, without assumptions' },
        recommended_solution: { type: 'STRING', description: 'The WebCrew solution discussed and accepted as relevant' },
        appointment_intent: { type: 'STRING', description: 'Accurate status: wants_to_book, declined, not_decided, or booked. Never use booked before book_appointment succeeds.' },
        requested_next_action: { type: 'STRING', description: 'Exact agreed next action: start_trial, book_consultation, send_information, human_follow_up, or none. Use start_trial whenever the caller explicitly agreed to sign up now.' },
        sms_consent:  { type: 'BOOLEAN', description: 'Caller explicitly said yes to receiving a confirmation SMS at the caller phone number' },
        sms_consent_answered: { type: 'BOOLEAN', description: 'True only after the caller heard the SMS disclosure and clearly answered yes or no' },
        caller_phone_confirmed: { type: 'BOOLEAN', description: 'True only after the caller stated their phone number and you read it back digit by digit and they explicitly confirmed it — same rule as email. Never infer, guess, or assume a number (e.g. from area code context or a placeholder). If unconfirmed, set false and never invent a value for caller_phone.' },
        message:      { type: 'STRING', description: 'Accurate summary of business, location, pain point, solution, next action, appointment intent, and notes' },
      },
      required: ['caller_name', 'caller_email', 'email_confirmed', 'business_name', 'business_name_confirmed', 'industry', 'pain_point', 'recommended_solution', 'appointment_intent', 'requested_next_action', 'sms_consent', 'sms_consent_answered', 'caller_phone_confirmed', 'message'],
    },
    webcrewOnly: true, // WebCrew sales-lead qualification; clients get the client take_message below
  },
  {
    name: 'end_call',
    description: 'End the call after saying a proper goodbye. ONLY use when: caller says goodbye/thanks/done, issue is fully resolved, or after confirming a booking. NEVER call this before the caller has responded to your greeting.',
    parameters: {
      type: 'OBJECT',
      properties: {
        reason: { type: 'STRING', description: 'brief reason (resolved, booked, escalated, etc.)' },
        caller_confirmed_done: { type: 'BOOLEAN', description: 'True only when the caller explicitly said they need nothing else, are finished, or said goodbye' },
      },
      required: ['caller_confirmed_done'],
    },
  },
  {
    name: 'start_trial',
    description: 'Send the caller a Stripe checkout link by SMS to start their free trial (card required, nothing charged until the trial ends). Only call after the caller explicitly agrees to sign up now AND explicitly consents to receive this text. On a phone call verified Caller ID is used; in the widget ask for and confirm a mobile number.',
    parameters: {
      type: 'OBJECT',
      properties: {
        caller_confirmed: { type: 'BOOLEAN', description: 'True only after the caller explicitly agreed to start the trial now' },
        sms_consent_confirmed: { type: 'BOOLEAN', description: 'True only after the caller heard the required SMS disclosure and explicitly agreed to receive the trial-link text' },
        caller_phone: { type: 'STRING', description: 'Widget only: the mobile number to text the checkout link to. Not needed on a phone call.' },
        caller_phone_confirmed: { type: 'BOOLEAN', description: 'Widget only: true only after you read the number back digit by digit and they explicitly confirmed it.' },
      },
      required: ['caller_confirmed', 'sms_consent_confirmed'],
    },
    webcrewOnly: true, // sells WebCrew's own plan — must never be offered on a client's line
  },
  {
    name: 'check_availability',
    description: 'Check available appointment slots for the next 5 business days. Call this when a caller wants to book an appointment.',
    parameters: { type: 'OBJECT', properties: {}, required: [] },
    needsCalendar: true,
  },
  {
    name: 'book_appointment',
    description: 'Book an appointment for the caller. Only call after confirming the time slot with the caller.',
    parameters: {
      type: 'OBJECT',
      properties: {
        caller_name:  { type: 'STRING', description: "Caller's full name" },
        caller_email: { type: 'STRING', description: "Caller's email address" },
        caller_phone: { type: 'STRING', description: "Caller's phone number" },
        slot_time:    { type: 'STRING', description: 'ISO datetime of the selected slot (from check_availability results)' },
        notes:        { type: 'STRING', description: 'Any special notes or reason for appointment' },
        sms_consent:  { type: 'BOOLEAN', description: 'Caller explicitly said yes to a confirmation text with the booked time. If SMS consent was already asked and answered earlier this same call, reuse that same answer here — do not ask twice.' },
        sms_consent_answered: { type: 'BOOLEAN', description: 'True only after the caller heard the SMS disclosure and clearly answered yes or no, this call (now or earlier).' },
        caller_phone_confirmed: { type: 'BOOLEAN', description: 'True only after the caller stated their phone number and you read it back digit by digit and they explicitly confirmed it — same rule as email. Never infer, guess, or assume a number. If already confirmed earlier this call, reuse that. If unconfirmed, set false and never invent a value for caller_phone.' },
      },
      required: ['caller_name', 'caller_email', 'slot_time', 'sms_consent', 'sms_consent_answered', 'caller_phone_confirmed'],
    },
    needsCalendar: true,
  },
  ...(CLIENT_TOOL_DECLARATIONS as ToolDecl[]),
]

/**
 * The declarations a session is allowed to call. The routing flags are local
 * metadata, not part of Gemini's function-declaration schema — sending them
 * makes Live setup close with code 1007, so they are stripped here.
 */
export function selectToolDeclarations(mode: ToolMode, calendarEnabled: boolean) {
  return TOOL_DECLARATIONS
    .filter(d => (mode === 'webcrew' ? !d.clientOnly : !d.webcrewOnly))
    .filter(d => mode === 'webcrew' || !d.needsCalendar || calendarEnabled)
    .map(({ webcrewOnly: _w, clientOnly: _c, needsCalendar: _n, ...declaration }) => declaration)
    .map(d => mode === 'client' && d.name === 'book_appointment' ? optionalEmailBooking(d) : d)
}

// Client lines: the caller's email is optional when booking (see ClientCallSession.book). WebCrew's own sales
// line keeps it required.
function optionalEmailBooking<T extends { parameters?: any }>(d: T): T {
  const params = d.parameters
  if (!params) return d
  return {
    ...d,
    parameters: {
      ...params,
      properties: { ...params.properties, caller_email: { type: 'STRING', description: "Optional. Only if the caller offers one and you spelled it back and got a yes. Never required to book." } },
      required: (params.required ?? []).filter((k: string) => k !== 'caller_email'),
    },
  }
}
