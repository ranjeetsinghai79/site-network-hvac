export const runtime = "edge"
export const dynamic = "force-dynamic"

import { getProspectFunnel } from "@/lib/db"

const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }
const h2: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12, letterSpacing: "-0.01em" }
const th: React.CSSProperties = { textAlign: "left", padding: "6px 10px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }
const td: React.CSSProperties = { padding: "6px 10px", fontSize: 12.5, color: "var(--text-2)", borderTop: "1px solid var(--border)" }

const TRUST_COLOR: Record<string, string> = {
  human: "var(--success)", widget: "var(--accent-light)", suspected_bot: "var(--error)",
  no_speech: "var(--muted)", self: "var(--muted)", owner: "var(--muted)", unknown: "var(--warning)", unlabeled: "var(--muted)",
}
const TRUST_NOTE: Record<string, string> = {
  human: "spoke a real sentence", widget: "website chat sessions (some are tests)", suspected_bot: "recorded scam / IVR script",
  no_speech: "hung up or never spoke", self: "our own line calling itself", owner: "your own phones", unknown: "too short to tell",
}

// Below this many people in the denominator a % is noise, so it's greyed and flagged instead of presented as a rate.
const MIN_SAMPLE = 30

export default async function ProspectsPage() {
  const f = await getProspectFunnel()
  const top = Math.max(1, f.stages[0]?.n ?? 1)
  const realCalls = f.callTrust.find(c => c.trust === "human")?.n ?? 0
  const botCalls = f.callTrust.find(c => c.trust === "suspected_bot")?.n ?? 0
  const paid = f.stages.find(s => s.key === "paid")?.n ?? 0
  const contacted = f.stages.find(s => s.key === "contacted")?.n ?? 0
  const engaged = f.stages.find(s => s.key === "engaged")?.n ?? 0

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1040 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)", marginBottom: 4 }}>Prospects → Customers</h1>
      <p style={{ color: "var(--text-2)", fontSize: 13, marginBottom: 22 }}>
        Measured from the database. Test leads are excluded. Email opens/replies live in Resend and Twilio and are <strong>not</strong> tracked here.
        “Engaged” also counts inbound web inquiries, so Contacted → Engaged is <strong>not</strong> a true reply rate to outreach.
      </p>

      {/* Headline */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Paying customers", value: paid, color: paid ? "var(--success)" : "var(--warning)" },
          { label: "Contacted", value: contacted, color: "var(--accent-light)" },
          { label: "Engaged", value: engaged, color: "var(--accent-light)" },
          { label: "Real phone callers", value: realCalls, color: "var(--success)" },
          { label: "Scam robocalls blocked/labelled", value: botCalls, color: "var(--error)" },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: "12px 18px", minWidth: 120 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1, letterSpacing: "-0.04em" }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Funnel */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={h2}>Funnel (each row = reached at least this stage)</div>
        {f.stages.map((s, i) => {
          const prev = i === 0 ? null : f.stages[i - 1].n
          const rate = prev && prev > 0 ? Math.round((s.n / prev) * 1000) / 10 : null
          const trusted = prev !== null && prev >= MIN_SAMPLE
          return (
            <div key={s.key} style={{ display: "grid", gridTemplateColumns: "230px 1fr 130px", gap: 12, alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>{s.label}</div>
              <div style={{ background: "var(--surface-2)", borderRadius: 6, height: 22, overflow: "hidden" }}>
                <div style={{ width: `${Math.max(s.n ? 1.5 : 0, (s.n / top) * 100)}%`, height: "100%", background: "linear-gradient(90deg,#00C26F,#0EA5E9)" }} />
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 700 }}>
                {s.n}
                {rate !== null && (
                  <span style={{ marginLeft: 8, fontWeight: 500, color: trusted ? "var(--text-2)" : "var(--muted)" }}>
                    {rate}% {!trusted && <span title={`Only ${prev} in the previous stage — too few to trust as a rate`}>· small n</span>}
                  </span>
                )}
              </div>
            </div>
          )
        })}
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>
          {f.skipped} more prospects were skipped as a poor fit. Rates under {MIN_SAMPLE} people in the prior stage are greyed as “small n”: don't optimise off them.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Weekly */}
        <div style={card}>
          <div style={h2}>New per week (last 8 weeks)</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Week</th><th style={th}>Leads</th><th style={th}>Real calls</th><th style={th}>Widget</th><th style={th}>Bot calls</th></tr></thead>
            <tbody>
              {f.weekly.map(w => (
                <tr key={w.week}>
                  <td style={td}>{w.week}</td><td style={td}>{w.leads}</td><td style={td}>{w.humanCalls}</td><td style={td}>{w.widget}</td>
                  <td style={{ ...td, color: w.botCalls ? "var(--error)" : "var(--muted)" }}>{w.botCalls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Call quality */}
        <div style={card}>
          <div style={h2}>Who is actually calling (all-time)</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {f.callTrust.map(c => (
                <tr key={c.trust}>
                  <td style={{ ...td, color: TRUST_COLOR[c.trust] ?? "var(--text-2)", fontWeight: 700 }}>{c.trust}</td>
                  <td style={{ ...td, color: "var(--text)", fontWeight: 700 }}>{c.n}</td>
                  <td style={{ ...td, fontSize: 11.5 }}>{TRUST_NOTE[c.trust] ?? ""}</td>
                </tr>
              ))}
              {f.callTrust.length === 0 && <tr><td style={td}>No calls yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Sources */}
        <div style={card}>
          <div style={h2}>Where prospects come from</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Source</th><th style={th}>Leads</th><th style={th}>Paid</th></tr></thead>
            <tbody>
              {f.bySource.map(s => (
                <tr key={s.source}><td style={td}>{s.source}</td><td style={td}>{s.n}</td><td style={{ ...td, color: s.paid ? "var(--success)" : "var(--muted)" }}>{s.paid}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Warm */}
        <div style={card}>
          <div style={h2}>Warm signals</div>
          <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.9 }}>
            SMS opt-ins: <strong style={{ color: "var(--text)" }}>{f.warm.smsConsents}</strong> ({f.warm.smsRevoked} revoked)<br />
            Website form submissions (includes tests): <strong style={{ color: "var(--text)" }}>{f.warm.formSubmissions}</strong><br />
            SMS conversations: {f.warm.conversations.length ? f.warm.conversations.map(c => `${c.stage} ${c.n}`).join(" · ") : "none"}<br />
            Demo-site requests: {f.warm.buildRequests.length ? f.warm.buildRequests.map(b => `${b.status} ${b.n}`).join(" · ") : "none"}
          </div>
        </div>
      </div>
    </div>
  )
}
