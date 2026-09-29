# WebCrew communications control plane

One public Twilio number, `+1 (918) 255-5151`, is the identity for every customer conversation. Direction and channel select the workflow; phone number alone never does.

## Workflow routing

| Channel | Direction | Workflow |
|---|---|---|
| Voice | Inbound | Answer immediately, identify the problem, qualify, capture contact details, offer the relevant WebCrew solution, and book or create a follow-up task. |
| Voice | Outbound | Continue an opted-in or otherwise permitted outreach conversation, handle objections, invite the prospect to test the public AI number, and offer an appointment. |
| SMS | Inbound | Load the lead and recent conversation, honor STOP/HELP first, answer questions and objections, and progress toward a call test or appointment. |
| SMS | Outbound | Send only under the applicable consent/use-case rules, persist every turn, process delivery callbacks, and let Twilio queue above sender throughput. |
| Voice | Overflow/recovery | Apologize, ask why the caller called, resolve what can be resolved, capture the lead and offer an appointment. Never recursively launch another recovery call. |

## Concurrency target

- Cloudflare Worker HTTP/SMS and turn-based voice webhooks are stateless and horizontally scalable.
- Native voice Cloud Run target: 15 instances x 8 concurrent WebSockets = 120 active calls.
- Two warm instances reduce cold-start risk. WebSocket timeout is 60 minutes.
- Call metadata travels in Twilio webhook/custom parameters; correctness does not depend on two requests reaching the same instance.
- Provider quotas remain hard gates: Twilio outbound voice CPS, Twilio/A2P messaging MPS, and Gemini Live concurrent-session quota must each be approved for the required peak.

## Reliability rules

1. A webhook acknowledges quickly; slow follow-up work runs asynchronously.
2. Call SID and Message SID are idempotency keys.
3. Outbound and recovery status callbacks are tagged by `flow`; recovery cannot recursively trigger itself.
4. If native audio is unavailable, Twilio uses the turn-based voice workflow rather than dropping the call.
5. If speech is empty, ask once more and provide a clear callback path.
6. SMS recovery requires active SMS consent. A returned voice call is tracked independently from SMS consent.
7. Booking, call, message and consent events are persisted against the same normalized phone identity.

## Capacity acceptance test

Before claiming 100 concurrent calls in production:

1. Approve Twilio and Gemini quotas for at least 120 concurrent sessions and the desired outbound CPS/MPS.
2. Run staged tests at 10, 25, 50, 100 and 120 simultaneous calls.
3. Require at least 99% webhook success, zero lost Call SIDs, p95 first-response latency under five seconds, and successful overflow handling.
4. Confirm database pool usage, memory, Gemini session count, Twilio queue delay and booking writes at each stage.
5. Enable alerts before increasing the public traffic limit.
