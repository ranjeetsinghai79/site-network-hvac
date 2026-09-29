import { GoogleGenAI } from '@google/genai'
import { bootstrapADC } from './gcp-auth.js'

// ── Vertex AI — tries credits project first, falls back to billed project ────
// 1. webcrew-501006        — $300 credits (016CC3-3F88BC-EEF775), spend here first
// 2. gen-lang-client-0362421597 — real money via recruitos-enterprise billing, backup
// 3. AI Studio free tier   — 20 req/day, last resort
//
// Same SA (webcrew-vertex@gen-lang-client-0362421597) holds aiplatform.user on
// both Vertex projects, so one key file covers both.
const CREDITS_PROJECT = process.env.VERTEX_CREDITS_PROJECT_ID ?? 'webcrew-501006'
const BILLED_PROJECT  = process.env.VERTEX_PROJECT_ID ?? 'gen-lang-client-0362421597'
// Gemini 3.x text models are served from Vertex's `global` location only — in
// us-central1 they 404, which (verified 2026-09-18) silently pushed every call down
// to the 20-req/day free tier. Live voice is different: it is regional (us-central1).
const LOCATION         = process.env.VERTEX_TEXT_LOCATION ?? 'global'

if (process.env.VERTEX_SA_FILE) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.VERTEX_SA_FILE
} else {
  bootstrapADC()
}

const _vertexCredits = new GoogleGenAI({ vertexai: true, project: CREDITS_PROJECT, location: LOCATION })
const _vertexBilled   = new GoogleGenAI({ vertexai: true, project: BILLED_PROJECT,  location: LOCATION })

// ── AI Studio (last resort) — free tier, 20 req/day ──────────────────────────
const AI_STUDIO_KEY = process.env.GOOGLE_AI_API_KEY
const _studio = AI_STUDIO_KEY?.startsWith('AIza') ? new GoogleGenAI({ apiKey: AI_STUDIO_KEY }) : null

export const GEMINI_PRO   = 'gemini-3.1-pro-preview'
export const GEMINI_FLASH = 'gemini-3.8-flash'


export interface GeminiOpts {
  model?: string
  maxTokens?: number
  temperature?: number
  systemInstruction?: string
  responseMimeType?: string
  responseSchema?: object
}

export async function geminiText(prompt: string, opts: GeminiOpts = {}): Promise<string> {
  const { model = GEMINI_FLASH, maxTokens, temperature, systemInstruction, responseMimeType, responseSchema } = opts
  const config: Record<string, any> = {}
  if (maxTokens)             config.maxOutputTokens  = maxTokens
  if (temperature != null)   config.temperature      = temperature
  if (systemInstruction)     config.systemInstruction = systemInstruction
  if (responseMimeType)      config.responseMimeType = responseMimeType
  if (responseSchema)        config.responseSchema   = responseSchema
  const req = (m: string) => ({
    model: m,
    contents: prompt,
    ...(Object.keys(config).length ? { config } : {}),
  })

  // 1. Vertex on the credits project — spend the $300 first
  try {
    const result = await _vertexCredits.models.generateContent(req(model))
    return result.text ?? ''
  } catch (e: any) {
    console.warn(`[Gemini] Vertex(credits:${CREDITS_PROJECT}) failed (${e.message?.slice(0, 100)}) — trying billed project`)
  }

  // 2. Vertex on the billed project (real money, small $)
  try {
    const result = await _vertexBilled.models.generateContent(req(model))
    return result.text ?? ''
  } catch (e: any) {
    console.warn(`[Gemini] Vertex(billed:${BILLED_PROJECT}) failed (${e.message?.slice(0, 100)}) — trying AI Studio fallback`)
  }

  // 3. AI Studio free tier — no pro quota there, downgrade to flash
  if (_studio) {
    const result = await _studio.models.generateContent(req(model === GEMINI_PRO ? GEMINI_FLASH : model))
    return result.text ?? ''
  }

  throw new Error('Gemini unavailable: both Vertex projects failed and no AI Studio key configured')
}
