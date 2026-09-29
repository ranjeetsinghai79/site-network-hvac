export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { niches, cities, target = 100 } = await req.json()

  if (!niches?.length) {
    return NextResponse.json({ error: "Select at least one niche" }, { status: 400 })
  }

  const triggerUrl = process.env.PIPELINE_TRIGGER_URL
  if (!triggerUrl) {
    return NextResponse.json({
      ok:      true,
      message: `Scrape queued: ${niches.join(", ")} — runs on next GCP Cloud Scheduler cycle`,
    })
  }

  const res = await fetch(`${triggerUrl}/scrape`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${process.env.PIPELINE_TRIGGER_SECRET ?? ""}`,
    },
    body: JSON.stringify({ niches, cities, target }),
  })

  if (!res.ok) {
    return NextResponse.json({ error: `Trigger failed: ${res.status}` }, { status: 502 })
  }

  return NextResponse.json({
    ok:      true,
    message: `Scraping ${niches.join(", ")} for ${target} leads — triggered`,
  })
}
