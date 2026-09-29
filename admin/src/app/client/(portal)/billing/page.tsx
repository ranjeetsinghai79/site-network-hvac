export const runtime = 'edge'
import { loadPortal } from "@/lib/client-portal"
import { PageHeader, Card } from "@/components/portal-ui"
import { BillingCard } from "@/components/billing-card"

export const dynamic = "force-dynamic"

export default async function BillingPage() {
  const { lead } = await loadPortal()
  return (
    <>
      <PageHeader title="Billing" subtitle="Your plan and payment details." />
      <Card pad={false} style={{ background: "transparent", border: "none", overflow: "visible" }}>
        <BillingCard hasStripe={!!lead.stripe_customer_id} subscriptionActive={!!lead.subscription_active} subscriptionPlan={lead.subscription_plan ?? lead.client_plan ?? "launch"} paid={!!lead.paid} />
      </Card>
    </>
  )
}
