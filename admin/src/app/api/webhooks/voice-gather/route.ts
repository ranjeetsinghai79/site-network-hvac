export const runtime = "edge"

import { NextRequest } from "next/server"
import { setCallStatus, setOptOut } from "@/lib/db"

const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID ?? ""
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN  ?? ""
const TWILIO_FROM  = process.env.TWILIO_FROM_NUMBER ?? ""

// Handles keypress from voice call:
//   1 → send SMS with demo link, mark interested
//   9 → opt out
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const leadId = searchParams.get("leadId") ?? ""
  const site   = decodeURIComponent(searchParams.get("site") ?? "")

  const form = await req.formData()
  const digit = form.get("Digits")?.toString() ?? ""
  const to    = form.get("To")?.toString() ?? ""

  let twiml = ""

  if (digit === "1") {
    await setCallStatus(leadId, "interested")

    // Send SMS with demo link if we have the site URL and phone
    if (site && to && TWILIO_SID) {
      const smsBody = new URLSearchParams({
        To:   to,
        From: TWILIO_FROM,
        Body: `Here's your free website from WebCrew: ${site}\n\nReply STOP to opt out.`,
      })
      const creds = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method:  "POST",
        headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
        body:    smsBody.toString(),
      }).catch(() => {})
    }

    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Perfect! We just texted you the link. Take a look and let us know if you would like to keep it. Have a great day!</Say>
  <Hangup/>
</Response>`
  } else if (digit === "9") {
    if (leadId) await setOptOut(leadId)
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">You have been removed from our list. Have a great day!</Say>
  <Hangup/>
</Response>`
  } else {
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">We did not catch that. Check your email for the website link. Goodbye!</Say>
  <Hangup/>
</Response>`
  }

  return new Response(twiml, { headers: { "Content-Type": "text/xml" } })
}
