export const runtime = 'edge'
import { redirect } from "next/navigation"
import { loadPortal } from "@/lib/client-portal"
import { getClientOpportunities } from "@/lib/db"
import { PageHeader, Empty, ButtonLink } from "@/components/portal-ui"
import { ClientPipeline } from "@/components/client-pipeline"

export const dynamic = "force-dynamic"

export default async function LeadsPage() {
  const p = await loadPortal()
  if (!p.reception) redirect("/client/dashboard")
  const rows = await getClientOpportunities(p.reception.configId, 200)
  return (
    <>
      <PageHeader title="Leads" subtitle="Everyone your AI receptionist spoke with who needs something from you. Mark them as you go." />
      {rows.length === 0
        ? <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }}>
            <Empty title="No leads yet" body="When a caller leaves a message, asks for a quote, or books, they show up here with a summary of what they need." action={<ButtonLink href="/client/receptionist" primary>Finish setup</ButtonLink>} />
          </div>
        : <ClientPipeline rows={rows} title="All leads" tabs />}
    </>
  )
}
