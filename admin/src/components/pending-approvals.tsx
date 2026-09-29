"use client"

import { useState } from "react"
import { Check, X } from "lucide-react"
import type { PendingApproval } from "@/lib/db"

export function PendingApprovals({ items }: { items: PendingApproval[] }) {
  const [rows, setRows] = useState(items)
  const [busy, setBusy] = useState<string | null>(null)

  async function act(item: PendingApproval, action: "approve" | "reject") {
    setBusy(`${item.entity_type}:${item.entity_id}`)
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: item.entity_type,
          entityId: item.entity_id,
          action,
          actorEmail: "admin@webcrew.app",
          notes: action === "approve" ? "Approved from AI Business Manager" : "Rejected from AI Business Manager",
        }),
      })
      if (!res.ok) throw new Error("Approval update failed")
      setRows((prev) => prev.filter((row) => row.entity_id !== item.entity_id || row.entity_type !== item.entity_type))
    } finally {
      setBusy(null)
    }
  }

  if (!rows.length) {
    return (
      <div style={{ padding: "18px", fontSize: 13, color: "var(--text-2)" }}>
        No pending approvals. New social, ads, and risky actions will appear here before anything publishes or spends.
      </div>
    )
  }

  return (
    <div>
      {rows.map((item, i) => {
        const key = `${item.entity_type}:${item.entity_id}`
        return (
          <div key={key} style={{ padding: "14px 16px", borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none" }}>
            <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: item.compliance_warnings.length ? 7 : 0 }}>
                  {item.business_name} · {item.entity_type} · {item.detail ?? item.status}
                </div>
                {item.compliance_warnings.slice(0, 2).map((warning) => (
                  <div key={warning} style={{ fontSize: 11, color: "var(--warning)", lineHeight: 1.4 }}>
                    {warning}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
                <button onClick={() => act(item, "approve")} disabled={busy === key} style={buttonStyle("var(--success)")}>
                  <Check size={13} /> Approve
                </button>
                <button onClick={() => act(item, "reject")} disabled={busy === key} style={buttonStyle("var(--error)")}>
                  <X size={13} /> Reject
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function buttonStyle(color: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    minHeight: 30,
    borderRadius: 7,
    border: `1px solid ${color}55`,
    background: `${color}18`,
    color,
    padding: "0 9px",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  }
}
