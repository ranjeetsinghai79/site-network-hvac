export const runtime = 'edge'
import { loadPortal } from "@/lib/client-portal"
import { PageHeader, Card, Empty } from "@/components/portal-ui"
import { WidgetSnippetCard } from "@/components/widget-snippet-card"

export const dynamic = "force-dynamic"

const DEFAULT_RECEPTION_URL = "https://ai-reception-459352382653.us-central1.run.app"

export default async function WebsiteAssistantPage() {
  const p = await loadPortal()

  if (!p.reception) {
    return (
      <>
        <PageHeader title="Website assistant" subtitle="Add a talking AI to your own website." />
        <Card>
          <Empty title="Not available yet" body="This turns on once your AI receptionist is set up. Reach out and we'll get it ready for your site." />
        </Card>
      </>
    )
  }

  const base = (process.env.RECEPTION_BASE_URL ?? process.env.RECEPTION_SERVER_URL ?? DEFAULT_RECEPTION_URL).replace(/\/$/, "")
  const snippet = `<script src="${base}/widget.js" data-config="${p.reception.configId}" data-name="${p.reception.businessName}" async></script>`
  const currentOrigin = p.reception.widgetAllowedOrigins?.[0] ?? deriveOrigin(p.reception.websiteUrl)

  return (
    <>
      <PageHeader title="Website assistant" subtitle="Add a talking AI chat and voice assistant to your own website — keep your site exactly as it is." />

      <Card title="How it works">
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.8, color: "var(--text-2)" }}>
          <li>Copy the code below.</li>
          <li>Paste it once, anywhere in your site&apos;s HTML (most builders have a &quot;custom code&quot; or &quot;footer scripts&quot; spot — or ask whoever built your site to add it).</li>
          <li>That&apos;s it. A chat/voice bubble appears in the corner of your site, answered by the same AI as your phone line — it greets visitors, answers questions, and can book appointments.</li>
        </ol>
      </Card>

      <WidgetSnippetCard snippet={snippet} currentOrigin={currentOrigin} />
    </>
  )
}

function deriveOrigin(websiteUrl: string): string | null {
  try {
    return new URL(websiteUrl).origin
  } catch {
    return null
  }
}
