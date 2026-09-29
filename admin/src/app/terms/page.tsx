export const runtime = 'edge'
export const metadata = { title: "Terms of Service" }

export default function TermsPage() {
  return (
    <main style={page}>
      <section style={wrap}>
        <h1 style={h1}>Terms of Service</h1>
        <p style={muted}>Last updated: June 27, 2026</p>

        <Block title="Service">
          The AI Front Office helps businesses audit their online presence, capture leads, respond to inquiries,
          draft content, draft ads, manage follow-up, and generate reporting. Some features require third-party
          integrations and customer approval before activation.
        </Block>

        <Block title="Approvals and automation">
          Ads, social publishing, outbound campaigns, phone automation, budget changes, and live-site changes are
          approval-gated at launch. Customers are responsible for reviewing claims, offers, regulated content, and
          campaign settings before approval.
        </Block>

        <Block title="Ad spend and third-party costs">
          Advertising spend is not included unless expressly stated. Google, Meta, SMS, voice, email, domain, hosting,
          and other third-party costs may be pass-through or subject to usage caps.
        </Block>

        <Block title="Compliance">
          Customers are responsible for ensuring they have proper rights, licenses, consent, and disclosures for their
          industry and jurisdiction. Health, legal, financial, real estate, and employment-related content may require
          additional review.
        </Block>

        <Block title="No guaranteed outcomes">
          The service may improve response time, lead capture, follow-up, content production, and campaign operations,
          but it does not guarantee rankings, revenue, ad performance, leads, appointments, or legal/medical outcomes.
        </Block>

        <Block title="Cancellation and data">
          Customers can cancel according to their agreement. Export, transfer, and deletion requests are handled based
          on account status, ownership, legal retention requirements, and connected third-party systems.
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
