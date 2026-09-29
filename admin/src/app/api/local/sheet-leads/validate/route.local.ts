import { NextRequest, NextResponse } from "next/server"
import { idsForFilter, type LeadFilter } from "@/lib/local/query"
import { cancelJob, currentJob, startValidation } from "@/lib/local/validate"

export const dynamic = "force-dynamic"

const MAX_BULK = 50_000

// Body: { ids: number[] } for a row / selection, or { filter: LeadFilter } for "everything matching".
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { ids?: number[]; filter?: LeadFilter }
  const ids = Array.isArray(body.ids)
    ? body.ids.filter(n => Number.isInteger(n)).slice(0, MAX_BULK)
    : idsForFilter(body.filter ?? {}, MAX_BULK)
  if (!ids.length) return NextResponse.json({ error: "No leads matched" }, { status: 400 })
  try {
    return NextResponse.json(startValidation(ids))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 })
  }
}

export async function GET() {
  return NextResponse.json({ job: currentJob() })
}

export async function DELETE() {
  cancelJob()
  return NextResponse.json({ job: currentJob() })
}
