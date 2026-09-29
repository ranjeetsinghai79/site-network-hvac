export const runtime = 'edge'
import { getIntegrationStatuses } from "@/lib/db"
import { Cable, ExternalLink } from "lucide-react"

export const dynamic = "force-dynamic"

const labels: Record<string, string> = {
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  instagram_ads: "Instagram Ads",
  facebook_page: "Facebook Page",
  instagram: "Instagram Organic",
  threads: "Threads",
  linkedin: "LinkedIn",
  google_business_profile: "Google Business Profile",
  pinterest: "Pinterest",
  tiktok: "TikTok",
  x: "X",
}

const connectable = new Set(["google_ads", "meta_ads", "instagram_ads", "facebook_page", "instagram", "threads"])

export default async function IntegrationsPage() {
  const rows = await getIntegrationStatuses()

  return (
    <div style={{ padding: "32px 36px", maxWidth: 980 }}>
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)" }}>
          Integrations
        </h1>
        <p style={{ color: "var(--text-2)", fontSize: 13, marginTop: 4 }}>
          Connect ad and social accounts for launch. Campaigns and posts still require approval before publishing or spending.
        </p>
      </div>

      <section style={panel}>
        <div style={panelHeader}>Ad and Social Platforms</div>
        {rows.map((row, i) => {
          const connected = row.status === "connected"
          return (
            <div key={row.provider} style={{ display: "grid", gridTemplateColumns: "1fr 120px 160px", gap: 16, alignItems: "center", padding: "16px 18px", borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, fontWeight: 800, color: "var(--text)" }}>
                  <Cable size={15} color={connected ? "var(--success)" : "var(--muted)"} />
                  {labels[row.provider] ?? row.provider}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  {row.account_label ?? "Not connected"}
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: connected ? "var(--success)" : "var(--warning)" }}>
                {row.status}
              </div>
              {connectable.has(row.provider) ? (
                <a href={`/api/integrations/${row.provider}/start`} style={button}>
                  <ExternalLink size={13} />
                  Connect
                </a>
              ) : (
                <span style={{ ...button, opacity: 0.65 }}>
                  Manual setup
                </span>
              )}
            </div>
          )
        })}
      </section>
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

const button: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  minHeight: 34,
  borderRadius: 8,
  border: "1px solid var(--border-2)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: 12,
  fontWeight: 800,
  textDecoration: "none",
}
