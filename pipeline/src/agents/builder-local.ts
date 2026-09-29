import { buildAndDeployLocal } from '../tools/build-local.js'
import type { Lead, PipelineConfig, AgentResult } from '../types.js'
import type { HeroImages } from './image-generator.js'

// Brand color CSS — same logic as builder.ts
const HEX6 = /^#[0-9A-Fa-f]{6}$/

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

function darken(hex: string, f: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r * f, g * f, b * f)
}

function lighten(hex: string, f: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f)
}

function hexToRgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function generateBrandColorCSS(
  colors: { primary?: string; secondary?: string; accent?: string },
  theme: string
): string | null {
  const primary = colors.primary && HEX6.test(colors.primary) ? colors.primary : null
  const accent  = colors.accent  && HEX6.test(colors.accent)  ? colors.accent  : primary
  if (!primary && !accent) return null

  const base = primary ?? accent!
  const hi   = accent  ?? primary!

  return [
    `/* ── Client brand color override ── */`,
    `[data-theme="${theme}"] {`,
    `  --brand-bg:           ${darken(base, 0.08)};`,
    `  --brand-surface:      ${darken(base, 0.12)};`,
    `  --brand-card:         ${darken(base, 0.15)};`,
    `  --brand-accent:       ${hi};`,
    `  --brand-accent-light: ${lighten(hi, 0.25)};`,
    `  --brand-blob-1:       ${hexToRgba(hi, 0.25)};`,
    `  --brand-blob-2:       ${hexToRgba(base, 0.18)};`,
    `}`,
  ].join('\n')
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 55)
}

export async function runBuilderLocalAgent(
  lead: Lead,
  config: PipelineConfig,
  heroImages?: HeroImages | null,
  _heroVideoBuffer?: Buffer | null
): Promise<AgentResult<Lead>> {
  console.log(`[BuilderLocal] Building ${lead.name} (no GitHub)`)

  if (!lead.config_ts) {
    return { success: false, error: 'No config_ts on lead — run config-generator first' }
  }

  const repoName    = `site-${slugify(lead.name)}`
  const projectName = repoName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63)

  // CSS append: design tokens + brand color patch
  const designCssBlock   = lead.niche_profile?.design?.cssTokenBlock
  const googleFontsImport = lead.niche_profile?.design?.googleFontsImport ?? null
  const brandColors      = lead.brand_data?.colors
  const themeMatch       = lead.config_ts.match(/theme:\s*["']([^"']+)["']/)
  const theme            = themeMatch?.[1] ?? 'clean'
  const brandColorPatch  = brandColors ? generateBrandColorCSS(brandColors, theme) : null
  const cssAppend = [designCssBlock, brandColorPatch].filter(Boolean).join('\n\n') || null

  const envVars: Record<string, string> = {
    BUSINESS_NAME:         lead.name,
    BUSINESS_NICHE:        lead.niche,
    BUSINESS_OWNER_PHONE:  lead.phone  || '',
    BUSINESS_OWNER_EMAIL:  lead.email  || '',
    PIPELINE_API_URL:      process.env.PIPELINE_API_URL || 'https://api.webcrew.app',
  }

  let result: { url: string } | null = null
  try {
    result = await buildAndDeployLocal({
      niche:             config.niche,
      city:              lead.city ?? undefined,
      configTs:          lead.config_ts,
      cssAppend,
      googleFontsImport,
      businessName:      lead.name,
      heroImages:        heroImages ?? null,
      projectName,
      envVars,
    })
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Local build + deploy failed' }
  }

  if (!result) {
    return { success: false, error: 'Local build + deploy failed' }
  }

  return {
    success: true,
    data: {
      ...lead,
      github_repo:    `local:${projectName}`,
      cloudflare_url: result.url,
      status:         'deployed',
    },
  }
}
