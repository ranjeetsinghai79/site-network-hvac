export const runtime = 'edge'
import { redirect } from "next/navigation"
import { AuthShell } from "@/components/auth-ui"
import { SetPasswordForm } from "@/components/auth-forms"
import { hasPassword, requireClient } from "@/lib/client-auth"

export const dynamic = "force-dynamic"

// Shown once, right after the one-time post-checkout sign-in, until a password exists.
export default async function WelcomePage() {
  const email = await requireClient()
  if (!email) redirect("/client/login")
  if (await hasPassword(email)) redirect("/client/dashboard")
  return (
    <AuthShell title="Create your password" subtitle={`Welcome! You'll sign in with ${email} and this password from now on — and your browser will remember you.`}>
      <SetPasswordForm endpoint="/api/client/set-password" cta="Create password & continue" />
    </AuthShell>
  )
}
