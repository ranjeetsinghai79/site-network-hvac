import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fetchNicheVideo, fetchServicePhotos, fetchNichePhotos } from './pexels-video.js'

// In tsx CJS mode __dirname = pipeline/src/tools — go up 3 to monorepo root
declare const __dirname: string
const MONOREPO_ROOT = path.resolve(__dirname, '../../..')

const NICHE_TEMPLATE_DIR: Record<string, string> = {
  hvac:                   'templates/hvac',
  roofing:                'templates/roofing',
  dentist:                'templates/dentist',
  medspa:                 'templates/medspa',
  lawfirm:                'templates/lawfirm',
  remodeling:             'templates/remodeling',
  cleaning:               'templates/cleaning',
  'junk-removal':         'templates/junk-removal',
  daycare:                'templates/daycare',
  'auto-detailing':       'templates/auto-detailing',
  restaurant:             'templates/restaurant',
  'luxury-realestate':    'templates/luxury-realestate',
  salon:                  'templates/salon',
  barbershop:             'templates/barbershop',
  plumbing:               'templates/plumbing',
  landscaping:            'templates/landscaping',
  'pressure-washing':     'templates/pressure-washing',
  'epoxy-flooring':       'templates/epoxy-flooring',
  'basement-waterproofing': 'templates/basement-waterproofing',
  'foundation-repair':    'templates/foundation-repair',
  'septic-services':      'templates/septic-services',
  'tree-services':        'templates/tree-services',
}

type HeroImages = Record<'hero-1' | 'hero-2' | 'hero-3' | 'hero-4', Buffer | null>

async function downloadBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    return Buffer.from(ab)
  } catch { return null }
}

// Inject heroVideo URL into config.ts string
function injectHeroVideo(configTs: string, videoUrl: string): string {
  // Add heroVideo field into the config object, after the business block
  if (configTs.includes('heroVideo:')) return configTs  // already set
  return configTs.replace(
    /^(export const config: SiteConfig = \{)/m,
    `$1\n  heroVideo: ${JSON.stringify(videoUrl)},`
  )
}

// Inject image: "/service-N.jpg" into each item inside the services: [...] block only
function extractServiceTitles(configTs: string): string[] {
  const titles: string[] = []
  const re = /title:\s*"([^"]+)"/g
  // Only scan within the services block
  const block = configTs.match(/services:\s*\[[\s\S]*?\],?\s*\n/)
  if (!block) return titles
  let m: RegExpExecArray | null
  while ((m = re.exec(block[0])) !== null) titles.push(m[1])
  return titles
}

function injectServiceImages(configTs: string, count: number): string {
  // Find the services: [ ... ] block
  const servicesMatch = configTs.match(/services:\s*\[[\s\S]*?\],?\s*\n/)
  if (!servicesMatch) return configTs

  let n = 0
  const patchedServices = servicesMatch[0].replace(
    /(\{ icon: "[^"]+", title: "[^"]+",[^}]*?)(\s*\})/g,
    (match, inner, closing) => {
      if (inner.includes('image:') || n >= count) return match
      n++
      return `${inner}, image: "/service-${n}.jpg"${closing}`
    }
  )

  return configTs.replace(servicesMatch[0], patchedServices)
}

async function ensureCFProject(
  projectName: string,
  envVars: Record<string, string>
): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const token     = process.env.CLOUDFLARE_TOKEN
  if (!accountId || !token) throw new Error('CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_TOKEN not set')

  const base = 'https://api.cloudflare.com/client/v4'
  const hdrs = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const cfVars: Record<string, { value: string }> = {}
  for (const [k, v] of Object.entries(envVars)) cfVars[k] = { value: v }

  const res = await fetch(`${base}/accounts/${accountId}/pages/projects`, {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify({
      name: projectName,
      production_branch: 'main',
      deployment_configs: {
        production: {
          compatibility_date: '2024-09-23',
          compatibility_flags: ['nodejs_compat'],
          env_vars: Object.keys(cfVars).length > 0 ? cfVars : undefined,
        },
      },
    }),
  })

  const body = await res.json() as any
  if (!res.ok) {
    const msg = JSON.stringify(body?.errors ?? body)
    if (!msg.includes('already exists') && !msg.includes('taken')) {
      throw new Error(`CF project create failed: ${msg}`)
    }
    console.log('[build-local] CF project already exists — reusing')
  } else {
    console.log(`[build-local] CF project "${projectName}" created ✓`)
  }
}

export async function buildAndDeployLocal(params: {
  niche: string
  templateStyle?: string
  configTs: string
  city?: string
  cssAppend?: string | null
  googleFontsImport?: string | null
  businessName?: string
  heroImages?: HeroImages | null
  projectName: string
  envVars?: Record<string, string>
}): Promise<{ url: string } | null> {
  const { niche, city, cssAppend, googleFontsImport, businessName, heroImages, projectName, envVars = {} } = params
  let configTs = params.configTs

  const style = params.templateStyle ?? process.env.HVAC_TEMPLATE_STYLE
  const relTemplateDir = niche === 'hvac' && style === 'editorial'
    ? 'templates/hvac-editorial'
    : niche === 'hvac' && style === 'zigzag'
    ? 'templates/hvac-zigzag'
    // Same reasoning as builder.ts's resolveTemplateDir(): an unmapped niche
    // falls back to the generic template instead of guessing a folder name
    // that likely doesn't exist.
    : (NICHE_TEMPLATE_DIR[niche] ?? 'templates/generic-business')
  const templateDir    = path.join(MONOREPO_ROOT, relTemplateDir)

  if (!fs.existsSync(templateDir)) {
    console.error(`[build-local] Template not found: ${templateDir}`)
    return null
  }

  const configPath  = path.join(templateDir, 'src/lib/config.ts')
  const globalsPath = path.join(templateDir, 'src/app/globals.css')

  // ── Save originals ────────────────────────────────────────────────────────
  const origConfig  = fs.readFileSync(configPath, 'utf8')
  const origGlobals = fs.existsSync(globalsPath) ? fs.readFileSync(globalsPath, 'utf8') : null

  const IMAGE_KEYS = ['hero-1', 'hero-2', 'hero-3', 'hero-4'] as const
  const SERVICE_KEYS = ['service-1', 'service-2', 'service-3', 'service-4', 'service-5', 'service-6'] as const
  const origImages: Record<string, Buffer | null> = {}
  for (const k of [...IMAGE_KEYS, ...SERVICE_KEYS]) {
    const p = path.join(templateDir, `public/${k}.jpg`)
    origImages[k] = fs.existsSync(p) ? fs.readFileSync(p) : null
  }

  // ── Pexels: fetch stock video + service-specific photos ─────────────────
  const [pexelsVideo, serviceSlots] = await Promise.all([
    fetchNicheVideo(niche, city),
    fetchServicePhotos(niche, businessName),  // businessName seeds page offset → unique per business
  ])

  // Inject heroVideo URL into config
  if (pexelsVideo?.videoUrl) {
    configTs = injectHeroVideo(configTs, pexelsVideo.videoUrl)
    console.log('[build-local] heroVideo injected into config ✓')
  }

  // Download Pexels photos; track per-slot success for fal.ai fallback
  const serviceBuffers: (Buffer | null)[] = await Promise.all(
    serviceSlots.map(p => p ? downloadBuffer(p.url) : Promise.resolve(null))
  )
  const pexelsCount = serviceBuffers.filter(Boolean).length
  console.log(`[build-local] Pexels service photos: ${pexelsCount}/6 downloaded`)

  // fal.ai fallback: generate AI image for any slot Pexels couldn't fill
  const falKey = process.env.FAL_KEY
  if (falKey) {
    const { fal } = await import('@fal-ai/client')
    fal.config({ credentials: falKey })
    const NEG = 'cartoon, illustration, 3D render, CGI, text overlay, watermark, blurry, low quality, distorted'
    const missingIndices = serviceBuffers.map((b, i) => b === null ? i : -1).filter(i => i >= 0)
    if (missingIndices.length > 0) {
      console.log(`[build-local] fal.ai fallback for ${missingIndices.length} empty service slots`)
      const titles = extractServiceTitles(configTs)
      for (const idx of missingIndices) {
        const title = titles[idx] ?? `${niche} service`
        const prompt = `Professional ${title}, commercial photography, photorealistic, 8K, no text, no watermark, high detail`
        try {
          const result = await fal.subscribe('fal-ai/flux-pro/v1.1', {
            input: { prompt, negative_prompt: NEG, image_size: 'landscape_16_9', num_inference_steps: 28, num_images: 1 } as any,
          }) as any
          const url: string = result?.data?.images?.[0]?.url
          if (url) serviceBuffers[idx] = await downloadBuffer(url)
        } catch (e: any) {
          console.warn(`[build-local] fal slot ${idx + 1} failed: ${e.message}`)
        }
      }
      const falCount = serviceBuffers.filter((b, i) => b !== null && missingIndices.includes(i)).length
      if (falCount > 0) console.log(`[build-local] fal.ai filled ${falCount} service slots ✓`)
    }
  } else if (pexelsCount < 6) {
    // Fallback: fill remaining slots with generic niche photos
    const genericPhotos = await fetchNichePhotos(niche, 6 - pexelsCount)
    const genericBuffers = await Promise.all(genericPhotos.map(p => downloadBuffer(p.url)))
    let gi = 0
    for (let i = 0; i < serviceBuffers.length; i++) {
      if (serviceBuffers[i] === null && gi < genericBuffers.length) {
        serviceBuffers[i] = genericBuffers[gi++] ?? null
      }
    }
    console.log(`[build-local] Generic fallback filled ${gi} remaining slots`)
  }

  const photoBuffers = serviceBuffers.filter((b): b is Buffer => b !== null)

  // Only inject image paths for photos that actually exist
  if (photoBuffers.length > 0) {
    configTs = injectServiceImages(configTs, photoBuffers.length)
    console.log(`[build-local] service image paths injected (${photoBuffers.length}) ✓`)
  }

  try {
    // ── Patch template files ──────────────────────────────────────────────────
    fs.writeFileSync(configPath, configTs, 'utf8')
    console.log('[build-local] config.ts written ✓')

    if (origGlobals !== null) {
      const fontPrefix  = googleFontsImport ? `@import ${googleFontsImport};\n\n` : ''
      const cssSuffix   = cssAppend ? '\n\n' + cssAppend : ''
      if (fontPrefix || cssSuffix) {
        fs.writeFileSync(globalsPath, fontPrefix + origGlobals + cssSuffix, 'utf8')
        console.log(`[build-local] globals.css patched (fonts: ${!!fontPrefix}, tokens: ${!!cssSuffix}) ✓`)
      }
    }

    if (heroImages) {
      for (const k of IMAGE_KEYS) {
        const buf = heroImages[k]
        if (!buf) continue
        fs.writeFileSync(path.join(templateDir, `public/${k}.jpg`), buf)
      }
      console.log('[build-local] Hero images written ✓')
    }

    // Write Pexels service photos to public/service-N.jpg
    for (let i = 0; i < photoBuffers.length; i++) {
      fs.writeFileSync(path.join(templateDir, `public/service-${i + 1}.jpg`), photoBuffers[i])
    }
    if (photoBuffers.length > 0) {
      console.log(`[build-local] Service photos written (${photoBuffers.length}) ✓`)
    }

    // ── Next.js build ─────────────────────────────────────────────────────────
    console.log(`[build-local] Building ${niche} template…`)
    try {
      execSync(`npm run build --workspace=${relTemplateDir}`, {
        cwd:     MONOREPO_ROOT,
        stdio:   ['ignore', 'pipe', 'pipe'],
        timeout: 3 * 60_000,
        env:     { ...process.env, NODE_ENV: 'production' },
      })
    } catch (buildErr: any) {
      const output = (buildErr.stdout?.toString() ?? '') + (buildErr.stderr?.toString() ?? '')
      const lastLines = output.split('\n').filter((l: string) => l.trim()).slice(-10).join(' | ')
      throw new Error(`Next.js build failed: ${lastLines}`)
    }
    console.log('[build-local] Build complete ✓')

    // ── CF Pages project ──────────────────────────────────────────────────────
    await ensureCFProject(projectName, envVars)

    // ── Wrangler direct upload ────────────────────────────────────────────────
    const outDir = path.join(templateDir, 'out')
    if (!fs.existsSync(outDir)) throw new Error(`out/ dir not found after build: ${outDir}`)

    console.log(`[build-local] Deploying to ${projectName}.pages.dev…`)
    try {
      execSync(`wrangler pages deploy "${outDir}" --project-name="${projectName}" --commit-dirty=true`, {
        cwd:    MONOREPO_ROOT,
        stdio:  ['ignore', 'pipe', 'pipe'],
        timeout: 2 * 60_000,
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN:  process.env.CLOUDFLARE_TOKEN ?? '',
          CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
        },
      })
    } catch (deployErr: any) {
      const output = (deployErr.stdout?.toString() ?? '') + (deployErr.stderr?.toString() ?? '')
      const lastLines = output.split('\n').filter((l: string) => l.trim()).slice(-5).join(' | ')
      throw new Error(`Wrangler deploy failed: ${lastLines}`)
    }
    console.log(`[build-local] Deployed ✓ → https://${projectName}.pages.dev`)

    return { url: `https://${projectName}.pages.dev` }

  } catch (e: any) {
    // Re-throw so caller sees the real error; finally still runs to restore template
    throw e

  } finally {
    // ── Restore template to original state ────────────────────────────────────
    fs.writeFileSync(configPath, origConfig, 'utf8')
    if (origGlobals !== null) fs.writeFileSync(globalsPath, origGlobals, 'utf8')
    for (const k of IMAGE_KEYS) {
      const p = path.join(templateDir, `public/${k}.jpg`)
      const orig = origImages[k]
      if (orig) fs.writeFileSync(p, orig)
      else if (fs.existsSync(p)) fs.unlinkSync(p)
    }
    // Restore original service images
    for (const k of SERVICE_KEYS) {
      const p = path.join(templateDir, `public/${k}.jpg`)
      const orig = origImages[k]
      if (orig) fs.writeFileSync(p, orig)
      else if (fs.existsSync(p)) fs.unlinkSync(p)
    }
    console.log('[build-local] Template restored ✓')
  }
}
