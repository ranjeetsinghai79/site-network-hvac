import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const target = process.env.PIPELINE_API_URL
    if (!target) return NextResponse.json({ success: true, queued: false })
    const response = await fetch(`${target}/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: body.name ?? body.firstName ?? "",
        phone: body.phone ?? "",
        email: body.email ?? "",
        service: body.service ?? "HVAC service",
        message: body.message ?? "",
        source: req.headers.get("origin") ?? "website",
        businessName: process.env.BUSINESS_NAME ?? body.businessName,
        businessNiche: "hvac",
        businessOwnerPhone: process.env.BUSINESS_OWNER_PHONE ?? "",
        businessOwnerEmail: process.env.BUSINESS_OWNER_EMAIL ?? "",
        submittedAt: new Date().toISOString(),
      }),
    })
    return NextResponse.json({ success: response.ok }, { status: response.ok ? 200 : 502 })
  } catch {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
