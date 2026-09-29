import { NextResponse } from "next/server"
import { syncFromSheet } from "@/lib/local/sync"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function POST() {
  try {
    return NextResponse.json(await syncFromSheet())
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
