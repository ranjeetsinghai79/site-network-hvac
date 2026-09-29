# Phase 2 Agency Platform Roadmap

## Status

**Completed for private beta on July 14, 2026.** All Phase 2 workstreams below are implemented and approval-safe. Public anonymous signup, automated marketplace payouts, and unrestricted catalog publication are intentionally reserved for a later public-platform phase.

## Objective

Turn the Phase 1 operator-led delivery system into a repeatable multi-client agency platform that can support 10-100 managed clients and later become self-serve SaaS.

Phase 2 does not mean launching a public marketplace immediately. The platform must first prove repeatable onboarding, delivery, measurement, permissions, and billing with real agency clients.

## Product Boundary

Phase 2 owns:

- agency and workspace tenancy
- reusable agent definitions and niche playbooks
- per-client agent installation and configuration
- durable execution history, retries, and observability
- role-based operator/client access
- standardized onboarding and integration checks
- outcome reporting, usage metering, and unit economics
- an eventual partner/developer layer after internal proof

The approval gates from Phase 1 remain mandatory for ad spend, publishing, outreach, phone actions, material website changes, and regulated claims.

## Execution Plan

| ID | Workstream | Depends On | Acceptance Criteria | Risk | Done Artifact | Status |
| --- | --- | --- | --- | --- | --- | --- |
| P2.1 | Agency platform foundation | Phase 1 | Agency tenancy, agent catalog, playbook installs, and execution runs exist without changing Phase 1 behavior | Medium | Migration v21 and Platform admin view | Implemented |
| P2.2 | Workspace onboarding | P2.1 | Operator can create a client from one URL, review extracted business DNA, select a playbook, and see integration blockers | Medium | Guided onboarding flow | Implemented |
| P2.3 | Durable automation runner | P2.1 | Runs are idempotent, retryable, observable, scoped to a workspace, and stop at approval gates | High | Supervised database execution worker | Implemented |
| P2.4 | Roles and permissions | P2.1 | Owner, operator, specialist, approver, and client roles are enforced server-side | High | Signed sessions, scoped APIs, and role gates | Implemented |
| P2.5 | Outcome reporting | P2.2, P2.3 | Every client report connects activity to calls, leads, bookings, pipeline, and attributable revenue where data exists | Medium | Outcome ledger and 30-day reports | Implemented |
| P2.6 | Metering and billing | P2.3, P2.5 | Usage and pass-through costs are recorded per workspace; margins and limits are visible | High | Metering ledger, cost attribution, caps, and economics view | Implemented |
| P2.7 | Self-serve pilot | P2.2-P2.6 | Invited agencies can onboard clients without database or code access while all risky actions stay gated | High | Invite-only agency portal | Implemented |
| P2.8 | Partner catalog | P2.7 | Versioned agents/playbooks can be submitted, reviewed, installed, metered, and disabled | High | Governed private catalog beta | Implemented |

## P2.1 Data Model

The first milestone introduces:

- `agency_accounts` and `agency_members`
- agency ownership and lifecycle fields on `growth_workspaces`
- `agent_definitions`
- `playbook_templates`
- `workspace_agent_installations`
- `workspace_playbook_installations`
- `automation_runs`

Existing workspaces are assigned to the default WebCrew agency. Core Phase 1 agents are seeded into the catalog. No external action is automatically enabled by this migration.

## Approval and Escalation Policy

- Low-risk analysis and draft generation may run automatically.
- Medium-risk changes require an operator review when confidence or source quality is low.
- High-risk external actions always require an explicit authorized approval event.
- A failed run may retry only when its operation is idempotent.
- Repeated failures, credential errors, policy warnings, and spend-limit conflicts escalate to a human operator.

## Definition of Phase 2 Done

Phase 2 is complete when an invited agency can onboard and operate clients through the product without engineering assistance, costs and outcomes are measurable per client, roles are enforced, automation runs are durable, and high-risk actions cannot bypass approval.

Phase 2 is complete for private-beta operation. The public marketplace, automated partner payouts, and anonymous public sign-up are a later phase and still require evidence from 10-100 successfully managed clients.
