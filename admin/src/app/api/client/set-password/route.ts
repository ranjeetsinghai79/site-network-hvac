export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"
import { hasPassword, requireClient, setPassword } from "@/lib/client-auth"
import { validatePassword } from "@/lib/password"
import { SESSION_COOKIE, sessionCookieOptions, signClientSession } from "@/lib/client-session"

// First-time password for someone who arrived through a one-time sign-in link (e.g. right after paying).
// Refuses if a password already exists — changing it goes through change-password (needs the current one).
export async function POST(req: NextRequest) {
  const email = await requireClient()
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 })
  if (await hasPassword(email)) return NextResponse.json({ error: "You already have a password." }, { status: 409 })
  const { password } = await req.json().catch(() => ({})) as { password?: string }
  if (typeof password !== "string") return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  const problem = validatePassword(password, email)
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })

  const version = await setPassword(email, password)
  const res = NextResponse.json({ ok: true, next: "/client/dashboard" })
  res.cookies.set(SESSION_COOKIE, await signClientSession(email, version), sessionCookieOptions())
  return res
}
