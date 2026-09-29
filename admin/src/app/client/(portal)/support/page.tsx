export const runtime = 'edge'
import { loadPortal } from "@/lib/client-portal"
import { PageHeader } from "@/components/portal-ui"
import { ChangeRequestFormClient } from "@/components/change-request-form"

export const dynamic = "force-dynamic"

export default async function SupportPage() {
  const { lead, email } = await loadPortal()
  return (
    <>
      <PageHeader title="Help & requests" subtitle="Need something changed, added, or fixed? Tell us in plain words — we handle it and reply by email." />
      <div id="change-request"><ChangeRequestFormClient leadId={lead.id} email={email} /></div>
    </>
  )
}
