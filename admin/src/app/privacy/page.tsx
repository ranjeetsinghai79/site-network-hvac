export const runtime = 'edge'
export const metadata = { title: "Privacy Policy" }

export default function PrivacyPage() {
  return (
    <main style={page}>
      <section style={wrap}>
        <h1 style={h1}>Privacy Policy</h1>
        <p style={muted}>Last updated: June 27, 2026</p>

        <Block title="What we collect">
          We collect business contact information, website URLs, lead submissions, call and message metadata,
          CRM activity, integration status, analytics, generated content drafts, and information needed to operate
          the AI Front Office.
        </Block>

        <Block title="How we use data">
          We use data to audit websites, generate growth plans, capture and follow up with leads, operate AI reception,
          draft content and ads, provide reporting, prevent abuse, and improve service quality.
        </Block>

        <Block title="AI processing">
          Customer data may be processed by AI providers to generate audits, recommendations, responses, content,
          campaign drafts, and business summaries. We do not authorize AI providers to use customer data to target ads
          outside the customer’s configured campaigns.
        </Block>

        <Block title="Communications">
          SMS, email, and phone automation require appropriate consent or a permitted business relationship. Recipients
          can opt out of SMS by replying STOP. Call recording and AI disclosure requirements vary by jurisdiction and
          must be configured before live phone automation.
        </Block>

        <Block title="Data retention and cancellation">
          We retain operational records, CRM history, call/message logs, generated content, and analytics while an account
          is active. Export and deletion requests can be handled by contacting the account owner or support contact.
        </Block>

        <Block title="Contact">
          For privacy requests, contact the business operating this deployment.
        </Block>
      </section>
    </main>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={h2}>{title}</h2>
      <p style={p}>{children}</p>
    </section>
  )
}

const page: React.CSSProperties = { minHeight: "100vh", background: "#07070f", color: "#e2e8f0", padding: "48px 22px" }
const wrap: React.CSSProperties = { maxWidth: 780, margin: "0 auto" }
const h1: React.CSSProperties = { fontSize: 34, fontWeight: 850, letterSpacing: "-0.04em", marginBottom: 8 }
const h2: React.CSSProperties = { fontSize: 16, fontWeight: 800, marginBottom: 8 }
const p: React.CSSProperties = { color: "#94a3b8", lineHeight: 1.7, fontSize: 14 }
const muted: React.CSSProperties = { color: "#64748b", fontSize: 13 }
