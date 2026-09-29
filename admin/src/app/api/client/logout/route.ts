export const runtime = 'edge'
import { NextResponse } from "next/server"

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete("client_email")
  return res
}
