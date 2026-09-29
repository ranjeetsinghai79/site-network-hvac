import { pool } from '../reception/db.js'

// Landing-page "paste your URL" previews are anonymous, throwaway data by
// design (48h TTL set at creation — see migration-v46-preview-jobs.sql).
// Whether or not a visitor claimed one, the preview row itself is never a
// real client's permanent reception config (a claimed "add AI to my site"
// lead gets its own separate, permanent reception_configs row through the
// normal onboarding path — this cleanup never touches that). Deletes
// preview_jobs before reception_configs since preview_jobs.config_id is a
// FK into reception_configs with no ON DELETE behavior defined.
export async function cleanupExpiredPreviews(): Promise<{ jobsDeleted: number; configsDeleted: number }> {
  const jobs = await pool.query(`
    DELETE FROM preview_jobs
    WHERE expires_at < now()
       OR config_id IN (SELECT id FROM reception_configs WHERE is_preview = true AND preview_expires_at < now())
    RETURNING id
  `)
  const configs = await pool.query(`
    DELETE FROM reception_configs WHERE is_preview = true AND preview_expires_at < now() RETURNING id
  `)
  return { jobsDeleted: jobs.rowCount ?? 0, configsDeleted: configs.rowCount ?? 0 }
}

const isMain = process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href
if (isMain) {
  cleanupExpiredPreviews()
    .then(r => { console.log('[Preview Cleanup]', r); return pool.end() })
    .catch(e => { console.error('[Preview Cleanup] failed:', e.message); process.exit(1) })
}
