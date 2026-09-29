export const runtime = 'edge'
export const metadata = { title: "Communication Consent" }

export default function ConsentPage() {
  return (
    <main style={page}>
      <section style={wrap}>
        <h1 style={h1}>Communication Consent</h1>
        <p style={muted}>Last updated: June 27, 2026</p>

        <Block title="SMS consent">
          By submitting a form or opting in, a contact may agree to receive messages related to inquiries, appointments,
          follow-up, reminders, and service updates. Message and data rates may apply. Reply STOP to opt out or HELP for help.
        </Block>

        <Block title="Outbound marketing">
          Automated promotional SMS requires appropriate consent or another lawful basis. The system stores consent events
          and revocation events so outbound campaigns can be blocked when consent is missing or revoked.
        </Block>

        <Block title="Calls and AI reception">
          AI phone reception may answer calls, collect information, summarize conversations, and route or book appointments.
          If calls are recorded or transcribed, the business must provide any required disclosure before recording begins.
        </Block>

        <Block title="Email">
          Email follow-up should include clear sender identity and unsubscribe handling when used for marketing.
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
