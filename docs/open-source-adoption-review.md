# Open Source Adoption Review

Review date: July 14, 2026

## Decision Rule

Do not add open-source projects because they are popular. Add them only when they improve one of these Phase 1/2 outcomes:

- agency delivery speed
- lead/data quality
- content/ad/video production
- analytics/reporting
- booking/reception
- compliance/approval safety
- self-hosted cost control

Avoid projects that introduce unclear licensing, account-bypass behavior, jailbreak patterns, or major operational burden before the agency workflow is repeatable.

## Use Now

These are aligned with Phase 1 delivery or immediate operational quality.

| Repo | Use | Decision |
| --- | --- | --- |
| `firecrawl/firecrawl` | Crawling, search, extraction | Keep using. Already core to business DNA/audit flow. AGPL means do not embed/fork casually; use API/self-host intentionally. |
| `ChromeDevTools/chrome-devtools-mcp` | Browser QA, performance, visual checks | Use for admin/landing/client-site QA. Good fit for launch validation. |
| `remotion-dev/remotion` | Deterministic programmatic video | Use for template videos, reports, explainers, outreach clips. Better than generative video for predictable branded output. |
| `calcom/cal.diy` | Booking/scheduling infrastructure | Use/integrate for booking flows if our current Calendly/booking handoff becomes limiting. |
| `PostHog/posthog` | Product analytics, session replay, feature flags | Use for our platform/admin/client portal analytics. More product-heavy than Plausible. |
| `plausible/analytics` | Lightweight privacy-first web analytics | Use for client websites where simple, privacy-friendly analytics are enough. |
| `Billionmail/BillionMail` | Self-hosted newsletters/email marketing | Evaluate for owned email marketing after deliverability requirements are clear. Keep Resend for transactional email. |
| `AgriciDaniel/claude-ads` | Paid media operating playbooks | Borrow scoring/checklist ideas. Do not make it a runtime dependency yet. |
| `zubair-trabzada/ai-marketing-claude` | Marketing skill library | Borrow campaign/calendar/report workflow ideas. Do not install blindly. |
| `coreyhaines31/marketingskills` | Marketing playbooks | Borrow patterns for content and offer generation. |
| `goabstract/Marketing-for-Engineers` | Marketing education | Use as reference for positioning, onboarding, and sales writing. |

## Evaluate Later

Useful, but not needed before first 10-100 clients.

| Repo | Potential Use | Reason to Wait |
| --- | --- | --- |
| `ComposioHQ/composio` | Tool/auth layer for many integrations | Useful for future agency platform. For now, direct official APIs keep control and reduce dependency risk. |
| `langchain-ai/langgraph` | Durable multi-agent workflows | Good for complex orchestration later. Current workflow is simpler and already implemented. |
| `openai/openai-agents-python` | Python agent runtime | Strong option if we introduce Python services. Current stack is TS/Next/pipeline-first. |
| `microsoft/agent-framework` | Enterprise agent orchestration | Evaluate for platform phase, not Phase 1 agency delivery. |
| `langchain-ai/deepagents` | Deeper agent patterns | Research only until platform SDK becomes necessary. |
| `agentscope-ai/agentscope` | Multi-agent framework | Research only. |
| `FoundationAgents/MetaGPT` | Multi-agent software-company pattern | Too broad for current local-business automation. |
| `microsoft/ai-agents-for-beginners` | Training/reference | Good education, not product dependency. |
| `ComfyUI` on RunPod | Image/video workflow backend | Use for self-hosted image/video generation when we want custom nodes/workflows. Best as a RunPod worker behind our `/video` queue. |
| `SkyworkAI/SkyReels-V2` | Open-source video model | Evaluate on RunPod for phase-two video generation. Need GPU/cost/quality testing. |
| `NVlabs/LongLive` | Long video infrastructure | Later only; our local SMB videos are short ads/reels/hero loops. |
| `Tongyi-MAI/Z-Image` | Image generation | Evaluate against current image providers if cost/quality improves. |
| `higgsfield-ai/cli` | Premium generated visuals/videos | Useful as provider option, but not a self-hosted core. |
| `jordanrendric/claude-video-vision` | Video analysis | Later for analyzing client videos/calls/social clips. |
| `QwenLM/Qwen3-TTS` | Self-hosted TTS | Strong candidate for RunPod voice once we need owned voice generation. Supports multilingual, voice design, streaming, and voice clone. |
| `resemble-ai/chatterbox` | Open-source TTS | Evaluate quality/latency against Qwen3-TTS and VibeVoice. |
| `microsoft/VibeVoice` | Open-source voice AI | Evaluate for voice content and receptionist voice generation. |
| `OpenBMB/VoxCPM` | Voice model | Evaluate later; not a launch dependency. |
| `SesameAILabs/csm` | Conversational speech model | Research only until licensing/deployment fit is clear. |
| `tinyhumansai/openhuman` | Digital human/avatar | Later, if clients want avatar/video spokespersons. Not core. |
| `n8n-mcp` / `n8n-skills` | Workflow automation templates | Later as agency-platform extension. Do not make n8n the core workflow engine. |
| `odoo/odoo` | CRM/ERP | Integrate/sync later. Do not embed Odoo as core CRM now; it is too heavy for our first agency workflow. |
| `apache/superset` | BI dashboards | Later if PostHog/Plausible/internal reports are insufficient. |
| `ScrapeGraphAI/Scrapegraph-ai` | AI scraping | Evaluate where Firecrawl/Playwright miss dynamic or semantic extraction. |
| `Graphify-Labs/graphify`, `codegraph` | Codebase graph/context | Useful for engineering productivity, not product runtime. |
| `thedotmack/claude-mem`, `claude-mem` style tools | Agent memory | We already have business memory. Evaluate only for developer workflow. |
| `anthropics/skills`, `openai/skills`, `tech-leads-club/agent-skills` | Skill catalogs | Borrow structure for future agent catalog/marketplace. |
| `21st-dev/magic-mcp`, `ui-ux-pro-max-skill`, `impeccable`, `taste-skill`, `huashu-design` | UI/design assistance | Use selectively for design inspiration, not as runtime dependencies. |

## Avoid For Production

Avoid as dependencies or customer-facing infrastructure unless a future security/legal review changes the decision.

| Repo | Reason |
| --- | --- |
| `Alishahryar1/free-claude-code` | Account/cost-bypass positioning. Not appropriate for production or client systems. |
| `smol-ai/GodMode` | Old general AI chat browser; not useful for our architecture. |
| `Gitlawb/openclaude` | Unclear fit and potential compatibility/legal risk. |
| `openclaw/openclaw`, `zeroclaw-labs/zeroclaw`, `NVIDIA/NemoClaw` | Agent-shell alternatives. Not needed and can distract from product delivery. |
| `Anil-matcha/Awesome-GPT-5.6-API-and-Prompts` | Prompt list, not infrastructure. Treat as reading material only. |
| `Anil-matcha/Open-Generative-AI` | Broad resource list; not a product dependency. |
| `karpathy/nanoGPT`, `karpathy/nanochat`, `lyogavin/airllm` | Model training/inference education; not needed for local-business agency delivery. |
| `karpathy/autoresearch` | Research automation, not core. |
| `karpathy/nanoGPT` / `nanochat` | Useful education, not our product path. |
| `free-*`, jailbreak, bypass, or unofficial provider wrappers | Avoid. We need reliable, compliant client delivery. |

## Voice Recommendation

For Phase 1, keep voice/reception on managed telephony and existing AI voice paths.

For self-hosted voice on RunPod:

1. Test `QwenLM/Qwen3-TTS` first.
2. Benchmark `resemble-ai/chatterbox` and `microsoft/VibeVoice`.
3. Only add voice cloning with explicit written client consent and clear rights to the source voice.

Do not run client production calls on experimental self-hosted voice until latency, quality, failover, and consent are proven.

## Video Recommendation

Use both deterministic and generative video:

- Remotion: production-safe templates, explainers, reports, outreach videos.
- RunPod + ComfyUI: self-hosted custom image/video workflows.
- RunPod + SkyReels/Z-Image/other models: test for short ads/reels.
- GCP/Veo/Higgsfield: premium managed fallback.

Default sequence:

1. Render deterministic video from script/templates.
2. Use generated clips as assets inside the deterministic template.
3. Keep provider output approval-gated before publishing.

## CRM Recommendation

Do not adopt Odoo as the core CRM now.

Use our internal lightweight CRM/event model for Phase 1. Add Odoo sync later for clients or agencies that already use Odoo.

## Analytics Recommendation

Use:

- Plausible for client websites.
- PostHog for our product/admin/client portal.

Avoid Superset until we need heavy BI dashboards.

## Platform Recommendation

For the future agency platform, the most relevant external foundations are:

- Composio for third-party app auth/actions.
- LangGraph or OpenAI Agents Python for durable agent orchestration if our internal workflow engine becomes insufficient.
- skill catalogs from Anthropic/OpenAI/community repos for future agent manifests.
- n8n integrations for optional agency workflow extensions.

Do not expose a public marketplace until the agency workflow is proven with real clients.
