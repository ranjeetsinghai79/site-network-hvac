export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"
import { requireClient } from "@/lib/client-auth"
import { getClientLead, getClientReception } from "@/lib/db"
import { googleCalendarEnabled, oauthClient, redirectUri, signState, SCOPES } from "@/lib/google-oauth"

// Step 1 of "Connect Google Calendar": send the signed-in client to Google's consent screen.
export async function GET(req: NextRequest) {
  const email = await requireClient()
  if (!email) return NextResponse.redirect(new URL("/client/login", req.url))

  const client = oauthClient()
  const lead = await getClientLead(email)
  const reception = lead ? await getClientReception(lead.id) : null
  if (!googleCalendarEnabled() || !client || !reception) return NextResponse.redirect(new URL("/client/dashboard?calendar=unavailable", req.url))

  const params = new URLSearchParams({
    client_id: client.id,
    redirect_uri: redirectUri(req.url),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",          // we need a refresh token: the AI books calls when the owner isn't logged in
    prompt: "consent",               // always return one, even if they connected before
    login_hint: email,
    state: await signState(email, reception.configId),
  })
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
