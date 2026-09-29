export const runtime = 'edge'
import { getSurveyResponses } from "@/lib/db"

export const dynamic = "force-dynamic"

const BUDGET_COLOR: Record<string, string> = {
  "Not right now":              "var(--muted)",
  "$49–99/mo":                  "var(--warning)",
  "$100–199/mo":                "#6366f1",
  "$200+/mo or one-time":       "var(--success)",
}

export default async function SurveysPage() {
  const rows = await getSurveyResponses()

  const byNiche   = rows.reduce<Record<string, number>>((acc, r) => { if (r.niche) acc[r.niche] = (acc[r.niche] ?? 0) + 1; return acc }, {})
  const byAI      = rows.reduce<Record<string, number>>((acc, r) => { if (r.ai_want) acc[r.ai_want] = (acc[r.ai_want] ?? 0) + 1; return acc }, {})
  const noWebsite = rows.filter(r => r.has_website?.includes("don't")).length
  const wantMore  = rows.filter(r => r.budget && r.budget !== "Not right now").length
  const topNiche  = Object.entries(byNiche).sort((a, b) => b[1] - a[1])[0]
  const topAI     = Object.entries(byAI).sort((a, b) => b[1] - a[1])[0]

  const cell = { padding: "12px 14px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-2)", verticalAlign: "top" as const }
  const statCard = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 20px" }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0 }}>Survey Responses</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
          From <a href="https://webcrew.app/survey" target="_blank" style={{ color: "var(--accent-light)" }}>webcrew.app/survey</a>
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Total responses",    val: rows.length },
          { label: "No website",         val: noWebsite },
          { label: "Open to paying",     val: wantMore },
          { label: "Top niche",          val: topNiche ? `${topNiche[0]} (${topNiche[1]})` : "—" },
        ].map(s => (
          <div key={s.label} style={statCard}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)" }}>{s.val}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Top AI request */}
      {topAI && (
        <div style={{ ...statCard, marginBottom: 24, borderColor: "rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.05)" }}>
          <div style={{ fontSize: 12, color: "var(--accent-light)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
            Most-wanted AI feature ({topAI[1]} votes)
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{topAI[0]}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>→ Build this next and sell to all 200 clients</div>
        </div>
      )}

      {rows.length === 0 ? (
        <div style={{ padding: 48, textAlign: "center", color: "var(--muted)", fontSize: 13, background: "var(--surface)", borderRadius: 10, border: "1px solid var(--border)" }}>
          No survey responses yet. Share <strong>webcrew.app/survey</strong> with leads after they see their demo.
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                {["Date", "Name", "Business", "Phone", "Niche", "Pain", "Website?", "AI Want", "Budget"].map(h => (
                  <th key={h} style={{ ...cell, fontWeight: 700, fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ transition: "background 0.1s" }}>
                  <td style={cell}>{r.created_at?.slice(0,10)}</td>
                  <td style={{ ...cell, fontWeight: 600, color: "var(--text)" }}>{r.name || "—"}</td>
                  <td style={cell}>{r.biz || "—"}</td>
                  <td style={cell}>
                    {r.phone ? (
                      <a href={`tel:${r.phone}`} style={{ color: "var(--accent-light)", textDecoration: "none", fontWeight: 600 }}>{r.phone}</a>
                    ) : "—"}
                  </td>
                  <td style={cell}>{r.niche || "—"}</td>
                  <td style={{ ...cell, maxWidth: 200, whiteSpace: "normal" }}>{r.pain || "—"}</td>
                  <td style={cell}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                      background: r.has_website?.includes("don't") ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
                      color: r.has_website?.includes("don't") ? "#22c55e" : "var(--warning)",
                    }}>
                      {r.has_website?.includes("don't") ? "No site" : r.has_website?.includes("fine") ? "Has site" : "Bad site"}
                    </span>
                  </td>
                  <td style={{ ...cell, maxWidth: 180, whiteSpace: "normal" }}>{r.ai_want || "—"}</td>
                  <td style={cell}>
                    <span style={{ color: BUDGET_COLOR[r.budget || ""] ?? "var(--muted)", fontWeight: 600, fontSize: 12 }}>
                      {r.budget || "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
