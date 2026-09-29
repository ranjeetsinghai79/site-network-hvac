# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## AUTO-INVOKE RULE (read first, every session)

**If the task involves ANY of the following — invoke `/cinematic-build` skill BEFORE doing anything else:**
- Building or editing any file under `templates/*/`
- Creating or modifying any React component, section, or hook
- Any animation work (GSAP, Lenis, ScrollTrigger, loading screen, cursor)
- Any design decision (colors, layout, typography, spacing)
- Any new niche template or config.ts generation
- Running `npm run dev:<niche>` to test

This skill loads the full $25k quality stack context automatically. Do not skip it.

## External Design Resources (react-bits, lenis, GSAP, Vanta, Seesaw — scraped 2026-07-19)

Read `design-resources/REFERENCE.md` before pulling in any new animated component, background effect, cursor, or gallery pattern. Distills: react-bits' ~100-component catalog (Backgrounds/TextAnimations/Components/Animations, `ts-tailwind` variant matches our stack), Lenis upgrade options (`lenis/react`, `lenis/snap`), GSAP's full free plugin surface (Flip, Draggable, MotionPath — all unlocked, no Club GSAP anymore), why Vanta is skipped (Three.js version conflict — use react-bits' `ogl` Backgrounds instead), and Seesaw as an inspiration-only gallery. Full react-bits + lenis repo clones live in `design-resources/` (gitignored, re-clone command in the doc) — copy-paste components from there, don't `npm install` them as a package.

## Scroll-Sequence Hero (frame-by-frame scrub — verified 2026-07-17, pipeline-wired 2026-07-24)

Component: `packages/core/src/sections/scroll-sequence-hero.tsx`, exported as `ScrollSequenceHero` from `@core/web` (moved out of medspa-local — was template-local, now shared). Demo routes: `/scroll-demo` on both medspa (`npm run dev:medspa` → localhost:3102/scroll-demo/, 143 frames) and hvac (79 frames). Canvas frame-sequence scrub: GSAP ScrollTrigger pin 250% + scrub 0.5, prefers-reduced-motion guard, preload counter.
- Stock media keys ALL present in `pipeline/.env`: `PEXELS_API_KEY` (images+videos, 200 req/hr), `PIXABAY_API_KEY`, `UNSPLASH_ACCESS_KEY` (images only).
- Frame recipe: ~7fps, 1280w, q:v 4 → ~50KB/frame; keep total ≤10MB per hero.
- 21st.dev MCP: TWO servers installed at user scope 2026-07-17 — `magic` (stdio, `npx @21st-dev/magic`) + `21st` (HTTP, `https://21st.dev/api/mcp`, x-api-key header, key from `admin/.env.local` 21STDEV_API_KEY). Both `✓ Connected`. HTTP server is richer: `search` (free), `get_component` (2/day free tier), `generate` (21st AI). Can also be driven session-independent via raw curl JSON-RPC POST to the HTTP endpoint.
- 21st components USED on scroll-demo page (retrieved via MCP, adapted to house rules — framer-motion→GSAP, shadcn deps stripped, CSS vars): `magic-treatment-menu.tsx` (from 21st #18963 pricing) + `magic-testimonials.tsx` (from 21st #7267 testimonials grid).

**Pipeline-driven per-lead frames (opt-in, medspa only for now):** `SCROLL_HERO_ENABLED=true` env flag makes `orchestrator.ts` run `pipeline/src/tools/frame-extractor.ts` (`extractFramesFromVideo`, same fps=7/scale=1280/q:v4 recipe) on the hero MP4 that `hero-video-generator.ts` already produces per Tier-1 lead — zero extra generation cost, since it reuses the existing free-stock-first/Kling-fallback video instead of sourcing a new one. Frames upload via `uploadBinaryFilesBatch()` (`pipeline/src/tools/github.ts`, Git Data API — blobs+tree+commit in ~3 calls instead of one GET+PUT per file) to `<template>/public/frames/`. `SiteConfig.heroFrames`/`tier` (`packages/core/src/types/config.ts`) get spliced into the lead's generated `config.ts` string in `orchestrator.ts` (not via the Gemini prompt — config-generator runs before the hero video exists in the current call order, so the splice happens post-generation, pre-build). `templates/medspa/src/app/page.tsx` renders `<ScrollSequenceHero>` when `config.heroFrames` is set, else falls back to the existing `<MedSpaHero>`. Not yet wired for other niches — mechanical follow-up (repeat the page.tsx conditional + drop the niche gate in orchestrator.ts) once proven live.

## Fable Brain — Reasoning Standards

Standing orders for rigorous judgment on every task. Read [`fable-brain.md`](./fable-brain.md) — it is the execution protocol for intent-reading, verification, self-attack, and fake-competence detection. Run the **Final Gate** checklist before any non-trivial output.

## What This Is

**MedSpaOS** — AI revenue operating system for independent med spas.
Pivot: This repo was previously a generic multi-niche website pipeline (WebCrew). It is now focused exclusively on med spas, skin clinics, and IV therapy clinics.

Core positioning: "We don't sell med spas more leads. We turn the leads and patients they already have into booked, completed, repeat revenue."

Three systems:

1. **Pipeline** — medspa-focused outreach engine (MEDSPAS + USA_SkinClinics + USA_IVTherapy tabs):
   - **Tier 1 (no website)** → MedSpaOS pitch email + SMS: "missed calls, no-shows, and consults that didn't book are costing you revenue"
   - **Tier 2 (has website)** → revenue recovery audit email + SMS: "what's your no-show rate right now?"
   Fully automated, zero human steps per lead. Default niche: `medspa`.
2. **Templates** — medspa template is primary. See `templates/medspa/` (TreatmentMenuSection built). Skin-clinic and iv-therapy also relevant for aesthetic vertical.
3. **AI Reception** — Gemini Live (native audio) + Twilio Media Streams. Answers inbound calls for deployed clients. Server: `pipeline/src/reception/` — deployed to GCP Cloud Run (`webcrew-501006`, `us-central1`). Live URL: `https://ai-reception-459352382653.us-central1.run.app` (verified 2026-07-20 via `gcloud run services list`). **Also does outbound AI voice calling** (corrects earlier stale note that said inbound-only) — `server.ts`'s `POST /call` (generic dial) + `POST /warm-trigger` (call a warm lead after email click/SMS reply/form submit) hit real Twilio `Calls.json` REST (`initiateCall()`, with `MachineDetection`), and `twilio-relay.ts` gives Gemini Live an outbound-aware greeting when `isOutbound` is set. Triggered from Sofia's SMS flow (`api/src/index.ts` `triggerOutboundCall()`) only when a lead replies "CALL" — consent-gated by design, not cold dialing. Confirmed 2026-09-03 while evaluating salescloser.ai (third-party AI cold-calling SaaS) — not needed, this already covers the consented/warm-lead outbound case; do not use a third-party dialer for actual cold/unconsented numbers (TCPA artificial-voice rules apply the same as robocalls).

## Monorepo Workspaces

```
packages/core        → @core/web — shared component library (sections, hooks, types, effects)
templates/*          → 12 niche Next.js sites — import from @core/web
pipeline/            → AI pipeline (Node/TypeScript, tsx runtime)
admin/               → internal dashboard — Neon DB stats, leads, funnel (Next.js, port 3010)
api/                 → Cloudflare Worker — contact form handler, SMS/email, Sheets write
my-website/          → WebsiteDeveloper marketing landing page (port 3001)
webcrew/             → Webcrew marketing site (port 3002)
```

## Commands

```bash
# Pipeline (run from monorepo root)
npm run pipeline:dry          # dry-run (no GitHub/Cloudflare/email)
npm run pipeline              # live run
npm run pipeline:auto         # auto-run loop (pipeline/src/auto-run.ts)
npm run retention --workspace=pipeline  # run GBP + reviews + analytics agents

# Scraping (run from pipeline/ or via workspace)
cd pipeline && npm run scrape                          # scrape Google Maps (env-driven niche/city)
cd pipeline && npm run scrape:daily                    # daily scrape script (writes to DB — not the sheet pipeline)
cd pipeline && npm run outreach                        # send outreach (email + SMS)
cd pipeline && npm run outreach:dry                    # dry-run outreach (SMS_DRY_RUN=true)
cd pipeline && npm run outreach:t1                     # tier-1 only
cd pipeline && npm run repair                          # fix stuck/errored leads
cd pipeline && npm run api:deploy                      # deploy api/ Cloudflare Worker

# ─── Sheet scraping — 15 tabs, APPEND ONLY ───────────────────────────────────
# All 15 tabs use scrape-universal.ts. Never clears existing rows.
# Header: 22 columns (A–V)
#   A  Date Added       B  Business Name     C  Niche / Category  D  City
#   E  State / Country  F  Timezone          G  Phone             H  Email
#   I  Has Website      J  Website URL       K  Address           L  Rating
#   M  Reviews          N  GBP Claimed       O  Open Now          P  Price Level
#   Q  Tier             R  Maps URL
#   S  Business Email   T  Owner Email       U  Phone Type        V  Can SMS
#
# S/T populated by extractEmailsFromWebsite() — fetches site + /contact + /about pages
# U/V populated by lookupPhoneType() (libphonenumber-js/max, offline, free)
#   Phone Type values: mobile | landline | voip | toll-free | unknown
#   Can SMS: YES (mobile/voip/unknown) | NO (landline/toll-free)
#   US numbers always "unknown" due to number portability — SMS attempted anyway
#   outreach.ts + sms-agent.ts skip SMS when can_sms === false
#
# Spreadsheet: https://docs.google.com/spreadsheets/d/1wwZX7eriuA0i37t6_VOetkmHcS7YKiHXI2DYj7gfa9A
#
# ── LEAD STATE (2026-07-10) ──────────────────────────────────────────────────
# Sheet: 80,745 rows across 22 tabs
# DB (scraped_places): 134,148 unique (place_id, tab) pairs — dedup source of truth
#   Sheet vs DB gap fixed: backfill-db-from-sheet.ts synced 63,550 missing records (2026-07-10)
#   No duplicates possible — DB is authoritative for dedup, not sheet
#
# Per-tab counts (sheet rows / DB tracked):
#   Local SMBs    : 20,275 / 35,168  MEDSPAS       : 13,840 / 23,744
#   USA_Restaurants: 11,429 / 19,740  USA_DentalOffices: 10,734 / 18,137
#   USA_BarberShops:  4,099 /  6,271  USA_Salons    :  3,852 /  6,190
#   USA_SkinClinics:  3,180 /  6,134  USA_NailStudios:  2,176 /  3,895
#   INDIA_DentalOffices: 1,882 / 2,034  USA_IVTherapy:   827 / 1,800+
#
# Remaining scraping capacity (~141k more unique leads in current city lists):
#   MEDSPAS        : 687 active combos × ~60 = ~41k leads left
#   USA_DentalOffices: 343 active       × ~60 = ~21k leads left
#   USA_Restaurants: 298 active         × ~60 = ~18k leads left
#   USA_NailStudios: 203 active (0% done) × 60 = ~12k leads left (fresh!)
#   USA_SkinClinics: 161 active         × ~60 = ~10k leads left
#   Others (Salons, BarberShops, SMBs, IVTherapy, LawFirms, India): ~39k
#
# ── LEAD TARGETS (400k total) ────────────────────────────────────────────────
# MEDSPAS          : cap ~102k → currently 13,840 → need +86k
# USA_Restaurants  : cap ~102k → currently 11,429 → need +89k
# USA_Financial    : cap ~102k → currently  1,635 → need +98k
# Local SMBs       : cap ~142k → currently 20,275 → need +80k
# TOTAL TARGET: 400k | Current: 80,745 | Gap: 319,255
# ETA (Mac only, $0): ~25 days at 13k/day via scrape-fast.sh
#
# ── GCP CLOUD SCHEDULER STATUS (2026-07-10) ──────────────────────────────────
# STATUS: ALL 22 PAUSED (since 2026-07-03)
# ROOT CAUSE: Email enrichment caused 3h+ timeouts (1h limit × 2 retries)
# FIX NEEDED: Add SKIP_EMAIL_ENRICHMENT=true + set max-retries=0 to all jobs
#             Then resume all paused schedulers
# COST: GCP Cloud Run at hourly frequency = ~$90/mo — NOT free
#       DECISION: Use Mac-only scraping ($0) instead of GCP
#
# ── MAC-LOCAL SCRAPING ($0, primary strategy) ────────────────────────────────
# launchd job: runs scrape-fast.sh 1000 daily at 2am
# Plist: ~/Library/LaunchAgents/com.webcrew.scrape-fast.plist (WRITTEN, NOT YET LOADED)
# To activate (run once — macOS Sonoma/Ventura use bootstrap, NOT load):
#   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.webcrew.scrape-fast.plist
# To check: launchctl list | grep webcrew
# To disable: launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.webcrew.scrape-fast.plist
# NOTE: launchctl load fails with I/O error on Sonoma — always use bootstrap/bootout
# Log: pipeline/scrape-fast-launchd.log
#
# scrape-fast.sh yields ~13k/day:
# S-tier (2000/tab): MEDSPAS, SkinClinics, IVTherapy   → 6k/day
# A-tier (1000/tab): Salons, BarberShops, NailStudios, LocalSMBs → 4k/day
# B-tier (1000/tab): Dental, Restaurants, Financial     → 3k/day
# Scraping cost: $0 (Google Maps Playwright, no API cost)
# IMPORTANT: SKIP_EMAIL_ENRICHMENT is already set in scrape-fast.sh (no timeout risk)
#
# ── DEDUP GUARANTEE ──────────────────────────────────────────────────────────
# place_id tracked in scraped_places per (place_id, tab) — ON CONFLICT DO NOTHING
# exhausted combos tracked in scraped_combos — won't re-visit dry city+niche
# backfill-db-from-sheet.ts run 2026-07-10: sheet→DB synced, 134k total protected
# Run again to re-sync after any manual sheet edits:
#   cd pipeline && node --env-file=.env --import=tsx/esm src/scripts/backfill-db-from-sheet.ts
#   (or: set -a && source <(grep -v '^#' .env | grep -v '^$' | sed 's/^/export /') && set +a && npx tsx src/scripts/backfill-db-from-sheet.ts)
#
# NICHE SLUGS (maps-scraper.ts NICHE_QUERY):
#   MEDSPAS     : medspa-usa, botox-clinic, aesthetic-clinic, cosmetic-dermatology, laser-clinic
#   Financial   : financial-advisor, insurance-agent, life-insurance, tax-advisor, mortgage-broker
#   Restaurants : restaurant, italian-restaurant, mexican-restaurant, asian-restaurant, bbq-steakhouse
#   Local SMBs  : hvac, roofing, plumbing, cleaning, landscaping, auto-detailing, remodeling
#
# Manual runs:
cd pipeline && SHEET_TAB="Local SMBs" npx tsx src/scripts/scrape-universal.ts
cd pipeline && SHEET_TAB="MEDSPAS" npx tsx src/scripts/scrape-universal.ts
cd pipeline && SHEET_TAB="USA_DentalOffices" npx tsx src/scripts/scrape-universal.ts
cd pipeline && SHEET_TAB="USA_LawFirms" npx tsx src/scripts/scrape-universal.ts
cd pipeline && SHEET_TAB="USA_SkinClinics" npx tsx src/scripts/scrape-universal.ts
cd pipeline && SHEET_TAB="USA_IVTherapy" npx tsx src/scripts/scrape-universal.ts
cd pipeline && SHEET_TAB="USA_NailStudios" npx tsx src/scripts/scrape-universal.ts
# (SHEET_TAB = any of the 15 tab names above)
cd pipeline && SCRAPE_TARGET=500 SHEET_TAB="MEDSPAS" npx tsx src/scripts/scrape-universal.ts  # bulk run

# Sheet management
cd pipeline && node --env-file=.env --import=tsx/esm src/scripts/sync-status-tab.ts   # LIVE sync: rebuilds Status tab dashboard from DB+sheet (run any time)
cd pipeline && npx tsx src/scripts/init-all-headers.ts          # write 22-col header to all tabs (safe, skips if already correct)
cd pipeline && SHEET_TAB="MEDSPAS" ENRICH_LIMIT=500 npx tsx src/scripts/enrich-existing-rows.ts   # backfill email+phone cols for existing rows
cd pipeline && ENRICH_CONCUR=10 ENRICH_LIMIT=99999 npx tsx src/scripts/enrich-existing-rows.ts   # backfill all tabs
cd pipeline && npx tsx src/scripts/redistribute-leads.ts        # re-route Local SMBs rows to correct niche tabs (safe to re-run)
cd pipeline && npx tsx src/scripts/list-tabs.ts                 # list all tabs in spreadsheet
cd pipeline && npx tsx src/scripts/format-sheet.ts             # format "Local SMBs" tab
cd pipeline && npx tsx src/scripts/rebuild-sheet.ts --confirm   # DESTRUCTIVE: rebuild Local SMBs from DB (requires --confirm)

# Individual template dev servers
npm run dev:hvac
npm run dev:roofing
npm run dev:dentist
# ... dev:<niche> for any of the 25 niches

# Other apps
npm run dev:admin             # admin dashboard → http://localhost:3010
npm run dev:landing           # my-website → http://localhost:3001
npm run dev:webcrew           # webcrew → http://localhost:3002

# Ad winners research ($0, Playwright vs Meta Ad Library — proven-winner filter)
# Filter: started ≥MIN_DAYS ago AND still active = market-validated ad
cd pipeline && npx tsx src/scripts/ad-winners.ts "med spa botox"        # → ad-research/<slug>-<date>.md + creative brief
cd pipeline && MIN_DAYS=90 MAX_ADS=50 npx tsx src/scripts/ad-winners.ts "hvac repair"
cd pipeline && HEADLESS=false npx tsx src/scripts/ad-winners.ts "..."   # watch browser

# RE walkthrough video (realestate upsell — listing photos → cinematic tour)
# Room type inferred from filename (01-exterior.jpg, kitchen.png...); Kling ~$0.098/room + ffmpeg stitch
cd pipeline && DRY_RUN=true npx tsx src/scripts/walkthrough.ts ./photos "142-maple-ave"  # plan + cost estimate
cd pipeline && npx tsx src/scripts/walkthrough.ts ./photos "142-maple-ave"               # live → listing-walkthroughs/<slug>/final/walkthrough-16x9.mp4

# Cost tracking
npm run costs                 # last 30 days spend by service
npm run costs:total           # all-time totals
cd pipeline && npx tsx src/scripts/costs.ts --days 7  # last 7 days

# Demo site deployment (niche showcase sites on CF Pages)
# Triggered automatically on push to main via .github/workflows/deploy-niche-demos.yml
# HVAC: profix-hvac-demo.pages.dev (.github/workflows/deploy-hvac-demo.yml)
# All other niches: demo-<niche>.pages.dev (matrix workflow)
# Manual trigger: gh workflow run deploy-niche-demos.yml

# Domain management
npm run domain check jazzheating.com
npm run domain suggest "Jazz Heating & Air" "Tracy"
npm run domain connect "jazz heating" jazzheating.com
npm run domain list
npm run add-domain            # attach custom domain to deployed CF Pages project

# Image regeneration (when AI images need a redo)
npm run regen-images          # usage: add name-fragment and optional shot-index

# Template hero/project image generation (fal.ai Flux Pro)
cd pipeline && node --env-file=.env --import=tsx/esm src/scripts/gen-hero-grid-images.ts              # all niches
cd pipeline && node --env-file=.env --import=tsx/esm src/scripts/gen-hero-grid-images.ts <niche>       # one niche
cd pipeline && node --env-file=.env --import=tsx/esm src/scripts/gen-hero-grid-images.ts <niche> <file> # one file
# Each shot can override size: 'portrait_4_3' (default) | 'landscape_16_9' — use landscape for hero bg images

# Pipeline TypeScript check
cd pipeline && node_modules/.bin/tsc --noEmit

# Test DB connection
cd pipeline && npx tsx src/scripts/test-db.ts

# Apply DB migrations (idempotent — run in order)
# NEW migrations (v30+): use apply-migration.ts, not bare psql — it records what's
# applied in schema_migrations so drift (6 tables silently never migrated, found
# 2026-08-23) can't happen silently again:
#   cd pipeline && npx tsx src/scripts/apply-migration.ts src/db/migration-vNN-name.sql
psql $DATABASE_URL -f pipeline/src/db/migration-v2.sql
psql $DATABASE_URL -f pipeline/src/db/migration-v3-audits.sql
psql $DATABASE_URL -f pipeline/src/db/migration-v4.sql
psql $DATABASE_URL -f pipeline/src/db/migration-v5.sql
psql $DATABASE_URL -f pipeline/src/db/migration-v6-growth-os.sql
psql $DATABASE_URL -f pipeline/src/db/migration-v7-launch-foundation.sql
psql $DATABASE_URL -f pipeline/src/db/migration-v8-ads-foundation.sql     # ad_campaign_drafts table
psql $DATABASE_URL -f pipeline/src/db/migration-v9-compliance-launch.sql
psql $DATABASE_URL -f pipeline/src/db/migration-v11-gbp-per-client.sql
psql $DATABASE_URL -f pipeline/src/db/migration-v12-lead-events.sql
psql $DATABASE_URL -f pipeline/src/db/migration-v24-ad-performance.sql  # ad_performance_daily — required for /api/ads/performance
psql $DATABASE_URL -f pipeline/src/db/migration-v28-widget-sessions.sql  # widget_session_usage — per-IP daily cap for the webcrew.app avatar widget

# AI Reception (Gemini Live — GCP Cloud Run, port 3030)
npm run reception              # start reception server locally
npm run reception:migrate      # apply reception_configs table to Neon DB (run once)
npm run reception:setup        # provision reception for a business: npx tsx src/scripts/setup-reception.ts <url>
npm run reception:list         # list all provisioned receptions

# Reception server deploy (GCP Cloud Run — webcrew-501006, verified 2026-07-20)
# LIVE URL: https://ai-reception-459352382653.us-central1.run.app
# Redeploy after changes:
# 1. gcloud builds submit pipeline/ --tag us-central1-docker.pkg.dev/webcrew-501006/webcrew/ai-reception:latest --project=webcrew-501006
# 2. gcloud run deploy ai-reception --image=us-central1-docker.pkg.dev/webcrew-501006/webcrew/ai-reception:latest --region=us-central1 --project=webcrew-501006
# 3. Set Twilio phone webhook: POST https://ai-reception-459352382653.us-central1.run.app/voice/<configId>

# CF Worker env vars (for auto-provision on tier2 YES):
#   RECEPTION_SERVER_URL=https://ai-reception-459352382653.us-central1.run.app
#   RECEPTION_PROVISION_SECRET=wcreception-secret-2024

# Gemini Live model (bidiGenerateContent — confirmed working June 2026):
#   GEMINI_LIVE_MODEL=models/gemini-2.5-flash-native-audio-latest           # CURRENT DEFAULT — working
#   GEMINI_LIVE_MODEL=models/gemini-3.1-flash-live-preview                  # newer, untested
# WS endpoint: v1beta (NOT v1alpha). Old models removed: gemini-2.0-flash-live-001, gemini-2.5-flash-preview-native-audio-dialog
```

## Pipeline Architecture

`pipeline/src/orchestrator.ts` drives agents per lead, branching by tier:

**Tier 1 (no website) — full pipeline:**
```
lead-hunter    → Google Places API → tier1 (no website) + tier2 (has website) leads
brand-analyst  → Firecrawl scrape + Gemini → BrandData JSON (real photos, real reviews)
niche-brain    → Gemini → NicheProfile (unique visual style + cinematic prompts)
config-gen     → Gemini → TypeScript config.ts (real reviews as testimonials, niche copy)
image-gen      → real Google photos first; fal.ai Flux Pro fallback if < 4 real photos
video-gen      → Kling 1.6 Pro via fal.ai → 5s cinematic hero video
builder        → GitHub fork → writes config + uploads images + brand CSS injection
deployer       → Cloudflare Pages → polls until live
seo-agent      → sitemap.xml, robots.txt, schema JSON-LD
outreach       → Resend email + Twilio SMS: "here's your demo site — $299 one-time"
```

**Tier 2 (has website) — AI Reception outreach only:**
```
lead-hunter    → same as above
brand-analyst  → scrape for email/phone only
[everything else skipped]
outreach       → Resend email + Twilio SMS: "AI receptionist for [niche], test it: VAPI_DEMO_URL"
```

`Lead.status` full lifecycle:
`found → analyzed → config_generated → built → deployed → outreach_sent → sms_sent → conversation_active → meeting_scheduled → payment_link_sent → paid → handed_off`

Every step persists to Neon Postgres.

**Sheet-primary policy (2026-07-22):** the Google Sheet stays the primary lead store — reads/writes for outreach (`sheets-outreach.ts`, `sheets-sms-outreach.ts`) and scraping (`scrape-universal.ts`) go there directly. Neon's `leads` table is a secondary dedup/consent-lookup layer only, not the source of truth. Revisit once there are ≥10 paying clients. This does not apply to `consent_events`, `reception_configs`, or `call_logs` — those are compliance/live-client infrastructure that can't move to a sheet regardless of client count.

### Scale: Queue Worker (10-100 sites/day)

```bash
npm run worker:enqueue   # scan Google Maps + enqueue leads
npm run worker           # start N parallel workers (WORKER_CONCURRENCY=3)
npm run worker:status    # print queue depth
npm run worker:requeue   # retry stale leads
```

Uses `pg-boss` (Postgres-backed queue on Neon). `WORKER_CONCURRENCY` env controls parallelism.
Rate limits: Gemini 500 req/day free, fal.ai $0.04/img, Kling $0.05/video → ~$0.25/site total.

**Retention agents** (`pipeline/src/retention.ts`, run separately):
- `seo-agent` — generates sitemap.xml, robots.txt, schema JSON-LD, keyword list
- `gbp-agent` — posts weekly update to Google Business Profile via GMB API
- `reviews-agent` — fetches unanswered Google reviews, posts Gemini-generated replies
- `analytics-agent` — queries GSC for 28-day data, emails weekly summary to client
- `leads-agent` — handles contact form submissions → Neon + Google Sheets + Resend notify
- `video-agent` — Remotion 15s MP4 outreach video (install `@remotion/bundler @remotion/renderer remotion` first)

## packages/core (`@core/web`)

Shared library imported by every template. Never copy components between templates — extend core instead.

**Exports:**
```
@core/web            → sections + hooks + effects + types (barrel)
@core/web/sections   → Nav, Hero, HeroPhotoGrid, ScrollHero, Services, WhyUs,
                        Reviews, ServiceAreas, Contact, Footer, getIcon
@core/web/hooks      → useTextReveal, useEntranceReveal, useStaggerReveal,
                        useTilt, useParallax, useParticles, useScramble, useCounter
@core/web/types      → ThemeName, NicheName, Business, Service, Testimonial,
                        Stat, Reason, Property (all canonical config types)
@core/web/styles     → base CSS, tokens.css, utilities.css
```

**Hero variants:**
- `<Hero>` — cinematic full-bleed bg. Use `posterSrc="/hero-1.jpg"` for image bg, add `videoSrc` for video. Optional `posterBrightness` (0–1, default 0.45 — increase to 0.6–0.7 for portrait/people shots so subject is clearly visible). All niches now use this — no HeroPhotoGrid.
- `<ScrollHero>` — scroll-driven parallax hero (premium tier only)
- `<HeroPhotoGrid>` — deprecated for hero use. Do not use for new templates.

When adding a shared component, add to `packages/core/src/sections/` and export from `packages/core/src/sections/index.ts`.

## Template Architecture

Every template follows the same structure:
```
templates/<niche>/
  src/lib/config.ts          ← THE ONLY FILE that changes per client
  src/app/globals.css        ← @theme block with all CSS vars
  src/components/            ← nav, hero, services, why-us, reviews,
                                service-areas, contact, footer
  src/app/api/leads/route.ts ← POSTs to PIPELINE_API_URL/leads
```

**Design rules:**
- Tailwind v4 with `@theme {}` — ALL colors are CSS vars (`var(--color-*)`) never Tailwind color classes like `bg-green-500`
- GSAP only — no Framer Motion. Use `gsap.timeline()` for entrance sequences, `ScrollTrigger` for scroll-driven effects
- `EASE = [0.25, 0.46, 0.45, 0.94]` (or `"power3.out"`) everywhere for cinematic feel
- `next/link` is NOT used — plain `<a>` tags only
- Font weights `font-700`, `font-800`, `font-900` work as Tailwind utilities in v4

## Animation & UX Requirements (Draftly-standard)

Every template must implement ALL of the following. These are non-negotiable for award-winning feel.

### 1. Cinematic Loading Screen (`loading-screen.tsx`)
- Dark bg using `--brand-bg` gradient + aurora blobs
- Business name fades in → tagline fades in → progress bar fills → overlay slides up (yPercent: -100)
- Blocks body scroll (`overflow: hidden`) until complete
- Reference: `templates/hvac/src/components/loading-screen.tsx`

### 2. Scroll Progress Bar (`scroll-progress.tsx`)
- Fixed 2px bar at top of viewport
- Uses CSS var `--scroll-pct` driven by JS scroll listener
- Gradient: `--brand-accent` → `--brand-accent-light` with glow
- Reference: `templates/hvac/src/components/scroll-progress.tsx`

### 3. Lenis Smooth Inertia Scroll (`smooth-scroll.tsx`)
- `lerp: 0.1`, `smoothWheel: true`
- Must call `ScrollTrigger.update` on every Lenis scroll tick
- Already implemented — don't remove

### 4. GSAP Entrance Timelines (Hero)
Every hero must chain: label → badge → headline words → paragraph → CTAs → trust badges
```ts
const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
tl.from(labelRef.current, { opacity: 0, y: -16, duration: 0.45 })
  .from(words, { yPercent: 110, opacity: 0, stagger: 0.045, duration: 0.75 }, "-=0.8")
  // ... continue chaining
```

### 5. Word-Split Headlines (ALL sections, not just hero)
Wrap headings in `<SplitText>` (word-wrap + word-inner pattern). Use `useTextReveal` hook:
```tsx
import { useTextReveal } from "@/hooks/use-text-reveal"
// in component:
useTextReveal(headingRef, { start: "top 85%" })
```
Reference: `templates/hvac/src/hooks/use-text-reveal.ts`

### 6. Multi-Layer Parallax (Hero)
Three speeds: background (yPercent: -25, scrub: 1.5), photo grid (yPercent: -15, scrub: 2), content fade (opacity → 0, scrub: 1)

### 7. Horizontal Pinned Scroll (Services)
Desktop only (matchMedia `min-width: 1024px`). Pin section, translate track by `-scrollWidth + vw`. Cards animate as they enter via `containerAnimation`. Mobile: standard vertical stagger.

### 8. GSAP quickTo 3D Tilt (Why-Us / Feature Cards)
```ts
const setRotX = gsap.quickTo(card, "rotationX", { duration: 0.4, ease: "power2.out" })
const setRotY = gsap.quickTo(card, "rotationY", { duration: 0.4, ease: "power2.out" })
gsap.set(card, { transformPerspective: 900, transformStyle: "preserve-3d" })
```
Dynamic box-shadow shifts with mouse position for depth illusion.

### 9. Staggered Card Entrances (ALL grid/card sections)
Use `useStaggerReveal` hook from `@/hooks/use-text-reveal`:
```tsx
useStaggerReveal(containerRef, ".service-card", { y: 48, scale: 0.95, stagger: 0.07 })
```

### 10. Particle Canvas (Hero background)
50 slow-moving dots, color from `--brand-particle` CSS var. Canvas resizes on window resize.

### 11. Aurora Blob Background (Hero + Loading Screen)
Two radial blobs using `--brand-blob-1` and `--brand-blob-2` with `filter: blur(80px)`. Animate with `@keyframes aurora-drift`.

### 12. Magnetic Cursor (`cursor.tsx`)
Custom cursor follows mouse with `lerp`. Already implemented — keep in all templates.

### 13. Premium Hover on ALL Interactive Elements
- Cards: `.hover-lift` class (translateY -6px + shadow on hover)
- Buttons: `.btn-primary` shimmer gradient animation (already in globals.css)
- Nav links: subtle accent underline slide-in
- Images: `scale(1.05)` on hover with `transition-transform duration-500`

### 14. Image Reveal Animation
Hero images and section images use `.img-reveal` wrapper. GSAP drives `clipPath: inset(0 100% 0 0)` → `inset(0 0% 0 0)` on scroll enter.

### 15. Scroll-Triggered Counter Animation (Stats)
Number counters animate from 0 to value when entering viewport. Use `gsap.to({ val: 0 }, { val: target, onUpdate: () => el.textContent = Math.round(obj.val) })`.

### 16. Section Entrance (every non-hero section)
All section headings/subheads use `useEntranceReveal` or `useTextReveal`. No section should just appear without animation.

---

### Animation Timing Reference
| Element | Duration | Ease | Delay |
|---------|----------|------|-------|
| Hero label | 0.45s | power3.out | 0 |
| Hero words | 0.75s | power3.out | stagger 0.045 |
| Hero para | 0.6s | power3.out | overlap |
| Section heading | 0.65s | power3.out | scroll |
| Cards stagger | 0.65s | power3.out | 0.07 per card |
| Loading bar | 1.1s | power2.inOut | after name |
| Loading exit | 0.75s | power4.inOut | after bar |
| 3D tilt | 0.4s | power2.out | mouse move |

**Hero layout options:** cinematic bg (videoSrc/posterSrc) vs photo grid (`<HeroPhotoGrid>` from `@core/web`). Photo grid is for interior/service-heavy niches (cleaning, dentist, medspa). All others use video bg.

## Niche Signature Sections (Phase 2)

Each niche has a custom section replacing the generic Services component. All use CSS vars — no hardcoded colors.

| Niche | Component | File |
|-------|-----------|------|
| medspa | `TreatmentMenuSection` | `templates/medspa/src/components/treatment-menu.tsx` |
| lawfirm | `PracticeAreasSection` + `AttorneySection` | `templates/lawfirm/src/components/` |
| dentist | `SmileGallerySection` | `templates/dentist/src/components/smile-gallery.tsx` |
| cleaning | `GuaranteeSection` | `templates/cleaning/src/components/guarantee-section.tsx` |
| roofing | `MaterialsSection` | `templates/roofing/src/components/materials-section.tsx` |
| remodeling | `ProjectGallerySection` | `templates/remodeling/src/components/project-gallery.tsx` |
| junk-removal | `ProcessSection` | `templates/junk-removal/src/components/process-section.tsx` |
| daycare | `CurriculumSection` | `templates/daycare/src/components/curriculum-section.tsx` |
| auto-detailing | `PackagesSection` | `templates/auto-detailing/src/components/packages-section.tsx` |
| hvac | `BrandStorySection` + `HeroThermostat` | already existed, no change |
| restaurant | custom sections | already existed, no change |
| luxury-realestate | custom sections | already existed, no change |
| skin-clinic | `SkinMenuSection` | `templates/skin-clinic/src/components/skin-menu.tsx` |
| iv-therapy | `DripMenuSection` | `templates/iv-therapy/src/components/drip-menu.tsx` |
| nail-studio | `NailMenuSection` | `templates/nail-studio/src/components/nail-menu.tsx` |
| epoxy-flooring | `FinishShowcaseSection` | `templates/epoxy-flooring/src/components/finish-showcase.tsx` |

## Theme System

`packages/core/src/styles/tokens.css` defines all themes via CSS custom properties.

| Theme | Used by | Accent |
|-------|---------|--------|
| `clean` | all service templates + nail-studio (pink accent override) | indigo `#6366F1` |
| `slate` | medspa, skin-clinic (rose accent override `#E879A0`) | violet `#8B5CF6` |
| `dubai` | luxury-realestate | gold `#C9A96E` |
| `noir` | — (pipeline assigns to lawfirm) | white |
| `ocean` | dentist, iv-therapy | cyan `#06B6D4` |
| `forest` | — (pipeline assigns to daycare) | emerald |
| `ember` | — (pipeline assigns to restaurant) | amber |

Each template's `globals.css` sets `:root { --font-display: ...; --font-body: ...; }` to override the clean theme's Inter fallback with the niche-appropriate font (Playfair for lawfirm, Cormorant for medspa, Montserrat for roofing, etc.).

**config.ts exports:** `BUSINESS`, `SERVICES`, `TESTIMONIALS`, `TRUST_BADGES` — all template components read only from these.

When adding a new niche template, also update:
- `pipeline/src/types.ts` — add to `PipelineConfig.niche` union
- `pipeline/src/agents/builder.ts` — add to `NICHE_TEMPLATE_DIR`
- `pipeline/src/agents/config-generator.ts` — add fallback services
- `package.json` root — add `dev:<niche>` script

## New Modules (committed July 2026)

| Module | Path | Status |
|--------|------|--------|
| **Ads planner** | `pipeline/src/ads/` | Wired into orchestrator (auto-generates Google Search + Meta + Instagram draft campaigns per lead). Admin approval UI live at `admin/src/app/ads/` (approve/reject/publish). Live publish: Google Ads real (creates PAUSED budget+campaign+adgroup+keywords+ad via Google Ads API, gated `ADS_PUBLISH_LIVE=true`), Meta real but partial (creates PAUSED campaign shell only — no ad set/creative yet). TikTok Ads: no integration exists. `GOOGLE_ADS_CLIENT_ID` set in `admin/.env.local` (reuses main Google OAuth client). `META_APP_ID` still missing — create app at developers.facebook.com. Google Ads API access level (test vs Standard) unconfirmed — Standard requires manual Google review before real client accounts can be used. |
| **Ads performance sync** | `admin/src/lib/ad-reporting.ts` | Pulls last 30 days spend/impressions/clicks/conversions from Google Ads (GAQL `googleAds:search`) + Meta (Graph API `/insights`) for published campaigns, upserts into `ad_performance_daily` (migration v24). Trigger: `POST /api/ads/performance/sync` (optional `{draftId}` body for one campaign) or "Sync Performance" button on `admin/src/app/ads/`. Read: `GET /api/ads/performance?draft_id=xxx&days=30` → totals (spend, CTR, cost-per-lead) + daily series. No auto-schedule yet — manual trigger only, wire into a cron/GCP Scheduler hit on the sync endpoint if this needs to run unattended. Shared OAuth/token logic (Google refresh, Meta account lookup) factored into `admin/src/lib/ad-connections.ts`, reused by both `ad-publisher.ts` and `ad-reporting.ts`. |
| **Growth OS** | `pipeline/src/growth/` | Growth brain + DB layer for per-client growth plans |
| **Compliance** | `pipeline/src/compliance/` | TCPA/ad policy checker + `getLaunchReadiness()` — `PUBLIC_PRIVACY_URL`/`PUBLIC_TERMS_URL` now set and live (verified 2026-08-23: `webcrew.app/privacy` + `/terms` both 200), no longer blocking |
| **Cal.com booking** | `pipeline/src/reception/cal-booking.ts` | LIVE — `check_availability` + `book_appointment` tools in Gemini Live. Key: `CAL_DIY_API_KEY`. Event type: `CAL_EVENT_TYPE_ID` (default `6126925`) |
| **GCP auth** | `pipeline/src/tools/gcp-auth.ts` | Vertex AI JWT auth |
| **Gemini client** | `pipeline/src/tools/gemini.ts` | Vertex AI Gemini client (alternative to google-ai-studio) |
| **Sheets SMS outreach** | `pipeline/src/scripts/sheets-sms-outreach.ts` | SMS outreach directly from Google Sheets rows |
| **Ad winners research** | `pipeline/src/ads/winners.ts` | $0 Meta Ad Library scraper — proven winners (60+ days AND still active). `winnersToCreativeBrief()` feeds planner/Gemini. Pattern from advertising-ops repo (evaluated 2026-07-13, not installed) |
| **RE walkthrough** | `pipeline/src/walkthrough/` | Listing photos → per-room Kling clips (room→camera-move map in `camera-moves.ts`) → ffmpeg stitch. Upsell for realestate niche. Pattern from re-walkthrough-pro repo (not installed; used own fal.ai stack, no Apify/Higgsfield) |

## Social/Reel Content Engine (built 2026-09-07)

Client-facing add-on (also used for WebCrew's own accounts) — automated reel + carousel/image generation with tiered cadence, approval-gated, native platform publishing where feasible.

**Discovery that shaped this build**: `pipeline/src/video/` (types/planner/providers/store) + `video_assets` table (migration-v20) + full admin approval UI (`admin/src/app/video/`, wired into `/api/approvals`) already existed, fully built, but **completely dormant** — never called from orchestrator/retention, and no provider (`runpod`/`gcp_veo`/`hyperframes`) could actually render anything (no RunPod worker deployed, no Vertex Veo access). Rather than build a parallel reel system, extended this one.

**What was added**:
- **`fal_kling` provider** (`pipeline/src/video/types.ts`, `admin/src/lib/video-generator.ts`) — Kling 2.6 Pro image-to-video via fal.ai's plain REST queue API (`queue.fal.run`, not the `@fal-ai/client` SDK — admin routes run on Vercel Edge, where the SDK's Buffer/Blob usage isn't safe to assume). `generate_audio: true` always on for reels — native audio in the same generation call, no separate TTS/mux step. Cost: `reel_video` service in `cost-tracker.ts`, $0.14/sec (~$1.40/10s reel). **Default provider now** (`preferredProvider()` checks `FAL_KEY` first) since it needs zero new infra, unlike RunPod/GCP Veo.
- **Async render flow**: admin's edge route only submits the fal.ai job (`external_job_id` = fal request_id, status→`rendering`). `pipeline/src/scripts/video-render-poll.ts` (new, Node/pg, needs its own cron — see below) polls `queue.fal.run/.../requests/{id}/status`, fills in `asset_url` on completion, logs cost. Video is image-to-video — every reel draft needs a `source_image_url` (new column) or it stays on `provider:'manual'` rather than attempt a doomed render.
- **`planner.ts`'s `createVideoAssetDrafts`** gained a `mode: 'ad' | 'reel'` param (default `'ad'`, fully backward compatible with the dormant phase-two-ad-video behavior). `mode:'reel'` sets `assetType:'reel'`, 10s duration, `hasNativeAudio:true`, and `provider:'fal_kling'` only when a `sourceImageUrl` was supplied.
- **Tiered cadence** — new `content_cadence_plans` table (migration-v37, one row per workspace): `tier` (`weekly_lite`: 1 reel + 1 carousel + 2 images/week — matches the real SMM lead-sheet data where most budgets are <$500/mo and ask for weekly updates; `daily_premium`: 3 reels + 1 carousel/day, upsell tier), `channels[]`, `period`. Admin UI: `admin/src/app/content-plans/page.tsx` + `admin/src/app/api/content-plans/route.ts` (pick a workspace, tier, channels — upserts by workspace_id).
- **`pipeline/src/scripts/content-cadence-cron.ts`** (new) — daily run, generates drafts (needs_approval, spends nothing) for every plan due per its `period`. Resolves the reel's source image from `leads.business_brain.media.{hero_images,gallery_images}[0]`; skips reel generation with a log line (not a crash) if the client has no brand images on file yet. Reel count is honored literally (loops `reels_per_period` times, round-robins configured channels); social image/carousel counts are NOT multiplied per run — the underlying social planner only produces one image_post+carousel per channel per call, so running on the plan's own cadence already matches "N per period" without faking content variety there's no real prompt-diversity logic for yet.
- **Native video publishing** (`admin/src/lib/video-publisher.ts`, new `publishApprovedVideoAsset`, gated by `VIDEO_PUBLISH_LIVE`) — **Facebook Reels fully implemented**: 3-step Resumable Upload API using the `file_url` hosted-transfer method (Meta fetches the rendered mp4 itself from `asset_url` — no binary streaming through our server, edge-safe). **LinkedIn, YouTube, X are `manual_handoff` stubs, not implemented** — all three need real binary/chunked upload (LinkedIn: initializeUpload→PUT byte-range parts→finalizeUpload; YouTube: resumable PUT, needs a nodejs-runtime route not edge; X: INIT/APPEND/FINALIZE) that wasn't safe to write correctly without live credentials to test against — each is its own follow-up pass, not guessed blind. **Instagram + TikTok stay `manual_handoff` by design** — native posting needs Meta/TikTok business app review (weeks-long external approval) before our app can call `instagram_content_publish`/Content Posting API at all; more code here can't shortcut that.
- **Pricing** (mirrors the existing flat-pricing philosophy, no negotiation): add-on to the $299/mo base, not bundled in. **Weekly Lite ~$99-149/mo**, **Daily Premium ~$249-349/mo**. Raw AI cost per client: ~$45/mo (weekly, 1 reel) to ~$135/mo (daily, 3 reels w/ audio) — leaves healthy margin at either tier.
- **Cron jobs written but NOT activated** — `com.webcrew.video-render-poll` (every 5 min) and `com.webcrew.content-cadence-cron` (daily 7am) plists + runner scripts exist at the usual `~/.webcrew-jobs/`/`~/Library/LaunchAgents/` locations (same pattern as `drip-followup`/`health-check`), but were deliberately left un-bootstrapped — turning them on means real recurring fal.ai spend and draft generation against real client workspaces, a call worth making explicitly rather than silently. Run `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.webcrew.<name>.plist` for each when ready to go live.
- **Migration `migration-v37-content-engine.sql`** — written, not yet applied to live Neon DB. Run via `apply-migration.ts` per the standard convention before any of this can actually persist data.
- **Not yet done**: no actual client has a `content_cadence_plans` row yet (feature is code-complete, not yet turned on for anyone); `FAL_KEY`'s existing quota/spend headroom hasn't been checked against the added reel-render volume this unlocks.

### TS Errors (5, non-fatal at runtime)
All in reception — `BusinessBrain | fallback` union not narrowed before passing to `buildSystemPrompt()` in `server.ts:286-287`, `setup-reception.ts:53-57`, and `FunctionDeclaration[]` mismatch in `gemini-live.ts:66`.
Fix: add `if (!brain || 'error' in brain) return fallbackBrain` guard before each call.

## Key Files

| File | Purpose |
|------|---------|
| `pipeline/src/types.ts` | `Lead`, `BrandData`, `PipelineConfig`, `AgentResult<T>` — all shared types |
| `pipeline/src/orchestrator.ts` | Main pipeline loop, sequential agent chaining |
| `pipeline/src/run.ts` | Entry point, reads env vars into `PipelineConfig` |
| `pipeline/src/retention.ts` | Retention loop — GBP, reviews, analytics for deployed clients |
| `pipeline/src/db/supabase.ts` | DB layer — uses `pg` + `DATABASE_URL` (Neon Postgres, not Supabase) |
| `pipeline/src/db/schema.sql` | DB schema — run once to initialize |
| `pipeline/src/db/migration-v2.sql` | Adds Places API v1 expanded fields + sales-funnel columns (idempotent) |
| `pipeline/src/tools/cost-tracker.ts` | `logCost()` — call from agents after paid API calls; query with `costs` script |
| `pipeline/src/tools/domain-registrar.ts` | Domain availability (RDAP) + CF Registrar integration + domain suggestions |
| `pipeline/src/tools/google-sheets.ts` | Sheets API — `appendSheetRow`, `clearSheet`, `writeSheetRows`, `listSheetTabs`, `batchUpdateSheet` |
| `pipeline/src/scripts/scrape-universal.ts` | **Master scraper** — all tabs, append-only, 22-column header. Runs email+phone enrichment per lead automatically. Use `SHEET_TAB=<tab>` env |
| `pipeline/src/scripts/enrich-existing-rows.ts` | Backfill email+phone cols for existing rows. Resume-safe. `SHEET_TAB`, `ENRICH_LIMIT`, `ENRICH_CONCUR` env |
| `pipeline/src/tools/email-extractor.ts` | Fetches website + /contact + /about, extracts business_email + owner_email via regex. 7s timeout, no API cost |
| `pipeline/src/tools/phone-lookup.ts` | Classifies phone as mobile/landline/voip/toll-free/unknown using libphonenumber-js/max (offline, free). Sets can_sms flag |
| `pipeline/src/scripts/rebuild-sheet.ts` | Rebuild "Local SMBs" from DB. **DESTRUCTIVE** — requires `--confirm` flag |
| `pipeline/src/scripts/list-tabs.ts` | List all tabs in the Google Spreadsheet |
| `pipeline/src/scripts/format-sheet.ts` | Apply professional formatting (header, widths, filters) to "Local SMBs" |
| `pipeline/src/scripts/regen-images.ts` | Regenerate fal.ai hero images for a lead by name fragment |
| `pipeline/src/scripts/add-domain.ts` | Attach custom domain to a deployed CF Pages project + update DB |
| `pipeline/src/scripts/domain.ts` | CLI for domain check / suggest / connect / list |
| `pipeline/src/scripts/costs.ts` | View spend by service (daily or all-time) |
| `pipeline/src/scripts/deps-tracker.ts` | Checks tracked deps via GitHub API |
| `packages/core/src/sections/index.ts` | Barrel — all shared section components |
| `packages/core/src/types/config.ts` | Canonical types: ThemeName, NicheName, Business, Service, etc. |
| `packages/core/src/hooks/index.ts` | Barrel — all animation hooks |
| `admin/src/app/page.tsx` | Dashboard home — reads live stats/leads/funnel from Neon |
| `admin/src/lib/db.ts` | Admin DB queries (read-only, no pg-boss) |
| `admin/src/lib/pool.ts` | CF Workers-compatible pg pool (no `pg` native bindings) |
| `admin/src/lib/edge-crypto.ts` | HMAC token signing for CF Workers (Web Crypto API) |
| `admin/Dockerfile` | Admin containerized deploy (for GCP Cloud Run if needed) |
| `admin/wrangler.toml` | Admin CF Worker deploy config |
| `api/src/index.ts` | CF Worker entry — contact form → Resend + Twilio + Google Sheets |
| `api/wrangler.toml` | Worker config — routes to api.webcrew.app |
| `pipeline/src/ads/planner.ts` | Generate Google/Meta/Instagram ad campaign drafts per lead |
| `pipeline/src/ads/store.ts` | Persist ad drafts to `ad_campaign_drafts` table |
| `pipeline/src/ads/export.ts` | Export drafts in platform-native API format |
| `pipeline/src/compliance/readiness.ts` | `getLaunchReadiness()` — full env/infra checklist |
| `pipeline/src/compliance/policy.ts` | TCPA/SMS/ad compliance policy checks |
| `pipeline/src/growth/brain.ts` | Growth plan generator (Gemini) |
| `pipeline/src/reception/cal-booking.ts` | Cal.com v2 — slot availability + booking creation |

## webcrew.app Avatar Widget (built 2026-08-21)

Floating "talk to WebCrew" widget on webcrew.app — voice + text chat with the same Gemini Live sales brain that answers the live demo phone number (+19182555151), so a visitor can be greeted, qualified, and captured as a lead without hunting for the contact form.

- **Frontend**: `webcrew/src/components/avatar-widget.tsx`, mounted globally in `webcrew/src/app/layout.tsx`. No pre-rendered avatar video — the face is CSS/JS (blink/breathe idle loop, mouth height driven by the actual output audio's per-chunk RMS), so there's no asset-generation or hosting cost. Mic capture: `ScriptProcessorNode` downsamples to 16kHz PCM16, base64-framed over WS. Playback: PCM24kHz chunks scheduled back-to-back via `AudioBufferSourceNode` with a running `nextPlayTime` cursor. Text-input fallback always available (mic denial doesn't block the widget). Env: `NEXT_PUBLIC_WIDGET_WS_URL` (defaults to the Cloud Run reception service's `/widget-ws`), `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (Cloudflare Turnstile, invisible mode, loaded lazily on first widget open).
- **Backend**: extends the existing AI Reception Cloud Run service (`pipeline/src/reception/`) rather than standing up new infra — `gemini-live.ts` and `cal-booking.ts` are reused unchanged. New: `browser-relay.ts` (mirrors `twilio-relay.ts`'s tool-call handling but for a browser WS instead of Twilio Media Streams — no mulaw codec needed, browsers speak PCM16/24kHz natively), wired into `server.ts` as a second `WebSocketServer` on `/widget-ws` alongside the Twilio `/ws` path. Shared conversation-state helpers (`hasSpeechEnergy`, email/closing validators, owner/caller notification senders) were extracted from `twilio-relay.ts` into `relay-shared.ts` so both relays use one copy. System prompt: `buildWidgetSystemPrompt()` in `webcrew-prompt.ts` wraps `WEBCREW_SYSTEM_PROMPT` with a widget-mode override (no phone-call language, no live transfer claims, text input is the preferred email-confirmation path instead of SMS-verify). Leads land in the same `leads` table via `upsertReceptionLead` — no new lead-capture endpoint needed.
- **Abuse protection (new — Twilio call gating doesn't apply to a public widget)**: Cloudflare Turnstile verified server-side per session start (`TURNSTILE_SECRET_KEY` — **fails open with a warning if unset**, so set it before real launch); origin allowlist (`WIDGET_ALLOWED_ORIGINS`, default `https://webcrew.app`); per-IP daily session cap (`WIDGET_DAILY_IP_CAP`, default 20, tracked in new `widget_session_usage` table via `db.ts`'s `getWidgetSessionCountToday`/`incrementWidgetSessionCount`); hard per-session duration cap (`WIDGET_MAX_SESSION_MS`, default 4 min) that forces a wrap-up and closes the session regardless of activity, unlike the phone relay's silence-only idle timeout.
- **Scroll companion (2026-08-21)**: the avatar roams the page as the visitor scrolls, without any extra AI cost. Each `<section>` in `webcrew/src/components/missed-call-landing.tsx` carries a `data-avatar-caption="..."` attribute (one hand-written line per section, colocated with that section's copy so future edits stay in sync). `avatar-widget.tsx` runs one `IntersectionObserver` over all `[data-avatar-caption]` elements — **`threshold: 0` with a shrunk `rootMargin: '-35% 0px -35% 0px'`** (a thin center-of-viewport detection band) drives which section counts as "current"; a higher threshold array combined with that rootMargin was tried first and silently never fired past the hero (a tall section's overlap with the shrunk band is a small fraction of its own height, so it never crossed 0.3+) — keep `threshold: 0` if touching this. The caption renders as a speech bubble above the launcher (only while the chat panel is closed); clicking it calls the same `openWidget()` as the launcher button, handing off from passive narration straight into the live Gemini conversation. Verified working end-to-end in-browser (Playwright: scrolled to multiple sections, confirmed the bubble text tracked each one, confirmed clicking it opened the chat panel).
- **Backend deployed and verified live (2026-08-22)**: migration-v28 applied to Neon; reception Cloud Run redeployed with `browser-relay.ts`/`/widget-ws`; confirmed the `https://webcrew.app` `reception_configs` row exists (id `2eb501f4-8af2-4b2c-b60f-5e5dfeec8c8e`, same one backing the live demo number). Verified with a real WS client and via Playwright against `localhost:3002` pointed at the live Cloud Run backend: session connects, Gemini goes ready, typed messages get real Gemini replies rendered in the transcript, widget-mode phrasing holds ("chatting with WebCrew", not "calling").
- **Real bug hit + fixed during that deploy — `ws`'s `{server, path}` mode does not support two `WebSocketServer` instances on one `http.Server`.** Each instance's `handleUpgrade` fires for *every* upgrade on that server regardless of path, and calls `abortHandshake(socket, 400)` if the path doesn't match its own — so the first-registered instance (`/ws`, Twilio) was silently 400-ing every `/widget-ws` request before the widget's own `WebSocketServer` ever got a chance to see it. Fixed in `server.ts`: both `wss` and `widgetWss` now use `noServer: true`, with a single `server.on('upgrade', ...)` handler that parses the pathname and calls `.handleUpgrade()` on the matching instance manually (the pattern `ws`'s own docs recommend for multi-path servers on one HTTP server). **If a third WS path is ever added here, it must go through this same dispatcher — do not add another `{server, path}` instance.**
- **Second bug fixed**: `avatar-widget.tsx`'s `ws.onclose` only updated status text, never released the mic stream/`AudioContext`s — so a server-side rejection (bad origin, daily cap, missing config) left the mic hot with no cleanup. Fixed to always `teardown()` on close, and to surface a real error message (not a silent "ended") when the close code isn't the normal `1000`.
- **`WIDGET_ALLOWED_ORIGINS` now defaults to `https://webcrew.app,http://localhost:3002`** (was prod-only, which blocked local dev testing against the live backend — the actual cause of the first "not connected" report). Origin is a defense-in-depth layer here, not the primary gate (Turnstile + the per-IP cap are); loosening it to include the known local dev port is low risk.
- **Still not done**: `webcrew/` itself has NOT been pushed to its `deploy` remote yet — the live webcrew.app site does not have the widget. Local dev (`npm run dev:webcrew`) now correctly talks to the live Cloud Run backend, but going live on the actual domain needs `git -C webcrew push deploy main`. Also still open: create a Cloudflare Turnstile site and set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (frontend) + `TURNSTILE_SECRET_KEY` (Cloud Run env) — currently unset, so the bot-check fails open with a logged warning on every session.

## Call-Gap Latency Fix + Pricing Rewrite (2026-08-23)

- **Fixed a real audio-gap cause**: `take_message` (fires on nearly every real conversation) was `await`ing the confirmation SMS then the confirmation email **sequentially** in both `twilio-relay.ts` and `browser-relay.ts` before responding to Gemini — Gemini can't speak again until that tool response lands, so every lead capture stalled the call. Changed to `Promise.all` in both files. Not a total fix for all latency (Gemini generation time + `check_availability`'s single Cal.com call are still inherent), but removes the clearly avoidable stall. **Not yet deployed to Cloud Run** — code-reviewed and typechecked only.
- **Confirmed via Twilio API**: A2P 10DLC campaign is `VERIFIED` (not test-tier), 2 numbers on the Messaging Service, both voice+SMS enabled on the same number. 100/day outreach is trivial against this; no separate number needed.
- **New real offer synced across the AI agent + the website**: setup fee (normally $499) is $0 for every new customer today, every plan includes a 2-week free trial. Added as `setupFee`/`freeTrial` fields + updated `speakingInstruction` in `get_webcrew_pricing`'s response (both relays), a proactive-mention line in `webcrew-prompt.ts`'s VALUE AND SOLUTION section, and a budget-objection line ("talk to our crew, we're here to help") in OBJECTION HANDLING. Website: `webcrew/src/components/pricing.tsx` price-journey rewritten to 4 steps (demo → setup $0 → 2wk trial → plan), free-tier banner updated, new "Budget tight? Talk to our crew — Happy Customers. Happy Business. Happy Crew." banner added. Verified rendering correctly via `NEXT_PUBLIC_SHOW_PRICING=true` local preview (screenshotted) — **the pricing section itself stays gated off `NEXT_PUBLIC_SHOW_PRICING`, not flipped on**.
- **Pricing reconciled across voice, widget, and SMS (2026-09-02)** — was previously "Growth $99/mo + $69/mo founding floor" in voice/widget vs. a "let them name their price" negotiation + separate `$49/$69/$79/mo` tiers in Sofia's SMS agent. All three now sell the identical flat plan: **$0 setup, 2-week free trial, then $299/mo flat "AI Front Office"** — no tiers, no negotiation. `twilio-relay.ts`/`browser-relay.ts`'s `build_founder_offer` tool is deprecated (returns `success:false`, points to `escalate_to_human`) rather than removed, in case any live call mid-flow still calls it. **Still NOT reconciled** (deliberately out of scope, separate decision needed): `admin/` dashboard (`economics/page.tsx`, `billing-card.tsx`, `payment-modal.tsx`, `api/leads/[id]/checkout/route.ts`'s `basic`/`reception` Price IDs) and the `webcrew/` marketing site (`pricing.tsx`'s cards + "Pricing Roadmap" table, `terms/page.tsx`) still show the older `$49/$69/$149` tier structure.
- **Launch-readiness DB audit (2026-08-23)**: ran `getLaunchReadiness()` against real env — no `blocked` items, everything `ready`/`manual`. But found real drift: 6 tables defined across migration files were never actually applied to the live Neon DB (no migration-tracking table exists, so nothing catches this) — `api_keys`, `scheduler_log`, `webhook_log` (all migration-v3, all referenced by live code: `admin/src/app/api/v1/keys/route.ts`, `pipeline/src/scheduler.ts`, `pipeline/src/tools/webhook.ts` — would have thrown at runtime), `ad_performance_daily` (v24, required for `/api/ads/performance`), `reception_cap_alerts` (v27, silently no-ops today via existing try/catch in `trackCallCostAndCap`, so voice-cap-exceeded alert emails were never actually being sent). `location_groups` (v3) also missing but genuinely unused by any code — left as-is. Applied migration-v3/v24/v27; re-verified all migration-defined tables now exist. **No migration-tracking mechanism exists at all** — this kind of silent drift can recur; worth adding a simple `schema_migrations` table if this happens again.
- **Deploy status (updated 2026-08-23, launch-readiness pass)**: everything from today is live. Reception Cloud Run redeployed. Root repo + `webcrew` repo both pushed to `origin`. `webcrew` also pushed to `deploy` (`ranjeetsinghai79/webcrew`) — **the avatar widget and pricing.tsx copy are live on webcrew.app now** (pricing *section* itself still gated off, `NEXT_PUBLIC_SHOW_PRICING` unchanged). `api/src/index.ts` (rate limiting) redeployed via `wrangler deploy`. `webcrew`'s deploy pipeline is GitHub Actions (`.github/workflows/deploy.yml`, triggers on push to `main`), **not** CF Pages' native git integration (that project has no git provider connected) — worth knowing before assuming a push alone deploys anything for this repo.
- **Found + fixed a real bug while verifying the live widget**: `startSession()` gated the entire WebSocket connection behind `getUserMedia()` succeeding — a denied/failed mic permission threw before the WS ever opened, silently blocking **text chat too**, directly contradicting the UI's own "You can still type below" copy. Split into `startSession()` (WS + Gemini connect, always) and `startMic()` (capture, best-effort, independently retryable via the mic button without reconnecting the whole session). Verified via Playwright: session reaches "Listening" and text round-trips with a real Gemini reply even when mic capture silently fails.
- **Found + fixed a real voice-transcription bug** (2026-08-23, auditing an actual real conversation in `call_logs` — a real caller's clearly-English speech about "Steve's HVAC in Tracy, California" was randomly rendered mid-conversation in Hindi/Telugu script, while the AI's actual replies stayed contextually correct throughout — comprehension was fine, only the displayed transcript was corrupted). Root cause: `downsampleTo16k()` in `avatar-widget.tsx` used naive nearest-neighbor point sampling (pick every Nth sample) to go from the browser's native 48kHz down to Gemini's required 16kHz — no anti-aliasing, which degrades the audio Gemini's STT actually receives. Switched to box-filter (averaging) decimation. Deployed and live; **not yet re-verified against a real voice conversation** (only confirmed via typecheck/build) — worth a real test call to confirm the transcript stays in English throughout.
- **Zero clients have ever completed onboarding** — confirmed via DB query, `leads` table has 0 rows with `paid = true` or `handed_off = true`. The payment→provisioning→dashboard chain (see `docs/client-onboarding-runbook.md`) is real, wired code that has never actually been exercised end-to-end by anyone. **`admin`'s `STRIPE_SECRET_KEY` is `sk_live_...` (live mode)** — confirmed via `admin/.env.local` (labeled "Stripe — LIVE"). Do NOT run a test purchase through the admin onboarding flow expecting it to be free — it charges a real card. Only `api/`'s own separate `STRIPE_SECRET_KEY` (Sofia's autonomous-close key) is deliberately kept in test mode — see the Sofia/autonomous-close section below.

## Launch-Readiness Fixes (2026-08-23)

- **Fixed the public `/leads` + `/audit` toll-fraud gap** flagged since 2026-07-13. Root cause confirmed: `handleLeadSubmission` (`api/src/index.ts`) sends a real SMS to whatever `businessOwnerPhone` is in the POST body — meant to be the demo site's real owner (injected server-side by the builder), but nothing stops a direct POST supplying an arbitrary number, with no consent gate on that specific send. Fixed with per-IP rate limiting (`isRateLimited()`, 5 requests per 10 min per IP per endpoint), backed by a new `public_form_submissions` table (migration-v29), fails open only on a DB error. **Deployed and load-tested live** — 6 rapid requests to `/leads` returned 200×5 then 429; test rows cleaned from both the DB table and the real "Website Inbound Leads" Google Sheet tab afterward. Deliberately did *not* add a visible CAPTCHA/Turnstile — would've required frontend changes across every form; the IP throttle alone closes the abuse vector.
- **`admin.webcrew.app` custom domain** was missing entirely (DNS didn't resolve) — the client welcome email and `provision-client.ts` both point new clients there. Added via Cloudflare Pages API (`webcrew-admin` project) + a CNAME the user added manually (`CLOUDFLARE_TOKEN`/`CLOUDFLARE_API_TOKEN` in `.env` both lack Zone:DNS:Edit scope, confirmed via failed API calls — can't create zone DNS records with either token). Verified live: `admin.webcrew.app/client/login` → 200.
- **Migration drift fixed + prevented**: 2026-08-23 audit found `api_keys`, `scheduler_log`, `webhook_log` (v3), `ad_performance_daily` (v24), `reception_cap_alerts` (v27) were defined in migration files but never actually applied to the live Neon DB — no tracking mechanism existed to catch this. Applied all three files. Added `schema_migrations` table (migration-v30) + `pipeline/src/scripts/apply-migration.ts` (runs a file AND records it, idempotent) — **use this for all new migrations going forward**, not bare `psql -f`. Backfilled records for all 35 existing migration files (all now confirmed applied).
- **Client onboarding runbook written**: `docs/client-onboarding-runbook.md` — the actual happy path (admin onboard form → Stripe Payment Link → webhook auto-provisions AI Reception + billing → magic-link login → dashboard), the no-website-yet fallback, what's still manual by design, and a break-glass table for common failure symptoms. Confirmed by an Explore-agent audit that the payment→provisioning→dashboard chain is real code, not a stub (Stripe signature verification, `payment_status==='paid'` gating before any provisioning, `paymentConfirmed` flag only ever set by the verified webhook).
- **Self-serve client signup**: explicitly deferred (user decision) — manual admin-form onboarding stays the path for now. Revisit if onboarding volume becomes the bottleneck.
- **External, can't-be-code-fixed items — still open, need YOUR action**:
  - **Meta `META_APP_ID`**: create an app at developers.facebook.com under the WebCrew Meta Business account (Business → App Type "Business" → add Marketing API product). Needed for `ads/publisher.ts`'s Meta ad-set/creative creation (currently campaign-shell-only).
  - **Google Ads API access level**: currently unconfirmed test vs Standard. Standard requires submitting the app for Google's manual review via the Ads API Center (console.cloud.google.com → your project → Google Ads API → Apply for Standard Access) — full review can take days/weeks. Don't turn on live ad spend until this clears.

## Sofia SMS Sales Agent — Intent-Driven, TCPA-Gated, Autonomous Close (2026-09-01/02)

`api/src/index.ts`'s `handleSMSWebhook` runs "Sofia," the Gemini-driven SMS sales agent replying to inbound texts on WebCrew's number. Major rework this session, in order:

- **Keyword gate → structured intent read.** `isYes()`'s old `.includes('interested')` substring match never fired on a bare "Interest" and, worse, false-positived on "not interested" (substring match). Replaced the whole decision with one Gemini call requesting `{reply, commit}` via `responseMimeType:'application/json'`+`responseSchema` (`SofiaResult`, `SOFIA_RESPONSE_SCHEMA`, `parseSofiaJson`) — `commit` is a semantic read of genuine agreement ("yeah sure show it to me" counts, sarcasm/hesitation doesn't), not a keyword scan. The old crude `isYes()` keyword check is kept only as a last-resort fallback when Gemini is unreachable both providers.
- **TCPA consent gate unified.** Two mechanisms existed and could desync: `consent_events` (revoked_at-based) and `leads.sms_opt_out` (Worker's own STOP handler). New canonical `canTextNow()`/`loadTextableSet()` — check both — added to `pipeline/src/tools/sms-consent.ts` (Node/pg) and `api/src/index.ts` (Worker/neonQuery), applied at every outbound SMS site across both runtimes: `auto-build-from-sms.ts` (re-checked immediately before the final "site's ready" send — a build takes minutes, so a STOP mid-build must still block it — new terminal status `opted_out_before_send`), `orchestrator.ts`'s `sendWarmTeaseOutreach` (had zero check before), `agents/outreach.ts`, `sheets-sms-outreach.ts` (new bulk `loadTextableSet()`), and 6 sites in the Worker itself (Cal.com booking sends, review-request/no-show sends, first-contact notification sends). **A first pass migrated only those files** — `agents/sms-agent.ts`, `agents/sms-outreach.ts` (both `sendSMS()`'s backstop and `runSMSOutreachAgent()`'s guard, which also trusted a stale in-memory `lead.sms_opt_out`), `tools/sms.ts`, and — highest severity, an unattended daily cron — `scripts/drip-followup.ts` were still on the old narrower `hasSmsConsent()`/`loadSmsConsentSet()` until closed out 2026-09-02. Those two old functions are now deleted entirely (zero remaining callers repo-wide, confirmed via grep) — `canTextNow()`/`loadTextableSet()` are the only gate. `pipeline/src/agents/sms-reply-handler.ts` confirmed dead code (zero imports) — left untouched, not worth gating.
- **Gemini reliability hardening.** A live test hit 2 consecutive unparseable-JSON turns, silently degrading to an identical canned fallback line twice — undiagnosable because failures didn't log the raw output. Added: per-call request id in every log line, `finishReason` logging, raw output (truncated ~300 chars, never full history) on parse failure; `maxOutputTokens` 250→500 + `thinkingConfig:{thinkingBudget:0}` (250 was tight enough to risk truncation); one retry-with-reprompt per provider on parse failure (`callGeminiJson`); AI Studio daily-cap guard reusing the `ai_studio_key_usage` table/pattern already proven in `pipeline/src/reception/gemini-live.ts` (`AI_STUDIO_DAILY_CAP=20` — a placeholder, this codebase has two disagreeing numbers for the real cap, verify against the actual dashboard before trusting it).
- **`extractOfferedPrice()` — logging signal only, not the checkout amount.** Parses a dollar figure out of a lead's message (was silently unparsed before, `offered_price` stuck at 0 forever). Originally drove the autonomous-close amount directly (see below) under the old negotiation model; since the 2026-09-02 flat-pricing reconciliation it's kept only as a conversation-log signal if a lead counter-offers a number — the actual charge is always the fixed `FLAT_MONTHLY_PRICE`.
- **Autonomous SMS-to-payment close — reworked 2026-09-02 for flat pricing.** `createStripeCheckoutLink()` (Checkout Sessions via plain fetch, `metadata[lead_id]`/`subscription_data[metadata][lead_id]` set so `admin/src/app/api/stripe/webhook/route.ts` needs no field-name changes) now creates a **`mode:'subscription'`** session at the fixed `FLAT_MONTHLY_PRICE` ($299/mo, inline recurring `price_data` — no separate Price object needed) — not the old one-time payment for whatever number the lead texted. Fires when Sofia's own `commit===true` judgment lands at a post-demo stage (`demo_sent`/`price_asked`/`negotiating`) with `demoUrl` set (still the same **never send a checkout link before the lead has seen the site** guard) and `offered_price !== FLAT_MONTHLY_PRICE` (reused as an "already sent" marker, not a negotiated amount). Link auto-sends (still offers a call as an alternative in the same message); `notifyAutoClose()` emails Ranjeet a QA-only notice on every autonomous close. Worker secret `STRIPE_SECRET_KEY` — set to **pipeline's `sk_test_...` key**, deliberately NOT `admin/.env.local`'s key (confirmed live `sk_live_...` — don't ever copy that one into the Worker without a deliberate go-live decision). **Test-mode webhook gap closed**: `admin/src/app/api/stripe/webhook/route.ts` now tries `STRIPE_WEBHOOK_SECRET` (live) then `STRIPE_WEBHOOK_SECRET_TEST` (new env var) — before this fix, a completed Sofia test-mode payment had no registered webhook secret anywhere and would never have triggered provisioning. **Still needs a human**: register a Stripe **test-mode** dashboard webhook endpoint pointing at the same admin webhook URL, subscribed to `checkout.session.completed` (mirror whatever events the live endpoint already gets), and set its signing secret as `STRIPE_WEBHOOK_SECRET_TEST`; also confirm the Worker's own `STRIPE_SECRET_KEY` secret is actually set (`cd api && npx wrangler secret put STRIPE_SECRET_KEY`). Domain connection for deals closed entirely via SMS (no admin form) is explicitly deferred — client stays on `*.pages.dev` until a separate follow-up.
- **Lead identity pinning — real bug, not a testing artifact.** `leads.phone` has **no unique constraint** in the DB. The same phone number ended up on two separate `leads` rows (a manual test row + an old sheet-sourced row), and the reply lookup (`ORDER BY created_at DESC LIMIT 1`) picked whichever was created later — unrelated to which one the conversation was actually about. Sofia was re-guessing "who am I talking to" fresh every turn with no stable memory of it. Fixed: `sms_conversations.lead_id` (column existed, was never populated) now gets set on first resolution and every later turn looks up by that pinned id directly — never re-runs the fuzzy phone match once pinned. This can recur in real production if a phone number ever lands on two leads rows via different intake paths (scrape + manual, re-scrape under a different name, etc.) — the fix protects any phone, not just test numbers.
- **Rolling conversation summary — not RAG.** Considered open-source RAG (pgvector is trivially available on Neon) for cross-conversation/long-context memory; concluded it's premature at this system's actual conversation volume (zero paying customers) and would solve a problem that doesn't exist yet. The real near-term gap — `sms_conversations.messages` capped at 40 raw entries, older turns silently vanish with no trace — needed summarization, not retrieval. New `summary` column (migration-v31) + `summarizeConversation()`: once a mature conversation pushes messages off the 40-message window, the dropped turns fold into a running summary (cheap, short Gemini call) instead of being lost; `buildSalesPrompt` now includes it as "EARLIER IN THIS CONVERSATION (summarized)" context. `pgvector` stays a documented, trivial future option — don't build it until real conversation volume justifies it.

Deploy pattern used throughout: `cd api && npx wrangler deploy`, verify via `curl https://api.webcrew.app/health` + `npx wrangler deployments list` (confirm the latest version's timestamp matches). `com.webcrew.auto-build-from-sms` launchd job added this session (was completely unscheduled before — the "build now" promise in Sofia's commit-confirmation message had nothing consuming `build_requests`); polls every 2 min, `~/.webcrew-jobs/run-auto-build-from-sms.sh`.

### System Health Check (twice daily, self-healing where safe)

`pipeline/src/scripts/health-check.ts` — `com.webcrew.health-check` launchd job, runs ~7:30am + ~6:30pm daily (`StartCalendarInterval` array of two entries), emails a status report (Resend, to `BUSINESS_OWNER_EMAIL` env or `pavan.harati@gmail.com` default) and records every run to `system_health_checks` (migration-v32) for trend history — not just a point-in-time email. Manual run: `cd pipeline && npx tsx src/scripts/health-check.ts`.

Checks: Worker `/health` reachability, Neon DB reachability, every `com.webcrew.*` launchd job present + last exit code, stuck `build_requests` (status='building' >20min with no thrown exception, so `auto-build-from-sms.ts`'s own retry-then-error logic never saw it — crashed process, sleep, etc.), AI Studio daily quota usage, migration drift (compares `migration-v*.sql` files on disk against `schema_migrations` — the exact bug class found 2026-08-23; deliberately excludes `schema.sql`/pre-tracking `.sql` files, which aren't part of that numbered convention and would otherwise be permanent false positives), lead-identity resolution rate (diagnostic — conversations with 2+ messages that never resolved a `lead_id`), TCPA gate activity (informational — confirms opt-out blocks are actually firing).

Auto-heals only what's safely recoverable: an unloaded launchd job gets re-bootstrapped from its plist; a build stuck >20min in 'building' gets reset to 'retrying' so the poller retries once (bounded by the poller's own existing error cap on a second failure). Deliberately does NOT auto-fix: a launchd job with a nonzero last exit code (found live: `scrape-fast` exit 1 — flagged, not touched, needs a manual look since blindly restarting a job that's actively failing could mask a real problem), or missing migrations (flagged with the exact command to run, never auto-applied blind — a migration could be destructive or order-dependent).

## Security Hardening (2026-07-13)

Audit fixes applied — read before touching auth/webhooks:
- **Client portal cookie is now signed** (`admin/src/lib/client-session.ts`). `client_email` = `<email>.<hmac>`. Set via `signClientEmail`, verify via `verifyClientCookie` (middleware, dashboard page, billing-portal). Was plaintext = anyone could forge it and read any client's dashboard + Stripe billing.
- **Admin session secret** no longer falls back to the constant `webcrew-admin-secret`. Order: `SESSION_SECRET` → `ADMIN_PASSWORD` → dev-only string. **Set `SESSION_SECRET` (or at least `ADMIN_PASSWORD`) in prod** or admin tokens are forgeable. If `ADMIN_PASSWORD` is unset, the whole admin is still open by design — always set it.
- **Twilio webhooks now verify `X-Twilio-Signature`** (worker `/sms/reply` + `/call-status`, admin `/api/webhooks/sms`) — SHA-1 HMAC per Twilio spec. Blocks forged inbound SMS → toll fraud. Fails **open** if `TWILIO_AUTH_TOKEN` unset; escape hatch `SKIP_TWILIO_VALIDATION=true`. If real inbound SMS breaks at launch, the URL Twilio signs must exactly match `req.url` — set `SKIP_TWILIO_VALIDATION=true` to unblock, then debug.
- **Stripe webhook** compare is now timing-safe + rejects events >5 min old (replay).

Still open (not code-fixed): public `/leads` + `/audit` accept attacker-controlled `businessOwnerPhone` with no rate-limit/captcha → SMS toll-fraud vector; add Turnstile. Notification emails interpolate unescaped user input (low risk, internal recipient).

## TCPA SMS Consent Gate (2026-07-13)

**All outbound marketing SMS is consent-gated. Cold leads are EMAIL-ONLY.**
- Gate: `pipeline/src/tools/sms-consent.ts` — `canTextNow(phone)` / `loadTextableSet()` (canonical since 2026-09-02, replacing the older `hasSmsConsent()`/`loadSmsConsentSet()` which only checked `consent_events` and are now deleted). Checks `consent_events` (channel='sms', revoked_at IS NULL) AND `leads.sms_opt_out`, matched on last-10-digits — the two can desync, always check both. **Fail-closed** (no DB / error / no row → no send). Override: `ALLOW_COLD_SMS=true` (accepts $500–$1,500/text TCPA exposure — don't).
- Gated senders: `sheets-sms-outreach.ts` (bulk `loadTextableSet()`, exits early if 0 consents), `agents/outreach.ts` (all 3 SMS blocks), `agents/sms-outreach.ts` (`runSMSOutreachAgent` guard + throw backstop inside `sendSMS`), `agents/sms-agent.ts` (`runSmsAgent`), `tools/sms.ts` (`sendOutreachSMS`), `scripts/drip-followup.ts` (gated 2026-07-20, see below) — all on `canTextNow`/`loadTextableSet` as of 2026-09-02.
- Consent capture (CF Worker `api/src/index.ts` → `recordSmsConsent()`): inserts into `consent_events` on (1) `/leads` form submit with phone (express_written), (2) `/audit` form with phone (express_written), (3) any non-STOP inbound SMS reply (inbound_reply). STOP still revokes. Dedup: skips insert if active consent exists. **Worker must be redeployed (`npm run api:deploy`) for capture to go live** — until then gate blocks all SMS (safe default).
- Cold outreach channel = `sheets-outreach.ts` (email, CAN-SPAM opt-out regime — but do NOT send cold email via Resend at scale; Resend TOS prohibits cold outreach. Use dedicated cold-email tool + separate lookalike domains). SMS unlocks per-lead after form submit or inbound reply.
- **There is no "check a TCPA registry, then send" shortcut.** TCPA isn't a number database — it's a consent requirement on the sender. Absence from a DNC list or litigator list is not consent. Don't build outbound logic that treats "not on a blocklist" as "safe to text."

## SMS Drip / Follow-Up / Missed-Call Recovery (rebuilt 2026-07-20)

**One follow-up system, not three.** Previously had 3 competing implementations (DB-based `drip-followup.ts`, sheet-based `sms-followup.ts`, and a dead `follow_up` SmsType in `sms-agent.ts` never invoked by any caller). Consolidated to one:
- `pipeline/src/scripts/drip-followup.ts` — the only follow-up drip. Day-3 (FU1) + day-10 (FU2) SMS to leads with `status IN ('sms_sent','outreach_sent')` and no reply. Consent-gated (`loadTextableSet`/`consentSetAllows`, hard requirement — was on the older `loadSmsConsentSet` until 2026-09-02, missed the `leads.sms_opt_out` cross-check despite being an unattended daily cron) + optional litigator-list scrub layer (`tools/tcpa-litigator-check.ts`, see below) + E.164 phone normalization before every Twilio send (raw `leads.phone` is stored in mixed formats like `(415) 606-0079`).
- Retired: `scripts/sms-followup.ts` (sheet-based, read a `SMS-SENT` marker column that only `sheets-sms-outreach.ts` writes, was scheduled daily via launchd but had zero direct consent check of its own — deleted along with its plist/runner script). Retired: `follow_up` SmsType + `buildFollowUpSms` in `agents/sms-agent.ts` (unreachable — only `runSmsAgent(lead, 'initial')` is ever called, from `queue-worker.ts`).
- Cron: `com.webcrew.drip-followup` launchd job, daily 9:30am (`~/.webcrew-jobs/run-drip-followup.sh` → `npx tsx src/scripts/drip-followup.ts`). Manual: `npm run drip` / `npm run drip:dry`.
- **Litigator-list scrub** (`pipeline/src/tools/tcpa-litigator-check.ts`) — supplementary safety layer, NOT a consent substitute. Runs only on numbers that already passed the consent gate; reduces odds of texting a known serial TCPA plaintiff. Vendor: tcpalitigatorlist.com single-phone scrub API. Env: `TCPA_LITIGATOR_API_USERNAME` / `TCPA_LITIGATOR_API_PASSWORD` (unset → skipped with a warning, doesn't block sends — no vendor account provisioned yet, get creds at tcpalitigatorlist.com if this layer is wanted live). `TCPA_LITIGATOR_STRICT=true` treats a vendor lookup error as "listed" (blocks) instead of failing open.
- **Missed-call recovery** — `api/src/index.ts` `handleCallStatus()` (`POST /call-status`) was already fully built and consent-gated (checks `consent_events` before sending, logs to `missed_calls` table either way) but had never fired: number-provisioning never set `StatusCallback` on the purchased Twilio number, so Twilio had nowhere to POST the no-answer/busy/failed event. Fixed 2026-07-20 in both provisioning paths — `reception/server.ts` `buyLocalTwilioNumber()` and `scripts/provision-client.ts` `findAndBuyNumber()` — both now set `StatusCallback` to `${API_BASE_URL}/call-status?configId=...&biz=...&flow=inbound` when buying a number. Existing numbers backfilled via `pipeline/src/scripts/backfill-call-status-webhook.ts` (`DRY_RUN=true` first) — ran 2026-07-20, updated both live numbers (+19182555151 WebCrew, +14134667303 MH).
- Inbound SMS reply handling: live webhook is `POST https://api.webcrew.app/sms/reply` (confirmed via Twilio Messaging Service `inbound_request_url`) → handled entirely inside `api/src/index.ts`'s `handleSMSWebhook()` (the "Sofia" agent, Cloudflare Worker). `pipeline/src/agents/sms-reply-handler.ts` is **not** the live handler — confirmed dead code (zero imports anywhere), despite its own docstring describing this same route; left in place for reference only. `admin/src/app/api/webhooks/sms/route.ts` is a third, even simpler inbound handler (keyword auto-replies, no STOP/opt-out handling at all) that is also NOT wired to any live Twilio number or the Messaging Service — dead code, do not point new numbers at it as-is since it would silently ignore opt-out requests.

## LLM

Pipeline uses **Gemini 2.5 Flash** (`@google/generative-ai`) — not Codex. Free tier: 1,500 req/day for brand extraction, 500 req/day for config generation. Key: `GOOGLE_AI_API_KEY`.

## Environment Variables

Required in `pipeline/.env` (see `pipeline/.env.example`):

```
GOOGLE_AI_API_KEY          # Gemini 2.5 Flash — brand analysis + config generation
GOOGLE_PLACES_API_KEY      # lead discovery + PageSpeed
FIRECRAWL_URL              # https://api.firecrawl.dev (cloud) or http://localhost:3002 (self-hosted)
FIRECRAWL_API_KEY          # firecrawl.dev API key, or "local" for self-hosted
GITHUB_TOKEN               # ranjeetsinghai79 classic PAT with repo scope
CLOUDFLARE_TOKEN           # API token with Pages:Edit permission
CLOUDFLARE_ACCOUNT_ID      # from dash.cloudflare.com → Workers & Pages sidebar
DATABASE_URL               # Neon Postgres connection string (neon.tech)
PIPELINE_API_URL           # hosted pipeline API URL (for contact form lead capture)
RESEND_API_KEY
OUTREACH_FROM_EMAIL        # e.g. hello@yourdomain.com
GOOGLE_SERVICE_ACCOUNT_FILE  # path to service account JSON file (used in this setup)
# OR: GOOGLE_SERVICE_ACCOUNT_JSON  # inline JSON blob (alternative to FILE)
GBP_ACCOUNT_ID / GBP_LOCATION_ID
LEADS_SHEET_ID
BUSINESS_OWNER_EMAIL

# Pipeline run config
NICHE=hvac                 # any of the 12 niche values
LOCATION=Tracy, CA
CITY=Tracy
STATE=CA
COUNT=10
DRY_RUN=true
TEMPLATE_OWNER=ranjeetsinghai79
TEMPLATE_REPO=websitedeveloper
DEPLOY_OWNER=ranjeetsinghai79
```

Deployed templates read `BUSINESS_NAME`, `BUSINESS_NICHE`, `PIPELINE_API_URL` from their Cloudflare Pages env.

## Google APIs Auth

Sheets, GMB (Google My Business), and GSC all use the same service account. Auth is JWT-based via `crypto.createSign('RSA-SHA256')` — no OAuth flow. Set `GOOGLE_SERVICE_ACCOUNT_FILE` to the path of the JSON key file from GCP Console → Service Accounts → Keys → JSON. Alternatively set `GOOGLE_SERVICE_ACCOUNT_JSON` to the inline JSON blob — the tools check `FILE` first, then `JSON`.

## Git Remotes

```
webcrew  → github.com/ranjeetsinghai79/webcrew           (PRIMARY deploy — push here first)
origin   → github.com/ranjeetsinghai79/websitedeveloper  (legacy backup)
pavan    → github.com/pavankumarharati/websitedeveloper   (personal backup)
```

Push: `git push webcrew main && git push origin main && git push pavan main`

## webcrew/ — Marketing Site (webcrew.app)

Separate git repo at `webcrew/` (gitignored by monorepo root `.gitignore`).
Remotes: `deploy` → ranjeetsinghai79/webcrew (CF Pages auto-deploy), `origin` → pavankumarharati/webcrew.
Push: `git -C webcrew push deploy main` (only `deploy` remote works with ranjeet's token).

**Design system:** Electric blue + purple (`#2563EB → #7C3AED`). No dark theme. Bright/light background.
Font: Plus Jakarta Sans (display) + Inter (body).
Palette tokens: `--color-blue`, `--color-purple`, `--color-indigo`, `--color-bg`, `--color-surface`.
Class: `.gradient-brand` = blue→purple gradient text.

**Pricing model (single source of truth):**
- FREE demo site built overnight (Tier 1 — no website)
- $299 one-time — pay only if you love it (site ownership)
- $49/mo — AI team: AI call answering (Gemini Live), GBP posts, review replies, GSC weekly report, lead SMS alerts
- Custom — multi-location, e-commerce, booking, CRM integrations

**Outreach strategy:**
- Tier 1 (no website) SMS: "We built your {niche} business in {city} a FREE website overnight. See it → webcrew.app Pay $299 only if you love it."
- Tier 2 (has website) SMS: "AI receptionist for {niche} in {city} — answers calls 24/7, $49/mo. Try free → webcrew.app"
- Outreach channel: SMS ONLY (Twilio 10DLC, $0.0079/SMS). AI Reception = inbound product, NOT outbound call tool.
- CTA destination: webcrew.app → contact form → books call or triggers pipeline
- Cal.com booking: integrated in AI Reception (check_availability + book_appointment via CAL_DIY_API_KEY)
- Batch: start 200/day, ramp to 1000/day (Week 2), max 3600/day (10DLC standard limit)

**Contact form flows:**
- Tab 1 "No Website" → `POST https://api.webcrew.app/leads` → Tier 1 pipeline
- Tab 2 "Upgrade My Site" → same endpoint with `flowType: 'upgrade'` + currentUrl
- Tab 3 "Free Audit" → `POST https://api.webcrew.app/audit` → Firecrawl + PageSpeed + Gemini → HTML report email in 5 min
  - Phone is REQUIRED (mandatory) on audit form
  - Audit consent includes SMS opt-in for follow-up

**Twilio 10DLC compliance (A2P):**
- Consent model: inbound-only — users opt in via website form checkbox
- Consent copy: "I agree to receive text messages from WebCrew regarding my website demo... Consent is not a condition of purchase."
- Privacy policy at `/privacy`: includes exact carrier clause — "No mobile information will be shared with third parties/affiliates for marketing/promotional purposes..."
- SMS section states explicitly: "We do not engage in unsolicited cold texting."
- `webcrew/src/app/privacy/page.tsx` — carrier clause in Data Sharing section

**SEO/AEO/VSO (layout.tsx):**
- JSON-LD: FAQPage (6 Q&As), HowTo (3 steps), Organization, Service schemas
- Title targets: "AI builds your local business website overnight free"
- HowTo schema for voice search: 3-step process (sign up → AI builds → wake up to leads)
- FAQPage for AEO: answers ChatGPT/Perplexity/Codex queries about WebCrew pricing, speed, niches

**Dev:** `npm run dev:webcrew` → `http://localhost:3002`
**Deploy:** push to `deploy` remote triggers CF Pages build (Next.js static export)

## Business Brain (Firecrawl per-business LLM context)

`pipeline/src/tools/firecrawl.ts` exports `crawlBusinessSite(url, opts) → BusinessBrain`

BusinessBrain is the persistent LLM context for each client. Powers:
- **audit-report**: PageSpeed + Firecrawl + Gemini → HTML grade report (attached to outreach email)
- **brand-analyst**: extract services, pricing, team, colors, testimonials, USPs
- **config-generator**: hyper-personalized config.ts with real business data
- **image-generator**: use brain.media.gallery_images + hero_images from existing site
- **ai-reception**: knowledge base (services, hours, pricing, FAQs) for the AI receptionist
- **blog-generator** (retention): Gemini uses brain.full_text to write SEO posts in client's voice
- **ai-growth**: GBP posts written using real business context from brain

Media extraction from brain:
- `brain.media.images` — all image URLs across site
- `brain.media.hero_images` — og:image + above-fold images
- `brain.media.gallery_images` — portfolio/work photos
- `brain.media.before_after` — [{before, after, caption}] pairs
- `brain.media.youtube_embeds` — YouTube video IDs
- `brain.media.video_testimonials` — videos near review/testimonial context
- `brain.media.logo_url` — business logo

Brain is persisted to `leads.business_brain` (JSONB) in Neon DB.

## GCP Infrastructure

`ai-reception` confirmed live on project `webcrew-501006` / `us-central1` (verified 2026-07-20 via `gcloud run services list` — this is the only Cloud Run service currently deployed under this project/account). The `gen-lang-client-0844283339` project id below is unverified as of 2026-07-20 — it does not appear in `gcloud projects list` for the currently authenticated account, so firecrawl/scraper deployment location needs reconfirming before relying on it:
- `ai-reception` — Gemini Live + Twilio Media Streams (live, `webcrew-501006`)
- `firecrawl` — self-hosted Firecrawl API + Redis sidecar (deployed via `pipeline/firecrawl/`) — project unverified
- Scraper Cloud Run Jobs — 12 jobs, triggered by Cloud Scheduler (see `pipeline/deploy-gcp.sh`) — project unverified

Firecrawl URL after deploy: set `FIRECRAWL_URL` to Cloud Run service URL
Deploy Firecrawl: `bash pipeline/deploy-gcp.sh`
Deploy scraper jobs: same script (section 4)

## Firecrawl

Cloud API only: `FIRECRAWL_URL=https://api.firecrawl.dev` + `FIRECRAWL_API_KEY` (free 500 scrapes/month at firecrawl.dev). Used only by `brand-analyst` agent — falls back to Google Places data if unavailable.

## Active Codex Skills (invoke before web design work)

### MANDATORY: Cinematic Build Master Skill
**Before ANY template work, component creation, animation, or design decision — invoke `/cinematic-build` first.**
This is the single entry point that loads all GSAP patterns, quality gates, MCP server usage, and the full stack context.
Never start building without it.

### Skill Reference Table

| Trigger | Skill | What it activates |
|---------|-------|-------------------|
| **ANY template/component/animation work** | `/cinematic-build` | **MASTER** — full stack context, all GSAP patterns, 16-point gate, MCP usage |
| Complex ScrollTrigger / pinned sections | `gsap-scrolltrigger` | Pin, scrub, trigger config, Lenis integration |
| GSAP plugins (SplitText, Flip, Draggable) | `gsap-plugins` | Plugin registration, SplitText word split, Flip state |
| Timeline sequencing / stagger choreography | `gsap-timeline` | Position parameter, nesting, `add()`, labels |
| Animation performance / 60fps / jank | `gsap-performance` | will-change, batching, compositor-only transforms |
| React/Next.js useGSAP hook / cleanup | `gsap-react` | useGSAP, contextSafe, scope, SSR guards |
| Next.js bundle / data fetching / LCP | `react-best-practices` | Server components, bundle split, image optimization |
| Vercel cost / function count / caching | `vercel-optimize` | Edge config, ISR, function invocation reduction |
| Route transitions / shared element anim | `react-view-transitions` | ViewTransition API, addTransitionType, CSS pseudo-els |
| Design system audit / accessibility | `web-design-guidelines` | WCAG, contrast, spacing, hierarchy |
| New niche theme / color system | `brand-guidelines` | Color tokens, font pairing, visual language |
| Canvas FX / particle systems / WebGL | `canvas-design` | Aurora blobs, particle canvas, shader effects |
| Before CF Pages / GCP deploy | `web-perf` | LCP < 2s, zero CLS, composited-only animations |
| Frontend component / CSS / token systems | `frontend-design` | Tailwind v4 patterns, CSS custom properties |
| Premium UX / spacing / visual hierarchy | `ui-ux-pro-max` | Spacing systems, interaction design, premium patterns |
| Contact forms / API routes / auth | `owasp-security` | XSS, CSRF, injection — $25k clients require this |
| Post-build QA of interactions | `webapp-testing` | Every hover, scroll trigger, mobile breakpoint |

### MCP Servers (active now)
- **21st Magic** (`/ui <description>`) — Generate polished React components from natural language. Always specify "Next.js, Tailwind v4, CSS vars, cinematic luxury feel".
- **shadcn-ui** — Query component source/docs for forms, dialogs, tables, interactive UI. Use for Contact section forms and admin components.

## Marketing Skills (`coreyhaines31/marketingskills`, installed 2026-09-04)

51 Codex skills for GTM/marketing work — `product-marketing`, `competitor-profiling`, `customer-research`, `content-strategy`, `copywriting`, `copy-editing`, `ai-seo`, `social`, `video`, `ad-creative`, `marketing-plan`, `marketing-loops`, `pricing`, `offers`, and more (full list: `.Codex/skills/`, or `npx skills add coreyhaines31/marketingskills --list`).

- **Local-only, not in git** — `.Codex/` is gitignored (line 27). Reinstall on any machine/clone: `npx skills add coreyhaines31/marketingskills -a Codex`
- **Audited before install** (2026-09-04) — clean repo, no malicious code, MIT-licensed, real author (Corey Haines), sponsor disclosure is transparent and non-biasing. Safe.
- **The Notion "GTM Command Center" guide that pointed here does NOT match this repo** — don't follow it literally. Concrete mismatches found: guide's brand-memory file is `memory.md` → real convention is `.agents/product-marketing.md` (written by the `product-marketing` skill). Guide's `brand-voice-builder` and `humanizer` skills → don't exist in this repo at all. Guide describes install via Codex.ai web "Projects" → this pack is actually built for Codex/agent CLIs (`.Codex/skills/`), not web Projects (which don't read GitHub skill repos). Notion access for real use would route through Composio (separate OAuth broker), not a direct "Notion MCP" as implied.
- **WebCrew's own use**: real fit — no inbound content engine exists today (GTM is SMS-outreach-first). Blocker: webcrew.app has no CMS (static Next.js export via GH Actions) — the `Sanity` integration this pack expects for blog publishing needs that decision made first.
- **Client-facing use (website + maintenance + marketing tier)**: WebCrew-operates-it-for-the-client only, never client-self-serve — matches the existing hands-off AI Front Office model (same shape as `gbp-agent`/`reviews-agent` already running per-client automatically, see Pipeline Architecture above). Do NOT hand clients a Codex Project/Code setup to run themselves.
- **Adapt the channel mix for local-service clients** — the pack's default weekly cadence (LinkedIn Mon–Fri + blog SEO/GEO) is B2B-SaaS-flavored. HVAC/med spa/dental clients' actual lead channel is GBP/local-SEO/reviews (already automated via `gbp-agent`/`reviews-agent`/`analytics-agent`), not LinkedIn. Use `content-strategy`+`copywriting`+`ai-seo` for local-intent blog content; skip the LinkedIn cadence unless a specific client's ICP is genuinely B2B (e.g. commercial HVAC selling to businesses).
- Existing `pipeline/src/growth/` (Growth OS) is a narrower, code-based growth-plan generator — complementary, not a duplicate. Worth eventually wiring together, not now.

## Luxury Design Quality Gates ($20k Standard)

Every template must pass ALL before merge/deploy:

### Visual
- [ ] Cinematic loading screen with progress bar — dark bg, brand aurora blobs, name → tagline → bar → overlay exit
- [ ] Custom magnetic cursor (`cursor.tsx`) — context-aware, follows with lerp
- [ ] Zero hardcoded colors — CSS vars only (`var(--color-*)`, never `bg-green-500`)
- [ ] Word-split reveals on ALL headings (not just hero) — `useTextReveal` hook
- [ ] Scroll progress bar — fixed 2px top, gradient accent with glow

### Animation
- [ ] Hero entrance timeline chains: label → badge → headline words → paragraph → CTAs → trust badges
- [ ] 3D tilt on feature/why-us cards — `gsap.quickTo` rotationX/Y + dynamic shadow
- [ ] Horizontal pinned scroll on Services (desktop ≥1024px) — mobile vertical stagger
- [ ] Image reveals — `clipPath: inset(0 100% 0 0)` → `inset(0 0%)` on scroll enter
- [ ] Stats counters animate 0 → value on viewport enter
- [ ] All card grids use `useStaggerReveal` — no section appears without animation

### Performance
- [ ] LCP ≤ 2.5s (measure with PageSpeed or Lighthouse)
- [ ] CLS = 0 — no layout shift on font load or image load
- [ ] `will-change: transform` on animated elements, removed after animation completes
- [ ] Hero images use `next/image` with `priority` + correct `sizes`
- [ ] Lenis + ScrollTrigger wired: `ScrollTrigger.update` called on every Lenis tick

### Mobile
- [ ] Horizontal scroll section degrades to vertical stagger on mobile
- [ ] Custom cursor hidden on touch devices
- [ ] Loading screen exit ≤ 1.5s on 3G (don't block on heavy assets)
- [ ] All GSAP `matchMedia` guards in place for desktop-only effects

## npm Packages for $20k Luxury Feel

Already in stack: `gsap`, `@studio-freight/lenis`. Add if needed:

```bash
# WebGL / 3D backgrounds (luxury real estate, medspa, skin-clinic)
npm install three @types/three
npm install @react-three/fiber @react-three/drei

# Noise texture shaders (organic luxury feel)
npm install glsl-noise

# Premium icon set (beyond lucide — for luxury niches)
npm install @phosphor-icons/react
```

Three.js is optional — use only for `luxury-realestate`, `medspa`, `skin-clinic` where WebGL hero adds value. All other niches: canvas particle system sufficient.
