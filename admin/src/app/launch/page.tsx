export const runtime = 'edge'
import { ShieldCheck, AlertTriangle, CheckCircle2, ClipboardCheck } from "lucide-react"

export const dynamic = "force-dynamic"

const items = [
  {
    area: "Database",
    status: process.env.DATABASE_URL ? "ready" : "blocked",
    requirement: "DATABASE_URL set and migrations through v22 applied.",
  },
  {
    area: "Platform",
    status: process.env.DATABASE_URL && process.env.SESSION_SECRET ? "ready" : "blocked",
    requirement: "Tenant control plane, signed agency sessions, durable worker, audit logs, metering, and private catalog configured.",
  },
  {
    area: "AI",
    status: process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_AI_STUDIO_API_KEY ? "ready" : "blocked",
    requirement: "Google AI key set for audits, plans, content, and reception.",
  },
  {
    area: "Email",
    status: process.env.RESEND_API_KEY ? "ready" : "blocked",
    requirement: "Resend API key and verified sender domain configured.",
  },
  {
    area: "SMS",
    status: process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER ? "manual" : "blocked",
    requirement: "Twilio configured, express consent stored, STOP opt-out respected. Cold automated SMS stays blocked.",
  },
  {
    area: "Reception",
    status: process.env.RECEPTION_SERVER_URL || process.env.RECEPTION_BASE_URL || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_STUDIO_API_KEY ? "manual" : "blocked",
    requirement: "Reception server deployed, call disclosure reviewed, booking handoff tested.",
  },
  {
    area: "Ads",
    status: process.env.GOOGLE_ADS_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID ? "manual" : "blocked",
    requirement: "Google/Meta OAuth, ad account IDs, conversion tracking, approval UI, and spend caps tested before live spend.",
  },
  {
    area: "Claims",
    status: "manual",
    requirement: "Use AI Front Office / AI Business Manager positioning. Do not publish absolute guaranteed-leads claims without contract terms, exclusions, and substantiation.",
  },
  {
    area: "Compliance",
    status: process.env.PUBLIC_PRIVACY_URL && process.env.PUBLIC_TERMS_URL ? "manual" : "blocked",
    requirement: "TCPA/SMS consent, call recording consent, health/legal ad review, privacy/terms reviewed.",
  },
]

export default function LaunchPage() {
  const blocked = items.filter((item) => item.status === "blocked").length
  const manual = items.filter((item) => item.status === "manual").length
  const ready = items.filter((item) => item.status === "ready").length

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1100 }}>
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)" }}>
          Launch Readiness
        </h1>
        <p style={{ color: "var(--text-2)", fontSize: 13, marginTop: 4 }}>
          Production blockers, manual review items, and compliance gates for AI Business Manager launch.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        <Card icon={<CheckCircle2 size={16} />} label="Ready" value={ready} color="var(--success)" />
        <Card icon={<ClipboardCheck size={16} />} label="Manual Review" value={manual} color="var(--warning)" />
        <Card icon={<AlertTriangle size={16} />} label="Blocked" value={blocked} color="var(--error)" />
      </div>

      <section style={panel}>
        <div style={panelHeader}>Launch Gates</div>
        {items.map((item, i) => {
          const color = item.status === "ready" ? "var(--success)" : item.status === "manual" ? "var(--warning)" : "var(--error)"
          return (
            <div key={item.area} style={{ display: "grid", gridTemplateColumns: "180px 120px 1fr", gap: 16, padding: "16px 18px", borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>{item.area}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color, textTransform: "uppercase" }}>{item.status}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 }}>{item.requirement}</div>
            </div>
          )
        })}
      </section>

      <section style={{ ...panel, marginTop: 18, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
          <ShieldCheck size={16} color="var(--accent-light)" />
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Launch Rule</div>
        </div>
        <p style={{ color: "var(--text-2)", fontSize: 13, lineHeight: 1.65 }}>
          Public launch is allowed only after every blocked item is resolved. Manual items can launch for concierge pilots,
          but ads, social publishing, outbound SMS, and phone automation must remain approval-gated. SMS is opt-in only;
          paid campaigns launch paused first and go live only after client budget approval.
        </p>
      </section>
    </div>
  )
}

function Card({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div style={{ ...panel, padding: "16px 18px" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", color, marginBottom: 9 }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 850, color: "var(--text)", letterSpacing: "-0.04em" }}>{value}</div>
    </div>
  )
}

const panel: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  overflow: "hidden",
}

const panelHeader: React.CSSProperties = {
  padding: "13px 18px",
  borderBottom: "1px solid var(--border)",
  fontSize: 11,
  fontWeight: 800,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
}
