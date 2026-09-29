import { geminiText, GEMINI_FLASH }    from '../tools/gemini.js'
import { listReviews, replyToReview, GbpAccessRevokedError } from '../tools/google-my-business.js'
import { clearGbpCredentials }         from '../db/supabase.js'
import pg                              from 'pg'
import type { Lead, AgentResult }      from '../types.js'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

// Star rating string → integer (GBP API returns "FIVE", "FOUR", etc.)
const STAR_MAP: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
}

async function upsertReview(leadId: string, review: any, replyText: string | null): Promise<void> {
  const rating   = STAR_MAP[review.starRating] ?? parseInt(review.starRating) ?? 3
  const comment  = review.comment ?? null
  const reviewer = review.reviewer?.displayName ?? null
  const reviewDate = review.createTime ? new Date(review.createTime) : null

  await pool.query(
    `INSERT INTO client_reviews
       (lead_id, review_id, reviewer_name, rating, comment, our_reply, replied_at, review_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (lead_id, review_id) DO UPDATE SET
       our_reply  = COALESCE(EXCLUDED.our_reply, client_reviews.our_reply),
       replied_at = COALESCE(EXCLUDED.replied_at, client_reviews.replied_at)`,
    [
      leadId,
      review.reviewId,
      reviewer,
      rating,
      comment,
      replyText,
      replyText ? new Date() : null,
      reviewDate,
    ]
  )
}

export async function runReviewsAgent(
  lead: Lead
): Promise<AgentResult<{ replied: number; skipped: number }>> {
  const accountId  = lead.gbp_account_id  ?? process.env.GBP_ACCOUNT_ID
  const locationId = lead.gbp_location_id ?? process.env.GBP_LOCATION_ID

  if (!accountId || !locationId) {
    return { success: false, error: `No GBP credentials for ${lead.name} — set gbp_account_id/gbp_location_id on lead or GBP_ACCOUNT_ID/GBP_LOCATION_ID env` }
  }

  try {
    const reviews = await listReviews({ accountId, locationId })

    // Upsert ALL reviews to DB (answered + unanswered) so portal has full history
    if (lead.id) {
      await Promise.allSettled(
        reviews.map((r: any) =>
          upsertReview(lead.id!, r, r.reviewReply?.comment ?? null)
        )
      )
    }

    const unanswered = reviews.filter((r: any) => !r.reviewReply)
    let replied = 0
    let skipped = 0

    for (const review of unanswered.slice(0, 10)) {
      const rating   = review.starRating
      const text     = review.comment || ''
      const reviewer = review.reviewer?.displayName || 'Customer'

      const replyText = await geminiText(
        `Write a professional Google review reply for ${lead.name} (${lead.niche} business).
Reviewer: ${reviewer}
Rating: ${rating}
Review: "${text}"

2-3 sentences. Thank them, address their specific feedback, invite them back. If negative, apologize and offer to make it right. No emojis.`,
        { model: GEMINI_FLASH, maxTokens: 250 }
      )

      const success = await replyToReview({
        accountId,
        locationId,
        reviewId: review.reviewId,
        replyText,
      })

      if (success) {
        replied++
        if (lead.id) {
          await upsertReview(lead.id, review, replyText).catch(() => {})
        }
      } else {
        skipped++
      }
    }

    return { success: true, data: { replied, skipped } }
  } catch (e: any) {
    if (e instanceof GbpAccessRevokedError && lead.id) {
      await clearGbpCredentials(lead.id)
      return { success: false, error: `${e.message} — cleared gbp_account_id/gbp_location_id on ${lead.name}` }
    }
    return { success: false, error: e.message }
  }
}
