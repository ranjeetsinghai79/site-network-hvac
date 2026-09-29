"use client"

import { useEffect, useRef, useState } from "react"
import { gsap } from "@core/web/lib"
import { createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"
import type { SiteConfig } from "@core/web/types"

interface Props {
  config: SiteConfig
  posterSrc?: string
  videoSrc?: string
}

const ROSE = "#A83358"
const ROSE_DARK = "#8D2848"

export function MedSpaHero({ config, posterSrc = "/hero-4.jpg", videoSrc }: Props) {
  const b = config.business
  const services = config.services ?? []
  const reduced = useReducedMotion()

  /* ── Refs ── */
  const sectionRef  = useRef<HTMLElement>(null)
  const parallaxRef = useRef<HTMLDivElement>(null)
  const labelRef    = useRef<HTMLDivElement>(null)
  const badgeRef    = useRef<HTMLDivElement>(null)
  const h1Ref       = useRef<HTMLHeadingElement>(null)
  const paraRef     = useRef<HTMLParagraphElement>(null)
  const trustRef    = useRef<HTMLDivElement>(null)
  const ctaRef      = useRef<HTMLDivElement>(null)
  const formCardRef = useRef<HTMLDivElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)

  /* ── Form state ── */
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", service: "" })
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")

  /* ── Particles ── */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || reduced) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf = 0
    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener("resize", resize, { passive: true })

    const dots = Array.from({ length: 55 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.4 + 0.4,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = "rgba(212,180,131,0.25)"
      for (const d of dots) {
        d.x = (d.x + d.vx + canvas.width)  % canvas.width
        d.y = (d.y + d.vy + canvas.height) % canvas.height
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
    }
  }, [reduced])

  /* ── GSAP entrance + parallax ── */
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    if (reduced) {
      gsap.set(
        [labelRef.current, badgeRef.current, h1Ref.current, paraRef.current,
         trustRef.current, ctaRef.current, formCardRef.current].filter(Boolean),
        { opacity: 1, y: 0, x: 0 }
      )
      return
    }

    const scope = createScope()

    /* word split — wrap each word in the h1 in a clip container */
    const h1 = h1Ref.current
    if (h1) {
      h1.querySelectorAll<HTMLElement>("[data-word]").forEach((el) => {
        const inner = el.firstElementChild as HTMLElement | null
        if (inner) gsap.set(inner, { yPercent: 110, opacity: 0 })
      })
    }

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } })

    tl.from(labelRef.current,    { opacity: 0, y: -18, duration: 0.45 })
      .from(badgeRef.current,    { opacity: 0, y: -14, duration: 0.4 }, "-=0.2")
      .to(
        h1?.querySelectorAll<HTMLElement>("[data-word] > span") ?? [],
        { yPercent: 0, opacity: 1, stagger: 0.048, duration: 0.72 },
        "-=0.28"
      )
      .from(paraRef.current,     { opacity: 0, y: 22, duration: 0.6 }, "-=0.5")
      .from(trustRef.current,    { opacity: 0, y: 14, duration: 0.5 }, "-=0.42")
      .from(ctaRef.current,      { opacity: 0, y: 18, duration: 0.5 }, "-=0.4")
      .from(formCardRef.current, { opacity: 0, x: 44, scale: 0.97, duration: 0.78 }, "-=0.88")

    scope.add(tl)

    if (parallaxRef.current) {
      const t = gsap.to(parallaxRef.current, {
        yPercent: -22,
        ease: "none",
        scrollTrigger: { trigger: section, start: "top top", end: "bottom top", scrub: 1.5 },
      })
      scope.add(t)
      if (t.scrollTrigger) scope.add(t.scrollTrigger)
    }

    return () => scope.kill()
  }, [reduced])

  /* ── Form submit ── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.firstName || !form.phone || !form.service) return
    setStatus("loading")
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName:  form.lastName,
          phone:     form.phone,
          email:     "",
          service:   form.service,
          message:   "Hero form inquiry",
        }),
      })
      setStatus(res.ok ? "success" : "error")
    } catch {
      setStatus("error")
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }))

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="medspa-hero-section"
      style={{
        position: "relative",
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        background: "#1E1915",
      }}
    >
      {/* ── Aurora blobs ── */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        <div style={{
          position: "absolute",
          top: "-10%", left: "-8%",
          width: "55vw", height: "55vw",
          background: "radial-gradient(ellipse, rgba(184,149,90,0.16) 0%, transparent 68%)",
          filter: "blur(72px)",
          animation: "aurora-drift 14s ease-in-out infinite alternate",
        }} />
        <div style={{
          position: "absolute",
          bottom: "-12%", right: "-6%",
          width: "48vw", height: "48vw",
          background: "radial-gradient(ellipse, rgba(168,51,88,0.14) 0%, transparent 68%)",
          filter: "blur(80px)",
          animation: "aurora-drift 18s ease-in-out infinite alternate-reverse",
        }} />
      </div>

      {/* ── Parallax photo + overlays ── */}
      <div
        ref={parallaxRef}
        aria-hidden
        style={{ position: "absolute", inset: "-18% 0", overflow: "hidden", zIndex: 1 }}
      >
        {videoSrc ? (
          <video
            autoPlay muted loop playsInline
            poster={posterSrc}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.28) saturate(0.85)" }}
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        ) : posterSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterSrc}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.28) saturate(0.90)", willChange: "transform" }}
          />
        ) : null}

        {/* Gradient: dark left panel, gradient to transparent right */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(18,14,11,0.82) 0%, rgba(18,14,11,0.55) 45%, rgba(18,14,11,0.30) 100%)" }} />
        {/* Vignette */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 90% 90% at 50% 50%, transparent 35%, rgba(10,8,6,0.55) 100%)" }} />
      </div>

      {/* ── Particle canvas ── */}
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 2, pointerEvents: "none" }}
      />

      {/* ── Main content grid ── */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "clamp(6rem, 10vw, 9rem) 2rem 5rem",
          display: "grid",
          gridTemplateColumns: "1fr 420px",
          gap: "clamp(2rem, 5vw, 5rem)",
          alignItems: "center",
        }}
        className="medspa-hero-grid"
      >
        {/* ─────────────────── LEFT COLUMN ─────────────────── */}
        <div>
          {/* Location label */}
          <div ref={labelRef}>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(212,180,131,1)",
              marginBottom: "1.25rem",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {b.city} · Since {b.since} · {b.license}
            </span>
          </div>

          {/* Pulse badge */}
          <div ref={badgeRef} style={{ marginBottom: "1.75rem" }}>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              fontSize: "0.72rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.90)",
              padding: "0.4rem 1rem 0.4rem 0.7rem",
              borderRadius: "999px",
              background: `color-mix(in srgb, ${ROSE} 22%, transparent)`,
              border: `1px solid color-mix(in srgb, ${ROSE} 45%, transparent)`,
            }}>
              <span style={{
                width: "6px", height: "6px", borderRadius: "50%",
                background: "#E87FA8",
                boxShadow: "0 0 0 0 rgba(232,127,168,0.7)",
                animation: "medspa-pulse 1.8s ease-out infinite",
              }} />
              Accepting New Clients
            </span>
          </div>

          {/* Headline */}
          <h1
            ref={h1Ref}
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(3rem, 8vw, 7.5rem)",
              fontWeight: 600,
              lineHeight: 0.92,
              letterSpacing: "-0.025em",
              color: "#FAF7F1",
              marginBottom: "2rem",
            }}
          >
            {b.name.split(" ").map((word, i) => (
              <span key={i}>
                {i > 0 && " "}
                <WordClip>{word}</WordClip>
              </span>
            ))}
            <br />
            <span style={{ fontSize: "0.58em", fontStyle: "italic", fontWeight: 400, color: "rgba(250,247,241,0.90)", display: "block", marginTop: "0.35em" }}>
              <WordClip>Where</WordClip>
              {" "}
              <WordClip>Science</WordClip>
              {" "}
              <WordClip>Meets</WordClip>
              {" "}
              <WordClip>Beauty.</WordClip>
            </span>
          </h1>

          {/* Subtitle */}
          <p
            ref={paraRef}
            style={{
              fontFamily: "'Lato', sans-serif",
              fontSize: "clamp(0.95rem, 1.4vw, 1.125rem)",
              lineHeight: 1.72,
              color: "rgba(250,247,241,0.88)",
              marginBottom: "2.5rem",
              maxWidth: "36rem",
            }}
          >
            Board-certified providers. FDA-approved treatments.
            Natural results — every time. Complimentary consultations for every new client.
          </p>

          {/* Trust row */}
          <div
            ref={trustRef}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1.5rem",
              flexWrap: "wrap",
              marginBottom: "2.75rem",
            }}
          >
            <TrustPill icon="star" label={`${b.google_rating} Google`} />
            <span style={{ width: "1px", height: "20px", background: "rgba(250,247,241,0.14)" }} />
            <TrustPill icon="users" label={`${b.review_count}+ Clients`} />
            <span style={{ width: "1px", height: "20px", background: "rgba(250,247,241,0.14)" }} />
            <TrustPill icon="check" label="Free Consultation" />
          </div>

          {/* CTAs */}
          <div ref={ctaRef} style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            <a
              href="#contact"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.55rem",
                padding: "0.9rem 2rem",
                borderRadius: "999px",
                background: ROSE,
                color: "#fff",
                fontSize: "0.9rem",
                fontWeight: 700,
                fontFamily: "'Lato', sans-serif",
                letterSpacing: "0.04em",
                textDecoration: "none",
                boxShadow: "0 8px 32px -4px rgba(168,51,88,0.45)",
                transition: "background 0.22s ease, transform 0.22s ease, box-shadow 0.22s ease",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = ROSE_DARK
                ;(e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"
                ;(e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px -4px rgba(168,51,88,0.55)"
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = ROSE
                ;(e.currentTarget as HTMLElement).style.transform = "translateY(0)"
                ;(e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px -4px rgba(168,51,88,0.45)"
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
              </svg>
              Book Free Consultation
            </a>

            <a
              href={b.phoneHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.9rem 1.75rem",
                borderRadius: "999px",
                border: "1px solid rgba(212,180,131,0.35)",
                color: "rgba(212,180,131,0.90)",
                fontSize: "0.875rem",
                fontWeight: 600,
                fontFamily: "'Lato', sans-serif",
                letterSpacing: "0.03em",
                textDecoration: "none",
                transition: "border-color 0.2s, color 0.2s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(212,180,131,0.70)"
                ;(e.currentTarget as HTMLElement).style.color = "rgba(212,180,131,1)"
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(212,180,131,0.35)"
                ;(e.currentTarget as HTMLElement).style.color = "rgba(212,180,131,0.90)"
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.55a16 16 0 0 0 5.55 5.55l.91-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 15.5v1.42Z" />
              </svg>
              {b.phone}
            </a>
          </div>
        </div>

        {/* ─────────────────── RIGHT COLUMN — FORM CARD ─────────────────── */}
        <div ref={formCardRef}>
          <div style={{
            background: "rgba(249,245,238,0.97)",
            borderRadius: "16px",
            padding: "2.25rem 2rem",
            boxShadow: "0 24px 64px -8px rgba(10,8,6,0.55), 0 4px 16px rgba(10,8,6,0.22)",
            border: "1px solid rgba(212,180,131,0.20)",
          }}>
            {status === "success" ? (
              /* Success state */
              <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
                <div style={{
                  width: "52px", height: "52px", borderRadius: "50%",
                  background: "color-mix(in srgb, #B8955A 14%, transparent)",
                  border: "2px solid #B8955A",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 1.25rem",
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B8955A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", fontWeight: 600, color: "#1E1915", marginBottom: "0.6rem" }}>
                  We'll be in touch soon.
                </p>
                <p style={{ fontSize: "0.875rem", color: "rgba(30,25,21,0.58)", lineHeight: 1.6 }}>
                  One of our board-certified providers will call you within 60 minutes to discuss your goals.
                </p>
                <p style={{ marginTop: "1.25rem", fontSize: "0.8rem", color: "#B8955A", fontWeight: 600, letterSpacing: "0.05em" }}>
                  {b.phone}
                </p>
              </div>
            ) : (
              /* Form */
              <>
                <div style={{ marginBottom: "1.5rem" }}>
                  <p style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "1.5rem",
                    fontWeight: 600,
                    color: "#1E1915",
                    lineHeight: 1.2,
                    marginBottom: "0.4rem",
                  }}>
                    Book Your Free Consultation
                  </p>
                  <p style={{ fontSize: "0.8rem", color: "rgba(30,25,21,0.55)", letterSpacing: "0.01em" }}>
                    We call within 60 minutes. No commitment required.
                  </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <FormField
                      label="First Name"
                      type="text"
                      value={form.firstName}
                      onChange={set("firstName")}
                      placeholder="Jane"
                      required
                    />
                    <FormField
                      label="Last Name"
                      type="text"
                      value={form.lastName}
                      onChange={set("lastName")}
                      placeholder="Smith"
                    />
                  </div>

                  <FormField
                    label="Phone Number"
                    type="tel"
                    value={form.phone}
                    onChange={set("phone")}
                    placeholder="(555) 000-0000"
                    required
                  />

                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(30,25,21,0.55)", marginBottom: "0.4rem" }}>
                      I'm Interested In
                    </label>
                    <select
                      value={form.service}
                      onChange={set("service")}
                      required
                      style={{
                        width: "100%",
                        padding: "0.7rem 0.875rem",
                        borderRadius: "8px",
                        border: "1px solid rgba(30,25,21,0.14)",
                        background: "#fff",
                        fontSize: "0.875rem",
                        color: form.service ? "#1E1915" : "rgba(30,25,21,0.40)",
                        outline: "none",
                        cursor: "pointer",
                        appearance: "none",
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23B8955A' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 0.875rem center",
                        paddingRight: "2.5rem",
                      }}
                    >
                      <option value="" disabled>Select a treatment</option>
                      {(config.formServiceOptions ?? services.map((s) => s.title)).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  {status === "error" && (
                    <p style={{ fontSize: "0.8rem", color: "#B8416A", padding: "0.6rem 0.875rem", background: "rgba(184,65,106,0.06)", borderRadius: "6px" }}>
                      Something went wrong. Please call us at {b.phone}.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={status === "loading"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                      width: "100%",
                      padding: "0.9rem",
                      borderRadius: "8px",
                      background: ROSE,
                      color: "#fff",
                      fontSize: "0.875rem",
                      fontWeight: 700,
                      fontFamily: "'Lato', sans-serif",
                      letterSpacing: "0.05em",
                      border: "none",
                      cursor: status === "loading" ? "not-allowed" : "pointer",
                      opacity: status === "loading" ? 0.75 : 1,
                      boxShadow: "0 4px 18px -2px rgba(168,51,88,0.38)",
                      transition: "background 0.2s, transform 0.2s",
                      marginTop: "0.25rem",
                    }}
                    onMouseEnter={(e) => {
                      if (status !== "loading") {
                        ;(e.currentTarget as HTMLElement).style.background = ROSE_DARK
                        ;(e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"
                      }
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLElement).style.background = ROSE
                      ;(e.currentTarget as HTMLElement).style.transform = "translateY(0)"
                    }}
                  >
                    {status === "loading" ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden
                          style={{ animation: "spin 0.9s linear infinite" }}>
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                        Booking...
                      </>
                    ) : (
                      <>
                        Book My Free Consultation
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>

                <p style={{ marginTop: "1.1rem", fontSize: "0.7rem", color: "rgba(30,25,21,0.40)", textAlign: "center", lineHeight: 1.55 }}>
                  By submitting, you agree to receive a call from our team. No spam, ever.
                  <br />Board-certified providers · FDA-approved treatments · Free cancellation.
                </p>
              </>
            )}
          </div>

          {/* Social proof below form card */}
          <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
            <MiniTrustBadge>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#D4B483" aria-hidden><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              {b.google_rating} · {b.review_count}+ Reviews
            </MiniTrustBadge>
            <span style={{ width: "3px", height: "3px", borderRadius: "50%", background: "rgba(212,180,131,0.40)" }} />
            <MiniTrustBadge>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D4B483" strokeWidth="2.5" aria-hidden><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              HIPAA Compliant
            </MiniTrustBadge>
            <span style={{ width: "3px", height: "3px", borderRadius: "50%", background: "rgba(212,180,131,0.40)" }} />
            <MiniTrustBadge>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D4B483" strokeWidth="2.5" aria-hidden><path d="M9 12l2 2 4-4M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3z"/></svg>
              MD / NP / PA Only
            </MiniTrustBadge>
          </div>
        </div>
      </div>

      {/* ── Scroll hint ── */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: "2.25rem",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <span style={{ fontSize: "0.62rem", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(212,180,131,0.45)" }}>
          Explore Treatments
        </span>
        <div style={{
          width: "22px", height: "36px", borderRadius: "999px",
          border: "1.5px solid rgba(212,180,131,0.30)",
          display: "flex", justifyContent: "center", paddingTop: "5px",
        }}>
          <div style={{
            width: "3px", height: "7px", borderRadius: "999px",
            background: "rgba(212,180,131,0.55)",
            animation: "scroll-dot 1.8s ease-in-out infinite",
          }} />
        </div>
      </div>

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes medspa-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(232,127,168,0.65); }
          70%  { box-shadow: 0 0 0 7px rgba(232,127,168,0); }
          100% { box-shadow: 0 0 0 0 rgba(232,127,168,0); }
        }
        @keyframes aurora-drift {
          0%   { transform: translate(0,   0)   scale(1); }
          100% { transform: translate(4%,  5%)  scale(1.08); }
        }
        @keyframes scroll-dot {
          0%   { transform: translateY(0);   opacity: 0.9; }
          60%  { transform: translateY(10px); opacity: 0.2; }
          100% { transform: translateY(0);   opacity: 0.9; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 900px) {
          .medspa-hero-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .medspa-hero-grid {
            padding-top: 7rem !important;
          }
        }
      `}</style>
    </section>
  )
}

/* ── Sub-components ── */

function WordClip({ children }: { children: React.ReactNode }) {
  return (
    <span data-word style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom" }}>
      <span style={{ display: "inline-block" }}>{children}</span>
    </span>
  )
}

function TrustPill({ icon, label }: { icon: "star" | "users" | "check"; label: string }) {
  const icons = {
    star:  <svg width="13" height="13" viewBox="0 0 24 24" fill="#D4B483" aria-hidden><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
    users: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D4B483" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    check: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D4B483" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>,
  }
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", fontWeight: 600, color: "rgba(250,247,241,0.95)", fontFamily: "'Lato', sans-serif" }}>
      {icons[icon]}
      {label}
    </span>
  )
}

function MiniTrustBadge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.68rem", fontWeight: 600, color: "rgba(212,180,131,0.88)", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
      {children}
    </span>
  )
}

function FormField({
  label, type, value, onChange, placeholder, required,
}: {
  label: string
  type: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(30,25,21,0.55)", marginBottom: "0.4rem" }}>
        {label}{required && <span style={{ color: "#A83358", marginLeft: "2px" }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        style={{
          width: "100%",
          padding: "0.7rem 0.875rem",
          borderRadius: "8px",
          border: "1px solid rgba(30,25,21,0.14)",
          background: "#fff",
          fontSize: "0.875rem",
          color: "#1E1915",
          outline: "none",
          transition: "border-color 0.18s",
          boxSizing: "border-box",
        }}
        onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "#B8955A" }}
        onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(30,25,21,0.14)" }}
      />
    </div>
  )
}
