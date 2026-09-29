export const runtime = 'edge'
import { NextRequest, NextResponse } from "next/server"
import { requireClient } from "@/lib/client-auth"

async function notifySlack(email: string, leadId: string, message: string) {
  const slackUrl = process.env.SLACK_WEBHOOK_URL
  if (!slackUrl) return
  await fetch(slackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `*Change Request* from *${email}*\n> ${message.slice(0, 300)}${message.length > 300 ? "…" : ""}\nLead ID: \`${leadId}\``,
    }),
  }).catch(() => {})
}

export async function POST(req: NextRequest) {
  const email = await requireClient()
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 })

  const { leadId, message } = await req.json()

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 })
  }

  const resendKey  = process.env.RESEND_API_KEY
  const adminEmail = process.env.BUSINESS_OWNER_EMAIL ?? process.env.OUTREACH_FROM_EMAIL

  // Email notification
  if (resendKey && adminEmail) {
    const from = process.env.OUTREACH_FROM_EMAIL ?? "noreply@websitedeveloper.ai"
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: adminEmail,
        subject: `Change Request from ${email}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
            <h2 style="margin:0 0 12px;">Change request from client</h2>
            <p style="color:#666;margin:0 0 16px;">
              <strong>Email:</strong> ${email}<br/>
              <strong>Lead ID:</strong> ${leadId}
            </p>
            <div style="background:#f5f5f5;border-radius:8px;padding:16px;white-space:pre-wrap;font-size:14px;">
${message}
            </div>
          </div>
        `,
      }),
    })
  } else {
    console.log("[change-request]", { leadId, email, message })
  }

  // Slack notification (Grow+ clients get dedicated channel — set SLACK_WEBHOOK_URL per client or globally)
  await notifySlack(email, leadId, message)

  return NextResponse.json({ ok: true })
}
