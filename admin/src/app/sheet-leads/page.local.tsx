import { SheetLeadsTable } from "@/components/sheet-leads-table"

export const dynamic = "force-dynamic"

export default function SheetLeadsPage() {
  return (
    <div style={{ padding: "32px 36px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)" }}>Sheet Leads</h1>
      <p style={{ color: "var(--text-2)", fontSize: 13, marginTop: 4, marginBottom: 20 }}>
        Google Sheet → local cache (this machine only). Sync to pull, Validate to check whether each lead&apos;s website is live.
      </p>
      <SheetLeadsTable />
    </div>
  )
}
