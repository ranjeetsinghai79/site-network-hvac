export const runtime = 'edge'
import { NextResponse } from "next/server"
import { getLeads } from "@/lib/db"

export async function GET() {
  try {
    const leads = await getLeads()
    return NextResponse.json(leads)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
