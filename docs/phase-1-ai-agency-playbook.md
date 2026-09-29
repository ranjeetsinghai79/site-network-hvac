# Phase 1 AI Agency Playbook

## Status

**Locked on July 14, 2026.** Phase 1 is complete as an operator-led AI agency delivery system.

The system is ready for controlled client onboarding and delivery. External account connections, regulated claims, paid media spend, outbound messaging, social publishing, and production voice/video actions remain approval-gated by design. Those gates are part of the product, not unfinished Phase 1 work.

Phase 2 is tracked in `docs/phase-2-agency-platform-roadmap.md`.

## Positioning

Sell this as an AI agency delivery system, not as self-serve SaaS yet.

Primary offer:

> We install and run an AI Business Manager that audits, fixes, automates, follows up, creates content, prepares campaigns, and reports growth for local businesses.

Do not lead with "platform", "SaaS", or "guaranteed leads" in client-facing copy.

## Best First Niches

Start with one niche at a time:

1. HVAC
2. Medspa
3. Dental
4. Roofing
5. Plumbing

HVAC is the best first wedge for lost-call recovery, urgent demand, and measurable booking value.

## Client Workflow

1. Add or scrape business lead.
2. Crawl website and public business data.
3. Run audit.
4. Generate Growth Plan.
5. Build/fix website if needed.
6. Create AI Business Manager workspace.
7. Generate approval queues:
   - social drafts
   - ad drafts
   - video drafts
   - CRM/follow-up actions
8. Connect client-approved integrations.
9. Launch approved work.
10. Send weekly client report.

## Required Gates

Approval is required before:

- ad spend
- social publishing
- SMS follow-up
- phone/reception automation
- video generation with paid providers
- regulated health/legal/financial claims
- public results claims

SMS must be opt-in/consent-based. Cold automated SMS is not part of the launch playbook.

## Daily Operator Checklist

1. Check `/manager` for pending approvals.
2. Check `/social` for social content.
3. Check `/ads` for paid campaign drafts.
4. Check `/video` for video drafts/handoffs.
5. Check `/outreach` for active conversations.
6. Check launch jobs:
   - `com.webcrew.scrape-fast`
   - `com.webcrew.sms-followup`
   - `com.webcrew.sms-outreach`
7. Review any failed publish/render errors.

## Validation Commands

Run before client delivery batches:

```bash
npm run launch:check
cd pipeline && npx tsc --noEmit
cd ../admin && npm run build
cd ../pipeline && npm run video:check
```

Healthy launch status means:

- zero blocked launch items
- database, AI, and email ready
- manual gates understood
- no dirty worktree before deployment

## Current Phase 1 Readiness

Ready:

- lead scraping
- audits
- Growth Plan generation
- business memory
- admin dashboard
- client workspaces
- social queue
- ads queue
- video queue
- approval gates
- consent events
- usage limits
- CRM/event tables
- email/SMS/billing environment

Manual/client-specific:

- AI reception testing
- ad account connection
- budget/spend approval
- SMS consent confirmation
- regulated claims review
- video provider endpoint selection

## Client Pitch

Use:

> We set up and run your AI Business Manager: website, audit, AI front office, lead follow-up, reviews, content, paid campaign prep, and weekly growth reporting.

Avoid:

> We guarantee leads.

Better:

> We build the system that helps you capture, respond to, and convert more of the demand you already have.

## Agency Platform Groundwork

Build internally as a platform from day one:

- client workspaces
- agent catalog
- approval events
- integration state
- usage tracking
- content/ad/video queues
- reporting

Do not publicly launch a marketplace until delivery is repeatable across 10-100 clients.
