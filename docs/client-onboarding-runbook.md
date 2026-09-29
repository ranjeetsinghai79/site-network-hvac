# Client Onboarding Runbook

What actually happens, step by step, from "we closed a deal" to "client is logged into their dashboard." Written 2026-08-23 after auditing the real code paths — this describes what's actually wired, not an aspiration.

## The happy path (client already has, or doesn't need, a website)

1. **Enter the deal**: `admin.webcrew.app/clients/onboard` (internal admin, not public). Fill in name, email, phone, plan, amount.
   → `admin/src/app/api/clients/onboard/route.ts`: upserts the `leads` row (idempotent by email/phone), creates a `growth_workspaces` row, generates a real recurring **Stripe Payment Link**, emails it to the client via Resend.
   → **Nothing else happens yet.** Payment is the hard gate — no Twilio number, no AI Reception config, no site changes until Stripe confirms the client actually paid.

2. **Client pays** the Stripe link.
   → `admin/src/app/api/stripe/webhook/route.ts` fires, verifies the Stripe signature (timing-safe, rejects >5min-old events), confirms `payment_status === 'paid'` before doing anything.
   → Automatically: marks `leads.paid = TRUE` → attaches custom domain (if one was pre-set on the lead) → calls `provisionReception()` (POSTs to the reception `/provision` endpoint with `paymentConfirmed: true`, which buys a Twilio number, wires voice + `StatusCallback` for missed-call recovery, saves the `reception_configs` row) → generates + sends a Stripe invoice → marks the lead `handed_off` → sends the client a **magic-link welcome email**.

3. **Client logs in**: clicks the magic link (or goes to `admin.webcrew.app/client/login`, enters their email, gets a fresh one — single-use, expires). Lands on `admin.webcrew.app/client/dashboard`: site status, call logs/stats, GSC traffic, reviews, and a **Stripe Billing Portal** button (real, not a stub).

That's it — steps 2-3 are fully automatic once step 1 is done and the client pays.

## Before their first call: connect their calendar (required for booking)

A client's receptionist has **no booking tools** until a calendar is connected — it takes messages instead. That is deliberate: without it, bookings would land on WebCrew's own calendar.

**Normal path (client does it, ~30 seconds):** they open their dashboard → **Connect Google Calendar** → sign in with Google. No keys, no technical steps. Then they can set appointment length and bookable days/hours on the same card. Requires the one-time Google console setup in [`docs/google-calendar-setup.md`](./google-calendar-setup.md) (`GOOGLE_CALENDAR_ENABLED=true`).

**Fallback (client uses Cal.com):** get their Cal.com API key + event-type ID and run
```bash
cd pipeline
CLIENT_CAL_API_KEY=cal_live_xxx npx tsx src/scripts/set-reception-calendar.ts <receptionConfigId> <eventTypeId> America/Los_Angeles
```
(verifies against Cal.com first; live on the next call; `--clear` disconnects). Also confirm the transfer number on their dashboard: escalation dials it (else the lead's phone) and refuses the AI number itself.

**What the client's receptionist does on a call:** answers from their business info; books, reschedules, cancels (only appointments tied to the caller's own caller ID or a confirmed booking email); takes messages; transfers on request or safety emergencies; ends vendor/spam calls. After each call it classifies the intent/urgency, writes a contact + pipeline card (`reception_contacts` / `reception_opportunities`, separate from WebCrew's own `leads`), texts appointment reminders (consented callers only, 8am-9pm local), and nudges the owner about unreturned leads with a one-tap "mark contacted" link. Reminders/nudges are sent by `com.webcrew.reception-follow-ups` (launchd, every 10 min, this Mac) or by `POST /follow-ups/run` on the reception server.

## If the client has no real website yet

Step 1 above still applies, but the reception config's `website_url` defaults to a placeholder (`onboarding.webcrew.app/client/<leadId>`) that resolves to nothing — it only exists as a stable DB key, not a page. **A human must separately run the actual site pipeline** (or the CLI below) to give the client something real:

```bash
# Build their AI-reception brain from a real URL + buy their Twilio number directly
# (bypasses the Stripe payment-confirmation gate — this is a manual operator tool, use
# only after you've independently confirmed they've paid)
cd pipeline && npx tsx src/scripts/provision-client.ts <their-real-website-url> [--area-code XXX] [--lead-id <uuid>]
```

Or run the full site-build pipeline (`npm run pipeline` from repo root) if they need a demo site built from scratch first.

## What's still manual, on purpose (as of 2026-08-23)

- **No self-serve signup.** Every deal gets hand-entered via the admin onboard form. Fine at current volume; revisit if that becomes the bottleneck.
- **No automatic site build on payment.** The webhook provisions AI Reception + billing, not a website. If the client needs a new/rebuilt site, someone runs the pipeline by hand.
- **Manual number verification for `provision-client.ts`** — since it skips the payment gate, only use it after confirming payment some other way (Stripe dashboard, bank deposit, whatever the deal actually was).

## Where to look when something breaks

| Symptom | Check |
|---|---|
| Client says the payment link didn't work | Stripe dashboard → Payment Links; `admin/src/app/api/clients/onboard/route.ts` `createPaymentLink` |
| Client paid but no welcome email | Cloud Run logs (`gcloud run services logs read ai-reception ...`) for `/provision` call; Resend dashboard for the send |
| Client can't log in | `admin/src/app/api/client/auth/route.ts` — magic tokens are single-use + expiring; have them request a fresh one |
| Dashboard shows no data | `admin/src/lib/db.ts` `getClientCallLogs`/`Stats`/`Trend` — confirm `reception_configs.lead_id` actually links to their `leads` row |
| Receptionist only takes messages, never books | No calendar connected — run `set-reception-calendar.ts` above. Cloud Run log line `[Relay] Client mode — calendar NOT connected` confirms |
| Reminders / lead nudges not arriving | `launchctl list \| grep reception-follow-ups`, `~/.webcrew-jobs/logs/reception-follow-ups*.log`; pending rows: `SELECT kind,status,due_at,last_error FROM reception_follow_ups ORDER BY due_at DESC LIMIT 20` |
| Dead air / silent receptionist on a client call | Cloud Run log for `[Gemini] closed — code: 1008` (model unavailable on Vertex — `GEMINI_LIVE_MODEL_VERTEX` must be `gemini-live-2.5-flash-native-audio`, location `us-central1`) or `MALFORMED_FUNCTION_CALL` |
| Billing portal button 400s | Lead has no `stripe_customer_id` yet — happens if they paid via a link that wasn't tied to a Stripe customer record |
