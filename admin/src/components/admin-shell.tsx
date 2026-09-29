"use client"

import { usePathname } from "next/navigation"
import { Sidebar } from "./sidebar"

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const isClient  = path.startsWith("/client")
  const isLanding = path === "/landing"
  const isLegal = path === "/privacy" || path === "/terms" || path === "/consent"
  const isAgency = path.startsWith("/agency")
  const noShell = isClient || isLanding || isLegal || isAgency

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {!noShell && <Sidebar />}
      <div
        style={{
          flex: 1,
          marginLeft: noShell ? 0 : "var(--sidebar-w)",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    </div>
  )
}
