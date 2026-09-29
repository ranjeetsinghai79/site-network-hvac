export const runtime = 'edge'
import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    db_url_set: !!process.env.DATABASE_URL,
    db_url_prefix: process.env.DATABASE_URL?.slice(0, 20) ?? "MISSING",
    admin_pw_set: !!process.env.ADMIN_PASSWORD,
  })
}
