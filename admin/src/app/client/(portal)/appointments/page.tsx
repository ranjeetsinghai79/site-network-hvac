export const runtime = 'edge'
import { redirect } from "next/navigation"
import { CalendarDays, ExternalLink } from "lucide-react"
import { loadPortal, prettyPhone } from "@/lib/client-portal"
import { getClientUpcomingAppointments } from "@/lib/db"
import { PageHeader, Card, Empty, ButtonLink } from "@/components/portal-ui"

export const dynamic = "force-dynamic"

export default async function AppointmentsPage() {
  const p = await loadPortal()
  if (!p.reception) redirect("/client/dashboard")
  const appts = await getClientUpcomingAppointments(p.reception.configId, 100)
  const tz = p.reception.timezone ?? undefined
  const byDay = new Map<string, typeof appts>()
  for (const a of appts) {
    const day = new Date(a.booking_start!).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: tz })
    byDay.set(day, [...(byDay.get(day) ?? []), a])
  }
  return (
    <>
      <PageHeader title="Appointments" subtitle="Upcoming appointments your AI receptionist booked."
        action={p.reception.calendarProvider === "google" ? <ButtonLink href="https://calendar.google.com" ><CalendarDays size={14} /> Open Google Calendar <ExternalLink size={12} /></ButtonLink> : undefined} />
      {appts.length === 0 ? (
        <Card pad={false}><Empty title="No upcoming appointments" body={p.setup.calendar ? "When your AI books someone, they appear here and on your calendar, and they get a reminder before it." : "Connect your calendar and the AI can start booking appointments for you."} action={!p.setup.calendar ? <ButtonLink href="/client/receptionist" primary>Connect calendar</ButtonLink> : undefined} /></Card>
      ) : (
        [...byDay.entries()].map(([day, list]) => (
          <Card key={day} title={day}>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 14 }}>
              {list.map(a => (
                <li key={a.id} style={{ display: "flex", gap: 16, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ minWidth: 84, fontSize: 14, fontWeight: 800, color: "#047857" }}>{new Date(a.booking_start!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{a.name || "Caller"}</span>
                  {a.phone && <a href={`tel:${a.phone}`} style={{ fontSize: 13, color: "var(--accent-light)", fontWeight: 600, textDecoration: "none" }}>{prettyPhone(a.phone)}</a>}
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>{a.title}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </>
  )
}
