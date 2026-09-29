export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"
import { getAccount, requireClient, setPassword } from "@/lib/client-auth"
import { validatePassword, verifyPassword } from "@/lib/password"
import { SESSION_COOKIE, sessionCookieOptions, signClientSession } from "@/lib/client-session"

// Changing the password signs out every other device; this one stays signed in with a fresh cookie.
export async function POST(req: NextRequest) {
  const email = await requireClient()
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 })
  const { current, next } = await req.json().catch(() => ({})) as { current?: string; next?: string }
  if (typeof current !== "string" || typeof next !== "string") return NextResponse.json({ error: "Invalid request." }, { status: 400 })

  const acct = await getAccount(email)
  if (!(await verifyPassword(current, acct?.passwordHash ?? null))) return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 })
  const problem = validatePassword(next, email)
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })

  const version = await setPassword(email, next)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, await signClientSession(email, version), sessionCookieOptions())
  return res
}
