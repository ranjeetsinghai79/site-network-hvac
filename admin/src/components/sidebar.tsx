"use client"

import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Table2,
  Play,
  ChevronRight,
  Hammer,
  Globe,
  Phone,
  LogOut,
  ClipboardList,
  BriefcaseBusiness,
  Calculator,
  ShieldCheck,
  Cable,
  Megaphone,
  CreditCard,
  Send,
  Share2,
  Video,
  Blocks,
  UserPlus,
  PhoneIncoming,
  DollarSign,
  TrendingUp,
} from "lucide-react"

const NAV = [
  { href: "/",         icon: LayoutDashboard, label: "Dashboard" },
  { href: "/mrr",      icon: DollarSign,      label: "MRR"       },
  { href: "/manager",  icon: BriefcaseBusiness, label: "AI Manager" },
  { href: "/platform", icon: Blocks,          label: "Platform"   },
  { href: "/calls",    icon: Phone,           label: "Call List" },
  { href: "/reception-leads", icon: PhoneIncoming, label: "Reception Calls" },
  { href: "/leads",    icon: Table2,          label: "Leads"     },
  { href: "/prospects", icon: TrendingUp,    label: "Prospects" },
  // Local-only page (page.local.tsx) — compiled out of the cloud build, so hide the link there too.
  ...(process.env.NODE_ENV === "development" ? [{ href: "/sheet-leads", icon: Table2, label: "Sheet Leads" }] : []),
  { href: "/clients/onboard", icon: UserPlus, label: "Onboard Client" },
  { href: "/outreach", icon: Send,            label: "Outreach"  },
  { href: "/billing",  icon: CreditCard,      label: "Billing"   },
  { href: "/ads",      icon: Megaphone,       label: "Ad Drafts" },
  { href: "/social",   icon: Share2,          label: "Social"    },
  { href: "/video",    icon: Video,           label: "Video"     },
  { href: "/pipeline", icon: Play,            label: "Pipeline"  },
  { href: "/builder",  icon: Hammer,          label: "Builder"   },
  { href: "/surveys",  icon: ClipboardList,   label: "Surveys"   },
  { href: "/domains",  icon: Globe,           label: "Domains"   },
  { href: "/economics", icon: Calculator,      label: "Economics" },
  { href: "/integrations", icon: Cable,        label: "Integrations" },
  { href: "/launch",   icon: ShieldCheck,     label: "Launch"    },
]

export function Sidebar() {
  const path = usePathname()

  return (
    <aside
      style={{
        position:    "fixed",
        inset:       "0 auto 0 0",
        width:       "var(--sidebar-w)",
        background:  "var(--surface)",
        borderRight: "1px solid var(--border)",
        display:     "flex",
        flexDirection: "column",
        zIndex:      100,
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding:      "18px 16px 16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: "#1a1613", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 13 }}>M</span>
          </div>
          <div>
            <div
              style={{
                fontWeight:    800,
                fontSize:      13.5,
                letterSpacing: "-0.02em",
                color:         "var(--text)",
                lineHeight:    1.2,
              }}
            >
              MedSpaOS
            </div>
            <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 500 }}>
              Admin Console
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav
        style={{
          flex:          1,
          padding:       "10px 8px",
          display:       "flex",
          flexDirection: "column",
          gap:           2,
        }}
      >
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = path === href
          return (
            <a
              key={href}
              href={href}
              style={{
                display:     "flex",
                alignItems:  "center",
                gap:         9,
                padding:     "9px 11px",
                borderRadius: 8,
                fontSize:    13,
                fontWeight:  active ? 600 : 500,
                color:       active ? "var(--accent-light)" : "var(--text-2)",
                background:  active ? "var(--accent-dim-2)" : "transparent",
                textDecoration: "none",
                border:      `1px solid ${active ? "rgba(99,102,241,0.22)" : "transparent"}`,
                transition:  "all 0.12s ease",
              }}
            >
              <Icon size={15} strokeWidth={active ? 2.5 : 2} />
              <span style={{ flex: 1 }}>{label}</span>
              {active && (
                <ChevronRight size={12} style={{ opacity: 0.45 }} />
              )}
            </a>
          )
        })}
      </nav>

      {/* Client portal link */}
      <div
        style={{
          padding:     "10px 8px",
          borderTop:   "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <a
          href="/client/login"
          style={{
            display:     "flex",
            alignItems:  "center",
            gap:         9,
            padding:     "8px 11px",
            borderRadius: 8,
            fontSize:    12,
            fontWeight:  500,
            color:       "var(--muted)",
            textDecoration: "none",
          }}
        >
          <div
            style={{
              width:       6,
              height:      6,
              borderRadius: "50%",
              background:  "var(--success)",
              animation:   "pulse-dot 2s ease-in-out infinite",
              flexShrink:  0,
            }}
          />
          Client Portal
        </a>
      </div>

      {/* Logout + Footer */}
      <div style={{ padding: "10px 8px 14px" }}>
        <button
          onClick={async () => { await fetch("/api/auth", { method: "DELETE" }); window.location.href = "/login" }}
          style={{
            display:     "flex",
            alignItems:  "center",
            gap:         9,
            padding:     "8px 11px",
            borderRadius: 8,
            fontSize:    12,
            fontWeight:  500,
            color:       "var(--muted)",
            background:  "none",
            border:      "none",
            cursor:      "pointer",
            width:       "100%",
            textAlign:   "left",
          }}
        >
          <LogOut size={14} />
          Sign out
        </button>
        <div style={{ fontSize: 11, color: "var(--muted)", paddingLeft: 11, marginTop: 4 }}>
          Pipeline v1.0
        </div>
      </div>
    </aside>
  )
}
