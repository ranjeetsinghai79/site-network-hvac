export const runtime = "edge"

import { NextRequest } from "next/server"

const ADMIN_URL = process.env.ADMIN_URL ?? "https://webcrew-admin.pages.dev"

// Twilio calls this URL when the outbound call connects — serves TwiML script
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const leadId = searchParams.get("leadId") ?? ""
  const name   = decodeURIComponent(searchParams.get("name") ?? "your business")
  const site   = decodeURIComponent(searchParams.get("site") ?? "")

  const gatherAction = `${ADMIN_URL}/api/webhooks/voice-gather?leadId=${leadId}&site=${encodeURIComponent(site)}`

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${gatherAction}" method="POST" timeout="8">
    <Say voice="alice">
      Hello! This is Alex from Web Crew. We built ${name} a free professional website that went live last night.
      Press 1 and we will text you the link right now.
      Press 9 to be removed from our list.
    </Say>
  </Gather>
  <Say voice="alice">We did not catch that. Check your email for the website link. Have a great day!</Say>
</Response>`

  return new Response(twiml, {
    headers: { "Content-Type": "text/xml" },
  })
}

// Twilio also sends GET for some webhooks
export async function GET(req: NextRequest) {
  return POST(req)
}
