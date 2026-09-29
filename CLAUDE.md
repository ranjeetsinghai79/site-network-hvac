# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## HVAC Tier-2 Rebuild Campaign — build-first, honest outreach (2026-09-28)

Owner wanted to pull HVAC leads that already have an old website and get their attention
before pitching. The original idea (auto-fill the CONTACT FORM on each lead's own
website claiming "we already built you a new site") was rejected after discussion — no
precedent in this codebase, resembles a pattern already flagged as off-limits
([[feedback_no_cold_sms_automation]] — Playwright bulk-contacting cold leads, just via
web forms instead of SMS), and the claim would be false at send time regardless of
channel. Replaced with: **build the real site first, then send a truthful "we already
built it, want to see it?" email.** This reuses existing infra almost entirely —
`runOutreachAgent`'s tier2 branch (`pipeline/src/agents/outreach.ts`) already sends
exactly this "before/after, built overnight, $0 setup + 30-day trial + $297/mo" email
whenever `leads.cloudflare_url` is already set before it runs; no new email copy was
needed, only correct sequencing (build before outreach, not the default
pitch-then-build-on-reply flow the rest of the pipeline uses).

- **New**: `pipeline/src/tools/place-match-builder.ts` — `buildLeadFromPlacesMatch()`,
  extracted from `auto-build-from-sms.ts`'s local `triggerPipelineBuild()` so both the
  SMS auto-build flow and proactive rebuild campaigns share one Places-match→save→
  `runPipelineForLead()` implementation instead of drifting. Takes a `tier` param
  (`auto-build-from-sms.ts` still passes `tier1`; this campaign passes `tier2` — that's
  what keeps `runOutreachAgent` on the truthful-rebuild copy branch instead of the
  tier1 "no website" copy).
- **New**: `pipeline/src/scripts/select-hvac-rebuild-candidates.ts` (Phase 1, read-only
  against the sheet) — filters the "Local SMBs" tab to niche=hvac + has a website,
  writes candidates to `pipeline/rebuild-candidates/` (gitignored — contains scraped
  contact PII). **Real data-quality bug found and worked around**: all 7,492 hvac rows
  in "Local SMBs" have their "Has Website" cell written as an empty string that got
  dropped from the row array entirely, shifting every column from I onward left by one
  (so raw column J holds the YES/NO flag, K holds the actual URL) — confirmed via a
  live read, not assumed. Column-position parsing is unsafe past col E for this data;
  the script does shape-based extraction instead (URL/email/phone pattern matching
  across the row, same philosophy as `admin/src/lib/local/parse.ts` but applied
  further right since even that file's "A–J is reliable" assumption doesn't hold here).
  Also found and fixed two regex bugs surfaced by eyeballing real output: a bare rating
  value like "4.8" was matching the URL shape-pattern (digits+dot looks like a domain),
  and some sheet phone cells are pre-existing truncated fragments (e.g. "-1744",
  data-quality issue in the source, not introduced here) — both now filtered rather
  than silently propagated. Real run: 2,884 of 7,492 hvac rows have a genuine website.
- **New**: `pipeline/src/scripts/build-hvac-rebuilds.ts` (Phases 2-4) — quick free
  PageSpeed check per candidate (same `UPGRADE_THRESHOLD=45` bar `site-scorer.ts`
  already uses) to skip candidates whose current site is already decent, then builds
  via `buildLeadFromPlacesMatch(tier:'tier2')`, then calls `runOutreachAgent`. Dedupes
  against `leads.outreach_sent` by phone so re-running doesn't double-contact.
  `BATCH_SIZE` env (default 15/day — see the Firecrawl throughput note below before
  raising this), `DRY_RUN=true` runs the quick-check only, no spend.
- **`outreach.ts` changed**: the tier2 branch now skips `runAuditReportAgent`
  (Firecrawl+PageSpeed+Gemini) when a replacement site is already built — its output
  (auditSummary/auditHtml) isn't referenced by that branch's email template anyway, so
  running it was pure wasted Firecrawl quota. Also added an optional "text us at
  [TWILIO_FROM_NUMBER]" line to the already-built email variant so a reply has a
  working path into the existing Sofia SMS close flow (confirmed via code read: Sofia's
  `buildSalesPrompt` in `api/src/index.ts` already resolves `demoUrl` from
  `leads.cloudflare_url`, zero changes needed there).
- **PageSpeed Insights API is currently blocked on both configured keys** — verified
  live via direct API calls, not assumed: `GOOGLE_PLACES_API_KEY`'s project
  (571925663575) has never enabled `pagespeedonline.googleapis.com`
  (console link: https://console.developers.google.com/apis/api/pagespeedonline.googleapis.com/overview?project=571925663575);
  `GOOGLE_AI_API_KEY` gets `API_KEY_SERVICE_BLOCKED`. This silently degrades
  `scoreSite()`'s fallback path to "PageSpeed unavailable → treat as bad site, proceed"
  — meaning **the Phase 2 quick-check currently can't distinguish a genuinely bad site
  from a good one and accepts everything**, and this same silent degradation already
  affects the live `runSiteScorerAgent` used in the main `orchestrator.ts` pipeline
  today, not just this new campaign. No code fix needed — `scoreSite()` already tries
  both keys correctly — just enable PageSpeed Insights API on one of these two GCP
  projects, no gcloud CLI access in this environment to do it directly.
- **Real throughput ceiling, not the "10-100 sites/day" figure elsewhere in this
  file**: Firecrawl's free tier (500 scrapes/month ≈ 16/day) is what `brand-analyst`
  calls per lead during the build, and matters more for this campaign than a from-
  scratch tier1 build since the pitch is "we made yours better" — start `BATCH_SIZE`
  around 15/day and validate reply/conversion before considering a paid Firecrawl tier.
- **Cold-email volume is a known open item, not solved here**: 100/day ≈ 3,000/month
  is exactly the volume [[project_cold_email_queue]] already flagged as unresolved
  (dedicated cold-email sender still needed, Resend ToS prohibits cold outreach at
  scale) — pilot this campaign at a small daily count on the current Resend setup, not
  100/day, until that's sorted.
- **Not done**: no daily cron/scheduler wired up (scripts are run manually,
  `select-hvac-rebuild-candidates.ts` then `build-hvac-rebuilds.ts <file>`); final
  one-time price point wasn't changed from the existing $299–$499 tier1 range (reused
  as-is, no new pricing lever introduced); PageSpeed API enablement needs the owner
  (console access, not available in this environment).

**Follow-up pass, same day — Kling removed pipeline-wide, real build verified live:**
- **Kling hero video removed from every site build** (owner decision: whole pipeline,
  not just this campaign) — both build entry points, `orchestrator.ts`'s
  `runPipelineForLead()` (admin/SMS-triggered) and `queue-worker.ts` (the parallel
  scale path), no longer call `runHeroVideoAgent`/`uploadImageToFal`. Sites now build
  with `posterSrc`-only heroes. This also retired the per-lead automatic
  scroll-sequence-hero frame extraction (`SCROLL_HERO_ENABLED`, medspa-only), since it
  depended on the video this step produced — the `ScrollSequenceHero` component and
  its static `/scroll-demo` routes are unaffected (they don't go through this
  pipeline). **Not touched**: reel generation (`pipeline/src/video/`'s `fal_kling`
  provider) and the RE walkthrough feature both still use Kling for their own
  unrelated purposes.
- **"Latest ChatGPT/Imagen 2" image model — already moot, verified by reading the
  code**: Google's Imagen 3 was already tried in this exact pipeline and Google shut
  it down in August 2026 (documented by an in-code comment in `image-generator.ts`);
  it was already replaced with Gemini's current image model
  (`gemini-2.5-flash-image`, "Nano Banana") as the Google-credit image source. There's
  no live Imagen 2/3 to switch to. A Vertex catalog probe for anything newer
  (`gemini-3-flash-image` etc.) came back 404 on all candidates, but that's not
  conclusive on its own — this project's own reception-system notes already document
  Vertex model-listing GETs disagreeing with actual runtime availability. No OpenAI
  image integration exists or was added (would need a brand-new API key/billing
  account — flagged, not built, since it was never confirmed as the actual intent
  once the Imagen-3 mixup surfaced).
- **Real build run to verify end-to-end** (not a dry run) —
  `Virginia Mechanical Heating & Air Conditioning` (Tracy, CA), the first HVAC rebuild
  candidate: brand-analyst deep-crawled their real old site (15 pages, 50 images, 10
  services), image gen used **free local niche-library images** (Priority 1.5, not AI
  generation — Places returned 0 `photo_names` for this business so Priority 1 never
  fired), built + deployed live at
  `https://site-virginia-mechanical-heating-air-conditio.pages.dev`, AI Reception
  auto-provisioned. **Real-world side effect, not just a sandbox test**: this also
  sent the actual truthful "we rebuilt your site" outreach email to the real owner
  (`brandy@virginiamechanical.com`) — `build-hvac-rebuilds.ts` has no build-only mode
  that skips the outreach send, so running it for real always contacts the lead if the
  build succeeds. Content was accurate (site is genuinely live) and this is exactly
  what the campaign is for, but worth knowing before running more one-off verification
  builds — add an `OUTREACH_DRY_RUN`-style guard if a build-only test is needed again
  without contacting a real business.
- **Real pre-existing bug found and fixed via this run**: `gsc-agent.ts` built
  `siteUrl` as `` `https://${host}/` `` but `host` (`lead.cloudflare_url`) already
  includes the scheme (set by `deployer.ts` to the full deploy URL) — produced
  `https://https://site-....pages.dev/`, which silently failed Google Search Console
  verification for every deployed lead, not just this one (confirmed in the live log:
  `[GSC-Verify] getFileVerificationToken failed`). Fixed by stripping any existing
  scheme before re-adding it.
- **Two more pre-existing infra gaps surfaced by this run, not fixed here** (separate
  from PageSpeed): (1) Gemini Vertex on `webcrew-501006` returned `429 Resource
  exhausted` during just this one build's AEO step, fell through to the billed project
  (`gen-lang-client-0362421597`, `403` — billing not enabled there either), then to AI
  Studio — non-blocking, pipeline completed, but means Vertex credit headroom is
  tighter than expected; (2) `siteverification.googleapis.com` has never been enabled
  on project `526838119408` — needs enabling at
  https://console.developers.google.com/apis/api/siteverification.googleapis.com/overview?project=526838119408
  before GSC auto-verification can work at all, independent of the URL-formatting fix
  above.
- **Revised cost/throughput, now that Kling is gone and a real run confirmed
  numbers**: per-site AI cost is often close to **$0** when free real-photo/stock/
  library images are available (as happened in this test — no fal.ai or Vertex image
  spend at all), rising to ~$0.16 only when all 4 hero image slots need AI generation.
  Removing Kling also cuts several minutes of generation time per site, though that
  was never the binding constraint. **The real ceiling is still Firecrawl's free tier
  (500 scrapes/month ≈ 16/day)** — confirmed again by this run (`brand-analyst` used
  one real Firecrawl scrape) — unchanged by either the video or image-model decision.
  Wall-clock time per site (~5-8 min, mostly waiting on GitHub Actions + Cloudflare
  Pages) isn't a practical constraint even run sequentially at 15-16/day. To exceed
  ~16/day sustainably, the lever is still a paid Firecrawl tier (pricing not
  re-verified this session).

**Third pass, same day — fixed the "Local SMBs" column-shift bug on the LIVE sheet,
not just worked around it in scripts.** User couldn't see website URLs when looking
at the raw sheet directly (the shape-matching workaround only helped scripts, not
the human-readable sheet). Real scope check before touching anything: this tab
mixes **two different row layouts**, not one — most niches (hvac, roofing, plumbing,
cleaning, auto-detailing, landscaping, pest-control, electrician, etc.) are cleanly
shifted-by-one (the "Has Website" cell got written as an empty string that dropped
from the row array, pushing col J and everything after it left by one), but
"remodeling" (6,247/6,855 rows) and "handyman" (269/270 rows) are mostly a **Yelp
import with a completely different column layout** (YES/NO flag at index 15, a
`yelp:ID` marker at index 18) — and some of those rows are visibly mis-categorized
("Batteries Plus Bulbs" tagged "remodeling", pest-control companies tagged
"handyman"). Other tabs (MEDSPAS, USA_Restaurants) are mostly fine already, spot-
checked, not touched.
- **`pipeline/src/scripts/fix-local-smbs-website-columns.ts`** (new) — scoped fix,
  columns I ("Has Website") and J ("Website URL") only, for rows where the shift is
  unambiguous (col I is not already a literal YES/NO, but col J is). That row-level
  condition naturally excludes the Yelp-import rows without needing a niche
  allowlist — they simply don't match the pattern. Columns K onward were
  deliberately left as-is (still one column left of where the header says) — no
  current tooling trusts fixed positions past col J anyway (`enrich-existing-
  rows.ts`, `admin/src/lib/local/parse.ts` already shape-match), so a full 12-column
  realignment wasn't worth the added risk for what was actually asked. Dry-run by
  default, `--apply` to write; writes a JSON backup of every touched row's original
  I/J values to `pipeline/rebuild-candidates/local-smbs-IJ-backup-<timestamp>.json`
  before writing anything (gitignored, same convention as `neon-cleanup.ts`).
- **Applied for real to the live sheet, verified after**: 18,492 rows fixed (8,919
  with a confirmed real website, 9,573 confirmed no-website) in ~93 batched
  `values:batchUpdate` calls (a couple of 429s hit and retried automatically, exit
  code 0). Re-read the sheet directly afterward to confirm — `hvac` niche now shows
  `I=YES`/`J=<real URL>` correctly for all 2,244 of its genuine website rows.
- **`select-hvac-rebuild-candidates.ts` simplified back to trusting columns I/J
  directly** — the shape-matching workaround from the earlier pass in this file is
  no longer needed now that the source data is fixed; kept the shape-matching
  approach only in the one-off fix script itself, plus `admin/src/lib/local/
  parse.ts`'s existing tolerance (different tab/context, left alone). Also fixed a
  real precision bug found while reconciling the two approaches: the old broad
  "scan the whole row for anything URL-shaped" heuristic over-counted by ~640 hvac
  rows (2,884 vs. the correct 2,244) — some `no-website` rows had an unrelated
  URL-shaped value elsewhere in the row that got misread as a website. The
  positional read after the fix doesn't have this problem.
- **Deliverable**: published an Artifact (private, browsable/searchable/filterable
  table, 8,919 rows, niche filter chips) of every "Local SMBs" business with a
  confirmed real website — built from the same precise extraction used for the
  sheet fix itself, so the two are consistent. Link is in this session's chat
  history; re-generate by re-running the (now-deleted) export step's logic — pull
  columns I/J directly per-row across the whole tab (same as
  `select-hvac-rebuild-candidates.ts` but without the niche filter) — if needed
  again without the original conversation.
**Fourth pass, same day — also fixed the Yelp-import rows' flag position (owner
confirmed: flag-position cleanup only, no re-scraping, mis-categorization left
alone).** Checked first rather than assumed: of the 6,529 Yelp-marked rows
(`yelp:<id>` in col S), only **15** have a website URL captured anywhere in the row
— the other 6,514 never had one scraped at all (not a shift bug, a genuine data
gap). `fix-local-smbs-website-columns.ts` extended with a second detection branch:
for rows not already fixed by the shift-by-1 pass, scoped by the `yelp:` marker,
relocate the existing Has-Website flag from col P (index 15) into col I — and write
nothing into col J, since fabricating a URL that was never captured would be worse
than leaving it blank. Applied for real: 6,516 rows fixed (400 confirmed
no-website, 6,516 flagged YES with no URL — these two aren't mutually exclusive
counts, see the script's own log line). Verified after: only **1 row** in the
entire 25,009-row tab now lacks a proper `I=YES/NO` flag. Explicitly NOT done, per
owner decision: no re-scraping to find these 6,514 businesses' real websites (would
compete with the same Firecrawl budget as the HVAC campaign), and no attempt to fix
the mis-categorized rows (a battery/bulb retailer tagged "remodeling", pest-control
companies tagged "handyman") — no reliable way to recover the true category from
what's stored in the sheet.

**Fifth pass, same day — real logo/dedup gaps found via the Virginia Mechanical
build, chat-widget cursor bug fixed, two new Claude skills added.** Owner looked
at the live Virginia Mechanical rebuild
(`https://site-virginia-mechanical-heating-air-conditio-b1a.pages.dev/`) as a
template reference and flagged two real gaps: no logo, and (raised as a general
"make sure" requirement, not a confirmed bug on that specific site) no duplicate
images across a build.
- **Real bug found and fixed: a scraped logo was extracted and then silently
  thrown away.** `firecrawl.ts`'s `crawlBusinessSite()` already extracted
  `media.logo_url` from the client's old site, but it was only ever attached to
  a debug `media_summary` object in `brand-analyst.ts` — never onto `BrandData`
  itself, so every downstream agent had no way to see it. Fixed end-to-end:
  `BrandData.logo_url` (new field, `types.ts`) is now set from `brain.media.logo_url`
  (never from Gemini's free-form JSON — a URL is only trusted from the direct
  extraction); `fetchBusinessLogo()` (new, `image-generator.ts`) downloads it
  (skips anything that doesn't come back as an `image/*` content-type); `builder.ts`
  splices `business.logoUrl: "/logo.png"` into the generated config (only when the
  download actually succeeded — same "never reference a file that won't exist in
  the repo" reasoning as the existing lat/lng splice in `orchestrator.ts`) and
  uploads the logo alongside the 4 hero images; `Business.logoUrl` (new, optional,
  `packages/core/src/types/config.ts`) and `Nav.tsx` (`@core/web`, used by every
  template) now render a real `<img>` when it's set, falling back to the existing
  text wordmark when it isn't — a text wordmark is a legitimate design choice for a
  `newWebsite` client with no logo to scrape, not something to fabricate around.
  Wired into both build entry points (`orchestrator.ts` and `queue-worker.ts`).
  Footer.tsx still only renders the text wordmark — not updated this pass, low
  priority since Nav is what's visible above the fold.
- **Duplicate images: audited, no structural bug found in the current pipeline**
  (`image-generator.ts`'s 4 hero slots are always sourced from 4 distinct
  photos/files/prompts — checked all three priority branches: real Google photos,
  the niche stock library's `getHeroGridImages()`, and AI-gen). The real risk is
  cross-*site* duplication — every HVAC lead with zero real Google photos falls
  through to the same 4 static files in `pipeline/assets/hvac/`, so two different
  businesses built with no real photos will show identical hero images. Not code-
  fixed (would need either a bigger per-niche stock pool or forcing AI-gen when the
  library is the only source, both real cost/time tradeoffs) — instead turned into
  an explicit, mandatory visual QA step in both new skills below (load the deployed
  site, confirm the images are actually distinct, tell the user honestly when a
  build is relying on shared stock).
- **Real bug found and fixed: chat widget's text input had no explicit
  color/background/caret-color.** `pipeline/src/reception/public/widget.js`'s
  `.text-input` (used by the embeddable AI Reception widget on every client site,
  including the Virginia Mechanical HVAC site) was the only text-bearing element in
  that whole stylesheet without explicit colors — it silently inherited from
  whatever the host page's ambient theme was, which could make typed text and the
  blinking caret invisible on a dark-themed host page. Same bug, same fix, in
  `webcrew/src/components/avatar-widget.tsx`'s text input (webcrew.app's own
  widget). **Deployed live**: rebuilt + redeployed the `ai-reception` Cloud Run
  service (`webcrew-501006`/`us-central1`, now revision `ai-reception-00066-qv6`)
  and confirmed via a direct `curl` of `/widget.js` that the fix is actually being
  served — this affects every client's embedded widget immediately, not just after
  a future redeploy.
- **Two new Claude Code skills added** (`.claude/skills/newWebsite/SKILL.md`,
  `.claude/skills/redesign/SKILL.md` — gitignored like the rest of `.claude/skills/`,
  reinstall/recreate on a fresh clone if ever needed): `newWebsite` drives the real
  pipeline agents end-to-end for one named client with no existing site (no
  outreach sent, no scraping — the client is the only source of real data);
  `redesign` is for a client who already has a site — full-crawls it with a new
  `fullCrawl` option on `crawlBusinessSite()`/`runBrandAnalystAgent()` (50 pages
  and includes blog/testimonial paths vs. the default lead-scoring crawl's 15
  pages excluding them, 60k-char text cap vs. 20k) and requires a manual cross-
  check pass — logo, real photos preferred over stock, testimonials, hours,
  services, page-by-page content, video — against the raw scrape before building,
  since Gemini's extraction is explicitly treated as a draft, not ground truth.
  Both skills mandate invoking `/cinematic-build` first (per the existing
  AUTO-INVOKE RULE) and both end with an actual live-link check, never a claimed
  one. `crawlBusinessSite()`'s default behavior (15 pages, blog/news/careers
  excluded, 20k-char cap) is unchanged for every existing caller (tier1/2
  outreach, audit-report, blog-generator) — `fullCrawl` is opt-in only.
- **Not done this pass**: `network-hvac-site/` (a separate untracked nested-git
  experiment noticed during a previous session's disk cleanup, still unclear if
  wanted) was left alone again, not committed; `src/WooSender_B2B_Outbound_Playbook.pdf`
  and `public/file.mp4` in the `webcrew/` subrepo were found untracked and
  undocumented/explicitly-raw-source respectively — left uncommitted rather than
  guessed at; `public/logo.old.png` in `webcrew/` was already deleted from the
  working tree before this session started (not deleted by this pass) and that
  deletion was committed along with everything else — flagged here in case the
  file was meant to be kept as a historical reference (recoverable via
  `git show HEAD~1:public/logo.old.png` in the `webcrew/` repo if wanted back).

## Landing Page Redesign — "Paste Your URL" Instant AI SalesPerson Preview (2026-09-27/28)

Owner directive: replace webcrew.app's 15-field-form landing page with a native.no/lindaria-style flow — visitor pastes their website URL, clicks once, watches a staged AI-progress UI, then sees (and can talk to) a live AI SalesPerson preview of their own business, with a persistent conversion CTA so no visitor leaves unconverted. Full plan at `~/.claude/plans/we-have-to-change-velvet-bumblebee.md` (6 phases; production landing-page swap and the real-pipeline-spend phase both require explicit owner sign-off before proceeding — only Phase 1 is done so far). **Both landing pages will coexist permanently**, switched by a `NEXT_PUBLIC_NEW_LANDING` env flag on webcrew's Cloudflare Pages project (Phase 3) — reverting is a config flip + redeploy, never a code change.

Verified constraints that shaped the design (don't re-litigate without re-checking): webcrew.app is `output: 'export'` static-only (`webcrew/next.config.ts` + `.github/workflows/deploy.yml`'s `wrangler pages deploy out`) — no dynamic/edge SSR exists there, so the preview is rendered server-side by the reception Node server (already a long-lived Cloud Run process with its own Postgres pool) and iframed into webcrew.app, not rendered as a Next.js route. `config-generator.ts` emits TS source text, not a runtime JSON config — there's no "render `@core/web` against in-memory JSON" capability, so the preview intentionally uses a bespoke lightweight HTML template (Phase 2), not the real niche templates. Reception's `buildBrain()` extracts no images (unlike the heavier `pipeline/src/tools/firecrawl.ts`'s `crawlBusinessSite()` used by the real pipeline) — Phase 2 needs to add a hero-image field.

**Phase 1 done (backend proof of concept, zero production risk, verified against the real Neon DB + real Firecrawl/Gemini calls, not deployed to Cloud Run yet):**
- `pipeline/src/db/migration-v46-preview-jobs.sql` (applied) — new `preview_jobs` table (`stage`: reading→understanding→building→ready/failed, `progress_pct`, `config_id`, `display_config` jsonb for `{tagline, theme}`) + `reception_configs.is_preview`/`preview_expires_at` columns.
- `pipeline/src/reception/turnstile.ts` (new) — `verifyTurnstile()`/`clientIp()` extracted out of `browser-relay.ts` into a shared module (zero behavior change) so the new preview route doesn't duplicate them.
- `pipeline/src/reception/preview-pipeline.ts` (new) — `runPreviewJob(jobId, url)`: reuses `buildBrain()`/`buildSystemPrompt()` verbatim (same Firecrawl+Gemini extraction the real client-provisioning path already uses), one small extra Flash call for a marketing tagline + theme pick (reusing the existing 7-theme system from `packages/core/src/styles/tokens.css` by name only, no cross-import), then `saveReceptionConfig(..., {isPreview:true, previewExpiresAt: now+48h})`. Deliberately skips fresh AI image/video generation and any real GitHub+Cloudflare deploy — those stay exactly as expensive/slow as they are today and only run after a visitor actually converts (Phase 4, reusing the existing `triggerAutomatedBuild()`/`/pipeline-trigger` path unchanged).
- `pipeline/src/reception/server.ts` — new `POST /preview/start` (CORS-enabled for cross-origin calls from webcrew.app, Turnstile-gated via the extracted module, rate-limited 3/10min) and `GET /preview/status/:id` (polled by the frontend once Phase 3 exists).
- `pipeline/src/reception/db.ts` — `saveReceptionConfig()` extended with optional `{isPreview, previewExpiresAt}` (existing call sites in `/provision` and `orchestrator.ts` unaffected, default `false`/`null`); new `createPreviewJob`/`getPreviewJob`/`updatePreviewJob`; new `isRateLimited()` — same table/semantics as the Worker's `isRateLimited()` in `api/src/index.ts`, ported to run on reception server's own `pg.Pool` instead of `neonQuery` (same `public_form_submissions` table, both processes share one Postgres DB).
- **Real bug found and fixed while testing** (pre-existing, not introduced today, affects the live phone AI too): `buildSystemPrompt()` in `brain-builder.ts` rendered a day's hours as the literal string `"null"` when Gemini's extraction returns JSON `null` for a day (common for non-physical/no-fixed-hours businesses) — fixed to fall back to `"Please call for hours"` per day.
- **Real bug found and fixed while testing** (new code, caught by its own Phase 1 verification step): an unreachable/contentless URL didn't always throw inside `buildBrain()` (Firecrawl can "succeed" with empty content, and Gemini's extraction prompt explicitly allows null for missing fields including, in practice, `name`) — was surfacing as a raw Postgres NOT NULL constraint violation at the `saveReceptionConfig()` step instead of a clean failure. Fixed with an explicit `brain.name` check right after `buildBrain()`, failing fast at the `reading` stage with a real user-facing message.
- **End-to-end verified locally against the real Neon DB and real Firecrawl/Gemini APIs**: a real business URL (stripe.com, chosen only because it's stable/external/definitely not already a `reception_configs.website_url` — **never test this against an existing production `website_url` like webcrew.app itself, `saveReceptionConfig`'s `ON CONFLICT (website_url) DO UPDATE` would silently overwrite the live config**) went `reading→understanding→ready` in ~35s (well under the ~60-90s budget), produced a real `reception_configs` row with `is_preview=true`, a correct AI-receptionist system prompt, and a real derived tagline+theme; an unreachable domain correctly failed fast with a clean message; the rate limit correctly 429'd on the 4th request in 10 minutes; CORS preflight (`OPTIONS`) responds correctly. All test rows deleted after verification. `tsc --noEmit` clean, all 60 existing reception unit tests still pass unchanged.
**Phase 2 done (preview page + hero image, zero production risk, verified live against real Firecrawl/Gemini, not deployed to Cloud Run yet):**
- `pipeline/src/reception/types.ts` — `BusinessBrain.heroImage?: string`, extracted from the same Firecrawl response already fetched for the brain (no extra scrape/cost). `brain-builder.ts`'s `scrapeWebsite()` now also requests the `html` format alongside `markdown`; a new `extractHeroImage()` regexes `og:image` (falling back to the first `<img>`) out of the entry page's HTML and resolves it to an absolute URL.
- `pipeline/src/reception/preview-page.ts` (new) — `renderPreviewHtml(config, displayConfig, widgetHost)`: hand-built HTML string, same precedent as `server.ts`'s `/crm/contacted` route (no build step, no framework). Hero image (if found) + tagline + a 7-theme accent-color map (reusing the theme *names* from `packages/core/src/styles/tokens.css` by string only) + up to 6 real services with pricing + a sticky "try the chat bubble" nudge + the actual `<script src=".../widget.js" data-config="{configId}">` embed, so the live AI widget is really running inside the preview, not a mockup.
- `pipeline/src/reception/server.ts` — new `GET /preview/:previewId` (public, no auth — an anonymous `is_preview` config has nothing sensitive in it): validates UUID, requires the job to be `stage==='ready'`, loads the config, renders and serves the HTML with `Access-Control-Allow-Origin: *` and no `X-Frame-Options` restriction (deliberately, so Phase 3 can iframe it from webcrew.app).
- **Verified live end-to-end** (local reception server, real Neon DB, real Firecrawl crawl + Gemini extraction, test site `blueapron.com` — chosen for the same reason as Phase 1's stripe.com test: stable, external, definitely not an existing production `website_url`): `POST /preview/start` → job reached `ready` with a real hero image (`og:image`, `https://ba-image-api.remarkablefoods.net/...`), a correct theme pick (`ocean`/cyan) and tagline, and 18 real extracted services; `GET /preview/:id` rendered the full page correctly (hero photo, tagline, 6 services with real pricing where listed, and the widget embed tag pointing at the right config id). Test job + config row deleted from the DB afterward, local server stopped. `tsc --noEmit` clean, all 60 existing reception unit tests still pass unchanged.
**Phase 3 done (landing page built, coexists with the old one behind a flag — NOT yet flipped on in production, per the plan's explicit sign-off requirement):**
- `webcrew/src/lib/features.ts` — new `SHOW_NEW_LANDING = process.env.NEXT_PUBLIC_NEW_LANDING === 'true'`, same opt-in pattern as `SHOW_PUBLIC_PRICING`.
- `webcrew/src/components/website-preview-landing.tsx` (new, ~330 lines, same plain-CSS-in-JS style as `missed-call-landing.tsx` — no GSAP/cinematic-build stack, matching that sibling component's own precedent since this is webcrew.app's own marketing page, not a client niche template): single URL input hero → staged progress (`reading → understanding → building → ready`, polling `GET {RECEPTION_URL}/preview/status/:id` every 1.5s, `RECEPTION_URL` = new `NEXT_PUBLIC_RECEPTION_URL` env, defaults to the live Cloud Run URL) → iframed live preview (`GET {RECEPTION_URL}/preview/:id`) with a "try the chat bubble" nudge → sticky bottom CTA bar (dismiss collapses to a small re-expandable pill, never fully disappears — the "no visitor left behind" mechanism) → short claim form (name/business/email/phone + SMS consent) → How-it-works / live-demo-call / FAQ sections carried forward in spirit (rewritten for the new flow, not verbatim-copied) → same footer. Turnstile invisible-challenge helper copied verbatim from `avatar-widget.tsx`'s `getTurnstileToken()` (shares its global `Window.turnstile` type declaration — kept in avatar-widget.tsx only, to avoid a duplicate/conflicting ambient declaration).
- **The claim step reuses the existing `interestOnly` lead path verbatim, zero new backend logic** — a preview visitor already has a real, working site (they pasted its URL), so claiming the AI SalesPerson is exactly the already-built "add AI to my existing site, don't rebuild" flow (`api/src/index.ts`'s `engageWithSofia`/`handleLeadSubmission`, unchanged). Only additive changes: `ContactLead.previewConfigId?: string` (tracking only — which `reception_configs` preview row they claimed) surfaced as a new "From preview:" row in the internal notification email; `pipeline/src/reception/server.ts`'s `GET /preview/status/:id` now also returns `businessName` once `ready` (one extra `getReceptionConfigById` lookup only on that path) so the claim form can pre-fill/display it.
- `webcrew/src/app/page.tsx` — `SHOW_NEW_LANDING ? <WebsitePreviewLanding /> : <MissedCallLanding ... />`, `missed-call-landing.tsx` completely untouched. Reverting is the env-var flip the plan promised, never a code edit.
- **Verified**: `tsc --noEmit` clean on `webcrew/`, `pipeline/`, and an ad-hoc check on `api/src/index.ts`. `next build` (static export) succeeds both with the flag unset (old page renders, confirmed via `grep` on the exported `out/index.html`) and with `NEXT_PUBLIC_NEW_LANDING=true` (new page renders instead) — confirmed the switch works both directions from one build, not just "it compiles." **Live end-to-end test** (local `next dev` + local reception server, real Firecrawl/Gemini, test site `patagonia.com` — same "stable external site, definitely not a production `website_url`" rule as Phase 1/2): pasted the URL → staged progress reached `ready` in the UI's own polling loop → `GET /preview/status` correctly returned `businessName: "Patagonia"` → the rendered iframe page loaded with the real hero/services/widget embed. **Claim form's exact request shape verified against the real production Worker** (`api.webcrew.app`, not just code-reviewed): got `{"success":true}` back, and separately confirmed the shared `isRateLimited` 5-per-10-min gate on `/leads` still fires correctly (5th+ rapid request → 429).
- **Real anomaly found during that verification, not fully explained — flagged for the owner, not fixed here**: `wrangler tail` showed the Worker's `/leads` handler running to completion with no thrown exception and no `insertWebLead`-catch error logged (meaning `engageWithSofia`'s own `.catch()` around `insertWebLead` never fired), yet the resulting `leads` row never appeared when queried against the Neon DB `pipeline/.env`'s `DATABASE_URL` points to — confirmed with several different fresh test phone numbers, and confirmed the exact same `INSERT` SQL succeeds instantly when run directly against that same DB via `pg`. The Worker has both a `DATABASE_URL` and a `NEON_DATABASE_URL` secret set (confirmed present by name via `wrangler secret list`, values not readable) and `neonQuery()` accepts either — **most likely explanation is the Worker's bound secret value points at a different Neon database/branch than the one in `pipeline/.env` locally**, not a bug in the code touched this session (nothing in `insertWebLead`/`engageWithSofia` was modified — only the additive `previewConfigId` field and one notification-email row were added, and a direct query for `status='web_inquiry'` found **zero rows ever**, across all time, suggesting this predates today's work entirely). Worth a 5-minute check comparing the two `DATABASE_URL`/`NEON_DATABASE_URL` secret values against `pipeline/.env`'s before relying on any `/leads`-submitted web lead actually landing in the DB.
- **Not done at end of Phase 3**: not deployed/flag not flipped on in production. **Product-direction note (2026-09-28, owner discussion):** the claim step intentionally reuses the existing self-serve payment→provisioning→"create my password" flow (already built and verified live 2026-09-17) rather than any new auth — this preview flow is effectively the first true self-serve *public* signup entry point for WebCrew (every other path today is Sofia's SMS close or manual admin onboarding). Pricing for the claim step stays the existing 2-tier structure (`$297/mo` flat Front Office + `Custom` for anything outside the 4 pillars) — no new middle "upgrade" tier, to avoid re-introducing the tier confusion the 2026-09-02 flat-pricing pass deliberately removed.

**Phase 4 done (conversion wiring + cleanup — code-complete and verified, NOT deployed, flag still off):**
- `webcrew/src/components/website-preview-landing.tsx` — the claim form gained a second path the Phase 3 FAQ copy had already promised but the form didn't yet offer: a mode toggle, **"Add AI to my current site" (default, `interestOnly:true`, unchanged from Phase 3) vs "Build me a brand-new site instead"** (`interestOnly:false` — this is the one that actually fires `triggerAutomatedBuild()`, i.e. real Gemini/image-gen/GitHub/Cloudflare spend). Choosing "new" reveals city/state (required — feeds the generated site's address/service-area copy) + a business-type select (same `industries` list as `missed-call-landing.tsx`) + the same editorial/professional `templateStyle` picker, all reusing `handleLeadSubmission`'s existing fields unchanged (`templateStyle`, `city`, `state`, `businessNiche`) — **zero new Worker-side branching needed**, since a non-`interestOnly` submission with a `templateStyle` already goes through the exact same tier1-shaped build path a self-serve "no website yet" lead from `missed-call-landing.tsx` does.
- `pipeline/src/scripts/cleanup-expired-previews.ts` (new) — `cleanupExpiredPreviews()`: deletes expired `preview_jobs` rows first (both directly-expired ones and any still pointing at an already-expired config), then expired `reception_configs` rows (`is_preview=true AND preview_expires_at < now()`) — ordered that way because `preview_jobs.config_id` is a FK into `reception_configs` with no `ON DELETE` behavior, so deleting the parent first would throw. Never touches a real (non-preview) config, regardless of claim status — a claimed lead's actual AI-widget-on-their-site work happens through the separate, permanent onboarding path (admin's `website-assistant` page / real Stripe checkout+provisioning), not by mutating the disposable preview row.
- `pipeline/src/reception/server.ts` — new `POST /preview/cleanup` (Bearer-gated via the same `isAuthed` helper as `/follow-ups/run`, same intended trigger — a daily Cloud Scheduler hit, not yet created).
- **Verified for real, not just code-reviewed**: seeded one genuinely-expired `preview_jobs`+`reception_configs` pair and one 47-hours-from-now pair directly in the real Neon DB, ran the script for real — it deleted exactly the expired pair (`jobsDeleted:1, configsDeleted:1`) and left the fresh pair untouched, confirmed by a follow-up query. Cleaned up the fresh test row afterward. Also verified the HTTP route directly against a local reception server: no `Authorization` header → 401, wrong Bearer token → 401, correct token → 200 with real `{jobsDeleted, configsDeleted}` counts. `tsc --noEmit` clean on both `pipeline/` and `webcrew/`; all 60 reception unit tests still pass; `next build` (static export) succeeds with the flag both on and off, new toggle buttons confirmed present in the flag-on export's rendered HTML.
- **Deliberately not done, and not needed given how this was built**: the plan's original Phase 4 write-up assumed *every* claim would trigger real pipeline spend and therefore needed a hard sign-off gate before any conversion wiring existed at all — that's no longer quite true, since the default claim path (Phase 3's `interestOnly` reuse) triggers **zero** spend, and only the newly-added "build me a brand-new site" choice does. The spend-triggering path itself was intentionally NOT live-tested end-to-end with a real URL this session (would really build a site, spend real money, and text a real business) — that first real test should happen with the owner present, same posture as every other real-spend action this session declined to run unattended. Cloud Scheduler wiring for `/preview/cleanup` (daily hit, mirroring how `reception-follow-ups` is scheduled) is not yet created. Flag flip + production deploy are both still pending explicit owner sign-off, unchanged from Phase 3.

## Embeddable Client Widget — "AI Sales Person for Old Websites" (2026-09-27)

Pillar 4 ("AI-talking client website") was previously webcrew.app-only — `browser-relay.ts` had zero client-mode branching, no per-client origin scoping, and no embeddable script existed anywhere (verified by direct code read before starting, not assumed from stale notes). Built out for real this session, mirroring the phone line's already-proven client-mode pattern (`twilio-relay.ts`'s `isClientConfig`/`ClientCallSession` branch) instead of inventing a parallel one:

- **`browser-relay.ts`** now branches exactly like `twilio-relay.ts`: on `start`, if `isClientConfig(configData)` it builds a `ClientCallSession(configData, null, null)` (no callSid/callerPhone — a browser visitor has neither), intercepts tool calls through `clientSession.handle()` first (take_message/check_availability/book_appointment/find/reschedule/cancel_appointment — same calendar-aware client tools the phone line uses), and falls through to the WebCrew-only tool blocks (pricing, trial, verify-by-SMS) only when `clientSession` is null. `escalate_to_human`/`end_call` got the same client-aware tweaks twilio-relay.ts already has (skip the WebCrew pricing-gate/15-min-call-offer, use `clientClosingWasSpoken`, call `clientSession.onEscalated()`). Session-end now runs `generateClientCallInsights` + `updateCallLogClassification` + `clientSession.finishCall()` for client sessions, same as a phone call. `gemini.connect()` is called with `configData.system_prompt + buildClientRuntimeAddendum(...)` and `configData.website_url` (not the hardcoded WebCrew prompt/URL) — this is what actually flips `gemini-live.ts`'s tool-mode selection to `'client'`.
- **Per-client origin allowlist**: new `reception_configs.widget_allowed_origins TEXT[]` column (migration-v45, applied). The origin check moved from connection-time (couldn't know which client yet) to inside the `start` handler, after config load — a client's own widget checks `widget_allowed_origins` if set, else derives a single allowed origin from `website_url`'s origin (zero-config for the common case). The WebCrew/demo widget (no `?config=` param) keeps the original global `WIDGET_ALLOWED_ORIGINS` env-var check, unchanged.
- **New embeddable script**: `pipeline/src/reception/public/widget.js` (vanilla JS, ~350 lines, zero dependencies, no build step — ships as-is via `COPY src/ ./src/` in the existing Dockerfile). Shadow DOM UI (launcher + chat panel + mic toggle + text input), mic capture with the same box-filter downsample fix as `avatar-widget.tsx` (naive nearest-neighbor sampling was previously found to degrade Gemini's transcription), gapless 24kHz PCM playback, optional Turnstile (skipped if no `data-turnstile-sitekey`). Served at `GET /widget.js` (new route in `server.ts`, reads the file via `fs.readFile`, `Cache-Control: max-age=300`). Embed on any site with: `<script src=".../widget.js" data-config="<reception config id>" async></script>`. Optional attributes: `data-ws`, `data-turnstile-sitekey`, `data-accent`, `data-dark`, `data-name`, `data-position`.
- **Verified live** (local reception server against the real Neon DB + real Vertex Gemini Live, test config `b1d47991…` "Pavan Test HVAC", has Google Calendar connected): (1) client mode confirmed — greeting says "Thanks for calling Pavan Test HVAC!", never mentions WebCrew; (2) origin allowlist confirmed both ways — a forged `Origin: https://evil-scraper.example.com` gets `1008 origin not allowed` immediately, the real derived origin (`https://onboarding.webcrew.app`, from that config's `website_url`) connects fine; (3) legacy webcrew.app demo path (`ws://.../widget-ws` with no `?config=`) still gives the original WebCrew sales greeting — zero regression; (4) `check_availability` genuinely reached `ClientCallSession`→`calendarFromConfig`→`googlePort` and returned an honest "trouble checking the calendar" (never claimed a fake booking) — root-caused to `CALENDAR_TOKEN_KEY`/`GOOGLE_CALENDAR_CLIENT_ID/SECRET` being absent from local `pipeline/.env` by design (they live in Cloud Run Secret Manager + `admin/.env.local`, per the existing Google Calendar setup docs) — not a bug in this build, the phone line has the identical local limitation.
- **Not done / next steps before selling this**: (1) still not deployed — needs `gcloud builds submit` + `gcloud run deploy` (reception), `cd api && npx wrangler deploy` (Worker), `npm run deploy` (admin), and `git -C webcrew push deploy main` (landing page) before any of this is live — all four are local-verified only as of this note; (2) design is deliberately plain-MVP (emoji mic/send icons, simple launcher) — the original roadmap's "luxury design, Higgsfield-assisted" polish is real follow-up work, not done here; (3) per-IP daily session cap (`WIDGET_DAILY_IP_CAP`) and Turnstile are still shared/global across every client's widget on this one Cloud Run service, not per-client — acceptable for now, worth revisiting at volume.

**Admin UI + landing page pitch (2026-09-27, session 2) — client self-serve embed snippet, and the marketing pitch for it:**
- **Client portal**: `admin/src/app/client/(portal)/website-assistant/page.tsx` (new nav item "Website assistant", `client-nav.tsx`, gated on `hasReception`) — a logged-in client sees their real `<script src=".../widget.js" data-config="<their configId>">` snippet (via `WidgetSnippetCard`, `admin/src/components/widget-snippet-card.tsx`) with a copy button, plus a form to set which domain the widget is allowed to run on (`POST /api/client/widget-origin`, new route). This closes a real gap: `reception_configs.website_url` (used to derive the default allowed origin) is often NOT the client's actual old/existing site — it's a placeholder onboarding URL for self-serve/AI-reception-only clients — so without this form the zero-config default would silently point at the wrong domain for exactly the "old website" use case this product targets. `client-services.ts`'s former "Coming soon: Talking website assistant" stub is now a real `Service` entry (state `on`, links to the new page) once a reception config exists. `admin/src/lib/db.ts`'s `ClientReception` gained `websiteUrl`/`widgetAllowedOrigins`, plus new `setClientWidgetOrigin()`.
- **webcrew.app landing page**: `missed-call-landing.tsx`'s `#styles` section gained a third path — a "Already have a website?" card next to the 2 build-style cards — that flips the SAME lead form into "add AI to my existing site" mode (hides the website-style picker and Maps-link field, makes "current website" required, changes the submit CTA/copy, adds an info banner). New FAQ entry answers the same question for AEO. **Real safety fix required first**: the Worker's `/leads` handler (`api/src/index.ts`) auto-triggers a full unattended site-BUILD pipeline (`engageWithSofia`→`triggerAutomatedBuild`) for any lead with a phone + SMS consent and no `businessOwnerPhone` — exactly the shape a "keep my site" lead would have. Reusing that endpoint unmodified would have wastefully auto-built a new site nobody asked for. Fixed by adding `ContactLead.interestOnly?: boolean`, sent as `true` from the "keep my site" form path, which now skips `triggerAutomatedBuild` and swaps Sofia's opening-SMS prompt to describe adding a widget (never "demo site"/"new website"). The internal lead-notification email also now shows "Interest: Add AI widget to EXISTING site (no new build)" vs "New site build" so the owner never mistakes one for the other.
- **Verified locally** (not a full logged-in browser walkthrough — Playwright MCP wasn't connected this session, and the test client's password isn't something Claude has access to by design): `tsc --noEmit` clean on `pipeline/`, `api/` (ad-hoc), `admin/`, `webcrew/`. Admin dev server: new page/API route compile cleanly, correctly redirect/401 when unauthenticated, and the modified `/client/services` page still compiles. webcrew dev server: homepage renders 200, both the new card copy ("Already have a website?") and its CTA ("Add AI to my site") confirmed present in the server-rendered HTML.
- **Not deployed yet** — same as above, needs `wrangler deploy` (api/), `npm run deploy` (admin), and `git -C webcrew push deploy main` (webcrew) before any of this is live for a real visitor or client.

## PRODUCT DEFINITION (owner directive 2026-09-19 — read before deciding what to build)

**WebCrew's product is exactly four things, delivered at 100% quality. Everything else is an upgrade and does NOT get built until these four are proven with real paying clients:**
1. **AI Reception** (phone; includes appointment booking + CRM cards) — `pipeline/src/reception/`.
2. **Follow-up system** — appointment reminders, missed-call text-back, unreturned-lead nudges (`reception/follow-ups.ts`, Worker `handleCallStatus`).
3. **Review automation** — review *requests* by SMS with the client's Google review link (works today, no API); review *replies* need the Google Business Profile API (quota 0 as of 2026-09-19; see GBP notes) → interim: AI drafts the reply, owner one-tap posts it.
4. **AI-talking client website** — a floating "Floating AI Reception" widget on every client site (the site talks instead of sitting there). Shipped as a standalone embeddable script (`<script data-config=…>`, Shadow DOM) — see "Embeddable Client Widget" section below for the 2026-09-27 build (client-mode `browser-relay.ts`, per-client origin allowlist, `public/widget.js`). **Still open:** not yet deployed to Cloud Run, no admin UI to generate the embed snippet, and the "luxury design, Higgsfield-assisted" visual polish is deliberately deferred — current UI is plain-MVP.

**Parked (upgrades — do not start):** ads planner, video/social/reel engine, growth OS, RE walkthrough, extra niche templates, scraping expansion, GBP *posting*, SEO/AEO/GEO agents, Sofia SMS outbound expansion, multi-location. Quality gate for any change to pillar 1: run `pipeline/src/scripts/voice-eval.ts` on Vertex first (see Client-Mode AI Reception → voice eval).

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

## WebCrew Self-Serve Rebuild — 2 styles, $10k MRR target (2026-09-12/13)

**Note on drift**: the "What This Is" section below describes a MedSpaOS/med-spa-only pivot. The actual live code (`webcrew/`, `api/src/index.ts`) is 100% general local-business "AI Front Office" positioning (missed-call-landing.tsx), not medspa-specific — that doc section is stale relative to what's deployed. Trust the code over that section until someone reconciles them.

**Why**: an external "Master Plan v3" doc proposed $1M/yr via 10 sales/day from daily 4-hour Facebook Live + a $49/$99/$247 tier ladder. Rejected after review — the 10/day assumption is an outcome not a strategy, the upgrade-rate assumptions are unproven, and the real historical bottleneck has never been engineering: the fully-automated scrape→outreach→build→deploy pipeline had closed **zero** clients before this session. Replaced with a realistic, fully self-serve **$10k MRR target = 34 customers at $299/mo**, built almost entirely on infra that already existed. No new outbound messaging — consent-first stance holds (no SMS/email sent yet as of this session).

**What changed**:
- **webcrew.app now sells 2 website styles**, picked before the form (`webcrew/src/components/missed-call-landing.tsx`): "Editorial" (bold condensed headline, numbered cards — `templates/hvac-editorial`, generalized off HVAC-only copy this session) and "Professional" (`templates/hvac-zigzag` for HVAC; `templates/generic-business`, new, for everything else). Self-serve form now also captures City/State (required) and an optional Google Maps link.
- **Removed the "no credit card" / card-required contradiction** — landing page said "no credit card" in 7 places while `pricing.tsx`/Sofia's script both required a card for the trial. Copy now matches reality everywhere.
- **Removed undelivered-feature claims** — GBP auto-posting (still blocked on Google's own API approval, zero quota) and the `everything`/`marketing_only` lead-gen/ad-campaign plan tiers (never built, not on the roadmap) are gone from `webcrew/src/lib/plans.ts`, `api/src/index.ts`, and `admin/src/lib/plans.ts` — all three hand-maintained pricing mirrors, kept in sync by hand per their own header comments.
- **Exact Google Maps pin**: `Business.location?: {lat,lng}` (new, `packages/core/src/types/config.ts`), consumed by `service-areas.tsx`'s existing free iframe embed (prefers coords over the old address-text search). Populated two ways: scraped Tier-1 leads already have lat/lng from the Places API (now spliced into generated `config.ts` post-generation in `orchestrator.ts`, same pattern as the existing heroFrames splice); self-serve leads get it parsed from the pasted Google Maps link (`resolveMapsLatLng()` in `api/src/index.ts` — follows short-link redirects, regexes `@lat,lng`/`!3d!4d`).
- **"Any business" fallback**: `templates/generic-business` (new — scaffolded from `templates/landscaping`, generic `@core/web` sections, `Services layout="zigzag"`) is now what `builder.ts`'s `resolveTemplateDir()` and `build-local.ts` fall back to for any niche not in `NICHE_TEMPLATE_DIR`, instead of guessing a `templates/${niche}` folder that likely 404s. `config-generator.ts`'s `FALLBACK_SERVICES.default` gives it non-empty services even with zero scraped data. Style choice (`PipelineConfig.templateStyle: 'editorial'|'zigzag'`, new field) is honored for HVAC and for unmapped niches; other curated niches (medspa, dentist, etc.) keep their own signature template regardless of style pick, for now — generalizing those too is future work, not done this session.
- **Closed a real automation gap**: `POST /leads` (what the self-serve form submits to) only ever fed Sofia's SMS-sales conversation — it never actually triggered a build. Now, on lead insert, the Worker calls the reception Node server's existing `/pipeline-trigger` route (already auth'd via `RECEPTION_PROVISION_SECRET`, already used for `/provision`/`/warm-trigger`) which fire-and-forgets `runPipelineForLead()` — the same unattended path Tier-1 scraped leads use. "Fill the form, everything else automated" is now actually true for a walk-in visitor, not just for scraped leads.
- **Verified**: `tsc --noEmit` clean on pipeline/, api/ (ad-hoc, no project tsconfig exists there), webcrew/, packages/core, templates/hvac-editorial, templates/generic-business. `generic-business` rendered and screenshotted locally (content confirmed present past the scroll-reveal fold). webcrew's own local dev server hit a pre-existing Turbopack/Next.js install error unrelated to these edits (a `next` file missing under `webcrew/node_modules` that does exist at the monorepo root) — not fixed, flagged for a `npm install` check in `webcrew/` before relying on local dev there.
- **Not done this session**: nothing wired to actually drive traffic to webcrew.app (this pass fixes the offer or the funnel a visitor who arrives lands on, not acquisition) — SEO/schema work already in place is still the only channel; generalizing the other curated niches' templates to also honor style choice; a provider-swap abstraction for image generation (Imagen 3 is already primary, this was just not urgent).

## WebCrew Logo + Intro Animation (2026-09-19, local only — not deployed)

- **Logo = black disc, white eyes, orange smile** (user-supplied image). `webcrew/public/logo.png` + `webcrew/src/app/icon.png` (512px, transparent bg, cropped from a slightly-oval source and squared), `logo-1024.png` for large use. `logo.old.png`/`icon.old.png` are still the even-older gradient "W" (untouched); the previous navy neutral-face logo was overwritten and lives only in webcrew's git history (`git show HEAD:public/logo.png`). `webcrew/src/components/brand-mark.tsx` redrawn as SVG with the smile (blink/breathe kept, reduced-motion guard added); it feeds the nav/footer logo on every page.
- **Intro animation** (`webcrew/public/intro.mp4`, faststart copy of the user's `file.mp4`, 5s 1080p logo reveal, + `intro-poster.jpg`): `webcrew/src/components/intro-splash.tsx`, mounted in `app/page.tsx`. Full-screen muted overlay, fades at 4.0s, Skip button/click/Esc, once per session (`sessionStorage wc-intro-seen`), skipped for reduced-motion / save-data / 2g, failsafe 7s, autoplay-blocked → dismisses. Page content renders underneath, so it never blocks SEO/LCP.
- **Link preview**: `app/layout.tsx` `openGraph.videos` → `https://webcrew.app/intro.mp4`. `og-image.png` NOT changed (still the old "Calls, Google, Reviews" art) and is what most platforms show; few platforms play og:video.
- **Known mismatches, not fixed**: the video itself ends on the old navy neutral face (not the smile); `avatar-widget.tsx`'s floating launcher (`MiniFace`) still draws the old navy/neutral face — its mouth is audio-driven, so left alone. `public/file.mp4` (original) is untracked; deploy ships `intro.mp4` only if you `git add` it.

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
Rate limits: Gemini 500 req/day free, fal.ai $0.04/img, Kling 1.6 Pro $0.098/video
(verified 2026-09-28 against `cost-tracker.ts`'s `UNIT_COSTS` — this line previously
said $0.05, which was stale) → ~$0.25-0.35/site total depending on how many AI images
vs. real scraped photos get used.

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
- **Trial length corrected to 30 days (2026-09-17)** — supersedes the "2-week free trial"/"2wk trial" wording above and in the Sofia SMS section below; those reflect what was true 2026-08-23/09-02, not the current offer. Found via a real call transcript where the AI said "7 day trial" / "the first week" / "30-day trial" all in one call — `pipeline/src/reception/reception-contract.ts`'s `RECEPTION_OFFER.trialDays` (the actual live source of truth for the voice-triggered trial flow) was still `7`, disagreeing with `webcrew/src/components/pricing.tsx` and the Stripe `trial_period_days` values (already `30` in both `api/src/index.ts` and `admin/src/app/api/leads/[id]/checkout/route.ts`, just with stale "1-week" comments above them). Fixed `trialDays: 7` → `30`, plus every hardcoded "1-week"/"7-day" copy string in `api/src/index.ts` (`trialWindowLabel()` and its 6 call sites, Sofia's stage-prompt strings, SMS/email copy) and `pipeline/src/reception/{twilio,browser}-relay.ts`. `trialWindowLabel()`'s underlying 7-day cap logic (`PROMO_DEADLINE` scarcity window) was left untouched — that's a separate "sign up by this date" founding-offer deadline, not the trial length itself; only its label text was wrong. **Not yet redeployed to the reception Cloud Run service as of this note** — a live call right after this fix will still say "7 day" until `ai-reception` is rebuilt/redeployed (see the "Reception server deploy" command block above).
- **AI Front Office price corrected $299/mo → $297/mo, and setup-fee framed as a range (2026-09-17)** — user-directed correction, same session as the trial fix above. Updated the flat monthly price in all 4 hand-maintained `PLAN_CATALOG`/`PLANS` mirrors (`pipeline/src/reception/plan-catalog.ts`, `admin/src/lib/plans.ts`, `webcrew/src/lib/plans.ts`, `api/src/index.ts`) plus `reception-contract.ts`'s `RECEPTION_OFFER.monthlyPriceCents` (29\_900→29\_700), and every hardcoded `$299/mo`/`$299/month` copy string across `webcrew/src` (marketing pages, pricing.tsx, affiliate pages — commission math recomputed too: 30% of $297 = $89.10/mo, was $89.70), `pipeline/src/agents/{outreach,sms-outreach}.ts`, `pipeline/src/tools/{resend,visibility-check}.ts`, `pipeline/src/scripts/drip-followup.ts`, `pipeline/src/scheduler.ts` (comments), and `admin/src/components/onboard-client-form.tsx` (`amount: 299` → `297` — this one drives a real Stripe charge amount, not just copy). Deliberately left untouched: tier1's unrelated one-time "$299-$499" scraped-lead pitch range (`lead-hunter.ts`/`maps-scraper.ts`/`site-scorer.ts`/`daily-scrape.ts` comments, `stripe-agent.ts`'s `WEBSITE_PRICE_ONE_TIME`, `run-pipeline.tsx`) — different pricing lever (one-time tier1 site build, not the AI Front Office subscription), not in scope. Setup fee: `reception-contract.ts` gained `normalSetupHighCents: 99_900` alongside the existing `normalSetupPriceCents: 49_900`, so the voice/SMS `speakingInstruction` now says "Setup usually costs $499 to $999 or more, but it's $0 for you today" instead of a flat "$499" — `webcrew/src/components/pricing.tsx`'s matching copy (4 spots) updated the same way for consistency between what the phone says and what the site says. **Not yet redeployed** to Cloud Run / Cloudflare Pages / Workers as of this note.
- **Client-facing screens brand-matched to webcrew.app (2026-09-17)** — `admin.webcrew.app`'s `/client/login` and `/client/dashboard` previously used the internal admin tool's own dark navy/indigo theme (`--bg:#07070f`, `--accent:#6366f1`, system-ui font) even though these are the pages a paying client actually sees right after checkout — jarring next to webcrew.app's light green→blue (`#00C26F`→`#0EA5E9`) gradient brand with Plus Jakarta Sans/Inter. **webcrew.app's `globals.css` `--color-*` tokens are the single source of truth ("business DNA") for any client-facing screen anywhere, including inside the separate `admin` repo.** Fixed via a scoped CSS-variable override — new `admin/src/app/client/client-brand.css` + `admin/src/app/client/layout.tsx` remap the SAME variable names the dashboard/login pages already reference (`--bg`, `--accent`, `--text`, etc.) to webcrew's brand values inside a `[data-client-brand]` scope, so ~130 existing `var(--...)` usages across both pages picked up the new brand with zero markup changes; the handful of hardcoded indigo hex literals (`#6366f1`, `rgba(99,102,241,...)`) were swapped to `var(--accent)`/the new rgba by hand. The internal admin tool (everything outside `/client/*`) intentionally keeps its own dark theme — this was a client-facing-only fix. **Found and fixed a real, previously-live bug while testing this**: `src/middleware.ts`'s public-route allowlist checked `pathname.startsWith("/client/")` but not `/api/client/`, so `POST /api/client/auth` (the client login form's own endpoint) was being redirected into the internal admin's password gate whenever `ADMIN_PASSWORD` is set — meaning the entire client magic-link login flow was broken in any real deployment with admin auth on. Fixed by adding `/api/client/` to the allowlist. This also unblocked `/api/client/change-request`, which had **no auth of its own** — it was accidentally "protected" only by that same bug; added a real `verifyClientCookie` check there now that it's reachable. Verified the whole real flow end-to-end locally: submitted the login form for an actual paid test lead (`pavan.harati@gmail.com`, `handed_off=true`), followed the dev-mode magic link, landed on a correctly re-themed dashboard.
- **Full production deploy + live end-to-end proof (2026-09-17)** — all of the above shipped for real: root repo pushed to `origin`/`pavan` (the root repo's own `webcrew` remote alias was left alone — it points at `ranjeetsinghai79/webcrew.git`, the **webcrew subdirectory's** separate repo, not a real root-monorepo remote; pushing the monorepo there would be wrong, flagging in case that alias should just be deleted), `webcrew/` pushed to `deploy` (triggers its GitHub Actions → CF Pages workflow, confirmed `success`) + `origin`, `api/` via `wrangler deploy`, `admin` via `npm run deploy` (CF Pages), `ai-reception` rebuilt via `gcloud builds submit` + redeployed via `gcloud run deploy` (now revision `ai-reception-00054-49j`, serving 100%).
  Then ran one real Stripe **test-mode** subscription checkout through the actual `createTrialCheckoutLink()` code path (not a simulation) against the existing paid test lead (`7d84c51f-...`, `pavan.harati@gmail.com`) — Stripe's own hosted checkout page independently confirmed both fixes ("30 days free... then $297.00 per month"), completed payment, and the full chain fired for real: webhook processed the event, `/provision` correctly hit its idempotency path (`reused: true` — this lead already had a real Twilio number `+19342482253` from earlier testing, so no duplicate number was purchased), a fresh magic token was issued, and `/thank-you` auto-polled into a working "Open client dashboard" link with **zero email re-entry**, landing on the live, correctly branded dashboard showing the real `$297/mo` active subscription.
  **Found and fixed one more real bug during this run**: `ADMIN_URL` was set in `admin/.env.local` (`https://webcrew-admin.pages.dev`, not even the real custom domain) but was never pushed as an actual Cloudflare Pages secret — in production `process.env.ADMIN_URL` was `undefined` there, so the webhook's welcome-email portal link and this session's magic-link handoff were both silently falling through to `http://localhost:3010`. Set `ADMIN_URL=https://admin.webcrew.app` via `wrangler pages secret put` — **note for future secret changes on this project: CF Pages secrets only take effect on the next deployment, not retroactively on the currently-live one** (confirmed by testing — the fix required a redeploy before it took effect). Re-verified after redeploying: the dashboard link now correctly resolves to `admin.webcrew.app`.
  Test artifacts: the `E2E Test Lead` name/city on that lead row and the test Stripe subscription are harmless leftover test data (Stripe test-mode, no real charge ever occurs), not cleaned up.

## Client-Mode AI Reception — first-client readiness (2026-09-18)

A paying client's receptionist is a different product from the WebCrew sales line, and until this pass it was the same code path with WebCrew's sales behaviour bolted on. Audit of a real client call found it would have failed in five ways; all fixed and deployed (Cloud Run `ai-reception-00055-w4h`, previous good revision `00054-49j`; Worker `24dbce7e`; migration v40 applied).

- **P0 — client calls would have had dead air.** Cloud Run env `GEMINI_LIVE_MODEL_VERTEX` was `gemini-3.1-flash-live-preview` (an AI-Studio-only name). Client lines are Vertex-only by design (free-tier AI Studio data must not carry a client's customers), and Vertex returned 1008 "model not found". Demo/WebCrew traffic hid it because it uses AI Studio first. **Only `gemini-live-2.5-flash-native-audio` in `us-central1` resolves on `webcrew-501006`** (probed 2026-09-18: `global`, the 3.x previews, and the `gen-lang-client-0362421597` billed project — billing not enabled — all fail). Env var now set to that; code default location also `us-central1`. Verified on the deployed service (greeting audio ~1.4s).
- **P0 — all text generation silently ran on the 20-req/day free tier.** `GEMINI_FLASH='gemini-3.8-flash'` / `GEMINI_PRO='gemini-3.1-pro-preview'` 404'd because `tools/gemini.ts` called Vertex in `us-central1`; **Gemini 3.x text models are served from Vertex's `global` location only** (verified: 3.8-flash, 3.7-flash, 3.5-flash, 3.1-pro-preview all OK in `global`). So `geminiText()` always fell through credits→billed→AI Studio, which would have broken provisioning (`buildBrain` uses GEMINI_PRO) and call insights after ~20 calls/day. Fixed by `VERTEX_TEXT_LOCATION` defaulting to `global` (an interim fix that mapped to 2.5 models was replaced — the newest models work). **Live voice is the opposite: regional (`us-central1`), and `gemini-live-2.5-flash-native-audio` is the only conversational Live model in Vertex's catalog** (`gemini-3.5-live-translate-preview` / `gemini-3.5-transcribe-live-preview` exist but are translation/transcription, not agents). There is nothing to request from Google for a 3.x conversational Live model — it is not published on Vertex yet.
- **Client tool set** (`reception/client-tools.ts`, `gemini-live.ts` `selectToolDeclarations`): a client line never gets `start_trial`, `get_webcrew_pricing`, `build_founder_offer`, `verify_email_by_sms`, or WebCrew's prospect-shaped `take_message` — it gets a client `take_message` (name, confirmed callback number, what they need, SMS consent; email optional) plus, only when a calendar is connected, `check_availability`, `book_appointment`, **`find_appointment`, `reschedule_appointment`, `cancel_appointment`**. `end_call` no longer demands "Thank you for calling WebCrew" or a WebCrew 15-min-call offer on a client line; escalation no longer requires the WebCrew pricing tool. Runtime prompt addendum (`buildClientRuntimeAddendum`) is applied at connect time, so it also upgrades configs whose stored `system_prompt` predates this.
- **Per-client calendar.** Was one global Cal.com event type → every client booking landed on WebCrew's calendar. Now `reception_configs.cal_api_key/cal_event_type_id/timezone`; **no calendar = no booking tools (message-only)**, never a fallback to WebCrew's (only configs in `AI_STUDIO_BACKEND_WEBSITE_URLS`, e.g. `webcrew.app/hvac-test`, use the env calendar so the demo still books). Connect with `CLIENT_CAL_API_KEY=… npx tsx pipeline/src/scripts/set-reception-calendar.ts <configId> <eventTypeId> <tz>` (verifies against Cal.com first; live on next call). Cal.com v2 reschedule/cancel/list verified live end-to-end (reschedule returns a **new uid**).
- **Appointment safety.** A caller can only see/move/cancel bookings tied to their own caller ID (phone stored in booking metadata) or a spelled-back+confirmed booking email; a `booking_uid` must have come from `find_appointment` this call; max 3 lookups/call; reschedule/cancel need an explicit yes judged on the last ~12s of caller speech (`isAffirmed`, walk-backs like "yes… no wait" rejected).
- **CRM (own tables, not `leads`).** Migration v40: `reception_contacts` → `reception_opportunities` (stage: new/callback_requested/booked/cancelled/escalated/contacted/won/lost/spam) → `reception_events`, `reception_follow_ups`. Previously a client's caller was upserted into WebCrew's own sales `leads` (status `interested`) — cross-contamination with WebCrew outreach/Sofia — that no longer happens for client lines. Tools move stages deterministically (book→booked, message→callback_requested, cancel→cancelled, transfer→escalated). Owner alerts carry a signed one-tap "mark contacted" link (`GET /crm/contacted`, HMAC on `RECEPTION_PROVISION_SECRET`).
- **Caller classification is post-call, NOT a live tool.** A live `classify_call` tool was built and removed: on Vertex's native-audio Live model it made the model emit `MALFORMED_FUNCTION_CALL` turns (empty turn = silence on the line; measured 6/6 on one utterance, and repeated-failure on a complaint call). Dropping it → 0 malformed across 5 real-audio scenarios; a tool-free `enum`/minimal schema still failed. Instead `generateClientCallInsights()` classifies intent/urgency/summary/sentiment from the full transcript after the call → `call_logs.intent/urgency/route`, updates the CRM card, and is a safety net: a real customer need or urgent/emergency call that ended with nothing captured still becomes a card + owner alert. Live routing (emergency→offer transfer, vendor→end, booking→calendar) is prompt + tools. Also added a generic `MALFORMED_FUNCTION_CALL` recovery in `GeminiLiveSession` (nudge + retry ×2) for any tool.
- **Follow-ups.** `reception/follow-ups.ts`: appointment reminders (24h before, or 2h if booked inside 24h; SMS only if the caller consented on the call, else email) and owner "unreturned lead" nudges (2h; 15 min if urgent), no texts 9pm–8am local. Drained by `com.webcrew.reception-follow-ups` (launchd, every 10 min, **runs on this Mac — needs it awake**) or `POST /follow-ups/run` (Bearer `RECEPTION_PROVISION_SECRET`; Cloud Scheduler API is not enabled on `webcrew-501006`, so nothing hits it yet — Cloud Run has min-instances but no in-process timer). Follow-up SMS to customers is sent **from the client's own Twilio number**, and the Worker now routes a text *to* a client's number to the business owner (email+SMS, one auto-ack per customer per 12h, client-branded STOP/HELP that clears `reception_contacts.sms_consent`) instead of into Sofia.
- **Tests:** `npm run reception:test` (35). Live Gemini harness used this session: caller turns synthesized with macOS `say` → 16 kHz PCM streamed into a real `GeminiLiveSession` with fake CRM/Cal deps; text-input harnesses are misleading on the 2.5 native-audio model (unreliable replies) — use audio. Run local Vertex scripts as `node --env-file=.env ../node_modules/tsx/dist/cli.mjs <script>` from `pipeline/` (`node --import=tsx/esm` breaks on `gaxios`'s package.json) with `GOOGLE_APPLICATION_CREDENTIALS=$PWD/webcrew-vertex-sa.json`.
- **Follow-up pass, same day (rev `ai-reception-00056-xrs`, admin `15848f2c`):**
  - **UPDATE 2026-09-19 — `gemini-3.8-live` (GA 2026-09-15, $3/M audio-in, $12/M audio-out ≈ $0.005+$0.018/min, same rates as 2.5) now appears in the Vertex catalog** (`GET .../publishers/google/models/gemini-3.8-live` = 200 in `us-central1` + `europe-west4`; `gemini-3.1-flash-live-preview` = 200 in us-central1/us-east4/europe-west4; `-extended-thinking` = 404 everywhere). **But the Live WebSocket still closes 1008 "Publisher model … not found or [no access]" for `webcrew-501006`** — listed but gated. `gemini-live-2.5-flash-native-audio` still works (first audio 1.3 s). Action: request Vertex access for 3.8-live; re-run the probe (`live38.mjs` pattern: `@google/genai` `vertexai:true`, `ai.live.connect`, `sendRealtimeInput({text})`) until `setupComplete` arrives, then A/B with the audio harness before switching `GEMINI_LIVE_MODEL_VERTEX`. Text `sendRealtimeInput` is required on 3.x (not `sendClientContent`). Voicebox (jamiepine/voicebox) is a local voice-clone/dictation desktop app, not a telephony agent model — irrelevant here; self-hosting OSS S2S (Moshi etc.) rejected: no tool calling, EN/FR only, ~$520/mo per always-on L40S vs Gemini ≈ $0.02/min.
  - **UPDATE 2026-09-19 (later) — `gemini-3.8-live` WORKS via AI Studio, gated on Vertex.** Vertex: publisher GET says `launchStage: GA` but it is absent from our project's model list and the Live WS closes 1008; other developers report the identical error and Google staff have not published an access process (forum threads only). AI Studio: with the existing `GOOGLE_AI_API_KEY` (free tier), `gemini-3.8-live` connected, `setupComplete`, first audio **1.2 s** vs **3.6 s** for `gemini-2.5-flash-native-audio-preview-12-2025` on the same path (single text-prompted sample each — not a quality benchmark). `webcrew-501006` has billing enabled and `generativelanguage.googleapis.com` already enabled, so an API key created IN that project should be paid-tier (Google's paid terms: no training on prompts) — that is the route to 3.8-live for client lines without waiting on Vertex. **Not done:** create that key, re-add an AI-Studio candidate to `gemini-live.ts` `buildChain` behind a flag (voice is Vertex-only today by product decision), run the audio harness (booking + tool calls, ~5 scenarios) 3.8 vs 2.5 before switching.
  - **Voice eval harness + first results (2026-09-19).** `pipeline/src/scripts/voice-eval.ts --backend vertex|aistudio [--only <scenario>]` drives a REAL `GeminiLiveSession` with the real client prompt/tools of the test HVAC line (`b1d47991…`), macOS-`say` phone audio, canned tool results, the relay's real greeting trigger; scores 5 scenarios (emergency, book, faq, reschedule, robocall), first-response latency, malformed calls, dead air, and reports which backend ACTUALLY served (a silent fallback is flagged INVALID). Vertex run needs `GOOGLE_APPLICATION_CREDENTIALS=$PWD/webcrew-vertex-sa.json`; aistudio run uses `GEMINI_LIVE_AISTUDIO_KEY` else the free `GOOGLE_AI_API_KEY` (synthetic audio only). **Results (single synthetic voice, free-tier AI Studio):** 2.5-Vertex 4/5, 3.8-live 5/5; median first response ~1.5 s vs ~1.6–1.9 s (one 13 s outlier on 3.8 — free tier, unverified on paid); 0 malformed calls on either. **Real difference: emergency triage.** For "furnace died, newborn at home", 2.5 IGNORED the prompt's "EMERGENCY TRIAGE… every call" rule and booked a routine slot 5 days out; 3.8 took an urgent message. Both answered the price question correctly from the prompt. Both require the caller's email to book (`book_appointment.caller_email` is required) — friction for phone callers; product decision pending. Bugs found on the way: (1) `gemini-live.ts` sent `thinkingLevel` for every `gemini-3*` model but `gemini-3.8-live` rejects it (close 1007) → now only `3.1` gets `thinkingLevel`, others `thinkingBudget:0`; (2) a call-time fallback silently masked that failure. **New opt-in backend in `gemini-live.ts`:** `GEMINI_LIVE_PRIMARY=aistudio` + `GEMINI_LIVE_AISTUDIO_KEY` (BILLED-project key only) → `gemini-3.8-live` first, Vertex 2.5 as fallback; default unchanged (Vertex only). **Blocked:** the existing `WebCrewAPI` key (webcrew-501006) returns close 1011 "Your prepayment credits are depleted" → the Gemini API in that project bills from AI Studio prepay credits (separate from Vertex/Cloud credits); owner must top up at ai.studio/projects → Billing, then set `GEMINI_LIVE_AISTUDIO_KEY` + `GEMINI_LIVE_PRIMARY=aistudio` on Cloud Run and re-run the eval on the paid key before switching.
  - **Pillar-1 fixes shipped 2026-09-19 (Cloud Run `ai-reception-00061-b9l`, rollback `00060-crx`; AI Studio backend flag OFF).** (a) Urgent non-safety calls (no heat/AC in extreme weather, active leak, or a vulnerable person at home) are no longer answered with the earliest routine slot when that is >~24 h away: `check_availability` → offer a slot only if within ~24 h, else say when the next opening is, offer an immediate transfer, else `take_message urgency=urgent/emergency` (rule in `buildClientRuntimeAddendum` — applied at connect time so it upgrades already-stored prompts — and mirrored in `brain-builder.ts` HVAC_BLOCK). (b) Booking no longer requires the caller's email on Google calendars (`CalendarPort.requiresEmail`; Cal.com still requires it; client-mode `book_appointment` declaration drops `caller_email` from `required`; Google event has no attendee/invite when no email). Eval after fixes: **Vertex 2.5 (prod) 5/5, emergency passed 4/4 runs; 3.8-live 5/5**; 57 unit tests pass. To turn 3.8 on: owner tops up AI Studio credits → set `GEMINI_LIVE_AISTUDIO_KEY` (key from billed project, e.g. `WebCrewAPI`) + `GEMINI_LIVE_PRIMARY=aistudio` on Cloud Run → re-run `voice-eval.ts --backend aistudio` on the paid key first.
  - **Pillar 2 (follow-ups) moved to the cloud + A2P BLOCKER found (2026-09-19).** Follow-up drain now runs from **Cloud Scheduler job `reception-follow-ups`** (project `webcrew-501006`, `us-central1`, every 5 min, `POST https://ai-reception-459352382653.us-central1.run.app/follow-ups/run`, header `Authorization: Bearer $RECEPTION_PROVISION_SECRET`; API enabled today; a brand-new job took ~4 min to fire its first tick — that's normal, not broken). Recreate: `gcloud scheduler jobs create http reception-follow-ups --location=us-central1 --schedule="*/5 * * * *" --uri=<url> --http-method=POST --headers="Authorization=Bearer <secret>" --attempt-deadline=120s --max-retry-attempts=1`. The Mac launchd job `com.webcrew.reception-follow-ups` was booted out (plist left in `~/Library/LaunchAgents/`, NOT in health-check's auto-heal list). The drain is idempotent (`FOR UPDATE SKIP LOCKED`). E2E test on the test client (seeded a due reminder + a 3-h-old unreturned lead for the owner's own phone; rows cleaned up afterwards): the cloud tick claimed both within 5 s and marked them `sent`. **But Twilio then reported both `undelivered`, error 30034 (A2P 10DLC unregistered number).** Cause: the Messaging Service's campaign use case is `SOLE_PROPRIETOR`, which registers ONE 10DLC number; `+19182555151` (added June) is the registered one and delivers; every later number (`+19342482253` client test line, `+12182827420`) stays unregistered. Consequence: **all SMS from any client line — reminders, owner nudges, booking confirmations, missed-call text-back, review requests — is dropped by carriers while our logs say "sent".** Fix options: (1) register a Standard / Low-Volume Standard brand (needs legal business name + EIN) and a campaign, attach all client numbers (only option that keeps per-client numbers; lead time days–weeks); (2) bridge: send all client SMS from the one registered number with the business name in the body + route replies by customer phone (moderate build; campaign content must cover it). Health check (`scripts/health-check.ts`) now has `checkFollowUpRunner` (overdue pending follow-ups >30 min) and `checkSmsDelivery` (24 h of Twilio messages; alerts on any 30034). Also seen: 24 other failures/24 h are `21211` invalid destination numbers from WebCrew's own sales SMS (parked area).
  - **INCIDENT 2026-09-21 — Neon DB over quota → live phone AI down.** Every query fails with `53000 "Your account or project has exceeded the quota. Upgrade your plan"`. Impact: `POST /voice/:id` on Cloud Run hangs (>15 s, no response; Twilio times out) for BOTH lines, because the relay loads the config from Neon at the start of every call and `/voice` has no DB-failure path; `/health` (no DB) and the Worker `/health` still look fine, which hides it. Probable cause: Neon free-plan compute/storage exhausted by always-on load, ALL from parked areas: two `scrape-universal.ts` processes running 1 day and 9 h, plus KeepAlive launchd jobs `medspas-100k`, `platform-worker` (pg-boss), `scheduler` (pg-boss), `scrape-fast`, plus 2-minute pollers `auto-build-from-sms` and `gsc-verify-worker` — the DB never gets to suspend; the scraped_places dedup table (134k+ rows) also bloats storage (see memory feedback_neon_production_only — scrape data belongs in the sheet). Same message was seen 2026-07-22. Cloud Scheduler job `reception-follow-ups` was PAUSED 2026-09-21 (`gcloud scheduler jobs resume reception-follow-ups --location=us-central1 --project=webcrew-501006` once the DB is healthy). Needed from owner: upgrade the Neon plan (console.neon.tech → project → Billing/Usage; the phone product must not depend on a free-tier DB). Hardening still TODO: `/voice` DB-failure fallback (fast apology TwiML / forward to owner), stale-if-error config cache, Twilio Voice Fallback URL on a Worker route, and a health check that exercises a DB-backed `/voice`, not just `/health`.
  - **Neon cleanup DONE 2026-09-22** (owner upgraded to Launch plan first, confirmed reachable). `neon-cleanup.ts` had two real bugs found and fixed while running it for real: (1) the NOT-NULL-FK block was schema-shape-only — now checks actual referencing rows, so an empty child table (the common case, e.g. `referral_commissions`) doesn't force a manual override; (2) `TRUNCATE` was used for most tables, but Postgres refuses to truncate a table if ANY other table has a live FK pointing at it regardless of data — and `leads` itself holds an FK into `audits`, so truncating `audits` failed even with `leads` excluded/empty. Rewrote to `DELETE` every emptied table in a fixed-point retry loop (a `SAVEPOINT` per table per pass, keep retrying whatever's still blocked until a pass makes no progress) instead of hand-deriving a dependency order — simpler and correct for a one-off script. Also added `yelp_reviews` (90,626 rows, cached Yelp review scrape data) to the empty-list; it wasn't in the original classification. Rolled back cleanly on the first failed attempt (transaction discipline held) before either bug was found — verified 599/90626/267333/etc rows were still 0 loss before retrying. Applied: all leads/scrape/test/log/parked-feature tables emptied, `pgboss` schema dropped, backup written to `~/neon-cleanup-backup-2026-09-22.json`. Two stale `reception_configs` rows deleted (`LusterFinish Mobile Auto Detailing` — never paid/handed off, no number, 0 calls; `Albertsons` — the known stuck test build, inactive, 0 calls); kept both `WebCrew` lines and `Pavan Test HVAC` (voice-eval.ts's hardcoded test target). `consent_events` (TCPA proof) untouched, confirmed 6 rows before and after. DB size 173.8 MB → 47.9 MB after `VACUUM` on the emptied tables (a straight post-DELETE re-check showed 183.8 MB — DELETE doesn't reclaim space until vacuumed, unlike TRUNCATE; don't read that number as "cleanup failed"). **Production confirmed working again**: both `/voice/<id>` webhooks now respond in 0-1s (were 504-timing-out for ~24h). Cloud Scheduler `reception-follow-ups` resumed (was paused during the outage).
  - **Twilio `.env` duplicate-key bug fixed 2026-09-22.** `pipeline/.env` had TWO active `TWILIO_ACCOUNT_SID` lines — the correct `AC…`/token pair the owner added (line ~61-62) and a leftover `SK…` API-key pair (line ~64-65) added earlier by mistake. Since duplicate keys in a `.env` file resolve last-wins, the `SK` pair was silently overriding the correct one and breaking all local Twilio calls. Commented out the `SK` pair; verified the `AC` pair now authenticates (HTTP 200, account "WebCrew", active). **Not yet done: production (Cloud Run + Worker) still runs on the OLD Twilio account** (`ACd10ec826489e7c63afe04ba5d33455f6`, the one with the VERIFIED campaign for `+19182555151` only) — switching prod means either porting/re-buying numbers on the new account (Twilio numbers are account-bound, can't just "move") and repointing every webhook + the `reception_configs.twilio_phone` rows + Cloud Run/Worker secrets together, or keeping voice on the old account and doing something else with the new one. **Also: the new account's own A2P campaign is FAILED** (error 30909, same Sole-Proprietor ceiling as the old one) — switching accounts alone does NOT fix client SMS; that still needs the Standard/Low-Volume-Standard brand+campaign decision (EIN) from the 2026-09-19/20 conversation. Owner has NOT yet said which numbers/lines should move to the new account — needs a decision before touching prod Twilio config.
  - **Cleanup directive 2026-09-21 (owner: no real clients, lead data lives in the Google Sheet, goal = product ready for new clients).** DONE: all launchd jobs retired except `com.webcrew.health-check` (scrape-fast, medspas-100k, scheduler, platform-worker, sms/email-outreach, drip-followup, auto-build-from-sms, gsc-verify-worker, content-cadence-cron, video-render-poll, review-requests, reception-follow-ups); plists moved to `~/Library/LaunchAgents/disabled-2026-09-21/` (re-enable = move back + `launchctl bootstrap gui/$(id -u) <plist>`); running scrapers killed; health-check `EXPECTED_JOBS` reduced to itself so it can't resurrect them. GCP has no scraper schedulers (only the paused `reception-follow-ups`). READY BUT NOT RUN (DB still returns 53000): `pipeline/src/scripts/neon-cleanup.ts` — dry-run by default, `--apply --delete-configs <ids>`; empties leads/scrape/queue/test/log tables via TRUNCATE (falls back to DELETE where a kept table has an FK in), drops the `pgboss` schema, NEVER empties `consent_events` (TCPA proof + STOP records), NULLs kept-table FKs into emptied tables first, writes a JSON backup of kept tables to `~/neon-cleanup-backup-<date>.json`, leaves unclassified tables untouched and lists them. Finding: `send-review-requests.ts` (pillar 3) is built on the LEGACY `cal_bookings` + `leads` tables, not `reception_opportunities`, so it never handled new-architecture bookings — pillar 3 must be rebuilt on `reception_*` (needs a per-client Google review link setting).
  - **New Twilio account (verified read-only 2026-09-21):** `pipeline/.env` had TWO active `TWILIO_ACCOUNT_SID` lines — a valid `AC…` (line ~61, token line ~62) and an `SK…` API-key SID (line ~64) that overrides it (last wins) → auth fails until the `SK` line is commented out and the file saved. The AC pair is valid: account "WebCrew", type Full, active, balance ≈ $14.30, one number `+14156873555` (voice+SMS, `voice_url` none, `sms_url` = an old Twilio Function), Messaging Service with A2P **campaign FAILED (error 30909 — CTA/message-flow unverifiable, rejected 2026-06-02)** and brand `SOLE_PROPRIETOR` APPROVED (identity VERIFIED). So switching accounts does NOT fix client SMS: still Sole Proprietor = 1 number, and this campaign is not approved. Old account campaign is VERIFIED for `+19182555151` only. Real fix for multi-number client SMS = Standard/Low-Volume Standard brand (EIN) + campaign. Cutover caveat: numbers/CallSids are account-scoped, so Cloud Run/Worker creds must switch together with the numbers' webhooks (a partial switch breaks hangup/redirect on live calls).
  - **Gemini paid key confirmed working 2026-09-21** (owner updated the card + $5 advance on Google Cloud billing account `016CC3-3F88BC-EEF775`, which is linked to `webcrew-501006`): `WebCrewAPI` key → `gemini-3.8-live` ready, first audio 1.1 s. Paid-key `voice-eval` run could not complete (eval loads the test config from the blocked DB). The same key 404s on `gemini-2.5-flash` text ("no longer available to new users") — only `audit-report.ts` (parked) uses that model; pillar text paths use Vertex `gemini-3.x`.
  - **Twilio switch pending (2026-09-21):** `pipeline/.env` `TWILIO_ACCOUNT_SID` currently holds an API Key SID (`SK…`, 34 chars) + its secret, not the Account SID (`AC…`) + Auth Token our code needs (`Basic ${SID}:${TOKEN}` and the SID in the URL path) → Twilio auth fails; `TWILIO_MESSAGING_SERVICE_SID` and `TWILIO_FROM_NUMBER` were blanked. Prod (Cloud Run + Worker) still uses the old account. Old account SID: `ACd10ec826489e7c63afe04ba5d33455f6`.
  - **PRODUCTION HARDENING 2026-09-26 (Cloud Run `ai-reception-00063-zgh`, rollback `00061-b9l`; Worker `57fc86a3`; admin `68edb39e`).** (1) `/voice` can no longer hang: any failure returns fallback TwiML — rings the owner's cell from the last-known-good config (`outageTwiml`, never dials the line's own number), else an apology. `db.ts getReceptionConfigById` keeps a per-line cache used ONLY when the DB errors (owner edits still apply instantly when healthy), warmed at startup via `warmConfigCache()`. (2) `GET /ready` (DB-backed, 503 when DB is down) and `GET /ready/voice` (opens a real Gemini Live session; Bearer `RECEPTION_PROVISION_SECRET`, 60 s cache) — `/health` stays DB-free and is NOT a call-readiness signal. (3) Twilio `VoiceFallbackUrl` = Worker `POST https://api.webcrew.app/voice-fallback` (static TwiML, independent of Cloud Run/DB) set on `+19182555151` and `+19342482253` (old account) and on every newly bought number (`server.ts`, `provision-client.ts`; env `VOICE_FALLBACK_URL`). (4) Cloud Monitoring in `webcrew-501006`: email channel → `pavan.harati@gmail.com`, uptime checks `WebCrew reception ready (database)` (1 min) + `WebCrew reception voice session (Gemini)` (5 min, USA_OREGON/IOWA/VIRGINIA), and one alert policy each (fires when >1 region fails for 2 min, auto-close 30 min). Alerts have NOT been seen firing (an outage was not simulated on production). Health-check script also probes `/ready`. (5) Cloud Run: `--cpu-boost`, max instances 5→10; concurrency 8/instance, request timeout 3600 s, min instances still 0 (first call after idle = cold start). **Warm-instance cost (Cloud Run instance-based billing $0.000018/vCPU-s + $0.000002/GiB-s, minus free tier): ≈ $93/mo for 2 vCPU/1 GiB always-on, ≈ $47/mo at 1 vCPU** — owner decision, recommended once there is a paying client. (6) `scripts/load-test-calls.ts` (simulated Twilio Media Streams over the live `/ws`, ~7.5 s calls so no summaries/emails; `--cleanup` removes rows for callers `+1555010xxxx`): 8, 12 and 20 simultaneous calls → all connected, AI spoke on all, first audio p50 ≈ 1.2–1.3 s / max 1.5 s, **0 dropped mid-call** (1006 closes only after our own hang-up event). Capacity: 8 calls/instance × 10 instances = 80 concurrent; Vertex Live allows up to 1,000 concurrent sessions/project on PayGo (Google docs). (7) `scripts/google-calendar-selftest.ts` drives the real `googlePort` against the real Google Calendar API using service account `webcrew-gbp-sa.json` (must be a `webcrew-501006` SA; the Vertex SA's project has Calendar API off): 9/9 pass — slots, book with no email, booked time leaves the offer list, double-book refused, find by phone metadata, reschedule keeps length, cancel, revoked token → `calendar_disconnected` + owner notified. Cannot cover the interactive consent, refresh-token exchange or attendee invites (SA can't invite without domain-wide delegation) → `scripts/google-calendar-live-check.ts` covers those once someone connects (needs `CALENDAR_TOKEN_KEY` from Secret Manager `calendar-token-key` + client id/secret from `admin/.env.local`, none of which are in `pipeline/.env`). Google OAuth client verified valid: token endpoint answers `invalid_grant` (not `invalid_client`) for a fake code, and the auth URL redirects to sign-in with no redirect/scope error. (8) **Client "My services" page** (`admin/src/app/client/(portal)/services`, logic in `admin/src/lib/client-services.ts`, nav "My services"): plan + status, and per-service state derived from real data (phone reception On/Ready for calls/Being set up/Paused; booking On/Needs setup; reminders On/Partly on/Starts with booking; website Live), plus "Coming soon" (review requests, website assistant). Texts count as On only when Cloudflare Pages secret `SMS_READY=true` (set when carrier registration is approved). (9) Test client recreated after the cleanup: lead `7417a9f9-…` (`source='test'`, `pavan.harati@gmail.com`, plan `ai_front_office`, paid/active) linked to config `b1d47991…`; password is set by the owner through the normal "forgot password" email (never by Claude). **A2P/ISV finding:** Twilio's ISV rules expect each customer business to be its own Brand + Campaign (docs.twilio.com a2p-10dlc/onboarding-isv); the owner's EIN covers WebCrew as a sender only. Options: (a) shared WebCrew sender for all client texts under one WebCrew Standard campaign (fast, carries approval/filtering risk because messages name other businesses); (b) per-client brand registration via the ISV API at onboarding (compliant, 1–3 weeks each, needs each client's EIN); (c) email + voice only until volume justifies (b). Voice is not gated by A2P.
  - **Google approvals status (2026-09-19):** (1) GBP API Basic Access — submitted 2026-09-02, live probe shows `429 RESOURCE_EXHAUSTED quota_limit_value:"0"` on `mybusinessaccountmanagement` + `mybusinessbusinessinformation` (note `listAccounts()` in `tools/google-my-business.ts` swallows this and returns `[]`, so `gbp-discover.ts` says "no accounts visible" — misleading); Google's own rule: listing must be 60+ days old (created 2026-09-02 → earliest ≈ 2026-11-01), so expect rejection/resubmit; no reply visible (Gmail connector needs re-auth). (2) Calendar OAuth verification — NOT submitted (owner console steps). (3) Vertex `gemini-3.8-live` — no public access process; bypassed via AI Studio paid key.
  - **AI-visibility check of webcrew.app (2026-09-19):** Gemini with Google Search grounding, 4 buyer-intent queries ("best AI receptionist for HVAC…", "AI answering service… texts back missed calls", "free website built by AI…", "AI front office… missed call text back") → webcrew.app NOT mentioned/cited; competitors named instead (My AI Front Desk, NextPhone, Allo, Upfirst…); sources were third-party listicles. Brand-name query does find webcrew.app (Gemini grounded + Claude web search). Could not test the other ~8 LLMs: no OpenAI/xAI/Perplexity keys (Perplexity MCP key invalid), Ahrefs MCP "Insufficient plan". WebCrew has no GBP/Maps listing (online business) — Maps isn't the channel; third-party comparison pages/directories are.
  - **Automation reality check (2026-09-19, DB counts):** `missed_calls` 2 rows ever; `reception_follow_ups` 0; `reception_opportunities` 0; `reception_contacts` 1; 4 of 5 reception lines active; retention (`scheduler.ts` pg-boss: monthly reviews/analytics/gbp/competitor on the 1st) applies to paying clients only = 0; GBP API still unapproved. Built ≠ exercised: nothing has run on a real paying client. Follow-up drain runs via Mac launchd (needs the Mac awake) — Cloud Scheduler API not enabled on `webcrew-501006`.
  - **Voice is Vertex-only** (product decision). `gemini-live.ts` `buildChain` returns Vertex only — the AI Studio candidate/key-cap code is gone; `AI_STUDIO_BACKEND_WEBSITE_URLS` removed from Cloud Run; WebCrew's own line and the widget now run on `gemini-live-2.5-flash-native-audio` too (checked with real audio: pricing tool fires, 0 malformed). **No newer Live model exists on this Vertex project**: re-probed 6 model names × 10 regions — only that one, in 7 regions. Gemini 3.x conversational Live is not published on Vertex at all (catalog listing checked) — nothing to request; re-check the catalog (`GET /v1beta1/publishers/google/models` in us-central1) periodically. Demo configs that share WebCrew's calendar are now listed in `DEMO_WEBSITE_URLS` (default `https://webcrew.app/hvac-test`).
  - **Internal copies of alerts/summaries** went to a hardcoded `ranjeetsinghai79@gmail.com`; now `OWNER_NOTIFY_EMAIL` (set on Cloud Run to `pavan.harati@gmail.com`; code default too). Every client alert/call summary still cc's this address.
  - **Forwarded-call caller ID:** if a carrier presents the business's own number as caller ID (some VoIP forwards do), the relay treats the caller as unknown so it never texts/CRMs/matches appointments to the business itself.
  - **Client dashboard** (`admin/src/app/client/dashboard`, `components/client-setup-card.tsx`, `client-pipeline.tsx`, `api/client/{opportunity,settings}`): new "Your AI Front Office" card (AI number + copy, carrier forwarding instructions, calendar status, editable live-transfer number stored in `reception_configs.brain_json.owner_phone`, alert destinations), upcoming appointments, and a leads pipeline with one-click Called back / Won / Lost (client-cookie auth, scoped to their own config). Recent Calls now shows the post-call summary, intent/urgency/outcome chips and a recording link. Fixed: a snippet bug that could render "undefined…", 5-second calls and vendor calls both being counted as "spam" (now by classification), a stale Vapi block, AI-only clients seeing "Site is being built" / "Site performance" / the legacy "Launch" plan, leftover indigo colors. Verified in a browser with a temporary seeded client (deleted afterward): clicks persist to the DB, AI number rejected as transfer target, unauthenticated calls → 401.
  - **Owner wants calls on their business number:** they forward it to the AI number — conditional "no answer" forwarding is recommended (owner still answers when free); transfers must go to their cell, never the forwarded line (loop). Codes are on the dashboard. Porting the business number into Twilio is the alternative if they want WebCrew to own it (not built).
  - **One-click Google Calendar (no API keys for the client).** Dashboard → "Connect Google Calendar" → Google sign-in (`admin/src/app/api/client/google/{start,callback,disconnect}`, `lib/google-oauth.ts`; signed 10-min state bound to the signed-in client, minimal scope `calendar.events`+`openid email`, `access_type=offline`). Refresh token stored AES-256-GCM encrypted (`CALENDAR_TOKEN_KEY`, admin `lib/token-crypto.ts` ↔ pipeline `reception/token-crypto.ts`, interop tested both ways) in `reception_configs.google_refresh_token_enc`; migration v41. The reception server books natively on their primary calendar (`reception/google-calendar.ts`, behind a provider-neutral `CalendarPort` in `cal-booking.ts` — Cal.com still works via `calPort`): availability from owner-set hours minus existing events (DST-safe local-time math, tested), re-checks for a clash right before writing, sends the customer a Google invite, tags events `webcrew=1` and only lists/edits its own, reschedules keep the visit length. Owner edits appointment length / bookable days+hours on the dashboard (`/api/client/calendar-settings`; defaults 1 hr, Mon–Fri 8–5). Revoked token → AI falls back to messages and emails the owner a reconnect link. **Dormant until `GOOGLE_CALENDAR_ENABLED=true`** — needs the Google console steps in `docs/google-calendar-setup.md` (consent screen published to Production, redirect URI, client ID/secret on both admin and Cloud Run). Until Google verifies the app, clients see "unverified app" (Advanced → Continue) and there is a 100-user cap; "Testing" status expires tokens every 7 days — don't use it. Calendar API enabled on `webcrew-501006`; `calendar-token-key` in Secret Manager mounted on Cloud Run (rev `00057-4j9`), same key set on admin (`b3259492`).
  - **Google Calendar switched ON (2026-09-18, admin `4373c709`, Cloud Run rev `00058-6g6`).** OAuth Web client lives in `webcrew-501006` (redirect URI `https://admin.webcrew.app/api/client/google/callback`); admin secrets `GOOGLE_CALENDAR_CLIENT_ID/SECRET/ENABLED=true` (Cloudflare Pages), Cloud Run `GOOGLE_CALENDAR_CLIENT_ID` env + `google-calendar-client-secret` in Secret Manager; also in gitignored `admin/.env.local`. **Never paste secrets into tracked files** (the client secret was pasted into `.gitignore`; caught before commit and moved). Not yet exercised with a real Google sign-in.
  - **Test client** (`leads` id `7274becd…`, email `pavan.harati@gmail.com`, `source='test'`) on the reactivated line **+19342482253** (config `b1d47991…`, "Pavan Test HVAC", live-transfer number = the owner's own cell). Log in at `admin.webcrew.app/client/login` with that email. Delete/deactivate before onboarding real clients if it clutters reports; the Twilio `StatusCallback` biz name was updated to match.
  - **Client dashboard is now a left-nav portal with password login (2026-09-19; admin `c7145897`, Cloud Run `00059-zcb`, migration v42).** Pages under `admin/src/app/client/(portal)/`: Overview, Leads, Calls, Appointments, Receptionist setup, Website (only if the client has a site), Billing, Help & requests, Account. Sign-in is **email + password** — the login page no longer offers or sends magic links. Passwords: PBKDF2-SHA256/100k (Workers' max) in `lib/password.ts`; min 10 chars + common/self-referential checks. Session cookie `email|version.hmac`, 180 days, **renewed on every visit** (middleware), and the `version` is checked against `client_accounts.session_version` on every page/API (`requireClient()` in `lib/client-auth.ts`) — so changing a password or "Sign out of all devices" instantly revokes every other session. 5 wrong passwords lock the account 15 min; responses never reveal whether an email has an account. Only **paying** leads (`paid` or `handed_off`) can have a login — not the ~600 scraped prospects. **Recovery:** "Forgot your password or email?" → by email, or by business phone (link goes to the email already on file, never displayed); reset tokens are single-use, stored hashed, 1 h, max 3 per 15 min. **Welcome email is now a 7-day "Create my password" link** (`createResetToken(..,'welcome',7d)`), replacing the 15-minute magic link that was dead by the time most people opened it. The post-checkout `/thank-you` auto-login still uses a one-time magic token (`/client/auth/[token]`), then forces `/client/welcome` until a password exists. 33-check end-to-end test run against a live server (lockout, single-use tokens, revocation, first-password flow) — `_authtest` was throwaway, not committed. Twilio numbers: bought only on **live**-mode Stripe payments (incl. trial starts — confirmed OK by owner); test-mode checkouts create the config but skip the purchase.
  - **Who the callers in the admin Calls page are** (checked 2026-09-19): 124 calls / 85 numbers to WebCrew's own demo line (+19182555151) since 2026-06-25 — the owner's own phones (+14156060079, +14695500069), website-widget visitors (no caller ID; incl. "test" and real HVAC-owner questions), the line's own number (11 early outbound/self calls), and **a recurring spoofed-caller pattern (re-measured 2026-09-19, supersedes the earlier "one burst ~20 numbers" note): 85 calls from 81 different +1918 numbers on 7 days (Aug 5,6,7,10,17,18,19, ~9–13/day, then stopped), 62 of them ending at the 36–52 s idle-timeout, one transcript shows the caller saying "please press one to verify…"** (neighbour-spoofing — the line is 918). Total burn ≈ 59 min ≈ under $2, so cost is trivial; the real damage is polluted metrics. Only 1 non-918, non-owner caller has ever phoned the demo line, so **confirmed real inbound phone prospects ≈ 0–1**. No defence built yet; plan: log Twilio `StirVerstat`, DTMF "press 1" gate on the demo line only (never on client lines), hang up after ~10 s with zero caller speech, per-number + daily-minute caps, `call_logs.trust` label. The Leads page's ~600 rows are scraped businesses (`source='pipeline'`), not callers. Stored transcripts were word-fragmented; stitched at display time (`tidyTranscript`) and at write time (`mergeTranscript`).
- **Call screening + trust labels (2026-09-19, Cloud Run `ai-reception-00060-crx`, rollback `00059-zcb`, migration v43).** `reception/call-screen.ts` (+ `call-screen.test.ts`). Applies ONLY to WebCrew's own lines (`!isClientConfig || isDemoConfig`) — **client lines are never gated or capped**. On an inbound call from a non-owner number, `POST /voice/:id` first returns a `<Gather>` "press 1 to talk to our AI receptionist" (no digit → goodbye, no Gemini stream, no cost), then on `?gate=1&Digits=1` opens the stream. Also per-number cap (`OWN_LINE_PER_NUMBER_DAILY_CAP`, default 4/24h) and a line-wide daily voice budget (`OWN_LINE_DAILY_SECONDS_CAP`, default 90 min) → polite decline. Kill switch: `CALL_GATE_ENABLED=false`. Owner phones (`OWNER_PHONES`, default `+14156060079,+14695500069`) skip everything. Twilio `StirVerstat` is now read and stored (`call_logs.stir_verstat`; passed to the relay as stream param `stir`, gate result as `gate`). `twilio-relay.ts` hangs up immediately when the live transcript matches a recorded-message/IVR pattern (`looksLikeRobocall`, fragment-tolerant — live transcription is word-split like "Pre ss one"). Every call gets `call_logs.trust` = owner|self|widget|human|suspected_bot|no_speech|unknown, computed in `insertCallLog` (`classifyTrust`); widget sessions pass `channel:'widget'`. **The robocall is a Google-listing scam script** ("Clients are currently having trouble finding you. Press one to speak with an agent immediately and verify your Google listing."), so scammers are dialing our Google-listed number. Backfill (`src/scripts/backfill-call-trust.ts [--apply]`, applied to 125 rows): 74 suspected_bot, 24 widget, 11 self, 11 no_speech, 4 owner, **1 human** — i.e. the demo line has had ~1 genuine phone prospect ever. Verified locally (gate/press-1/wrong digit/owner bypass/outbound bypass/both caps/kill switch) and the live `/voice/` returns the Gather; **not yet verified with a real call from a non-owner phone** (owner phones bypass the gate). **Admin UI for it (2026-09-19, admin `2e75bb10`):** `/prospects` (`admin/src/app/prospects/page.tsx`, `getProspectFunnel()` in `admin/src/lib/db.ts`) — read-only funnel from Neon (test leads + skipped excluded; stages derived from the `leads.status` lifecycle rank, so it is NOT a cohort funnel; "Engaged" includes inbound web inquiries; rates greyed as "small n" under 30 in the prior stage), weekly new leads/real calls/widget/bot calls, call-trust breakdown, source table, warm signals. Reception Calls (`/reception-leads`) now shows a trust chip per row and a filter that hides suspected_bot/self/owner by default (125 → 36). **Funnel numbers as of 2026-09-19:** 443 prospects → 207 built → 113 contacted → 2 engaged (both web inquiries) → 0 paying; opens/replies live in Resend/Twilio and are not tracked here. Privacy policy Google-data section is pushed and live (webcrew `1509690`, deploy workflow success).
- **Google Calendar connect bug fixed (2026-09-19, admin `1918ad9b`).** After the "unverified app" screen the client landed on `calendar=error&code=calendar_api_403_PERMISSION_DENIED`: `api/client/google/callback/route.ts` read the calendar's timezone via `GET /calendars/primary`, which Google does NOT allow with the `calendar.events` scope (checked against the Calendar discovery doc — only `calendars.get` in our path was wrong; every `events.*` call in `reception/google-calendar.ts` is allowed; `freebusy.query` and `calendarList.get` are NOT allowed with this scope, don't add them). Now uses `GET /calendars/primary/events?maxResults=1&fields=timeZone`. Not re-tested with a real Google sign-in yet. **Admin deploy note:** `wrangler login` had expired ("Failed to fetch auth token: 400"); deployed with `CLOUDFLARE_API_TOKEN=$CLOUDFLARE_TOKEN` (from `pipeline/.env`) via `npx wrangler pages deploy .vercel/output/static --project-name=webcrew-admin` after `npm run deploy`'s build step.
- **"Google hasn't verified this app" — verification prep.** `webcrew/src/app/privacy/page.tsx` had no Google user-data disclosure (Google rejects verification without one). Added a "Google Calendar and Google User Data" section incl. the Limited Use statement (local edit in the `webcrew/` repo, **not yet pushed**; needs the owner to review the legal wording, then `git -C webcrew push deploy main`). Remaining steps are console-only: Search Console domain ownership for webcrew.app, homepage links to the privacy policy, a short screen recording of the connect flow + scope justification, then submit in Google Auth Platform → Verification Center (`calendar.events` = sensitive scope: no paid security assessment; days–weeks). Until approved: Advanced → Continue works, 100-user cap.
- **Not done / needs a human before client #1's first real call:** (1) finish the Google console setup in `docs/google-calendar-setup.md` so the client can self-connect (Cal.com via `set-reception-calendar.ts` still works as a fallback; without either, message-only); (2) confirm the transfer number — escalation dials `brain.owner_phone`, else the lead's phone, and refuses the AI number itself (a forwarded business line would loop); (3) one real phone call to the client's number after forwarding is set — the deployed path is verified with simulated Twilio streams, not a real carrier call; (4) A2P: confirm the client's provisioned number is on the Messaging Service (`ensureTwilioNumberMessagingReady` runs at provision) or their confirmation/reminder SMS will be rejected; (5) the client dashboard doesn't show the new CRM/classification yet (data is in `reception_*` and `call_logs.intent/urgency/route`).

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

**Found 2026-09-19 — stuck test build looped ~615× (every ~15 min) since 2026-09-13**: a `build_requests` row ("Albertsons"/HVAC/Mountain House, Places text search matched a Safeway) kept re-running `auto-build-from-sms.ts`, whose `PlaceScraper` (Playwright) opens the matched Google Maps place URL each pass — that's the recurring Safeway maps-link open. No "Error building" ever logged, so `auto-build-from-sms.ts`'s retry→error cap never fired; the row sat in `building` (Cloudflare deploy polling "pending — waiting") and got re-queued. Deleted the test row (+ killed the run). Exact re-queue trigger not pinned down; if a test build ever loops again, check `select * from build_requests where status in ('pending','retrying','building')` first. Leftovers not cleaned: `leads` row `2ae1bff5-…` (Safeway), CF Pages project `site-safeway`, GitHub repo `ranjeetsinghai79/site-safeway`, and `sms_conversations` stage `building` for +14156060079.

**Sitemaps (2026-09-19)**: webcrew.app's sitemap is submitted in GSC (submitted 2026-09-04, Success, 15 pages) — no resubmit needed when it changes. `webcrew/src/app/sitemap.ts` now derives per-route `lastModified` from `git log` at build (`deploy.yml` checks out `fetch-depth: 0` for that; falls back to build date) and includes `/affiliate`. Client-site `sitemap.xml`/`robots.txt` in `pipeline/src/agents/seo-agent.ts` are now deterministic (were Gemini-written and listed `/contact`+`/services`, which 404 on single-page templates): sitemap = `/` only, base URL = `custom_domain` → `cloudflare_url` → `vercel_url`, and both files are skipped (not guessed) if none is set. Not handled: a client's sitemap keeps the `*.pages.dev` URL after a custom domain is attached later. Changes not yet committed/deployed as of this note.

Auto-heals only what's safely recoverable: an unloaded launchd job gets re-bootstrapped from its plist; a build stuck >20min in 'building' gets reset to 'retrying' so the poller retries once (bounded by the poller's own existing error cap on a second failure). Deliberately does NOT auto-fix: a launchd job with a nonzero last exit code (found live: `scrape-fast` exit 1 — flagged, not touched, needs a manual look since blindly restarting a job that's actively failing could mask a real problem), or missing migrations (flagged with the exact command to run, never auto-applied blind — a migration could be destructive or order-dependent).

### Weekly SEO/AEO/GEO check for webcrew.app (own site only, started 2026-09-27)

`pipeline/src/scripts/seo-weekly-check.ts` — `com.webcrew.seo-weekly-check` launchd job, Monday 8am (matches the "Weekly Report every Monday" already promised in `webcrew/public/llms.txt`), emails a report (Resend, same recipient as health-check) and records every run to `seo_weekly_checks` (migration-v44) for week-over-week deltas. Manual run: `cd pipeline && npx tsx src/scripts/seo-weekly-check.ts`. Added to health-check.ts's `EXPECTED_JOBS` so it's self-monitored like every other job.

**This is monitoring/reporting only — it never edits or deploys the live site unattended.** Findings are read-only recommendations in the email; an actual fix always happens in a real session with a human present, same as any other change to a public site. This is deliberate, not a limitation — an unattended weekly job silently changing live marketing copy/schema is exactly the kind of unsupervised action to avoid.

**Why local, not a cloud routine**: this needs the local-only `GOOGLE_SERVICE_ACCOUNT_FILE` service-account key (`pipeline/.env`, same one `health-check.ts`'s `checkGscHealth()` already reads) and, for OpenSEO-based checks in future, the local Docker instance — neither is reachable from a cloud-sandboxed routine without copying the private key into the routine's config, which wasn't worth the tradeoff for this. Real first-party GSC data is also just better than a DataForSEO/Ahrefs estimate for a site you already own.

**First real run (2026-09-27) found**: indexing is healthy (`/`, `/hvac`, `/roofing`, `/ai-receptionist`, `/contractors` all "Submitted and indexed," crawl allowed, fetch successful — the sitemap report's stale "0 indexed" figure was misleading, confirmed via direct URL Inspection API instead of trusting it) and on-page work is solid (`llms.txt` comprehensive with AI crawlers explicitly allowed, `/roofing` has 1,966 words + FAQPage/Service/Organization schema + well-targeted title/meta). But total impressions are tiny (72 over the trailing 28 days across all 16 tracked queries) and the exact money keywords — "[trade] ai receptionist" / "ai receptionist for [trade]" — rank worst (position 40–90). Root cause is very unlikely to be on-page: the `Organization` schema in `webcrew/src/app/layout.tsx` has **zero `sameAs` links**, and there is no LinkedIn, Crunchbase, Product Hunt, or any external profile anywhere in the codebase — zero citation footprint for Google or LLM grounding to trust. Matches the earlier 2026-09-19 AI-visibility finding (webcrew.app not cited by grounded Gemini search on buyer-intent queries; competitors named instead). **The real lever is external citations/backlinks, not more on-page content** — a prioritized directory list was proposed to the owner (SaaS/AI-tool directories: Product Hunt, Crunchbase, G2/Capterra, AlternativeTo, SaaSHub, theresanaiforthat.com, etc.) but creating those public-facing accounts needs the owner's go-ahead before any get created, since they're new public brand presence, not a code change.

## Sheet Leads Dashboard — LOCAL ONLY (built 2026-09-18)

`http://localhost:3010/sheet-leads` (admin dev server) — browse the Google Sheet's ~180k leads, see how old each is, and check whether each lead's website is actually live. **User explicitly said: do not push to cloud.**
- **Why it exists**: the existing `/leads` page reads Neon `leads` (pipeline leads only, `LIMIT 500`), never the sheet. Sheet Leads is separate; `/leads` untouched.
- **Data flow**: Sheet (`1wwZX7eriuA0i37t6_VOetkmHcS7YKiHXI2DYj7gfa9A`, read-only scope, service account `../pipeline/service-account.json`) → "Sync from sheet" button → local SQLite `admin/.local-data/sheet-leads.db` (gitignored, built-in `node:sqlite`, no deps). Validation results live ONLY in that DB — nothing is written back to the sheet or Neon. Full sync ≈ 20s. Tabs synced = any whose header starts `Date Added`,`Business Name` (skips Status/Website Inbound Leads/Survey Responses/Cold Email Queue). **`Yelp_Dataset` tab is ~82k of the 180k rows** — filter it out via the Tab dropdown when working scraped leads.
- **Kept out of the cloud build**: files are `page.local.tsx` / `route.local.ts`; `admin/next.config.mjs` adds those extensions to `pageExtensions` only in `PHASE_DEVELOPMENT_SERVER`, so `next build` / `npm run deploy` never sees them (they use node:sqlite + fs, which would break the edge/Pages build). Sidebar link is `NODE_ENV==="development"` only. Config-level check done (production phase omits `local.*`); a full `next build` was NOT run (would clobber the running dev `.next`). Any new local-only route must follow the same `.local.` naming.
- **Row parsing gotcha**: sheet rows are NOT column-stable — many omit Address so cols after J shift left. `src/lib/local/parse.ts` trusts only A–J and matches the rest by value shape (maps URL, `tierN`, emails, YES/NO). Dates come as both `2026-06-18` and `6/9/2026`; both parse. Lead identity key = maps URL or `name|city|phone`, per tab.
- **Validation** (`src/lib/local/validate.ts`, free HTTP GET, 10s timeout, 12 concurrent, background job polled by UI): statuses `live`, `live_blocked` (401/403/429 bot wall — site exists), `ssl_error`, `parked` (domain-broker text/host, e.g. dropcatch), `dead` (DNS fail/404/410), `down` (5xx), `timeout`, `social` (facebook/instagram/yelp etc. — profile, not a site), `no_website`. Buttons: per-row Check, Validate selected, Validate filtered/all (confirm prompt >500). **Limit: leads with no URL in the sheet are just marked `no_website` — confirming a tier-1 lead has since *gained* a site needs Google Places (paid), skipped per the $0 rule.**
- Files: `admin/src/lib/local/{db,sheets,parse,sync,query,validate}.ts`, `admin/src/app/api/local/sheet-leads/{,sync/,validate/}route.local.ts`, `admin/src/app/sheet-leads/page.local.tsx`, `admin/src/components/sheet-leads-table.tsx`.
- Run: `npm run dev:admin` → log in (`ADMIN_PASSWORD` in `admin/.env.local`) → Sheet Leads → Sync. Not committed yet.

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

Pipeline uses **Gemini 2.5 Flash** (`@google/generative-ai`) — not Claude. Free tier: 1,500 req/day for brand extraction, 500 req/day for config generation. Key: `GOOGLE_AI_API_KEY`.

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
- FAQPage for AEO: answers ChatGPT/Perplexity/Claude queries about WebCrew pricing, speed, niches

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

## Active Claude Skills (invoke before web design work)

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

51 Claude Code skills for GTM/marketing work — `product-marketing`, `competitor-profiling`, `customer-research`, `content-strategy`, `copywriting`, `copy-editing`, `ai-seo`, `social`, `video`, `ad-creative`, `marketing-plan`, `marketing-loops`, `pricing`, `offers`, and more (full list: `.claude/skills/`, or `npx skills add coreyhaines31/marketingskills --list`).

- **Local-only, not in git** — `.claude/` is gitignored (line 27). Reinstall on any machine/clone: `npx skills add coreyhaines31/marketingskills -a claude-code`
- **Audited before install** (2026-09-04) — clean repo, no malicious code, MIT-licensed, real author (Corey Haines), sponsor disclosure is transparent and non-biasing. Safe.
- **The Notion "GTM Command Center" guide that pointed here does NOT match this repo** — don't follow it literally. Concrete mismatches found: guide's brand-memory file is `memory.md` → real convention is `.agents/product-marketing.md` (written by the `product-marketing` skill). Guide's `brand-voice-builder` and `humanizer` skills → don't exist in this repo at all. Guide describes install via claude.ai web "Projects" → this pack is actually built for Claude Code/agent CLIs (`.claude/skills/`), not web Projects (which don't read GitHub skill repos). Notion access for real use would route through Composio (separate OAuth broker), not a direct "Notion MCP" as implied.
- **WebCrew's own use**: real fit — no inbound content engine exists today (GTM is SMS-outreach-first). Blocker: webcrew.app has no CMS (static Next.js export via GH Actions) — the `Sanity` integration this pack expects for blog publishing needs that decision made first.
- **Client-facing use (website + maintenance + marketing tier)**: WebCrew-operates-it-for-the-client only, never client-self-serve — matches the existing hands-off AI Front Office model (same shape as `gbp-agent`/`reviews-agent` already running per-client automatically, see Pipeline Architecture above). Do NOT hand clients a Claude Project/Code setup to run themselves.
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

## OpenSEO — self-hosted SEO tool (set up 2026-09-19, local only)

Open-source Semrush/Ahrefs alternative (`every-app/open-seo`, MIT, v0.1.9): keyword research, rank tracking (organic + Google Maps grid), competitor/backlink data, site audits, AI visibility, GSC/GA4 integration, MCP server + 10 agent skills. **Standalone repo, not in this monorepo:** `/Users/pavanharati/Documents/open-seo` (shallow clone; `git pull` to update).
- **Run:** `cd /Users/pavanharati/Documents/open-seo && docker compose up -d` → UI `http://localhost:3001`, health `/api/health`, MCP `http://localhost:3001/mcp`. Published GHCR image; first boot builds inside the container (~2 min). Data lives in Docker volume `open-seo_open_seo_data` (SQLite/D1).
- **Needs colima started** (`colima start`) — and **colima VM is now 4 GiB** (was 2 GiB default; the in-container `tsc` build was OOM-killed at 2 GiB → exit 137 restart loop). Host has 8 GiB.
- **Config:** `open-seo/.env` — `OPENSEO_TELEMETRY_DISABLED=1`, `PORT=3001`. **`DATAFORSEO_API_KEY` NOT SET YET** → UI/MCP boot fine but every data tool is unavailable. Key = base64 of `login:password` (`printf '%s' 'LOGIN:PASSWORD' | base64`, NOT the dashboard API key) from app.dataforseo.com/api-access. Pay-as-you-go, $1 free credit, **$50 minimum top-up**. Never paste it into tracked files. After adding: `docker compose up -d --force-recreate open-seo`.
- **Claude Code hookup:** MCP server `openseo` registered at *local* scope (per-user, not committed; `claude mcp list`). 10 skills copied to `.claude/skills/openseo-*` (gitignored, local-only like the marketing skills): keyword-research, keyword-clustering, competitor-analysis, competitive-landscape, seo-audit, local-seo, link-prospecting, seo-coach, seo-project-setup, seo-report. Reinstall: copy from `open-seo/plugins/openseo/skills/`.
- **Auth caveat:** Docker mode = `AUTH_MODE=local_noauth` (no login, single `admin@localhost`, bound to 127.0.0.1). Fine for us; **NOT safe to expose or share with clients as-is.** Client-facing/multi-user needs Cloudflare deploy (`docs/SELF_HOSTING_CLOUDFLARE.md`, Cloudflare Access) or `AUTH_MODE=hosted` (Better Auth + orgs).
- **Not wired into the pipeline/admin/client portal.** Product definition (top of file) parks SEO/AEO/GEO agents until the four pillars have paying clients — this is tooling for us, not a shipped client feature. Per-client use = one OpenSEO *project* per client domain (`create_project`), seeded from the client's site + GBP; report via `openseo-seo-report`.
- Not done: DataForSEO account, first project (webcrew.app), GSC connect (needs Google OAuth client + `BETTER_AUTH_SECRET`, see `docs/SELF_HOSTING_GOOGLE_SEARCH_CONSOLE.md`), `OPENROUTER_API_KEY` (in-app agent "SAM", optional — Claude Code via MCP covers it).
- **DECISION 2026-09-19 — use HOSTED OpenSEO ($10/mo), not self-host + DataForSEO.** Reason: cost. OpenSEO has no data of its own; every data feature is DataForSEO. Self-host = $50 minimum DataForSEO top-up upfront; hosted = $10/mo with **$10 of usage credits included** (so the sub is effectively prepaid usage), free trial $0.50 credits, GSC data free and doesn't consume credits, hosted markup is 28% only on usage beyond that. Typical costs: keyword search ~$0.05, backlink check ~$0.08, ChatGPT brand check ~$1.09 (avoid). **Spend rule: $0 until there's a concrete use (webcrew.app keyword plan); subscribe only then; SEO isn't in the four-pillar product, so no client-facing spend until a paying client wants it.**
- **REVERTED 2026-09-27 — back to LOCAL Docker, not hosted.** Hosted MCP (`https://app.openseo.so/mcp`) needs an interactive OAuth flow this non-interactive session couldn't run; user chose local instead of waiting on that. `claude mcp` config switched back: `openseo` → `http://localhost:3001/mcp` (was the hosted URL). Container was actually down (`docker compose stop` from 2026-09-19) and its image blob had been corrupted by a **host Mac disk-full incident** (see below) — restarted clean, confirmed healthy (`{"status":"ok", ..., "dataforseo":{"status":"warn","detail":"Not set"}}`). `DATAFORSEO_API_KEY` still not set, so MCP/UI work but every data tool (keyword research, SERP, backlinks, etc.) stays unavailable until that key is added — same as before, unaffected by this revert. Switch back to hosted anytime: `claude mcp remove openseo && claude mcp add --transport http openseo https://app.openseo.so/mcp`, then authorize via `/mcp` in an interactive session.
- **Host disk-full incident, found + fixed 2026-09-27**: colima/OpenSEO container was failing with `overlayfs`/containerd I/O errors on start. Root cause was NOT the container — the **Mac's own disk was at 97% (7.5GB free of 228GB)**, and colima's VM disk file (`~/.colima`, lives on that same host disk) hit `no space left on device` mid-write, corrupting the container's overlay layer. Fixed: `colima restart` (clean VM boot) + deleted `admin/Yelp/` (8.7GB — the raw Yelp Academic Dataset downloaded 2026-07-11, git-ignored, already consumed by `backfill-yelp-reviews.ts`/`import-yelp-remaining.ts` months ago, re-downloadable if ever needed again) + `admin/.next` (713MB regenerable build cache). **Odd finding, not fully explained**: `diskutil apfs list`'s "Capacity Not Allocated" barely moved after deleting ~9.4GB (verified the files were actually gone via `du`/`ls`, and confirmed `rm`+`df` accounting works correctly in general via a controlled 1GB dd test) — no local Time Machine snapshots, no duplicate/cloned copies of the Yelp files found elsewhere on disk, nothing else observed growing at the same time. Left uninvestigated further since the practical goal (get colima working again) was achieved — `docker compose up -d` succeeded right after. **If colima/Docker breaks again with I/O errors, check `df -h /System/Volumes/Data` first** — this Mac runs close to full (was 7.5GB free even after the cleanup) and will likely recur. `network-hvac-site/` (765MB, mostly its own `node_modules`, separate untracked Next.js+Drizzle+Cloudflare-Workers mini-project, own nested `.git`, last touched 2026-09-18) was noticed during this cleanup but deliberately left alone — not part of any current task, unclear if it's still wanted.
