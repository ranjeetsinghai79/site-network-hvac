# Phase 2 Platform Operations

## Status

Phase 2 is implemented for private-beta operation. WebCrew can create partner agencies, invite role-scoped members, onboard client businesses from one website URL, install playbooks and agents, run durable automations, collect approvals, report outcomes, meter cost, and govern private catalog submissions.

Public anonymous sign-up, unrestricted marketplace publication, and automated partner payouts are deliberately not enabled.

## Operator Surfaces

- `/platform`: platform overview and catalog inventory
- `/platform/control`: onboarding, clients, runs, outcomes, team, economics, catalog, and security
- `/agency/login`: invite-only agency sign-in
- `/agency/dashboard`: tenant-scoped private-beta portal

## Runtime

The durable worker is installed as `com.webcrew.platform-worker` on the current macOS operator machine.

Useful commands:

```bash
launchctl print gui/$(id -u)/com.webcrew.platform-worker
tail -f ~/.webcrew-jobs/logs/platform-worker-error.log
cd pipeline && npm run platform:smoke
```

For hosted production, run `npm run platform:worker` as an always-on process with one or more replicas. Claims use row locks, leases, retries, and idempotency keys.

## Roles

| Role | Intended Access |
| --- | --- |
| Owner | Agency settings, members, approvals, clients, catalog submissions |
| Operator | Client onboarding and day-to-day operation |
| Specialist | Assigned delivery and catalog submissions |
| Approver | Approval queue and reporting |
| Client | Read-focused client access |

Every private-beta API validates the signed session, active membership, role, agency scope, and workspace ownership server-side.

## Safety Rules

- Paid media, social publishing, SMS, phone automation, production video generation, and material site changes retain explicit approval gates.
- URL onboarding blocks localhost, private IP ranges, credentials in URLs, and non-HTTP protocols.
- OAuth state records carry agency/workspace ownership.
- Integration tokens remain encrypted at rest and are stored per workspace; publishers do not fall back to another workspace's credentials.
- Usage caps stop new automation runs when monthly cost reaches the configured cap.
- Security-sensitive actions append to `security_audit_log`.
- Catalog submissions require review before becoming installable.

## Verification

```bash
npm run growth:migrate
cd pipeline && npx tsc --noEmit && npm run platform:smoke
cd ../admin && npx tsc --noEmit && npm run build
cd .. && npm run launch:check
```
