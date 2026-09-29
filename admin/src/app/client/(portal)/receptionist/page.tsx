export const runtime = 'edge'
import { redirect } from "next/navigation"
import { loadPortal } from "@/lib/client-portal"
import { googleCalendarEnabled } from "@/lib/google-oauth"
import { PageHeader } from "@/components/portal-ui"
import { ClientSetupCard } from "@/components/client-setup-card"

export const dynamic = "force-dynamic"

export default async function ReceptionistPage({ searchParams }: { searchParams: Promise<{ calendar?: string; code?: string }> }) {
  const { calendar: notice, code } = await searchParams
  const p = await loadPortal()
  if (!p.reception) redirect("/client/dashboard")
  const r = p.reception
  return (
    <>
      <PageHeader title="Receptionist setup" subtitle="The three things your AI receptionist needs: calls sent to it, a calendar to book on, and a number to reach you." />
      <ClientSetupCard
        aiNumber={r.twilioPhone}
        hasCalls={p.hasCalls}
        calendar={{ connected: r.hasCalendar, googleAvailable: googleCalendarEnabled(), provider: r.calendarProvider, googleEmail: r.googleEmail, timezone: r.timezone, settings: (r.calendarSettings as any) ?? null, notice: notice ?? null, noticeCode: code ?? null }}
        transferPhone={r.transferPhone}
        fallbackTransfer={p.lead.phone ?? null}
        alertEmail={p.lead.email ?? null}
        alertPhone={p.lead.phone ?? null}
      />
    </>
  )
}
