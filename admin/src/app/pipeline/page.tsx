export const runtime = 'edge'
import { RunPipeline } from "@/components/run-pipeline"
import { ScrapeLeads } from "@/components/scrape-leads"
import { AuditWidget } from "@/components/audit-widget"

export default function PipelinePage() {
  return (
    <div style={{ padding: "32px 36px", maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize:      22,
            fontWeight:    800,
            letterSpacing: "-0.03em",
            color:         "var(--text)",
          }}
        >
          Pipeline
        </h1>
        <p style={{ color: "var(--text-2)", fontSize: 13, marginTop: 4 }}>
          AI Agency — audit → build → deploy → outreach. Beauty & wellness focus.
        </p>
      </div>

      {/* Step 0: Quick Audit (lead magnet) */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
          Step 0 — Free AI Growth Audit (paste URL → send to prospect)
        </div>
        <AuditWidget />
      </div>

      {/* Step 1: Scrape leads */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, marginTop: 28 }}>
          Step 1 — Find Beauty &amp; Wellness Leads
        </div>
        <ScrapeLeads />
      </div>

      {/* Step 2: Build + Deploy */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, marginTop: 28 }}>
          Step 2 — Build + Deploy Site
        </div>
        <RunPipeline />
      </div>

      {/* How it works */}
      <div
        style={{
          marginTop:    28,
          background:   "var(--surface)",
          border:       "1px solid var(--border)",
          borderRadius: 12,
          padding:      "20px 24px",
        }}
      >
        <div
          style={{
            fontSize:      11,
            fontWeight:    700,
            color:         "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom:  16,
          }}
        >
          What happens when you run
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div
                style={{
                  width:          22,
                  height:         22,
                  borderRadius:   "50%",
                  background:     "var(--accent-dim)",
                  border:         "1px solid var(--accent-dim-2)",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  fontSize:       10,
                  fontWeight:     700,
                  color:          "var(--accent-light)",
                  flexShrink:     0,
                  marginTop:      1,
                }}
              >
                {i + 1}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                  {s.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  {s.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const STEPS = [
  { name: "Lead Hunter",     desc: "Google Places API finds businesses without good websites in your target location" },
  { name: "Site Scorer",     desc: "PageSpeed API scores each site — skips anything scoring 60+ on mobile" },
  { name: "Brand Analyst",   desc: "Firecrawl scrapes the business site; Gemini extracts colors, fonts, tone" },
  { name: "Config Generator", desc: "Gemini writes a complete TypeScript config for the matching template" },
  { name: "Image Generator", desc: "fal.ai Flux Pro generates 4 cinematic hero images from brand prompts" },
  { name: "Video Generator", desc: "Kling 1.6 Pro creates a 5s scroll-scrubbed background video" },
  { name: "Builder",         desc: "Forks the template repo on GitHub and pushes the generated config + assets" },
  { name: "Deployer",        desc: "Creates a Cloudflare Pages project and deploys — live in ~60 seconds" },
  { name: "Outreach",        desc: "Sends a personalized email + SMS to the business owner with their demo link" },
]
