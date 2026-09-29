export const runtime = 'edge'
import { notFound } from "next/navigation"
import { Pool } from "@neondatabase/serverless"

export const dynamic = "force-dynamic"

async function getAudit(id: string) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const { rows } = await pool.query("SELECT * FROM audits WHERE id = $1", [id])
    if (!rows[0]) return null
    // Mark as viewed
    await pool.query(
      "UPDATE audits SET report_viewed=TRUE, report_viewed_at=NOW() WHERE id=$1 AND NOT report_viewed",
      [id]
    )
    return rows[0]
  } finally {
    await pool.end()
  }
}

function ScoreCircle({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444"
  const dash = 2 * Math.PI * 40        // circumference
  const offset = dash * (1 - score / 100)
  return (
    <div style={{ textAlign: "center" }}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="40" fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={dash} strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
          fill={color} fontSize="20" fontWeight="900">
          {score}
        </text>
      </svg>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{label}</div>
    </div>
  )
}

export default async function AuditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const audit = await getAudit(id)
  if (!audit) notFound()

  const overall = audit.overall_score ?? 0
  const overallColor = overall >= 80 ? "#10b981" : overall >= 50 ? "#f59e0b" : "#ef4444"
  const overallLabel = overall >= 80 ? "Good" : overall >= 50 ? "Needs Work" : "Critical"

  const recs: Array<{ title: string; description: string; priority: string; impact: string }> =
    audit.recommendations ?? []
  const competitors: Array<{ name: string; rating: number; review_count: number }> =
    audit.competitors ?? []
  const seoIssues: string[] = audit.seo_issues ?? []
  const siteIssues: string[] = audit.site_issues ?? []

  const CALENDLY_URL = process.env.CALENDLY_URL || "https://cal.com/ranjeet-singh-iw1omu/15min"
  const priorityColor = { high: "#ef4444", medium: "#f59e0b", low: "#10b981" } as Record<string, string>

  return (
    <div style={{ minHeight: "100vh", background: "#060612", fontFamily: "'Inter', system-ui, sans-serif", color: "#fff" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0f0c29 0%,#1a1a2e 50%,#16213e 100%)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "32px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 8 }}>
            Free AI Growth Audit
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "-0.5px" }}>
            {audit.business_name}
          </h1>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginTop: 6 }}>
            {audit.website_url} · {new Date(audit.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>

        {/* Overall score */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "32px", marginBottom: 20, textAlign: "center" }}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 12 }}>
            Overall Growth Score
          </div>
          <div style={{ fontSize: 88, fontWeight: 900, color: overallColor, lineHeight: 1 }}>
            {overall}
          </div>
          <div style={{ fontSize: 18, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>/ 100 — {overallLabel}</div>
          <p style={{ margin: "16px auto 0", maxWidth: 480, fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
            {overall < 50
              ? "Critical issues found. These are actively costing you bookings right now."
              : overall < 80
              ? "Several improvements needed. Fixing these could significantly increase your client flow."
              : "Good foundation — a few optimizations will push you to the top."}
          </p>
        </div>

        {/* Score breakdown circles */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "28px 32px", marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 20 }}>
            Score Breakdown
          </div>
          <div style={{ display: "flex", justifyContent: "space-around", gap: 16, flexWrap: "wrap" }}>
            <ScoreCircle score={audit.website_score ?? 0}    label="Website Speed" />
            <ScoreCircle score={audit.seo_score ?? 0}        label="SEO" />
            <ScoreCircle score={audit.reputation_score ?? 0} label="Reputation" />
            <ScoreCircle score={audit.phone_score ?? 0}      label="Phone CTA" />
            <ScoreCircle score={audit.booking_score ?? 0}    label="Booking" />
          </div>
        </div>

        {/* Signals grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Phone Number Visible",  ok: audit.phone_found,        good: "Visitors can call you easily",              bad: "No phone CTA — visitors can't reach you" },
            { label: "Online Booking Link",   ok: audit.has_booking_link,   good: `Booking at ${audit.booking_url ?? "your site"}`, bad: "No booking link — clients can't self-schedule" },
            { label: "Schema Markup (SEO)",   ok: audit.has_schema,         good: "Google can read your business info",         bad: "No schema — hurts local search ranking" },
            { label: "Reviews on Site",       ok: audit.has_reviews_on_site, good: "Social proof visible to visitors",           bad: "No testimonials — visitors leave without trust" },
          ].map(({ label, ok, good, bad }) => (
            <div key={label} style={{
              background: ok ? "rgba(16,185,129,0.05)" : "rgba(239,68,68,0.05)",
              border: `1px solid ${ok ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
              borderRadius: 12, padding: "16px 18px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>{ok ? "✅" : "❌"}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: ok ? "#10b981" : "#ef4444" }}>{label}</span>
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{ok ? good : bad}</div>
            </div>
          ))}
        </div>

        {/* Recommendations */}
        {recs.length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "28px 32px", marginBottom: 20 }}>
            <div style={{ fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 20 }}>
              AI Recommendations ({recs.length} found)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {recs.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 14, padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,0.15)", minWidth: 24 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{r.title}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
                        color: priorityColor[r.priority] ?? "#fff",
                        background: `${priorityColor[r.priority] ?? "#fff"}22`,
                        border: `1px solid ${priorityColor[r.priority] ?? "#fff"}44`,
                        borderRadius: 4, padding: "2px 6px",
                      }}>
                        {r.priority}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: 6 }}>{r.description}</div>
                    <div style={{ fontSize: 12, color: "#7c3aed", fontWeight: 600 }}>📈 {r.impact}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Competitors */}
        {competitors.length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "28px 32px", marginBottom: 20 }}>
            <div style={{ fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 16 }}>
              Top Competitors in {audit.city ?? "your area"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {competitors.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.2)", minWidth: 16 }}>#{i + 1}</div>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 13, color: "#f59e0b" }}>⭐ {c.rating}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{c.review_count} reviews</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Issues found */}
        {(seoIssues.length > 0 || siteIssues.length > 0) && (
          <div style={{ background: "rgba(239,68,68,0.03)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 16, padding: "24px 28px", marginBottom: 20 }}>
            <div style={{ fontSize: 11, letterSpacing: 3, color: "rgba(239,68,68,0.6)", textTransform: "uppercase", marginBottom: 14 }}>
              Issues Found
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...siteIssues, ...seoIssues].filter(Boolean).map((issue, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                  <span style={{ color: "#ef4444", marginTop: 1 }}>•</span>
                  {issue}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.15),rgba(91,33,182,0.08))", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 16, padding: "32px", textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
            Want us to fix all of this?
          </div>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, maxWidth: 440, margin: "0 auto 24px" }}>
            We handle everything — AI website, AI phone reception (24/7), review management, and monthly growth reports.
            Starting at <strong style={{ color: "#fff" }}>$97/mo</strong>. No setup fee for the first 100 clients.
          </p>
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noreferrer"
            style={{
              display:        "inline-block",
              background:     "linear-gradient(135deg,#7c3aed,#5b21b6)",
              color:          "#fff",
              textDecoration: "none",
              padding:        "16px 40px",
              borderRadius:   12,
              fontWeight:     700,
              fontSize:       16,
              letterSpacing:  "-0.2px",
            }}
          >
            Book a Free 15-Min Call →
          </a>
          <div style={{ marginTop: 16, fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
            No contracts. Cancel anytime. First 100 clients get $0 setup fee.
          </div>
        </div>

      </div>
    </div>
  )
}
