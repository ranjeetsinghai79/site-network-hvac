export const runtime = 'edge'
import { AuthShell } from "@/components/auth-ui"
import { SetPasswordForm } from "@/components/auth-forms"
import { peekResetToken } from "@/lib/client-auth"

export const dynamic = "force-dynamic"

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const t = await peekResetToken(token)
  if (!t) {
    return (
      <AuthShell title="Link expired" subtitle="This link has expired or was already used." footer={<a href="/client/login" style={{ color: "var(--accent-light)", fontWeight: 600, textDecoration: "none" }}>← Back to sign in</a>}>
        <a href="/client/forgot" style={{ display: "block", textAlign: "center", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--accent)", borderRadius: 9, padding: "12px 16px", textDecoration: "none" }}>Get a new link</a>
      </AuthShell>
    )
  }
  const welcome = t.purpose === "welcome"
  return (
    <AuthShell title={welcome ? "Create your password" : "Choose a new password"} subtitle={t.email}>
      <SetPasswordForm token={token} endpoint="/api/client/reset" cta={welcome ? "Create password & open dashboard" : "Save password & sign in"} />
    </AuthShell>
  )
}
