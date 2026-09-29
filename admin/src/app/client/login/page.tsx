export const runtime = 'edge'
import { AuthShell } from "@/components/auth-ui"
import { LoginForm } from "@/components/auth-forms"

export const dynamic = "force-dynamic"

const NOTICES: Record<string, string> = {
  expired: "That one-time link has expired. Sign in with your email and password, or use “Forgot your password” below.",
  "not-found": "We couldn't find an active account for that login.",
}

export default async function ClientLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return (
    <AuthShell title="Sign in" subtitle="Your WebCrew dashboard" footer={<>New here? Open the welcome email we sent and choose “Create my password”.<br />Your browser will remember you afterwards.</>}>
      <LoginForm notice={error ? NOTICES[error] ?? null : null} />
    </AuthShell>
  )
}
