import { NextRequest, NextResponse } from "next/server"
import { listLeads, stats, type LeadFilter } from "@/lib/local/query"
import { lastSync } from "@/lib/local/sync"

export const dynamic = "force-dynamic"

function filterFromParams(sp: URLSearchParams): LeadFilter {
  return {
    tab: sp.get("tab") || undefined,
    tier: sp.get("tier") || undefined,
    status: sp.get("status") || undefined,
    age: sp.get("age") || undefined,
    sheetSite: sp.get("sheetSite") || undefined,
    q: sp.get("q") || undefined,
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const pageSize = Math.min(200, Math.max(10, Number(sp.get("pageSize") ?? 100)))
  const page = Math.max(0, Number(sp.get("page") ?? 0))
  const { rows, total } = listLeads(filterFromParams(sp), sp.get("sort") ?? "added_ts", sp.get("dir") ?? "desc", page, pageSize)
  return NextResponse.json({ rows, total, page, pageSize, stats: stats(), lastSyncedAt: lastSync() })
}
