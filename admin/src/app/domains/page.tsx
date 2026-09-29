"use client"

import { useEffect, useState } from "react"
import { Globe, Search, Link2, CheckCircle, AlertCircle, Loader, Copy, ChevronDown, ChevronUp } from "lucide-react"

interface DeployedLead {
  id: string
  name: string
  niche: string
  city: string
  state: string
  cloudflare_url: string
  custom_domain?: string
  status: string
}

interface DnsInstructions {
  cnameTarget: string
  domain: string
  instructions: {
    cname: { type: string; name: string; value: string }
    bare:  { type: string; name: string; value: string }
    note:  string
  }
}

export default function DomainsPage() {
  const [leads, setLeads]               = useState<DeployedLead[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState("")
  const [expanded, setExpanded]         = useState<string | null>(null)
  const [domainInput, setDomainInput]   = useState<Record<string, string>>({})
  const [checkResult, setCheckResult]   = useState<Record<string, { available: boolean | null; error?: string }>>({})
  const [connecting, setConnecting]     = useState<string | null>(null)
  const [dnsInfo, setDnsInfo]           = useState<Record<string, DnsInstructions>>({})

  useEffect(() => {
    fetch("/api/domains")
      .then(r => r.json())
      .then(d => { setLeads(d.leads ?? []); setLoading(false) })
  }, [])

  const filtered = leads.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.niche.toLowerCase().includes(search.toLowerCase()) ||
    l.city.toLowerCase().includes(search.toLowerCase())
  )

  function projectName(url: string) {
    return url.replace("https://", "").replace(".pages.dev", "").replace(/\/$/, "")
  }

  async function checkDomain(leadId: string, domain: string) {
    if (!domain) return
    const r = await fetch("/api/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check", domain }),
    })
    const d = await r.json()
    setCheckResult(prev => ({ ...prev, [leadId]: d }))
  }

  async function connectDomain(lead: DeployedLead) {
    const domain = domainInput[lead.id]?.trim()
    if (!domain) return
    setConnecting(lead.id)
    const r = await fetch("/api/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action:      "connect",
        leadId:      lead.id,
        domain,
        projectName: projectName(lead.cloudflare_url),
      }),
    })
    const d = await r.json()
    setConnecting(null)
    if (d.success) {
      setDnsInfo(prev => ({ ...prev, [lead.id]: d }))
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, custom_domain: domain } : l))
    } else {
      setCheckResult(prev => ({ ...prev, [lead.id]: { available: null, error: d.error } }))
    }
  }

  function copy(text: string) { navigator.clipboard.writeText(text) }

  if (loading) return (
    <div style={{ padding: "60px 36px", color: "var(--muted)", fontSize: 14 }}>Loading deployed sites…</div>
  )

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)" }}>
          Domain Manager
        </h1>
        <p style={{ color: "var(--text-2)", fontSize: 13, marginTop: 4 }}>
          Connect custom domains to deployed Cloudflare Pages sites
        </p>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 20, maxWidth: 360 }}>
        <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, niche, or city…"
          style={{
            width: "100%", padding: "8px 12px 8px 32px", borderRadius: 8,
            background: "var(--surface)", border: "1px solid var(--border)",
            fontSize: 13, color: "var(--text)", outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Deployed", value: leads.length, color: "var(--accent-light)" },
          { label: "With Domain", value: leads.filter(l => l.custom_domain).length, color: "var(--success)" },
          { label: "No Domain", value: leads.filter(l => !l.custom_domain).length, color: "var(--warning)" },
        ].map(s => (
          <div key={s.label} style={{ padding: "10px 16px", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", minWidth: 100 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, marginTop: 1 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1.5fr 120px", gap: 12, padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
          <span>Business</span><span>Niche</span><span>Pages URL</span><span>Custom Domain</span><span>Action</span>
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            No deployed sites found
          </div>
        )}

        {filtered.map((lead) => {
          const isExpanded = expanded === lead.id
          const dns = dnsInfo[lead.id]
          const check = checkResult[lead.id]
          const pName = projectName(lead.cloudflare_url)

          return (
            <div key={lead.id} style={{ borderBottom: "1px solid var(--border)" }}>
              {/* Row */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1.5fr 120px", gap: 12, padding: "12px 16px", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{lead.name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{lead.city}, {lead.state}</div>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", textTransform: "capitalize" }}>{lead.niche}</div>
                <div>
                  <a href={lead.cloudflare_url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: "var(--accent-light)", textDecoration: "none" }}>
                    {pName}.pages.dev ↗
                  </a>
                </div>
                <div>
                  {lead.custom_domain ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <CheckCircle size={12} color="var(--success)" />
                      <a href={`https://${lead.custom_domain}`} target="_blank" rel="noreferrer"
                        style={{ fontSize: 12, color: "var(--success)", textDecoration: "none", fontWeight: 600 }}>
                        {lead.custom_domain}
                      </a>
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>Not connected</span>
                  )}
                </div>
                <div>
                  <button
                    onClick={() => setExpanded(isExpanded ? null : lead.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)",
                      background: isExpanded ? "var(--accent-dim-2)" : "transparent",
                      color: isExpanded ? "var(--accent-light)" : "var(--text-2)",
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    <Globe size={12} />
                    {lead.custom_domain ? "Manage" : "Connect"}
                    {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>
                </div>
              </div>

              {/* Expanded panel */}
              {isExpanded && (
                <div style={{ padding: "16px 16px 20px", background: "var(--bg)", borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 10 }}>
                    Connect a custom domain to {lead.name}
                  </div>

                  {/* Domain input + check */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                    <input
                      value={domainInput[lead.id] ?? lead.custom_domain ?? ""}
                      onChange={e => setDomainInput(prev => ({ ...prev, [lead.id]: e.target.value }))}
                      placeholder="e.g. jazzheating.com"
                      style={{
                        flex: 1, maxWidth: 280, padding: "7px 11px", borderRadius: 7,
                        background: "var(--surface)", border: "1px solid var(--border)",
                        fontSize: 13, color: "var(--text)", outline: "none",
                      }}
                    />
                    <button
                      onClick={() => checkDomain(lead.id, domainInput[lead.id] ?? "")}
                      style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      Check
                    </button>
                    <button
                      onClick={() => connectDomain(lead)}
                      disabled={connecting === lead.id}
                      style={{
                        padding: "7px 16px", borderRadius: 7, border: "none",
                        background: "var(--accent)", color: "#fff",
                        fontSize: 12, fontWeight: 700, cursor: "pointer",
                        opacity: connecting === lead.id ? 0.6 : 1,
                        display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      {connecting === lead.id ? <Loader size={12} className="spin" /> : <Link2 size={12} />}
                      {connecting === lead.id ? "Connecting…" : "Connect"}
                    </button>
                  </div>

                  {/* Check result */}
                  {check && (
                    <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      {check.available === true && <><CheckCircle size={13} color="var(--success)" /><span style={{ fontSize: 12, color: "var(--success)" }}>Domain appears available</span></>}
                      {check.available === false && <><AlertCircle size={13} color="var(--warning)" /><span style={{ fontSize: 12, color: "var(--warning)" }}>Domain is registered — if you own it, you can still connect it below</span></>}
                      {check.available === null && <><AlertCircle size={13} color="var(--muted)" /><span style={{ fontSize: 12, color: "var(--muted)" }}>Check failed: {check.error}</span></>}
                    </div>
                  )}

                  {/* DNS instructions after successful connect */}
                  {dns && (
                    <div style={{ padding: 14, borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", marginTop: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                        <CheckCircle size={13} />
                        Domain connected — add these DNS records at your registrar
                      </div>
                      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ color: "var(--muted)" }}>
                            {["Type","Name","Value","TTL"].map(h => (
                              <th key={h} style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid var(--border)", fontWeight: 600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ padding: "6px 8px", color: "var(--text-2)" }}>CNAME</td>
                            <td style={{ padding: "6px 8px", color: "var(--text)" }}>{dns.instructions.cname.name}</td>
                            <td style={{ padding: "6px 8px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <code style={{ color: "var(--accent-light)", background: "var(--accent-dim-2)", padding: "1px 6px", borderRadius: 4 }}>
                                  {dns.cnameTarget}
                                </code>
                                <button onClick={() => copy(dns.cnameTarget)} style={{ border: "none", background: "none", cursor: "pointer", padding: 2 }}>
                                  <Copy size={11} color="var(--muted)" />
                                </button>
                              </div>
                            </td>
                            <td style={{ padding: "6px 8px", color: "var(--muted)" }}>Auto</td>
                          </tr>
                        </tbody>
                      </table>
                      <div style={{ marginTop: 10, fontSize: 11, color: "var(--muted)" }}>
                        {dns.instructions.note}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 11, color: "var(--muted)" }}>
                        <strong>Bare domain (@):</strong> also add CNAME @ → {dns.cnameTarget} (or use CF nameservers for automatic handling)
                      </div>
                    </div>
                  )}

                  {/* Info box for already-connected */}
                  {lead.custom_domain && !dns && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      Currently: <strong style={{ color: "var(--text)" }}>https://{lead.custom_domain}</strong>
                      {" "}→{" "}
                      <span style={{ color: "var(--accent-light)" }}>{pName}.pages.dev</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <style>{`
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
