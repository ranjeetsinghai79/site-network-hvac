export const runtime = 'edge'
import { loadPortal } from "@/lib/client-portal"
import { PageHeader, Card, Chip, ButtonLink } from "@/components/portal-ui"
import { buildServices, planSummary, type ServiceState } from "@/lib/client-services"

export const dynamic = "force-dynamic"

const TONE: Record<ServiceState, "good" | "warn" | "bad"> = { on: "good", setup: "warn", partial: "warn", paused: "bad" }

export default async function ServicesPage() {
  const p = await loadPortal()
  const plan = planSummary(p)
  // Text messages to customers only count as "on" once the carrier registration is approved. Flip SMS_READY=true then.
  const { services, upcoming } = buildServices(p, { smsReady: process.env.SMS_READY === "true" })
  const needs = services.filter(s => s.state === "setup" || s.state === "partial" || s.state === "paused").length

  return (
    <>
      <PageHeader title="My services" subtitle="What is included in your plan and whether each service is switched on." />

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Your plan</div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)" }}>{plan.name}{plan.price && <span style={{ fontWeight: 600, color: "var(--muted)", fontSize: 15 }}> · {plan.price}</span>}</div>
            {plan.note && <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4, maxWidth: 560, lineHeight: 1.5 }}>{plan.note}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Chip tone={plan.state === "active" ? "good" : "warn"}>{plan.label}</Chip>
            <ButtonLink href="/client/billing">Manage billing</ButtonLink>
          </div>
        </div>
      </Card>

      <Card title="Included in your plan" aside={needs > 0 ? <Chip tone="warn">{needs} to finish</Chip> : <Chip tone="good">All set</Chip>} pad={false}>
        {services.map((s, i) => (
          <div key={s.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, padding: "18px 22px", borderTop: i ? "1px solid var(--border)" : undefined, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, flex: "1 1 320px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{s.title}</span>
                <Chip tone={TONE[s.state]}>{s.label}</Chip>
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>{s.blurb}</div>
              <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 8, lineHeight: 1.5 }}>{s.detail}</div>
            </div>
            {s.action && <ButtonLink href={s.action.href} primary={s.state !== "on"}>{s.action.label}</ButtonLink>}
          </div>
        ))}
        {services.length === 0 && <div style={{ padding: "18px 22px", fontSize: 13.5, color: "var(--muted)" }}>Nothing is set up on your plan yet. We will email you when your first service is ready.</div>}
      </Card>

      <Card title="Coming soon">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {upcoming.map(u => (
            <div key={u.title}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{u.title}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3, lineHeight: 1.5 }}>{u.blurb}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
