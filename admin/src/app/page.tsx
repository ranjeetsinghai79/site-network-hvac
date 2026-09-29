export const runtime = 'edge'
import { getFullStats, getRecentLeads, getFunnelData } from "@/lib/db"
import {
  Users,
  TrendingUp,
  Globe,
  DollarSign,
  AlertCircle,
} from "lucide-react"

export const dynamic = "force-dynamic"

const STATUS_COLOR: Record<string, string> = {
  found: "#64748b", scored: "#64748b", analyzed: "#64748b", config_generated: "#64748b",
  built: "#f59e0b",
  deployed: "#10b981", outreach_sent: "#10b981", sms_sent: "#10b981",
  conversation_active: "#6366f1", meeting_scheduled: "#6366f1",
  payment_link_sent: "#818cf8",
  paid: "#22c55e", handed_off: "#22c55e",
  skipped: "#334155", error: "#ef4444",
}

export default async function DashboardPage() {
  const [stats, recent, funnel] = await Promise.all([
    getFullStats(),
    getRecentLeads(10),
    getFunnelData(),
  ])

  const convPct =
    stats.total > 0
      ? ((stats.paid / stats.total) * 100).toFixed(1)
      : "0"

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--text)",
          }}
        >
          Dashboard
        </h1>
        <p style={{ color: "var(--text-2)", fontSize: 13, marginTop: 4 }}>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 14,
          marginBottom: 28,
        }}
      >
        <StatCard
          icon={Users}
          label="Total Leads"
          value={stats.total}
          color="var(--accent-light)"
        />
        <StatCard
          icon={TrendingUp}
          label="Processing"
          value={stats.processing}
          color="var(--warning)"
        />
        <StatCard
          icon={Globe}
          label="Live Sites"
          value={stats.deployed}
          color="var(--success)"
        />
        <StatCard
          icon={DollarSign}
          label="Paid"
          value={stats.paid}
          color="var(--paid)"
          sub={`${convPct}% conversion`}
        />
        <StatCard
          icon={AlertCircle}
          label="Errors"
          value={stats.errors}
          color="var(--error)"
        />
      </div>

      {/* Funnel */}
      <div
        style={{
          background:   "var(--surface)",
          border:       "1px solid var(--border)",
          borderRadius: 12,
          padding:      "20px 24px",
          marginBottom: 28,
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
          Pipeline Funnel
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {funnel.map((stage, i) => {
            const pct =
              stats.total > 0
                ? Math.round((stage.count / stats.total) * 100)
                : 0
            return (
              <div key={stage.group} style={{ flex: 1 }}>
                <div
                  style={{
                    background:   `${stage.color}15`,
                    border:       `1px solid ${stage.color}35`,
                    borderRadius: 10,
                    padding:      "12px 10px",
                    textAlign:    "center",
                  }}
                >
                  <div
                    style={{
                      fontSize:      22,
                      fontWeight:    800,
                      color:         stage.color,
                      lineHeight:    1,
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {stage.count}
                  </div>
                  <div
                    style={{
                      fontSize:   11,
                      color:      "var(--text-2)",
                      marginTop:  5,
                      fontWeight: 600,
                    }}
                  >
                    {stage.group}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                    {pct}%
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent Leads */}
      <div
        style={{
          background:   "var(--surface)",
          border:       "1px solid var(--border)",
          borderRadius: 12,
          overflow:     "hidden",
        }}
      >
        <div
          style={{
            padding:        "13px 20px",
            borderBottom:   "1px solid var(--border)",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize:      11,
              fontWeight:    700,
              color:         "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Recent Leads
          </div>
          <a
            href="/leads"
            style={{
              fontSize:       12,
              color:          "var(--accent-light)",
              textDecoration: "none",
              fontWeight:     600,
            }}
          >
            View all →
          </a>
        </div>

        {recent.map((lead, i) => {
          const siteUrl = lead.cloudflare_url ?? lead.vercel_url
          const color = STATUS_COLOR[lead.status] ?? "#64748b"
          return (
            <div
              key={lead.id}
              style={{
                display:      "flex",
                alignItems:   "center",
                gap:          14,
                padding:      "11px 20px",
                borderBottom:
                  i < recent.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight:   600,
                    fontSize:     13,
                    color:        "var(--text)",
                    whiteSpace:   "nowrap",
                    overflow:     "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {lead.name}
                </div>
                <div
                  style={{
                    fontSize:  11,
                    color:     "var(--muted)",
                    marginTop: 1,
                  }}
                >
                  {lead.niche} · {lead.city}, {lead.state}
                </div>
              </div>

              <span
                style={{
                  background:   `${color}20`,
                  color,
                  border:       `1px solid ${color}40`,
                  borderRadius: 999,
                  padding:      "3px 10px",
                  fontSize:     11,
                  fontWeight:   600,
                  whiteSpace:   "nowrap",
                }}
              >
                {lead.status.replace(/_/g, " ")}
              </span>

              {siteUrl ? (
                <a
                  href={siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize:       11,
                    color:          "var(--accent-light)",
                    textDecoration: "none",
                    whiteSpace:     "nowrap",
                    fontWeight:     600,
                  }}
                >
                  View ↗
                </a>
              ) : (
                <span style={{ fontSize: 11, color: "var(--border-2)", width: 36 }}>—</span>
              )}
            </div>
          )
        })}

        {recent.length === 0 && (
          <div
            style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}
          >
            No leads yet. Run the pipeline to get started.
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  sub,
}: {
  icon: any
  label: string
  value: number
  color: string
  sub?: string
}) {
  return (
    <div
      style={{
        background:   "var(--surface)",
        border:       "1px solid var(--border)",
        borderRadius: 12,
        padding:      "16px 18px",
      }}
    >
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          marginBottom:   10,
        }}
      >
        <span
          style={{
            fontSize:      11,
            fontWeight:    600,
            color:         "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </span>
        <div
          style={{
            width:          28,
            height:         28,
            borderRadius:   7,
            background:     `${color}18`,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
          }}
        >
          <Icon size={14} color={color} strokeWidth={2.5} />
        </div>
      </div>
      <div
        style={{
          fontSize:      30,
          fontWeight:    800,
          color,
          lineHeight:    1,
          letterSpacing: "-0.04em",
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>
          {sub}
        </div>
      )}
    </div>
  )
}
