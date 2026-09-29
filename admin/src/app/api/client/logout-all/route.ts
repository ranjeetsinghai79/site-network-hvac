export const runtime = 'edge'
import { NextResponse } from "next/server"
import { bumpSessionVersion, requireClient } from "@/lib/client-auth"
import { SESSION_COOKIE } from "@/lib/client-session"

// "Sign out everywhere": every issued cookie (including this browser's) stops working.
export async function POST() {
  const email = await requireClient()
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 })
  await bumpSessionVersion(email)
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(SESSION_COOKIE)
  return res
}
