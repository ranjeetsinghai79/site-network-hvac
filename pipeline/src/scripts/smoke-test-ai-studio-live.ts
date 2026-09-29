// Throwaway smoke test: confirms GOOGLE_AI_API_KEY + GEMINI_LIVE_MODEL_AI_STUDIO
// can open a Gemini Live session (setupComplete) via AI Studio, not Vertex.
// Isolates "does this SDK+model+key combo work" from the full Twilio/audio pipeline
// before flipping any real reception config over to the ai_studio backend.
//
// Run: cd pipeline && npx tsx src/scripts/smoke-test-ai-studio-live.ts
import 'dotenv/config'
import { GoogleGenAI, Modality } from '@google/genai'

const apiKey = process.env.GOOGLE_AI_API_KEY
const model  = process.env.GEMINI_LIVE_MODEL_AI_STUDIO ?? 'gemini-3.1-flash-live-preview'

if (!apiKey?.startsWith('AIza')) {
  console.error('GOOGLE_AI_API_KEY missing or malformed in pipeline/.env')
  process.exit(1)
}

async function main() {
  console.log(`[smoke-test] connecting to model=${model} via AI Studio...`)

  const ai = new GoogleGenAI({ apiKey })

  let settled = false
  const timeout = setTimeout(() => {
    if (settled) return
    settled = true
    console.error(`[smoke-test] FAILED — no setupComplete within 10s for ${model}`)
    process.exit(1)
  }, 10_000)

  const session = await ai.live.connect({
    model,
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: { parts: [{ text: 'You are a test assistant. Say hello.' }] },
    },
    callbacks: {
      onopen: () => console.log('[smoke-test] WebSocket open'),
      onmessage: (msg: any) => {
        if (msg.setupComplete && !settled) {
          settled = true
          clearTimeout(timeout)
          console.log(`[smoke-test] SUCCESS — setupComplete received for ${model}`)
          try { (session as any)?.close?.() } catch { /* ignore */ }
          process.exit(0)
        }
      },
      onerror: (e: any) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        console.error(`[smoke-test] FAILED — connect error:`, e?.message ?? e)
        process.exit(1)
      },
      onclose: (e: any) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        console.error(`[smoke-test] FAILED — closed before setupComplete, code: ${e?.code}, reason: ${e?.reason ?? ''}`)
        process.exit(1)
      },
    },
  })
}

main()
