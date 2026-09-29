export const runtime = 'edge'
import { loadPortal } from "@/lib/client-portal"
import { PageHeader, Card } from "@/components/portal-ui"
import { AccountForms } from "@/components/auth-forms"

export const dynamic = "force-dynamic"

export default async function AccountPage() {
  const { email } = await loadPortal()
  return (
    <>
      <PageHeader title="Account" subtitle={`Signed in as ${email}. Your browser stays signed in until you sign out.`} />
      <Card title="Password"><AccountForms /></Card>
    </>
  )
}
