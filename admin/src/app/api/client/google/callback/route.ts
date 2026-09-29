export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"
import { requireClient } from "@/lib/client-auth"
import { saveGoogleCalendar } from "@/lib/db"
import { CALENDAR_SCOPE, emailFromIdToken, oauthClient, redirectUri, verifyState } from "@/lib/google-oauth"
import { encryptToken } from "@/lib/token-crypto"

// Step 2: Google sends the client back with a one-time code. Exchange it, store the refresh token encrypted.
export async function GET(req: NextRequest) {
  // Every failure logs a short code (visible in Cloudflare logs) and shows it to the user, so "it didn't work" is diagnosable.
  const done = (result: string, why?: string) => {
    if (result !== "connected" && result !== "denied") console.error(`[google-calendar] connect failed: ${result}${why ? ` (${why})` : ""}`)
    return NextResponse.redirect(new URL(`/client/receptionist?calendar=${result}${why ? `&code=${encodeURIComponent(why.slice(0, 60))}` : ""}`, req.url))
  }
  const q = new URL(req.url).searchParams
  if (q.get("error")) return done("denied")

  const email = await requireClient()
  const state = await verifyState(q.get("state"))
  // The person finishing the flow must be the same signed-in client who started it.
  if (!email) return done("error", "no_session")
  if (!state) return done("error", "bad_state")
  if (state.email !== email) return done("error", "state_email_mismatch")

  const client = oauthClient()
  const code = q.get("code")
  if (!client) return done("error", "oauth_not_configured")
  if (!code) return done("error", "no_code")

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: client.id, client_secret: client.secret, redirect_uri: redirectUri(req.url), grant_type: "authorization_code" }).toString(),
  })
  const tokens = await tokenRes.json().catch(() => ({})) as any
  if (!tokenRes.ok || !tokens.access_token) return done("error", `token_${tokens.error ?? tokenRes.status}`)
  // Google's consent screen lets people untick individual permissions.
  if (!String(tokens.scope ?? "").includes(CALENDAR_SCOPE)) return done("scope", "calendar_permission_unticked")
  if (!tokens.refresh_token) return done("retry", "no_refresh_token")

  // calendars.get needs a broader scope than the calendar.events we request (403 PERMISSION_DENIED), but
  // events.list is allowed and reports the calendar's timeZone — so it proves access AND gives us the timezone.
  const cal = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1&fields=timeZone", { headers: { Authorization: `Bearer ${tokens.access_token}` } })
  const calData = await cal.json().catch(() => ({})) as any
  if (!cal.ok) return done("error", `calendar_api_${cal.status}_${calData?.error?.status ?? ""}`)

  try {
    await saveGoogleCalendar(state.configId, {
      refreshTokenEnc: await encryptToken(tokens.refresh_token),
      email: emailFromIdToken(tokens.id_token),
      timezone: typeof calData.timeZone === "string" ? calData.timeZone : null,
    })
  } catch (e: any) {
    return done("error", `save_${String(e?.message ?? "failed").slice(0, 40)}`)
  }
  return done("connected")
}
