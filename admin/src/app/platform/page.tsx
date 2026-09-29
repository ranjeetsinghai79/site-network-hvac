export const runtime = "edge"

import { getPlatformOverview } from "@/lib/db"
import { Blocks, Bot, BookOpenCheck, Building2, PlayCircle, ShieldCheck } from "lucide-react"

export const dynamic = "force-dynamic"

const riskColor = {
  low: "var(--success)",
  medium: "var(--warning)",
  high: "var(--error)",
}

export default async function PlatformPage() {
  const overview = await getPlatformOverview()
  const migrationReady = overview.activeAgents > 0

  return (
    <div style={{ padding: "clamp(18px, 4vw, 36px)", maxWidth: 1120 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>Agency Platform</h1>
        <p style={{ color: "var(--text-2)", fontSize: 13, marginTop: 4, lineHeight: 1.55 }}>
          Phase 2 foundation for multi-client delivery, reusable agents, niche playbooks, and durable automation runs.
        </p>
        <a href="/platform/control" style={{ display: "inline-flex", alignItems: "center", minHeight: 36, marginTop: 14, padding: "0 12px", borderRadius: 6, background: "var(--accent)", color: "white", textDecoration: "none", fontSize: 12, fontWeight: 800 }}>
          Open control center
        </a>
      </div>

      {!migrationReady && (
        <div style={{ ...panel, padding: "16px 18px", borderColor: "var(--warning)", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--warning)" }}>Platform migration pending</div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
            Run <code>npm run growth:migrate</code> to install the Phase 2 foundation and seed the core catalog.
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 22 }}>
        <Metric icon={<Building2 size={15} />} label="Agencies" value={overview.agencies} />
        <Metric icon={<Blocks size={15} />} label="Workspaces" value={overview.workspaces} />
        <Metric icon={<Bot size={15} />} label="Active Agents" value={overview.activeAgents} />
        <Metric icon={<BookOpenCheck size={15} />} label="Playbooks" value={overview.activePlaybooks} />
        <Metric icon={<PlayCircle size={15} />} label="Open Runs" value={overview.queuedRuns} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 18, alignItems: "start" }}>
        <section style={panel}>
          <div style={panelHeader}>Agent Catalog</div>
          {overview.agents.length === 0 ? (
            <Empty label="No agents installed yet" />
          ) : overview.agents.map((agent, index) => (
            <div key={agent.id} style={{ padding: "14px 16px", borderBottom: index < overview.agents.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>{agent.name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{agent.category} · v{agent.version}</div>
                </div>
                <span style={{ ...pill, color: riskColor[agent.risk_level], borderColor: `${riskColor[agent.risk_level]}55` }}>
                  {agent.risk_level} risk
                </span>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--text-2)" }}>{agent.description}</p>
              {agent.default_requires_approval && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8, color: "var(--warning)", fontSize: 11, fontWeight: 700 }}>
                  <ShieldCheck size={12} /> Approval required by default
                </div>
              )}
            </div>
          ))}
        </section>

        <div style={{ display: "grid", gap: 18 }}>
          <section style={panel}>
            <div style={panelHeader}>Niche Playbooks</div>
            {overview.playbooks.length === 0 ? <Empty label="No active playbooks yet" /> : overview.playbooks.map((playbook, index) => (
              <div key={playbook.id} style={{ padding: "15px 16px", borderBottom: index < overview.playbooks.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>{playbook.name}</div>
                  <span style={pill}>{playbook.niche}</span>
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--text-2)" }}>{playbook.description}</p>
              </div>
            ))}
          </section>

          <section style={{ ...panel, padding: "16px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text)", marginBottom: 10 }}>Current boundary</div>
            <div style={{ fontSize: 12, lineHeight: 1.65, color: "var(--text-2)" }}>
              Internal agency platform only. Public self-serve and marketplace access stay locked until onboarding, roles, metering, and durable runs are proven with managed clients.
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div style={{ ...panel, padding: "14px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--accent-light)", marginBottom: 9 }}>{icon}<span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>{label}</span></div>
      <div style={{ fontSize: 25, fontWeight: 850, color: "var(--text)" }}>{value}</div>
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return <div style={{ padding: "24px 16px", fontSize: 12, color: "var(--muted)" }}>{label}</div>
}

const panel: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }
const panelHeader: React.CSSProperties = { padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 10.5, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }
const pill: React.CSSProperties = { display: "inline-flex", alignItems: "center", flexShrink: 0, border: "1px solid var(--border-2)", borderRadius: 6, padding: "3px 6px", color: "var(--text-2)", fontSize: 10, fontWeight: 800, textTransform: "uppercase" }
