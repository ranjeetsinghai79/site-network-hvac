export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"
import { consumeResetToken, peekResetToken, setPassword } from "@/lib/client-auth"
import { validatePassword } from "@/lib/password"
import { SESSION_COOKIE, sessionCookieOptions, signClientSession } from "@/lib/client-session"

// Spends a reset / welcome token and sets the password. Signs the person in on success.
export async function POST(req: NextRequest) {
  const { token, password } = await req.json().catch(() => ({})) as { token?: string; password?: string }
  if (typeof token !== "string" || typeof password !== "string") return NextResponse.json({ error: "Invalid request." }, { status: 400 })

  const peek = await peekResetToken(token)
  if (!peek) return NextResponse.json({ error: "This link has expired or was already used. Request a new one." }, { status: 410 })
  const problem = validatePassword(password, peek.email)
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })   // checked BEFORE spending the token, so a typo doesn't burn it

  const email = await consumeResetToken(token)
  if (!email) return NextResponse.json({ error: "This link has expired or was already used. Request a new one." }, { status: 410 })
  const version = await setPassword(email, password)
  const res = NextResponse.json({ ok: true, next: "/client/dashboard" })
  res.cookies.set(SESSION_COOKIE, await signClientSession(email, version), sessionCookieOptions())
  return res
}
