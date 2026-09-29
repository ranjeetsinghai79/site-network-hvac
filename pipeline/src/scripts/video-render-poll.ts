/**
 * video-render-poll.ts
 *
 * Polls fal.ai's queue API for reels submitted via the admin Video Queue
 * (`admin/src/lib/video-generator.ts`'s submitFalKling, provider='fal_kling').
 * That submit call only enqueues the job (edge runtime, no long poll) — this
 * script is the other half: checks job status, downloads the finished mp4 URL,
 * marks the row 'rendered', and logs real spend via cost-tracker's reel_video
 * service (units = duration_sec, so a 10s reel logs as $1.40).
 *
 * Run via cron (every few minutes — fal renders typically finish in under 2min):
 *   cd pipeline && npx tsx src/scripts/video-render-poll.ts
 */

import 'dotenv/config'
import pg from 'pg'
import { logCost } from '../tools/cost-tracker.js'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const FAL_KEY = process.env.FAL_KEY
const MODEL_PATH = 'fal-ai/kling-video/v2.6/pro/image-to-video'

interface PendingRow {
  id: string
  lead_id: string | null
  business_name: string | null
  external_job_id: string
  duration_sec: number
}

async function main() {
  if (!FAL_KEY) {
    console.log('[VideoPoll] FAL_KEY not set — nothing to poll.')
    return
  }

  const { rows } = await pool.query<PendingRow>(
    `SELECT va.id, va.lead_id, gw.business_name, va.external_job_id, va.duration_sec
     FROM video_assets va
     LEFT JOIN growth_workspaces gw ON gw.id = va.workspace_id
     WHERE va.status = 'rendering' AND va.provider = 'fal_kling' AND va.external_job_id IS NOT NULL`
  )

  if (!rows.length) {
    console.log('[VideoPoll] No renders in flight.')
    return
  }
  console.log(`[VideoPoll] Checking ${rows.length} render(s)...`)

  for (const row of rows) {
    try {
      await checkOne(row)
    } catch (e: any) {
      console.error(`[VideoPoll] ${row.id}: ${e.message}`)
    }
  }
}

async function checkOne(row: PendingRow) {
  const statusRes = await fetch(
    `https://queue.fal.run/${MODEL_PATH}/requests/${row.external_job_id}/status`,
    { headers: { Authorization: `Key ${FAL_KEY}` } }
  )
  const statusData = await statusRes.json() as { status?: string; error?: string }

  if (statusData.status === 'IN_PROGRESS' || statusData.status === 'IN_QUEUE') {
    console.log(`  [VideoPoll] ${row.id} still ${statusData.status}`)
    return
  }

  if (statusData.status !== 'COMPLETED') {
    await pool.query(
      `UPDATE video_assets SET status = 'failed', render_error = $2, updated_at = now() WHERE id = $1`,
      [row.id, `fal.ai render failed: ${statusData.error ?? statusData.status ?? 'unknown'}`]
    )
    console.log(`  [VideoPoll] ${row.id} failed: ${statusData.error ?? statusData.status}`)
    return
  }

  const resultRes = await fetch(`https://queue.fal.run/${MODEL_PATH}/requests/${row.external_job_id}`, {
    headers: { Authorization: `Key ${FAL_KEY}` },
  })
  const resultData = await resultRes.json() as { video?: { url?: string } }
  const videoUrl = resultData.video?.url
  if (!videoUrl) {
    await pool.query(
      `UPDATE video_assets SET status = 'failed', render_error = $2, updated_at = now() WHERE id = $1`,
      [row.id, 'fal.ai reported COMPLETED but returned no video URL']
    )
    return
  }

  await pool.query(
    `UPDATE video_assets
     SET status = 'rendered', asset_url = $2, rendered_at = now(), render_error = NULL, updated_at = now()
     WHERE id = $1`,
    [row.id, videoUrl]
  )

  await logCost({
    service: 'reel_video',
    units: row.duration_sec,
    leadId: row.lead_id ?? undefined,
    leadName: row.business_name ?? undefined,
    note: `reel render, ${row.duration_sec}s w/ native audio`,
  })

  console.log(`  [VideoPoll] ${row.id} rendered ✓ (${videoUrl})`)
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error('[VideoPoll] Fatal:', e)
    return pool.end()
  })
