# Google Calendar one-click connect — setup

The code is deployed and dormant. Clients see "Connect Google Calendar" only after `GOOGLE_CALENDAR_ENABLED=true`
(admin app). Until then their dashboard says "Ask us to connect it" and the AI takes messages.

Already done: Calendar API enabled on `webcrew-501006`; `CALENDAR_TOKEN_KEY` (encrypts stored refresh tokens) set on
the admin app and in Secret Manager (`calendar-token-key`); DB migration v41 applied.

## What's left (about 10 minutes, in the Google Cloud console, project `webcrew-501006`)

1. **Google Auth Platform → Branding.** App name `WebCrew`; support + developer email `pavan.harati@gmail.com`;
   home page `https://webcrew.app`; privacy `https://webcrew.app/privacy`; terms `https://webcrew.app/terms`;
   authorized domain `webcrew.app`.
2. **Audience → External**, then **Publish app** (status "In production"). Do NOT leave it in "Testing": in Testing,
   Google expires refresh tokens after 7 days and the AI would silently lose the calendar every week.
3. **Data Access → Add scopes:** `openid`, `email`, `https://www.googleapis.com/auth/calendar.events`.
   (Only these. `calendar.events` is a "sensitive" scope — verification, no paid security audit.)
4. **Clients → Create client → Web application**, name `WebCrew dashboard`. Authorized redirect URIs:
   - `https://admin.webcrew.app/api/client/google/callback`
   - (optional, local testing) `http://localhost:3011/api/client/google/callback`
   Copy the **Client ID** and **Client secret**.
5. Give those two values to Claude (or set them yourself):
   - admin app (Cloudflare Pages `webcrew-admin`): `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_ENABLED=true`
   - reception server (Cloud Run `ai-reception`): `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`
   Both sides must use the same client (the reception server refreshes tokens with it).

## What the client sees

Dashboard → "Connect Google Calendar" → Google sign-in + one consent screen → back on the dashboard, connected.
Until Google verifies the app, the consent screen shows **"Google hasn't verified this app"** — the client clicks
*Advanced → Go to WebCrew (unsafe) → Continue*. Unverified apps are capped at 100 connected users. Submit for
verification in Google Auth Platform → Verification Center (needs the privacy/terms pages above, domain ownership of
`webcrew.app` in Search Console, and a short screen recording of the connect flow); typically days to a few weeks.

## Behaviour notes

- The AI only creates/edits/deletes events it made itself (tagged `webcrew=1`) and reads other events' busy times so it never double-books. It uses the client's **primary** calendar.
- Timezone comes from the client's Google calendar. Appointment length and bookable days/hours are edited on the dashboard (defaults: 1 hour, Mon–Fri 8–5, 2-hour lead time).
- If Google revokes access (client removes it in their Google account), the AI stops booking, takes messages, and emails the owner a reconnect link.
- Rotating `CALENDAR_TOKEN_KEY` invalidates every stored token — clients would have to reconnect.
