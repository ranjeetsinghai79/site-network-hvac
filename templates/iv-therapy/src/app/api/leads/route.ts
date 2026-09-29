import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const payload = {
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      email: body.email || '',
      service: body.service,
      message: body.message || '',
      source: req.headers.get('origin') || 'website',
      businessName: process.env.BUSINESS_NAME || 'Revive IV Therapy',
      businessNiche: process.env.BUSINESS_NICHE || 'iv-therapy',
      submittedAt: new Date().toISOString(),
    }
    if (process.env.PIPELINE_API_URL) {
      await fetch(`${process.env.PIPELINE_API_URL}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
