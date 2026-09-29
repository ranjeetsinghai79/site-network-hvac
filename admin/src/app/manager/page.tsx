export const runtime = 'edge'
import { getBusinessManagerSummaries, getFrontOfficeActivity, getPendingApprovals } from "@/lib/db"
import { BriefcaseBusiness, CheckCircle2, Clock3, Database, Megaphone, MessageSquareText, Target, Video } from "lucide-react"
import { PendingApprovals } from "@/components/pending-approvals"

export const dynamic = "force-dynamic"

const colorByPriority: Record<string, string> = {
  critical: "var(--error)",
  high: "var(--warning)",
  medium: "var(--accent-light)",
  low: "var(--success)",
}

export default async function ManagerPage() {
  const [workspaces, activity, approvals] = await Promise.all([
    getBusinessManagerSummaries(),
    getFrontOfficeActivity(),
    getPendingApprovals(),
  ])

  const totals = workspaces.reduce(
    (acc, w) => {
      acc.approvals += w.approval_tasks + w.social_drafts + w.ad_drafts + w.video_drafts
      acc.memory += w.memory_chunks
      acc.social += w.social_drafts
      acc.ads += w.ad_drafts
      acc.video += w.video_drafts
      return acc
    },
    { approvals: 0, memory: 0, social: 0, ads: 0, video: 0 }
  )

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1180 }}>
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)" }}>
          AI Business Manager
        </h1>
        <p style={{ color: "var(--text-2)", fontSize: 13, marginTop: 4 }}>
          A daily operating view of every AI Front Office: plans, approvals, memory, social, ads, and CRM activity.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, marginBottom: 26 }}>
        <Metric icon={<BriefcaseBusiness size={16} />} label="Businesses" value={workspaces.length} color="var(--accent-light)" />
        <Metric icon={<Clock3 size={16} />} label="Needs Approval" value={totals.approvals} color="var(--warning)" />
        <Metric icon={<Database size={16} />} label="Memory Chunks" value={totals.memory} color="var(--info)" />
        <Metric icon={<MessageSquareText size={16} />} label="Social Drafts" value={totals.social} color="var(--success)" />
        <Metric icon={<Target size={16} />} label="Ad Drafts" value={totals.ads} color="var(--paid)" />
        <Metric icon={<Video size={16} />} label="Video Drafts" value={totals.video} color="var(--info)" />
      </div>

      {workspaces.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1.45fr 0.85fr", gap: 18, alignItems: "start" }}>
          <section style={panel}>
            <div style={panelHeader}>Front Office Workspaces</div>
            <div>
              {workspaces.map((w, i) => (
                <div
                  key={w.workspace_id}
                  style={{
                    padding: "16px 18px",
                    borderBottom: i < workspaces.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 750, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {w.business_name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                        {[w.industry, w.city].filter(Boolean).join(" · ") || w.website_url}
                      </div>
                    </div>
                    <span
                      style={{
                        alignSelf: "flex-start",
                        fontSize: 11,
                        fontWeight: 700,
                        color: colorByPriority[w.plan_priority ?? "medium"] ?? "var(--text-2)",
                        border: `1px solid ${(colorByPriority[w.plan_priority ?? "medium"] ?? "var(--border-2)")}55`,
                        borderRadius: 6,
                        padding: "4px 7px",
                        textTransform: "uppercase",
                      }}
                    >
                      {w.plan_priority ?? "planned"}
                    </span>
                  </div>

                  <p style={{ color: "var(--text-2)", fontSize: 12.5, lineHeight: 1.55, marginBottom: 12 }}>
                    {w.plan_summary ?? "No current plan yet. Run an audit, then generate a Growth Plan."}
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                    <Mini label="Queued" value={w.queued_tasks} />
                    <Mini label="Approve" value={w.approval_tasks} />
                    <Mini label="Memory" value={w.memory_chunks} />
                    <Mini label="Social" value={w.social_drafts} />
                    <Mini label="Ads" value={w.ad_drafts} />
                    <Mini label="Video" value={w.video_drafts} />
                    <Mini label="CRM" value={w.crm_events} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section style={panel}>
            <div style={panelHeader}>Pending Approvals</div>
            <PendingApprovals items={approvals} />
          </section>

          <section style={panel}>
            <div style={panelHeader}>Latest Activity</div>
            {activity.slice(0, 18).map((a, i) => (
              <div key={`${a.kind}-${a.workspace_id}-${i}`} style={{ padding: "12px 16px", borderBottom: i < Math.min(activity.length, 18) - 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <ActivityIcon kind={a.kind} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{a.title}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  {a.business_name} · {a.status}
                </div>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  )
}

function Metric({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div style={{ ...panel, padding: "15px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color, marginBottom: 10 }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 27, fontWeight: 850, color: "var(--text)", letterSpacing: "-0.04em" }}>{value}</div>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 9px" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>{label}</div>
    </div>
  )
}

function ActivityIcon({ kind }: { kind: string }) {
  if (kind === "ad") return <Target size={13} color="var(--paid)" />
  if (kind === "social") return <MessageSquareText size={13} color="var(--success)" />
  if (kind === "video") return <Video size={13} color="var(--info)" />
  if (kind === "crm") return <CheckCircle2 size={13} color="var(--info)" />
  return <Megaphone size={13} color="var(--accent-light)" />
}

function EmptyState() {
  return (
    <div style={{ ...panel, padding: "34px", textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 750, color: "var(--text)", marginBottom: 8 }}>No AI Business Manager data yet</div>
      <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, maxWidth: 560, margin: "0 auto" }}>
        Run an audit, apply growth migrations, then run `AUDIT_ID=&lt;id&gt; npm run growth:plan`.
        That creates the plan, memory, social drafts, ad drafts, and approval queue.
      </p>
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
