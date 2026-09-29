export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"
import { validateMagicToken } from "@/lib/db"
import { ensureAccount, getAccount } from "@/lib/client-auth"
import { SESSION_COOKIE, sessionCookieOptions, signClientSession } from "@/lib/client-session"

// One-time sign-in link — only issued right after checkout (the /thank-you page). It signs the
// person in once; anyone without a password yet is then sent to create one. Everyday sign-in is
// email + password, never a link.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const email = await validateMagicToken(token)
  if (!email) return NextResponse.redirect(new URL("/client/login?error=expired", req.url))

  await ensureAccount(email)
  const acct = await getAccount(email)
  const res = NextResponse.redirect(new URL(acct?.passwordHash ? "/client/dashboard" : "/client/welcome", req.url))
  res.cookies.set(SESSION_COOKIE, await signClientSession(email, acct?.version ?? 0), sessionCookieOptions())
  return res
}
