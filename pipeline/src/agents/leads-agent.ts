import { appendSheetRow } from '../tools/google-sheets.js'
import { sendOutreachEmail } from '../tools/resend.js'
import { saveLead } from '../db/supabase.js'
import type { AgentResult } from '../types.js'

export interface FormSubmission {
  firstName: string
  lastName: string
  phone: string
  email?: string
  service: string
  message?: string
  source: string
  businessName: string
  businessNiche: string
  submittedAt: string
}

export async function runLeadsAgent(
  submission: FormSubmission
): Promise<AgentResult<{ saved: boolean; sheetsRow: boolean; notified: boolean }>> {
  console.log(`[Leads] Processing form submission from ${submission.firstName} ${submission.lastName}`)

  let saved = false
  let sheetsRow = false
  let notified = false

  // 1. Save to Supabase
  try {
    await saveLead({
      place_id: `form_${Date.now()}`,
      name: `${submission.firstName} ${submission.lastName}`,
      phone: submission.phone,
      email: submission.email,
      address: '',
      city: '',
      state: '',
      niche: submission.businessNiche,
      status: 'found',
    })
    saved = true
  } catch (e: any) {
    console.error('[Leads] Supabase save failed:', e.message)
  }

  // 2. Append to Google Sheet
  if (process.env.LEADS_SHEET_ID) {
    sheetsRow = await appendSheetRow({
      spreadsheetId: process.env.LEADS_SHEET_ID,
      sheetName: 'Leads',
      values: [
        submission.submittedAt,
        submission.firstName,
        submission.lastName,
        submission.phone,
        submission.email || '',
        submission.service,
        submission.message || '',
        submission.source,
        submission.businessName,
      ],
    })
  }

  // 3. Notify business owner by email
  if (process.env.BUSINESS_OWNER_EMAIL) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.OUTREACH_FROM_EMAIL || 'leads@webcrew.dev',
        to: process.env.BUSINESS_OWNER_EMAIL,
        subject: `New lead from ${submission.firstName} ${submission.lastName} — ${submission.service}`,
        html: `
          <h2>New Lead from Your Website</h2>
          <p><strong>Name:</strong> ${submission.firstName} ${submission.lastName}</p>
          <p><strong>Phone:</strong> ${submission.phone}</p>
          <p><strong>Email:</strong> ${submission.email || 'Not provided'}</p>
          <p><strong>Service:</strong> ${submission.service}</p>
          <p><strong>Message:</strong> ${submission.message || 'None'}</p>
          <p><strong>Submitted:</strong> ${submission.submittedAt}</p>
          <hr/>
          <p style="color:#666;font-size:12px">Via your AI-powered website</p>
        `,
      }),
    })
    notified = res.ok
  }

  return { success: true, data: { saved, sheetsRow, notified } }
}
