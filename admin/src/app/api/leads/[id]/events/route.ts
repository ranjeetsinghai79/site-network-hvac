export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"
import { getLeadEvents } from "@/lib/db"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const events = await getLeadEvents(id)
  return NextResponse.json({ events })
}
