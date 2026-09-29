# Social Content Stack

## Launch Position

The product should sell this as an AI Business Manager content engine:

- crawls the business website and public profiles
- creates a brand/business memory
- drafts image posts and carousels
- adapts captions per channel
- queues everything for approval
- publishes only through connected official APIs or manual handoff
- reports what was created, approved, published, and improved

At launch, keep video as phase two. Image posts and carousels are enough for fast local-business value.

## Top Local Platforms

Priority order for local SMBs:

1. Google Business Profile
2. Facebook Page
3. Instagram
4. Threads
5. LinkedIn
6. TikTok photo posts
7. Pinterest
8. X
9. YouTube
10. Nextdoor

`pipeline/src/social/platforms.ts` stores the current platform registry, publish mode, supported asset types, and notes.

## Publishing Rules

- Default status is `needs_approval`.
- No autonomous publishing without customer approval.
- No health/legal/financial outcome claims without review.
- No cold SMS for content distribution.
- Platforms with limited APIs should generate drafts and handoff packages first.

## Repo Recommendations

Use now:

- `googleads/google-ads-mcp`: Google Ads research/reporting assistant, not the main production publisher.
- `RamsesAguirre777/facebook-ads-library-mcp`: competitor ad intelligence for Meta, useful for swipe-file research.
- `AgriciDaniel/claude-seo`: borrow SEO/AEO/GEO workflow ideas and checklist structure.
- `D4Vinci/Scrapling`: evaluate as a crawler upgrade where Firecrawl/Playwright misses dynamic pages.
- `microsoft/markitdown`: ingest PDFs, menus, brochures, docs, and proposals into business memory.
- `heygen-com/hyperframes`: phase-two video rendering and social motion templates.

Do not use for launch:

- jailbreak / unsafe agent repos
- AGPL tools unless we intentionally accept license obligations
- video-heavy stacks before the image/carousel engine is producing value
- broad AI gateway/tooling repos as core production dependencies

## Next Implementation Steps

1. Add official publisher adapters in priority order: GBP, Facebook, Instagram, Threads, LinkedIn, Pinterest, TikTok.
2. Store external post IDs and per-platform errors on `social_assets`.
3. Add content calendar UI grouped by business, platform, date, and approval status.
4. Add weekly content packs: 5 posts, 2 carousels, 1 offer, 1 review prompt, 1 local FAQ.
5. Add performance reporting: impressions, clicks, calls, booking clicks, replies, and follower/reach trend.

## Phase Two Video

Default video direction:

- Use RunPod Serverless for custom/open-source generation workers where cost control, model choice, and batch rendering matter.
- Use Google Veo / Vertex AI when managed quality, reliability, safety review, and Google ecosystem integration matter more.
- Use Hyperframes for deterministic HTML-to-video templates, captions, explainers, and branded motion clips.

Video stays phase two. The launch offer should still win with website, audit, AI receptionist, CRM/follow-up, reviews, SEO/AEO/GEO, paid ads, and image/carousel content.
