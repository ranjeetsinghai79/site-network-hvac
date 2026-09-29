"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ListChecks, Users, Phone, CalendarDays, Bot, Globe, MessageSquareText, CreditCard, LifeBuoy, UserCircle, LogOut, Menu, X } from "lucide-react"

interface Props {
  business: string
  email: string
  hasReception: boolean
  hasSite: boolean
  needsCallback: number
  setupIncomplete: boolean
}

type Item = { href: string; label: string; icon: typeof Phone; badge?: { text: string; tone: "warn" | "dot" } | null }

export function ClientNav({ business, email, hasReception, hasSite, needsCallback, setupIncomplete }: Props) {
  const path = usePathname()
  const [open, setOpen] = useState(false)

  const front: Item[] = hasReception ? [
    { href: "/client/dashboard",    label: "Overview",         icon: LayoutDashboard },
    { href: "/client/services",     label: "My services",      icon: ListChecks },
    { href: "/client/leads",        label: "Leads",            icon: Users,        badge: needsCallback > 0 ? { text: String(needsCallback), tone: "warn" } : null },
    { href: "/client/calls",        label: "Calls",            icon: Phone },
    { href: "/client/appointments", label: "Appointments",     icon: CalendarDays },
    { href: "/client/receptionist", label: "Receptionist setup", icon: Bot,        badge: setupIncomplete ? { text: "", tone: "dot" } : null },
    { href: "/client/website-assistant", label: "Website assistant", icon: MessageSquareText },
  ] : [{ href: "/client/dashboard", label: "Overview", icon: LayoutDashboard }, { href: "/client/services", label: "My services", icon: ListChecks }]
  const account: Item[] = [
    ...(hasSite ? [{ href: "/client/website", label: "Website", icon: Globe } as Item] : []),
    { href: "/client/billing", label: "Billing",         icon: CreditCard },
    { href: "/client/support", label: "Help & requests", icon: LifeBuoy },
    { href: "/client/account", label: "Account",        icon: UserCircle },
  ]

  async function logout() {
    await fetch("/api/client/logout", { method: "POST" })
    window.location.href = "/client/login"
  }

  const link = (it: Item) => {
    const active = path === it.href
    return (
      <a key={it.href} href={it.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={`portal-link${active ? " active" : ""}`}>
        <it.icon size={17} aria-hidden="true" />
        <span style={{ flex: 1 }}>{it.label}</span>
        {it.badge?.tone === "warn" && <span className="portal-badge">{it.badge.text}</span>}
        {it.badge?.tone === "dot" && <span className="portal-dot" aria-label="Setup needed" />}
      </a>
    )
  }

  return (
    <>
      <div className="portal-topbar">
        <button onClick={() => setOpen(o => !o)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} className="portal-menu-btn">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        <span className="portal-topbar-title">{business}</span>
        {needsCallback > 0 && <a href="/client/leads" className="portal-badge" style={{ textDecoration: "none" }}>{needsCallback} to call back</a>}
      </div>
      {open && <div className="portal-scrim" onClick={() => setOpen(false)} />}
      <nav className={`portal-nav${open ? " open" : ""}`} aria-label="Dashboard">
        <div className="portal-brand">
          <div className="portal-logo">W</div>
          <div style={{ minWidth: 0 }}>
            <div className="portal-biz">{business}</div>
            <div className="portal-sub">AI Front Office</div>
          </div>
        </div>
        <div className="portal-group">{hasReception ? "Front office" : "Home"}</div>
        {front.map(link)}
        <div className="portal-group">Account</div>
        {account.map(link)}
        <div style={{ flex: 1 }} />
        <div className="portal-user">
          <div className="portal-email" title={email}>{email}</div>
          <button onClick={logout} className="portal-signout"><LogOut size={14} /> Sign out</button>
        </div>
      </nav>
    </>
  )
}
