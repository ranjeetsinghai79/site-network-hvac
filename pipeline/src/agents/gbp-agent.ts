import { geminiText, GEMINI_FLASH } from '../tools/gemini.js'
import { createPost, GbpAccessRevokedError } from '../tools/google-my-business.js'
import { clearGbpCredentials }      from '../db/supabase.js'
import type { Lead, AgentResult }   from '../types.js'

export async function runGbpAgent(lead: Lead): Promise<AgentResult<{ post_created: boolean }>> {
  const accountId  = lead.gbp_account_id  ?? process.env.GBP_ACCOUNT_ID
  const locationId = lead.gbp_location_id ?? process.env.GBP_LOCATION_ID

  if (!accountId || !locationId) {
    return { success: false, error: `No GBP credentials for ${lead.name} — set gbp_account_id/gbp_location_id on lead or GBP_ACCOUNT_ID/GBP_LOCATION_ID env` }
  }

  const bd = lead.brand_data!

  try {
    const postText = await geminiText(
      `Write a Google Business Profile post for ${bd.name}, a ${lead.niche} business in ${lead.city}. 150 words max. Promote their services: ${bd.services?.slice(0, 3).join(', ')}. Include a call to action. Sound professional and local. No emojis.`,
      { model: GEMINI_FLASH, maxTokens: 400 }
    )

    const posted = await createPost({
      accountId,
      locationId,
      summary: postText,
      callToActionUrl: lead.cloudflare_url ?? lead.vercel_url,
    })

    return { success: true, data: { post_created: posted } }
  } catch (e: any) {
    if (e instanceof GbpAccessRevokedError && lead.id) {
      await clearGbpCredentials(lead.id)
      return { success: false, error: `${e.message} — cleared gbp_account_id/gbp_location_id on ${lead.name}` }
    }
    return { success: false, error: e.message }
  }
}
