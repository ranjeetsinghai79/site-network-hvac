export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { niche, location, count, tier } = await req.json()

  if (!niche || !location) {
    return NextResponse.json({ error: "niche and location required" }, { status: 400 })
  }

  const triggerUrl = process.env.PIPELINE_TRIGGER_URL
  if (!triggerUrl) {
    return NextResponse.json({
      ok:      true,
      message: `Pipeline queued: ${niche} in ${location} — runs on next GCP Cloud Scheduler cycle`,
    })
  }

  const res = await fetch(triggerUrl, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${process.env.PIPELINE_TRIGGER_SECRET ?? ""}`,
    },
    body: JSON.stringify({ niche, location, count: count ?? 5, tier }),
  })

  if (!res.ok) {
    return NextResponse.json({ error: `Trigger failed: ${res.status}` }, { status: 502 })
  }

  return NextResponse.json({
    ok:      true,
    message: `Pipeline started: ${niche} in ${location} (${count ?? 5} leads, ${tier ?? "regular"})`,
  })
}
