"use client"

import { LogOut } from "lucide-react"

export function ClientLogout() {
  async function logout() {
    await fetch("/api/client/logout", { method: "POST" })
    window.location.href = "/client/login"
  }

  return (
    <button
      onClick={logout}
      style={{
        display:     "flex",
        alignItems:  "center",
        gap:         6,
        fontSize:    12,
        fontWeight:  600,
        color:       "var(--muted)",
        background:  "transparent",
        border:      "1px solid var(--border)",
        borderRadius: 7,
        padding:     "6px 12px",
        cursor:      "pointer",
      }}
    >
      <LogOut size={13} />
      Sign out
    </button>
  )
}
