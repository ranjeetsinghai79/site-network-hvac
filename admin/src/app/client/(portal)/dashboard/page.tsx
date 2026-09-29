export const runtime = 'edge'
import { redirect } from "next/navigation"
import { CheckCircle2, Circle, ArrowRight, Globe } from "lucide-react"
import { loadPortal, ROI_PER_BOOKING, prettyPhone, timeAgo } from "@/lib/client-portal"
import { getClientCallLogs, getClientCallStats, getClientCallTrend, getClientOpportunities, getClientUpcomingAppointments } from "@/lib/db"
import { PageHeader, Card, Kpi, KpiGrid, Chip, Empty, ButtonLink } from "@/components/portal-ui"
import { ClientPipeline } from "@/components/client-pipeline"

export const dynamic = "force-dynamic"

const greeting = () => { const h = new Date().getUTCHours() - 7; const l = (h + 24) % 24; return l < 12 ? "Good morning" : l < 18 ? "Good afternoon" : "Good evening" }

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ calendar?: string }> }) {
  const { calendar } = await searchParams
  if (calendar) redirect(`/client/receptionist?calendar=${encodeURIComponent(calendar)}`)   // older return URL from the Google connect flow

  const p = await loadPortal()
  const { lead, reception } = p

  if (!reception) {
    return (
      <>
        <PageHeader title={`${greeting()}`} subtitle={lead.name} />
        <Card title="Your website">
          <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--text-2)", lineHeight: 1.6 }}>
            {p.siteUrl ? "Your site is live." : "Your site is being built — we'll email you the moment it's ready."}
          </p>
          <ButtonLink href="/client/website" primary><Globe size={14} /> Open website details</ButtonLink>
        </Card>
      </>
    )
  }

  const [stats, trend, logs, opps, appts] = await Promise.all([
    getClientCallStats(lead.id, reception.configId), getClientCallTrend(lead.id, reception.configId),
    getClientCallLogs(lead.id, 5, reception.configId), getClientOpportunities(reception.configId, 40), getClientUpcomingAppointments(reception.configId, 5),
  ])
  const open = opps.filter(o => ["new", "callback_requested", "escalated"].includes(o.stage)).slice(0, 5)
  const avg = ROI_PER_BOOKING[lead.niche] ?? 200
  const revenue = stats.booked_this_month * avg
  const delta = trend.this_week_calls - trend.last_week_calls

  const steps = [
    { done: p.setup.forwarding, label: "Forward your business number to your AI number", hint: reception.twilioPhone ? prettyPhone(reception.twilioPhone) : "Your number is being set up" },
    { done: p.setup.calendar, label: "Connect your calendar so the AI can book", hint: "One click with Google" },
    { done: !!reception.transferPhone, label: "Choose where live calls transfer to", hint: reception.transferPhone ? prettyPhone(reception.transferPhone) : "Defaults to your account phone" },
  ]

  return (
    <>
      <PageHeader title={`${greeting()}`} subtitle={`${lead.name} · here's what your AI receptionist did for you.`} />

      {!p.setup.done && (
        <Card title="Finish setting up" aside={<a href="/client/receptionist" style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-light)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>Open setup <ArrowRight size={14} /></a>}>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
            {steps.map(s => (
              <li key={s.label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                {s.done ? <CheckCircle2 size={20} color="#059669" aria-label="Done" /> : <Circle size={20} color="var(--border-2)" aria-label="To do" />}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: s.done ? "var(--muted)" : "var(--text)", textDecoration: s.done ? "line-through" : "none" }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{s.hint}</div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <KpiGrid>
        <Kpi label="Calls answered" value={stats.total_this_month} hint={delta === 0 ? "Same as last week" : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta)} vs last week`} />
        <Kpi label="Appointments booked" value={stats.booked_this_month} hint="this month" tone={stats.booked_this_month > 0 ? "good" : "default"} />
        <Kpi label="Leads to call back" value={p.nav.needsCallback} hint={p.nav.needsCallback > 0 ? "Tap to review" : "You're all caught up"} tone={p.nav.needsCallback > 0 ? "warn" : "default"} href="/client/leads" />
        <Kpi label="Est. revenue recovered" value={revenue > 0 ? `$${revenue.toLocaleString()}` : "—"} hint={revenue > 0 ? `${stats.booked_this_month} × ~$${avg} avg job` : "Grows as bookings come in"} tone={revenue > 0 ? "good" : "default"} />
      </KpiGrid>

      {open.length > 0 && (
        <div>
          <ClientPipeline rows={open} title="Needs your attention" footer={<a href="/client/leads" style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-light)", textDecoration: "none" }}>View all leads →</a>} />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
        <Card title="Upcoming appointments" aside={<a href="/client/appointments" style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-light)", textDecoration: "none" }}>See all</a>} style={{ marginBottom: 0 }}>
          {appts.length === 0 ? (
            <Empty title="No upcoming appointments" body={p.setup.calendar ? "When your AI books someone, it shows up here and on your calendar." : "Connect your calendar and the AI can start booking."} action={!p.setup.calendar ? <ButtonLink href="/client/receptionist" primary>Connect calendar</ButtonLink> : undefined} />
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
              {appts.map(a => (
                <li key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{a.name || "Caller"}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{a.title ?? "Appointment"}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#047857", textAlign: "right", whiteSpace: "nowrap" }}>
                    {new Date(a.booking_start!).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: reception.timezone ?? undefined })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent calls" aside={<a href="/client/calls" style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-light)", textDecoration: "none" }}>See all</a>} style={{ marginBottom: 0 }}>
          {logs.length === 0 ? (
            <Empty title="No calls yet" body="Forward your business number to your AI number and calls will appear here within a minute." action={<ButtonLink href="/client/receptionist" primary>Set up forwarding</ButtonLink>} />
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
              {logs.map(c => (
                <li key={c.id}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{prettyPhone(c.caller_number)}</span>
                    {c.booked && <Chip tone="good">Booked</Chip>}
                    {c.escalated && <Chip tone="warn">Transferred</Chip>}
                    {c.is_spam && <Chip>Filtered</Chip>}
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>{timeAgo(c.created_at)}</span>
                  </div>
                  {c.summary && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.45 }}>{c.summary}</div>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
