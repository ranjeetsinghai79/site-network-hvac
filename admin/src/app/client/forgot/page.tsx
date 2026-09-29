import { AuthShell } from "@/components/auth-ui"
import { ForgotForm } from "@/components/auth-forms"

export default function ForgotPage() {
  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a secure link." footer={<a href="/client/login" style={{ color: "var(--accent-light)", fontWeight: 600, textDecoration: "none" }}>← Back to sign in</a>}>
      <ForgotForm />
    </AuthShell>
  )
}
