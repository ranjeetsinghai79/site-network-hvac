export const runtime = 'edge'
import { getCallLeads } from "@/lib/db"
import { CallList } from "@/components/call-list"

export const dynamic = "force-dynamic"

export default async function CallsPage() {
  const leads = await getCallLeads()

  const noWebsite  = leads.filter(l => !l.website).length
  const hasWebsite = leads.filter(l => !!l.website).length
  const interested = leads.filter(l => l.status === "interested").length
  const called     = leads.filter(l => l.status === "called").length

  return (
    <div style={{ padding: "32px 36px", maxWidth: 960 }}>
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize:      22,
            fontWeight:    800,
            letterSpacing: "-0.03em",
            color:         "var(--text)",
            marginBottom:  4,
          }}
        >
          Call List
        </h1>
        <p style={{ color: "var(--text-2)", fontSize: 13 }}>
          {leads.length} leads ready to call · {noWebsite} no website · {interested} interested · {called} already called
        </p>
      </div>

      {/* Quick stats */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        {[
          { label: "Total",       value: leads.length,  color: "var(--accent-light)" },
          { label: "No Website",  value: noWebsite,     color: "var(--warning)"      },
          { label: "Interested",  value: interested,    color: "var(--success)"      },
          { label: "Called",      value: called,        color: "var(--muted)"        },
        ].map(s => (
          <div
            key={s.label}
            style={{
              background:   "var(--surface)",
              border:       "1px solid var(--border)",
              borderRadius: 10,
              padding:      "12px 18px",
              minWidth:     90,
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1, letterSpacing: "-0.04em" }}>
              {s.value}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, fontWeight: 600 }}>
              {s.label}
            </div>
          </div>
        ))}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
          <a
            href="/pipeline"
            style={{
              fontSize:     13,
              color:        "var(--accent-light)",
              textDecoration: "none",
              fontWeight:   600,
              border:       "1px solid rgba(99,102,241,0.3)",
              borderRadius: 8,
              padding:      "9px 16px",
              background:   "var(--accent-dim)",
            }}
          >
            + Scrape more leads
          </a>
        </div>
      </div>

      {leads.length === 0 ? (
        <div
          style={{
            background:   "var(--surface)",
            border:       "1px solid var(--border)",
            borderRadius: 12,
            padding:      48,
            textAlign:    "center",
            color:        "var(--muted)",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)", marginBottom: 8 }}>
            No leads to call yet
          </div>
          <div style={{ fontSize: 13 }}>
            Go to{" "}
            <a href="/pipeline" style={{ color: "var(--accent-light)" }}>
              Pipeline → Scrape Leads
            </a>{" "}
            to find businesses to call.
          </div>
        </div>
      ) : (
        <CallList leads={leads} />
      )}
    </div>
  )
}
