import { geminiText, GEMINI_FLASH } from '../tools/gemini.js'
import { buildBrain, buildSystemPrompt } from './brain-builder.js'
import { saveReceptionConfig, updatePreviewJob, type PreviewDisplayConfig } from './db.js'
import type { BusinessBrain } from './types.js'

// Landing-page "paste your URL" instant preview: a cheap, fast stand-in for
// the real multi-hour pipeline (orchestrator.ts). Reuses buildBrain()/
// buildSystemPrompt() verbatim (the same Firecrawl+Gemini extraction the real
// pipeline's reception provisioning already does) — deliberately does NOT
// touch fresh AI image/video generation or a real GitHub+Cloudflare deploy,
// both of which are genuinely multi-minute-to-hour operations. The full,
// polished site still gets built the normal way once a visitor converts
// (see api/src/index.ts's triggerAutomatedBuild — unchanged, not called here).

const PREVIEW_TTL_MS = 48 * 3600_000
const THEMES = ['clean', 'slate', 'dubai', 'noir', 'ocean', 'forest', 'ember'] as const

async function deriveDisplayConfig(brain: BusinessBrain): Promise<PreviewDisplayConfig> {
  const prompt = `You are writing homepage marketing copy for a local business's new AI-powered website.
Business: ${brain.name} (${brain.type}).
Services: ${brain.services.map(s => s.name).join(', ') || 'not listed'}.
${brain.special_notes ? `Notes: ${brain.special_notes}` : ''}

Return ONLY valid JSON, no other text:
{
  "tagline": "one short, punchy marketing headline for this business's homepage hero, under 12 words",
  "theme": "one of: clean, slate, dubai, noir, ocean, forest, ember — pick whichever best fits this business's industry and tone"
}`
  try {
    const text = (await geminiText(prompt, { model: GEMINI_FLASH })).trim()
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('no JSON in response')
    const parsed = JSON.parse(match[0])
    const theme = (THEMES as readonly string[]).includes(parsed.theme) ? parsed.theme : 'clean'
    const tagline = typeof parsed.tagline === 'string' && parsed.tagline.trim() ? parsed.tagline.trim() : `${brain.name} — now answered 24/7`
    return { tagline, theme }
  } catch (e: any) {
    console.warn('[Preview] display-config derivation failed, using fallback:', e.message)
    return { tagline: `${brain.name} — now answered 24/7`, theme: 'clean' }
  }
}

/** Runs one preview job end to end. Never throws — always lands the job in 'ready' or 'failed'. */
export async function runPreviewJob(jobId: string, url: string): Promise<void> {
  try {
    await updatePreviewJob(jobId, { stage: 'reading', progressPct: 10 })
    const brain = await buildBrain(url)
    // A dead/unreachable/contentless URL doesn't always throw inside buildBrain() —
    // Firecrawl can "succeed" with empty content, and Gemini's extraction prompt
    // explicitly allows null for missing fields (including, in practice, name).
    // Catch that here with a clear message instead of letting it surface later as
    // a raw NOT NULL constraint violation from saveReceptionConfig().
    if (!brain.name || !brain.name.trim()) {
      throw new Error("Could not find business information at that URL — check the address or try a different page.")
    }

    await updatePreviewJob(jobId, { stage: 'understanding', progressPct: 45 })
    const display = await deriveDisplayConfig(brain)
    const systemPrompt = `${buildSystemPrompt(brain)}\n\nPREVIEW MODE: this is a demo generated automatically from ${url} for a visitor evaluating WebCrew. Behave exactly as a real receptionist for ${brain.name} would — never mention this is a preview or demo unless directly asked.`

    await updatePreviewJob(jobId, { stage: 'building', progressPct: 80, displayConfig: display })
    const config = await saveReceptionConfig(url, brain.name, brain, systemPrompt, undefined, {
      isPreview: true,
      previewExpiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
    })

    await updatePreviewJob(jobId, { stage: 'ready', progressPct: 100, configId: config.id })
  } catch (e: any) {
    console.error(`[Preview] job ${jobId} failed:`, e.message)
    await updatePreviewJob(jobId, { stage: 'failed', error: String(e.message ?? e).slice(0, 300) })
  }
}
