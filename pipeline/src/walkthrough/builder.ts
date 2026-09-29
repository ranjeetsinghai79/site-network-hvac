/**
 * RE Walkthrough Builder — listing photos → cinematic walkthrough video.
 *
 * Per-room clips (Kling image-to-video via fal.ai, ~$0.098/clip) stitched
 * with ffmpeg into one 16:9 master. Honest framing: this is a cinematic
 * walkthrough (camera-move clips in walk order), not a 3D/Matterport tour.
 *
 * Upsell product for the luxury-realestate niche: agents pay $1k-3k for
 * this production; we make it from listing photos for under $1.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { fal } from '@fal-ai/client'
import { logCost } from '../tools/cost-tracker.js'
import { uploadImageToFal } from '../agents/hero-video-generator.js'
import { CAMERA_MOVES, ROOM_ORDER, inferRoomType, type RoomType } from './camera-moves.js'

const execFileAsync = promisify(execFile)

const KLING_MODEL = process.env.KLING_MODEL ?? 'fal-ai/kling-video/v1.6/pro/image-to-video'
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp)$/i

export interface WalkthroughScene {
  file: string
  room: RoomType
  prompt: string
  clipPath?: string
}

export interface WalkthroughResult {
  scenes: WalkthroughScene[]
  finalPath: string
}

/** Plan scenes from an images directory: infer room per file, sort in walk order. */
export function planScenes(imagesDir: string): WalkthroughScene[] {
  const files = readdirSync(imagesDir)
    .filter((f) => IMAGE_EXTENSIONS.test(f))
    .sort()
  const scenes = files.map((f) => {
    const room = inferRoomType(f)
    return { file: join(imagesDir, f), room, prompt: CAMERA_MOVES[room] }
  })
  scenes.sort((a, b) => ROOM_ORDER.indexOf(a.room) - ROOM_ORDER.indexOf(b.room))
  return scenes
}

export async function buildWalkthrough(params: {
  imagesDir: string
  outDir: string
  slug: string
  dryRun?: boolean
}): Promise<WalkthroughResult> {
  const scenes = planScenes(params.imagesDir)
  if (scenes.length === 0) throw new Error(`No images found in ${params.imagesDir}`)

  const scenesDir = join(params.outDir, 'scenes')
  const finalDir = join(params.outDir, 'final')
  mkdirSync(scenesDir, { recursive: true })
  mkdirSync(finalDir, { recursive: true })

  console.log(`[Walkthrough] ${scenes.length} scenes planned (~$${(scenes.length * 0.098).toFixed(2)} in Kling credits):`)
  for (const s of scenes) console.log(`  ${s.room.padEnd(9)} ← ${basename(s.file)}`)

  if (params.dryRun) {
    console.log('[Walkthrough] DRY_RUN — no clips generated.')
    return { scenes, finalPath: '' }
  }

  const falKey = process.env.FAL_KEY
  if (!falKey) throw new Error('FAL_KEY not set — required for Kling clip generation')
  fal.config({ credentials: falKey })
  await assertFfmpeg()

  // ── Animate each room ──────────────────────────────────────────────────────
  for (const [i, scene] of scenes.entries()) {
    const clipPath = join(scenesDir, `room-${String(i + 1).padStart(2, '0')}-${scene.room}.mp4`)
    console.log(`[Walkthrough] (${i + 1}/${scenes.length}) ${scene.room} → Kling...`)

    const imageUrl = await uploadImageToFal(readFileSync(scene.file) as Buffer)
    if (!imageUrl) {
      console.log(`  upload failed for ${basename(scene.file)} — skipping room`)
      continue
    }

    let lastError = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await fal.subscribe(KLING_MODEL, {
          input: {
            prompt: scene.prompt,
            image_url: imageUrl,
            duration: '5',
            cfg_scale: 0.5,
            negative_prompt: 'shaky camera, fast motion, people, pets, text, watermark, warping, morphing walls',
          } as any,
          logs: false,
        }) as any

        const videoUrl: string = result?.data?.video?.url
        if (!videoUrl) { lastError = 'Kling returned no video URL'; continue }

        const res = await fetch(videoUrl, { signal: AbortSignal.timeout(120_000) })
        if (!res.ok) { lastError = `download failed: ${res.status}`; continue }

        writeFileSync(clipPath, Buffer.from(await res.arrayBuffer()))
        scene.clipPath = clipPath
        await logCost({ service: 'kling_video', units: 1, leadName: params.slug })
        break
      } catch (e: any) {
        lastError = e.message
        if (attempt === 0) console.log(`  attempt 1 failed (${lastError}), retrying...`)
      }
    }
    if (!scene.clipPath) console.log(`  FAILED ${scene.room}: ${lastError} — skipping room`)
  }

  const clips = scenes.filter((s) => s.clipPath).map((s) => s.clipPath!)
  if (clips.length === 0) throw new Error('All clip generations failed — nothing to stitch')

  // ── Normalize + stitch ─────────────────────────────────────────────────────
  console.log(`[Walkthrough] Stitching ${clips.length} clips...`)
  const normalized: string[] = []
  for (const clip of clips) {
    const norm = clip.replace(/\.mp4$/, '.norm.mp4')
    await execFileAsync('ffmpeg', [
      '-y', '-i', clip,
      '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=24',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an',
      norm,
    ])
    normalized.push(norm)
  }

  const listFile = join(params.outDir, 'concat.txt')
  writeFileSync(listFile, normalized.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'))

  const finalPath = join(finalDir, 'walkthrough-16x9.mp4')
  await execFileAsync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', finalPath])

  console.log(`[Walkthrough] Done: ${finalPath} (${clips.length} rooms, ~${clips.length * 5}s)`)
  return { scenes, finalPath }
}

async function assertFfmpeg(): Promise<void> {
  try {
    await execFileAsync('ffmpeg', ['-version'])
  } catch {
    throw new Error('ffmpeg not found on PATH — install with: brew install ffmpeg')
  }
}
