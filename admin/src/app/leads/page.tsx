export const runtime = 'edge'
import { getLeads } from "@/lib/db"
import { LeadsTable } from "@/components/leads-table"

export const dynamic = "force-dynamic"

export default async function LeadsPage() {
  const leads = await getLeads()

  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize:      22,
            fontWeight:    800,
            letterSpacing: "-0.03em",
            color:         "var(--text)",
          }}
        >
          Leads
        </h1>
        <p style={{ color: "var(--text-2)", fontSize: 13, marginTop: 4 }}>
          {leads.length} total · manage, transfer, and track every lead
        </p>
      </div>
      <LeadsTable leads={leads} />
    </div>
  )
}
