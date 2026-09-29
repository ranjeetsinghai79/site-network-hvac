"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  ArrowLeft, Globe, PlusCircle, Send, Loader2,
  CheckCircle2, XCircle, Clock, Hammer, ExternalLink,
  Upload, X, ChevronDown, Zap,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = "new" | "url"

interface Step {
  id:      string
  label:   string
  status:  "pending" | "working" | "done" | "error"
  detail?: string
}

const STEP_DEFS: Step[] = [
  { id: "brand",  label: "Analyzing brand identity",      status: "pending" },
  { id: "config", label: "Generating site config",        status: "pending" },
  { id: "build",  label: "Building website files",        status: "pending" },
  { id: "deploy", label: "Deploying to Cloudflare Pages", status: "pending" },
]

const STATUS_PROGRESS: Record<string, number> = {
  analyzed: 20, config_generated: 45, built: 70,
  deployed: 100, outreach_sent: 100, sms_sent: 100, paid: 100, handed_off: 100,
}

const TERMINAL_STATUSES = new Set(["deployed", "outreach_sent", "sms_sent", "paid", "handed_off"])

function applyLeadStatus(status: string, prev: Step[]): Step[] {
  type U = Partial<Step>
  const updates: Record<string, U> = {}
  if (status === "analyzed") {
    updates.brand  = { status: "done",    label: "Brand analyzed",            detail: "Scraping complete" }
    updates.config = { status: "working", label: "Generating site config…" }
  } else if (status === "config_generated") {
    updates.brand  = { status: "done" }
    updates.config = { status: "done",    label: "Site config generated" }
    updates.build  = { status: "working", label: "Building website files…" }
  } else if (status === "built") {
    updates.config = { status: "done" }
    updates.build  = { status: "done",    label: "Website files built" }
    updates.deploy = { status: "working", label: "Deploying to Cloudflare…" }
  } else if (TERMINAL_STATUSES.has(status)) {
    updates.build  = { status: "done" }
    updates.deploy = { status: "done",    label: "Deployed to Cloudflare Pages" }
  }
  return prev.map(s => updates[s.id] ? { ...s, ...updates[s.id] } : s)
}

interface BuildResult {
  previewUrl: string | null
  leadId:     string
}

const NICHES = [
  "hvac", "roofing", "dentist", "medspa", "lawfirm", "remodeling",
  "cleaning", "junk-removal", "daycare", "auto-detailing", "restaurant",
  "luxury-realestate", "salon", "barbershop", "plumbing", "landscaping",
  "pressure-washing", "epoxy-flooring", "basement-waterproofing",
  "foundation-repair", "septic-services", "tree-services",
]

// ── Main component ─────────────────────────────────────────────────────────────

interface BuilderAppProps {
  initialUrl?:   string
  initialNiche?: string
  initialName?:  string
  initialMode?:  Mode
  initialLeadId?: string
  onClose?:      () => void
}

export function BuilderApp({ initialUrl, initialNiche, initialName, initialMode, initialLeadId, onClose }: BuilderAppProps = {}) {
  const [mode,       setMode]       = useState<Mode>(initialMode ?? "url")
  const [url,        setUrl]        = useState("")
  const [niche,      setNiche]      = useState("")
  const [bizName,    setBizName]    = useState("")
  const [city,       setCity]       = useState("")
  const [textDump,   setTextDump]   = useState("")
  const [images,     setImages]     = useState<File[]>([])
  const [steps,      setSteps]      = useState<Step[]>([])
  const [building,   setBuilding]   = useState(false)
  const [result,     setResult]     = useState<BuildResult | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const stepsEndRef                 = useRef<HTMLDivElement>(null)
  const fileInputRef                = useRef<HTMLInputElement>(null!)
  const pollRef                     = useRef<ReturnType<typeof setInterval> | null>(null)
  const [progress,    setProgress]  = useState(0)
  const [pollStatus,  setPollStatus] = useState<string | null>(null)

  // Seed from props (inline overlay) or URL params (standalone page)
  useEffect(() => {
    if (initialUrl || initialNiche || initialName || initialMode || initialLeadId) {
      if (initialUrl)   setUrl(initialUrl)
      if (initialNiche) setNiche(initialNiche)
      if (initialName)  setBizName(initialName)
    } else {
      const p = new URLSearchParams(window.location.search)
      if (p.get("mode"))  setMode(p.get("mode") as Mode)
      if (p.get("url"))   setUrl(p.get("url")!)
      if (p.get("niche")) setNiche(p.get("niche")!)
      if (p.get("name"))  setBizName(p.get("name")!)
    }
  }, [])

  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [steps])

  // Poll lead status after async Cloud Run trigger
  useEffect(() => {
    if (!result || result.previewUrl || !result.leadId) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      return
    }
    const leadId = result.leadId
    setProgress(5)
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/leads/${leadId}`)
        if (!res.ok) return
        const data = await res.json() as { status: string; cloudflare_url?: string }
        const pct = STATUS_PROGRESS[data.status] ?? 5
        setProgress(pct)
        setPollStatus(data.status)
        setSteps(prev => applyLeadStatus(data.status, prev))
        if (data.cloudflare_url && TERMINAL_STATUSES.has(data.status)) {
          clearInterval(pollRef.current!); pollRef.current = null
          setResult({ previewUrl: data.cloudflare_url, leadId })
          setPollStatus(null)
        }
      } catch {}
    }, 10_000)
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [result?.leadId, result?.previewUrl])

  function addFile(files: FileList | null) {
    if (!files) return
    setImages(prev => [...prev, ...Array.from(files)])
  }

  function removeImage(i: number) {
    setImages(prev => prev.filter((_, idx) => idx !== i))
  }

  const build = useCallback(async () => {
    setError(null)
    setResult(null)
    setSteps([])
    setProgress(0)
    setPollStatus(null)
    setBuilding(true)

    // Will add workflow-specific steps once stream starts; pipeline steps are always shown
    const pipelineSteps = STEP_DEFS.map(s => ({ ...s }))

    const body: Record<string, any> = { mode, niche }
    if (mode === "url") {
      body.url = url
    } else {
      body.businessName = bizName
      body.city         = city
      body.text         = textDump
    }

    try {
      const res = await fetch("/api/builder/stream", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      })

      if (!res.ok || !res.body) {
        const err = await res.text()
        throw new Error(err || "Stream failed")
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buf     = ""
      let   gotResult = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          if (!gotResult) {
            // Mark any spinning steps as errored so UI doesn't freeze
            setSteps(prev => prev.map(s =>
              s.status === "working" ? { ...s, status: "error", detail: "Connection lost" } : s
            ))
            throw new Error("Connection lost — server restarted mid-build. Reload and retry.")
          }
          break
        }
        buf += decoder.decode(value, { stream: true })

        const lines = buf.split("\n")
        buf = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const evt = JSON.parse(line.slice(6))
            if (evt.type === "step") {
              setSteps(prev => {
                const idx = prev.findIndex(s => s.id === evt.id)
                const step: Step = { id: evt.id, label: evt.label, status: evt.status, detail: evt.detail }
                return idx >= 0
                  ? prev.map((s, i) => i === idx ? step : s)
                  : [...prev, step]
              })
            } else if (evt.type === "done") {
              gotResult = true
              setResult({ previewUrl: evt.previewUrl, leadId: evt.leadId })
              setBuilding(false)
            } else if (evt.type === "error") {
              gotResult = true
              throw new Error(evt.message)
            }
          } catch (parseErr: any) {
            if (parseErr?.message && !parseErr.message.includes("JSON")) throw parseErr
          }
        }
      }
    } catch (e: any) {
      setError(e.message ?? "Unknown error")
      setBuilding(false)
    }
  }, [mode, url, niche, bizName, city, textDump])

  const canBuild = !building && (
    mode === "url" ? url.trim().length > 3
                   : bizName.trim().length > 1
  )

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>

      {/* ── Left panel ─────────────────────────────────────────────────── */}
      <div style={{
        width:         380,
        minWidth:      380,
        display:       "flex",
        flexDirection: "column",
        borderRight:   "1px solid var(--border)",
        background:    "var(--surface)",
        overflow:      "hidden",
      }}>

        {/* Header */}
        <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          {onClose ? (
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex", alignItems: "center", padding: 0 }}>
              <ArrowLeft size={15} />
            </button>
          ) : (
            <a href="/leads" style={{ color: "var(--muted)", display: "flex", alignItems: "center", textDecoration: "none" }}>
              <ArrowLeft size={15} />
            </a>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "var(--accent-dim-2)", border: "1px solid rgba(99,102,241,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={13} color="var(--accent-light)" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: "-0.02em", color: "var(--text)" }}>Website Builder</div>
              <div style={{ fontSize: 10.5, color: "var(--muted)" }}>AI-powered, deploys to Cloudflare</div>
            </div>
          </div>
        </div>

        {/* Workflow tabs */}
        <div style={{ display: "flex", gap: 0, padding: "12px 16px 0", borderBottom: "1px solid var(--border)" }}>
          {(["url", "new"] as const).map(m => (
            <button
              key={m}
              onClick={() => { if (!building) setMode(m) }}
              disabled={building}
              style={{
                flex:           1,
                padding:        "8px 0",
                fontSize:       12.5,
                fontWeight:     mode === m ? 700 : 500,
                color:          mode === m ? "var(--accent-light)" : "var(--text-2)",
                background:     "transparent",
                border:         "none",
                borderBottom:   mode === m ? "2px solid var(--accent)" : "2px solid transparent",
                cursor:         building ? "not-allowed" : "pointer",
                transition:     "all 0.15s",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                gap:            6,
                opacity:        building ? 0.5 : 1,
              }}
            >
              {m === "url" ? <><Globe size={13} /> Existing Website</> : <><PlusCircle size={13} /> New Business</>}
            </button>
          ))}
        </div>

        {/* Form */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
          {mode === "url" ? (
            <UrlForm
              url={url} setUrl={setUrl}
              niche={niche} setNiche={setNiche}
              disabled={building}
            />
          ) : (
            <NewForm
              bizName={bizName} setBizName={setBizName}
              city={city} setCity={setCity}
              niche={niche} setNiche={setNiche}
              textDump={textDump} setTextDump={setTextDump}
              images={images} onAddFile={addFile} onRemoveImage={removeImage}
              fileInputRef={fileInputRef}
              disabled={building}
            />
          )}

          {/* Progress steps */}
          {steps.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>
                  Progress
                </div>
                {progress > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent-light)" }}>{progress}%</span>
                )}
              </div>

              {/* Determinate progress bar */}
              {progress > 0 && (
                <div style={{ height: 3, background: "var(--border-2)", borderRadius: 99, overflow: "hidden", marginBottom: 10 }}>
                  <div style={{
                    height:     "100%",
                    width:      `${progress}%`,
                    background: "linear-gradient(90deg, var(--accent), #7c3aed)",
                    borderRadius: 99,
                    transition: "width 1.2s ease",
                    boxShadow:  "0 0 6px rgba(99,102,241,0.55)",
                  }} />
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {steps.map(step => (
                  <StepRow key={step.id} step={step} />
                ))}
                <div ref={stepsEndRef} />
              </div>

              {/* Polling status badge */}
              {pollStatus && (
                <div style={{ marginTop: 8, fontSize: 10.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-light)", display: "inline-block", animation: "pulse-dot 1.5s ease-in-out infinite" }} />
                  Pipeline status: <span style={{ color: "var(--accent-light)", fontWeight: 600 }}>{pollStatus}</span>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ marginTop: 16, padding: "10px 14px", background: "var(--error-dim)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 12, color: "var(--error)" }}>
              {error}
            </div>
          )}

          {/* Result actions */}
          {result && result.previewUrl ? (
            <>
              <div style={{ marginTop: 16, padding: "14px 16px", background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success)", marginBottom: 8 }}>
                  ✓ Website live!
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a
                    href={result.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", background: "var(--success)", color: "#fff", borderRadius: 7, fontSize: 12, fontWeight: 600, textDecoration: "none" }}
                  >
                    <ExternalLink size={12} /> Open Site
                  </a>
                  <button
                    onClick={() => navigator.clipboard.writeText(result.previewUrl!)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border-2)", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    Copy Link
                  </button>
                </div>
              </div>

              {/* DNS Handoff */}
              <DnsHandoff previewUrl={result.previewUrl} />
            </>
          ) : result && !result.previewUrl ? (
            <div style={{ marginTop: 16, padding: "14px 16px", background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-light)", marginBottom: 6 }}>
                ✓ Pipeline started
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                Building in background on Cloud Run (~10 min). Return to the{" "}
                <a href="/leads" style={{ color: "var(--accent-light)" }}>leads page</a>{" "}
                and refresh the lead to see the live URL once deployed.
              </div>
            </div>
          ) : null}
        </div>

        {/* Build button */}
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
          <button
            onClick={build}
            disabled={!canBuild}
            style={{
              width:          "100%",
              padding:        "12px 0",
              borderRadius:   9,
              border:         "none",
              background:     canBuild
                ? "linear-gradient(135deg, var(--accent), #7c3aed)"
                : "var(--border-2)",
              color:          canBuild ? "#fff" : "var(--muted)",
              fontSize:       13.5,
              fontWeight:     700,
              cursor:         canBuild ? "pointer" : "not-allowed",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              gap:            8,
              transition:     "opacity 0.15s",
              boxShadow:      canBuild ? "0 4px 18px rgba(99,102,241,0.35)" : "none",
            }}
          >
            {building
              ? <><Loader2 size={14} style={{ animation: "spin 0.75s linear infinite" }} /> Building…</>
              : <><Hammer size={14} /> Build Website</>
            }
          </button>
          <div style={{ fontSize: 10.5, color: "var(--muted)", textAlign: "center", marginTop: 7 }}>
            Deploys to Cloudflare Pages · ~60–90s
          </div>
        </div>
      </div>

      {/* ── Right panel: preview ────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#0a0a14" }}>

        {/* Preview toolbar */}
        <div style={{ height: 44, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 16px", gap: 10, background: "var(--surface)" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
          </div>
          <div style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: 6, padding: "4px 12px", fontSize: 12, color: result?.previewUrl ? "var(--text-2)" : "var(--muted)", maxWidth: 500 }}>
            {result?.previewUrl ?? "preview will appear here once deployed…"}
          </div>
          {result?.previewUrl && (
            <a
              href={result.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--muted)", display: "flex", alignItems: "center" }}
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>

        {/* iframe / placeholder */}
        {result?.previewUrl ? (
          <iframe
            src={result.previewUrl}
            style={{ flex: 1, border: "none", width: "100%", height: "100%" }}
            title="Website Preview"
          />
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
            {building ? (
              <>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--accent-dim-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Loader2 size={24} color="var(--accent-light)" style={{ animation: "spin 0.75s linear infinite" }} />
                </div>
                <div style={{ fontSize: 14, color: "var(--text-2)", fontWeight: 500 }}>AI is building your website…</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Preview will appear once deployed</div>
              </>
            ) : result && !result.previewUrl ? (
              <>
                <div style={{ position: "relative", width: 64, height: 64 }}>
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--accent-dim-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Loader2 size={26} color="var(--accent-light)" style={{ animation: "spin 1.2s linear infinite" }} />
                  </div>
                  {progress > 0 && (
                    <svg style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }} width="64" height="64">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="var(--border-2)" strokeWidth="3" />
                      <circle cx="32" cy="32" r="28" fill="none" stroke="var(--accent)" strokeWidth="3"
                        strokeDasharray={`${2 * Math.PI * 28}`}
                        strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
                        style={{ transition: "stroke-dashoffset 1.2s ease" }}
                      />
                    </svg>
                  )}
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, color: "var(--text-2)", fontWeight: 600 }}>
                    {pollStatus ? `Pipeline: ${pollStatus.replace(/_/g, " ")}` : "Pipeline running on Cloud Run…"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    {progress > 0 ? `${progress}% complete · ` : ""}Preview auto-loads when deployed
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5 }}>
                  <Globe size={26} color="var(--muted)" />
                </div>
                <div style={{ fontSize: 14, color: "var(--muted)", fontWeight: 500 }}>
                  {mode === "url" ? "Enter a website URL and click Build" : "Fill in business details and click Build"}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", opacity: 0.6 }}>Preview loads here after deployment</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── URL workflow form ─────────────────────────────────────────────────────────

function UrlForm({
  url, setUrl, niche, setNiche, disabled,
}: {
  url: string; setUrl: (v: string) => void
  niche: string; setNiche: (v: string) => void
  disabled: boolean
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <Label>Business Website URL</Label>
        <input
          type="url"
          placeholder="https://smithhvac.com"
          value={url}
          onChange={e => setUrl(e.target.value)}
          disabled={disabled}
          style={inp(disabled)}
        />
        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 5 }}>
          Firecrawl will extract all pages, forms, images, contact info, and services.
        </div>
      </div>
      <div>
        <Label>Niche <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional — auto-detected)</span></Label>
        <NicheSelect value={niche} onChange={setNiche} disabled={disabled} />
      </div>
    </div>
  )
}

// ── New business workflow form ────────────────────────────────────────────────

function NewForm({
  bizName, setBizName, city, setCity, niche, setNiche,
  textDump, setTextDump, images, onAddFile, onRemoveImage,
  fileInputRef, disabled,
}: {
  bizName: string; setBizName: (v: string) => void
  city: string;    setCity:    (v: string) => void
  niche: string;   setNiche:   (v: string) => void
  textDump: string; setTextDump: (v: string) => void
  images: File[];  onAddFile: (files: FileList | null) => void
  onRemoveImage: (i: number) => void
  fileInputRef: React.RefObject<HTMLInputElement>
  disabled: boolean
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 2 }}>
          <Label>Business Name</Label>
          <input placeholder="Smith HVAC & Cooling" value={bizName} onChange={e => setBizName(e.target.value)} disabled={disabled} style={inp(disabled)} />
        </div>
        <div style={{ flex: 1 }}>
          <Label>City</Label>
          <input placeholder="Tracy" value={city} onChange={e => setCity(e.target.value)} disabled={disabled} style={inp(disabled)} />
        </div>
      </div>

      <div>
        <Label>Niche</Label>
        <NicheSelect value={niche} onChange={setNiche} disabled={disabled} />
      </div>

      <div>
        <Label>Business Info</Label>
        <textarea
          placeholder={`Paste anything you have:
• Services offered
• Phone & address
• Reviews / testimonials
• About the business
• Pricing, team info
• Any text from their social media or Google listing`}
          value={textDump}
          onChange={e => setTextDump(e.target.value)}
          disabled={disabled}
          rows={7}
          style={{
            ...inp(disabled),
            resize:    "vertical",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
          }}
        />
      </div>

      <div>
        <Label>Images <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional)</span></Label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          style={{
            width:          "100%",
            padding:        "10px",
            border:         "1.5px dashed var(--border-2)",
            borderRadius:   8,
            background:     "transparent",
            color:          "var(--muted)",
            fontSize:       12,
            cursor:         disabled ? "not-allowed" : "pointer",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            gap:            6,
            opacity:        disabled ? 0.5 : 1,
          }}
        >
          <Upload size={13} /> Upload images (logos, photos, hero)
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={e => onAddFile(e.target.files)} />
        {images.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {images.map((f, i) => (
              <div key={i} style={{ position: "relative", width: 56, height: 56, borderRadius: 7, overflow: "hidden", border: "1px solid var(--border-2)" }}>
                <img src={URL.createObjectURL(f)} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button
                  onClick={() => onRemoveImage(i)}
                  style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", background: "rgba(0,0,0,0.7)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                >
                  <X size={9} color="#fff" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Step row ──────────────────────────────────────────────────────────────────

function StepRow({ step }: { step: Step }) {
  const icon = step.status === "done"    ? <CheckCircle2 size={14} color="var(--success)" />
             : step.status === "error"   ? <XCircle      size={14} color="var(--error)" />
             : step.status === "working" ? <Loader2      size={14} color="var(--accent-light)" style={{ animation: "spin 0.75s linear infinite" }} />
             :                             <Clock        size={14} color="var(--muted)" />

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "7px 10px", borderRadius: 7, background: step.status === "working" ? "var(--accent-dim)" : "transparent" }}>
      <div style={{ flexShrink: 0, marginTop: 1 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: step.status === "working" ? 600 : 500, color: step.status === "done" ? "var(--text)" : step.status === "error" ? "var(--error)" : step.status === "working" ? "var(--accent-light)" : "var(--muted)" }}>
          {step.label}
        </div>
        {step.detail && (
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>{step.detail}</div>
        )}
      </div>
    </div>
  )
}

// ── Niche select ──────────────────────────────────────────────────────────────

function NicheSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <div style={{ position: "relative" }}>
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} style={{ ...inp(disabled), width: "100%", appearance: "none", paddingRight: 30 }}>
        <option value="">Auto-detect niche</option>
        {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      <ChevronDown size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
      {children}
    </div>
  )
}

function inp(disabled: boolean): React.CSSProperties {
  return {
    width:        "100%",
    background:   "var(--surface-2)",
    border:       "1px solid var(--border-2)",
    borderRadius: 8,
    color:        "var(--text)",
    padding:      "9px 12px",
    fontSize:     13,
    outline:      "none",
    opacity:      disabled ? 0.5 : 1,
  }
}

// ── DNS Handoff ───────────────────────────────────────────────────────────────

function DnsHandoff({ previewUrl }: { previewUrl: string }) {
  const [copied, setCopied] = useState<string | null>(null)

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1800)
  }

  // Extract CF pages hostname from preview URL
  const cfHost = previewUrl.replace(/^https?:\/\//, "").split("/")[0]

  const rows = [
    { type: "CNAME", name: "www",  value: cfHost, note: "for www.yourdomain.com" },
    { type: "CNAME", name: "@",    value: cfHost, note: "root domain (CF DNS only — use CNAME flattening)" },
  ]

  return (
    <div style={{ marginTop: 14, padding: "14px 16px", background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.22)", borderRadius: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-light)", marginBottom: 10 }}>
        DNS Handoff — point their domain here
      </div>

      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
        Give the client these records. If they use Cloudflare DNS, enable proxy (orange cloud).
        GoDaddy / Namecheap: use CNAME for www, and forward root → www.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map(r => (
          <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface-2)", padding: "8px 10px", borderRadius: 7, fontSize: 11 }}>
            <span style={{ color: "var(--muted)", width: 46, flexShrink: 0, fontWeight: 600 }}>{r.type}</span>
            <span style={{ color: "var(--text-2)", width: 28, flexShrink: 0 }}>{r.name}</span>
            <span style={{ color: "var(--accent-light)", flex: 1, fontFamily: "monospace", fontSize: 10.5, wordBreak: "break-all" }}>{cfHost}</span>
            <button
              onClick={() => copy(cfHost, r.name)}
              style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid var(--border-2)", background: "transparent", color: copied === r.name ? "var(--success)" : "var(--muted)", fontSize: 10, cursor: "pointer", flexShrink: 0 }}
            >
              {copied === r.name ? "✓" : "copy"}
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: "var(--muted)" }}>
        Or paste this into the admin domains page to connect programmatically via Cloudflare API.
      </div>
    </div>
  )
}
