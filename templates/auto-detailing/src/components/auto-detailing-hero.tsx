"use client"

import { useEffect, useRef, useState } from "react"
import { gsap } from "@core/web/lib"
import { createScope } from "@core/web/lib"
import { useReducedMotion } from "@core/web/hooks"
import type { SiteConfig } from "@core/web/types"

interface Props {
  config: SiteConfig
  posterSrc?: string
}

const SERVICES = [
  { id: "essential",  label: "Essential",  price: "from $149", duration: "3–4 hrs", top: "Exterior wash + clay bar + polish" },
  { id: "signature",  label: "Signature",  price: "from $349", duration: "6–8 hrs", top: "Paint correction + graphene sealant" },
  { id: "ceramic",    label: "Ceramic",    price: "from $899", duration: "2 days",  top: "Full correction + 5-yr ceramic coat" },
]

const TRUST = [
  { icon: "★", label: "5.0 Google" },
  { icon: "✓", label: "Ceramic Pro Certified" },
  { icon: "◎", label: "Mobile Service" },
  { icon: "⬡", label: "5-Year Warranty" },
]

export default function AutoDetailingHero({ config, posterSrc = "/hero-1.jpg" }: Props) {
  const { business } = config
  const reduced = useReducedMotion()
  const [active, setActive] = useState("signature")

  const sectionRef  = useRef<HTMLElement>(null)
  const parallaxRef = useRef<HTMLDivElement>(null)
  const labelRef    = useRef<HTMLDivElement>(null)
  const badgeRef    = useRef<HTMLDivElement>(null)
  const h1Ref       = useRef<HTMLHeadingElement>(null)
  const paraRef     = useRef<HTMLParagraphElement>(null)
  const ctaRef      = useRef<HTMLDivElement>(null)
  const trustRef    = useRef<HTMLDivElement>(null)
  const widgetRef   = useRef<HTMLDivElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)

  /* ── Particle canvas ── */
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
      x:  Math.random() * canvas.width,
      y:  Math.random() * canvas.height,
      r:  Math.random() * 1.5 + 0.4,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = "rgba(96,165,250,0.4)"
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
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize) }
  }, [reduced])

  /* ── GSAP entrance + parallax ── */
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    if (reduced) {
      gsap.set(
        [labelRef.current, badgeRef.current, h1Ref.current, paraRef.current,
         ctaRef.current, trustRef.current, widgetRef.current].filter(Boolean),
        { opacity: 1, y: 0, x: 0 },
      )
      return
    }

    const scope = createScope()
    const words = h1Ref.current?.querySelectorAll<HTMLElement>(".split-word")

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
    tl.from(labelRef.current,  { opacity: 0, x: -28, duration: 0.5 })
      .from(badgeRef.current,  { opacity: 0, y: -12, duration: 0.4 }, "-=0.2")
      .from(words ?? [],       { yPercent: 115, opacity: 0, stagger: 0.042, duration: 0.72 }, "-=0.3")
      .from(paraRef.current,   { opacity: 0, y: 22, duration: 0.6 }, "-=0.5")
      .from(ctaRef.current,    { opacity: 0, y: 18, duration: 0.5 }, "-=0.4")
      .from(trustRef.current,  { opacity: 0, y: 10, duration: 0.4 }, "-=0.35")
      .from(widgetRef.current, { opacity: 0, x: 48, duration: 0.85, ease: "expo.out" }, "-=0.9")
    scope.add(tl)

    /* parallax bg */
    if (parallaxRef.current) {
      const t = gsap.to(parallaxRef.current, {
        yPercent: -22,
        ease: "none",
        scrollTrigger: { trigger: section, start: "top top", end: "bottom top", scrub: 1.5 },
      })
      scope.add(t)
      if (t.scrollTrigger) scope.add(t.scrollTrigger)
    }

    /* aurora blob mouse parallax */
    const blob1 = section.querySelector<HTMLElement>(".ad-blob-1")
    const blob2 = section.querySelector<HTMLElement>(".ad-blob-2")
    const onMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2
      if (blob1) gsap.to(blob1, { x: (e.clientX - cx) * 0.022, y: (e.clientY - cy) * 0.022, duration: 1.2, ease: "power1.out" })
      if (blob2) gsap.to(blob2, { x: (e.clientX - cx) * -0.014, y: (e.clientY - cy) * -0.014, duration: 1.4, ease: "power1.out" })
    }
    window.addEventListener("mousemove", onMove)

    return () => { scope.kill(); window.removeEventListener("mousemove", onMove) }
  }, [reduced])

  const activeSvc = SERVICES.find(s => s.id === active) ?? SERVICES[1]

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: "var(--brand-bg)" }}
    >
      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        aria-hidden
      />

      {/* Aurora blobs */}
      <div
        className="ad-blob-1 absolute pointer-events-none"
        style={{
          width: "70vw", height: "70vw", maxWidth: 860, maxHeight: 860,
          top: "-20%", left: "-15%",
          background: "radial-gradient(ellipse, rgba(59,130,246,0.11) 0%, transparent 65%)",
          filter: "blur(80px)",
        }}
        aria-hidden
      />
      <div
        className="ad-blob-2 absolute pointer-events-none"
        style={{
          width: "55vw", height: "55vw", maxWidth: 680, maxHeight: 680,
          bottom: "-10%", right: "-10%",
          background: "radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 65%)",
          filter: "blur(80px)",
        }}
        aria-hidden
      />

      {/* Cinematic background photo */}
      <div ref={parallaxRef} className="absolute inset-0 z-0 pointer-events-none">
        <img
          src={posterSrc}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{ opacity: 0.18 }}
        />
        {/* Vignette */}
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at center, transparent 30%, rgba(4,8,15,0.8) 100%)",
          }}
        />
        {/* Bottom fade */}
        <div
          className="absolute bottom-0 left-0 right-0 h-48"
          style={{ background: "linear-gradient(to top, var(--brand-bg), transparent)" }}
        />
      </div>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(var(--grid-line,rgba(255,255,255,0.022)) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line,rgba(255,255,255,0.022)) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
        aria-hidden
      />

      {/* Main content */}
      <div
        className="relative z-10 flex-1 flex items-center"
        style={{ padding: "7rem 2rem 4rem" }}
      >
        <div
          className="w-full mx-auto"
          style={{
            maxWidth: "1280px",
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "3rem",
            alignItems: "center",
          }}
        >
          {/* ── Left: Copy ── */}
          <div style={{ maxWidth: "640px" }}>
            {/* Label */}
            <div
              ref={labelRef}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.5rem",
                fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.18em",
                textTransform: "uppercase", color: "var(--brand-accent)",
                marginBottom: "1.2rem",
              }}
            >
              <span
                style={{
                  display: "inline-block", width: "1.5rem", height: "1px",
                  background: "var(--brand-accent)",
                }}
              />
              {business.serviceAreas[0]} · Ceramic Pro Certified · Since {business.since ?? "2014"}
            </div>

            {/* Pulse badge */}
            <div ref={badgeRef} style={{ marginBottom: "1.4rem" }}>
              <span
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.5rem",
                  fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em",
                  color: "rgba(96,165,250,0.9)",
                  border: "1px solid rgba(59,130,246,0.25)",
                  background: "rgba(59,130,246,0.08)",
                  padding: "0.3rem 0.85rem", borderRadius: "999px",
                }}
              >
                <span
                  style={{
                    display: "inline-block", width: 7, height: 7,
                    borderRadius: "50%", background: "#3B82F6",
                    boxShadow: "0 0 10px rgba(59,130,246,0.8)",
                    animation: "pulse 2s ease-in-out infinite",
                  }}
                />
                Booking Available — Free Paint Assessment Included
              </span>
            </div>

            {/* Headline */}
            <h1
              ref={h1Ref}
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(3rem, 7vw, 5.5rem)",
                fontWeight: 900,
                lineHeight: 0.95,
                letterSpacing: "-0.03em",
                color: "var(--brand-fg)",
                marginBottom: "1.4rem",
                overflow: "hidden",
              }}
            >
              {["Every", "Detail.", "Perfected."].map((word) => (
                <span key={word} style={{ display: "inline-block", overflow: "hidden", marginRight: "0.25em" }}>
                  <span
                    className="split-word"
                    style={{
                      display: "inline-block",
                      background: word === "Perfected." ? "linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to))" : undefined,
                      WebkitBackgroundClip: word === "Perfected." ? "text" : undefined,
                      WebkitTextFillColor: word === "Perfected." ? "transparent" : undefined,
                      backgroundClip: word === "Perfected." ? "text" : undefined,
                    }}
                  >
                    {word}
                  </span>
                </span>
              ))}
            </h1>

            {/* Subhead */}
            <p
              ref={paraRef}
              style={{
                fontSize: "clamp(1rem, 1.8vw, 1.15rem)",
                color: "var(--brand-fg-muted)",
                lineHeight: 1.7,
                marginBottom: "2rem",
                maxWidth: "520px",
              }}
            >
              Ceramic coating, paint correction, PPF, and full details — using Gyeon, Gtechniq, and CarPro.
              Trusted by {business.review_count}+ vehicles across {business.serviceAreas.slice(0, 3).join(", ")}.
            </p>

            {/* CTAs */}
            <div ref={ctaRef} style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "2.5rem" }}>
              <a
                href={business.phoneHref}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.85rem 2rem", borderRadius: "999px",
                  background: "linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to))",
                  color: "#fff", fontWeight: 700, fontSize: "0.9rem",
                  textDecoration: "none", boxShadow: "var(--shadow-cta)",
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 40px -4px rgba(59,130,246,0.5)" }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "var(--shadow-cta)" }}
              >
                📞 {business.phone}
              </a>
              <a
                href="#services"
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.85rem 1.75rem", borderRadius: "999px",
                  border: "1px solid rgba(59,130,246,0.3)",
                  color: "var(--brand-fg)", fontWeight: 600, fontSize: "0.9rem",
                  textDecoration: "none", background: "rgba(59,130,246,0.06)",
                  transition: "border-color 0.2s, background 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(59,130,246,0.6)"; e.currentTarget.style.background = "rgba(59,130,246,0.12)" }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(59,130,246,0.3)"; e.currentTarget.style.background = "rgba(59,130,246,0.06)" }}
              >
                View Packages ↓
              </a>
            </div>

            {/* Trust badges */}
            <div
              ref={trustRef}
              style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}
            >
              {TRUST.map(({ icon, label }) => (
                <div
                  key={label}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.4rem",
                    fontSize: "0.72rem", color: "var(--brand-fg-muted)", fontWeight: 500,
                  }}
                >
                  <span style={{ color: "var(--brand-accent)", fontSize: "0.8rem" }}>{icon}</span>
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Service selector widget ── */}
          <div
            ref={widgetRef}
            style={{
              width: "320px",
              flexShrink: 0,
              background: "rgba(11,18,33,0.85)",
              border: "1px solid rgba(59,130,246,0.2)",
              borderRadius: "1.5rem",
              padding: "1.75rem",
              backdropFilter: "blur(16px)",
              boxShadow: "0 24px 80px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,130,246,0.08)",
            }}
          >
            {/* Widget header */}
            <div style={{ marginBottom: "1.25rem" }}>
              <p style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--brand-accent)", marginBottom: "0.35rem" }}>
                Select Your Package
              </p>
              <p style={{ fontSize: "0.78rem", color: "var(--brand-fg-muted)", lineHeight: 1.4 }}>
                Free paint assessment with every quote.
              </p>
            </div>

            {/* Service tabs */}
            <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.25rem" }}>
              {SERVICES.map(svc => (
                <button
                  key={svc.id}
                  onClick={() => setActive(svc.id)}
                  style={{
                    flex: 1, padding: "0.5rem 0.4rem",
                    borderRadius: "0.6rem", border: "none", cursor: "pointer",
                    fontSize: "0.68rem", fontWeight: 700, fontFamily: "var(--font-display)",
                    letterSpacing: "0.05em",
                    background: active === svc.id ? "var(--brand-accent)" : "rgba(59,130,246,0.08)",
                    color: active === svc.id ? "#fff" : "var(--brand-fg-muted)",
                    transition: "all 0.2s",
                  }}
                >
                  {svc.label}
                </button>
              ))}
            </div>

            {/* Selected service detail */}
            <div
              style={{
                background: "rgba(59,130,246,0.06)",
                border: "1px solid rgba(59,130,246,0.15)",
                borderRadius: "0.875rem",
                padding: "1.1rem",
                marginBottom: "1.25rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.6rem" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", fontWeight: 800, color: "var(--brand-fg)" }}>
                  {activeSvc.price}
                </span>
                <span style={{ fontSize: "0.7rem", color: "var(--brand-fg-muted)" }}>
                  {activeSvc.duration}
                </span>
              </div>
              <p style={{ fontSize: "0.78rem", color: "var(--brand-fg-muted)", lineHeight: 1.5 }}>
                {activeSvc.top}
              </p>
            </div>

            {/* Gloss meter */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--brand-fg-muted)" }}>
                  Protection Level
                </span>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--brand-accent)" }}>
                  {activeSvc.id === "essential" ? "55%" : activeSvc.id === "signature" ? "80%" : "100%"}
                </span>
              </div>
              <div style={{ height: "5px", background: "rgba(59,130,246,0.1)", borderRadius: "999px", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: activeSvc.id === "essential" ? "55%" : activeSvc.id === "signature" ? "80%" : "100%",
                    background: "linear-gradient(90deg, var(--brand-grad-from), var(--brand-grad-to))",
                    borderRadius: "999px",
                    transition: "width 0.5s cubic-bezier(0.25,0.46,0.45,0.94)",
                  }}
                />
              </div>
            </div>

            {/* CTA */}
            <a
              href={business.phoneHref}
              style={{
                display: "block", textAlign: "center",
                padding: "0.85rem", borderRadius: "999px",
                background: "linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to))",
                color: "#fff", fontWeight: 700, fontSize: "0.875rem",
                textDecoration: "none", boxShadow: "var(--shadow-cta)",
                transition: "transform 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)" }}
              onMouseLeave={e => { e.currentTarget.style.transform = "" }}
            >
              Book {activeSvc.label} — {activeSvc.price}
            </a>

            <p style={{ textAlign: "center", fontSize: "0.65rem", color: "var(--brand-fg-subtle)", marginTop: "0.75rem" }}>
              Free paint assessment · No commitment
            </p>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className="relative z-10 flex justify-center"
        style={{ paddingBottom: "2rem" }}
      >
        <div
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem",
            fontSize: "0.6rem", letterSpacing: "0.15em", textTransform: "uppercase",
            color: "var(--brand-fg-subtle)",
          }}
        >
          <span>Scroll</span>
          <span style={{ fontSize: "0.9rem", animation: "bounce 1.8s ease-in-out infinite" }}>↓</span>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 10px rgba(59,130,246,0.8); }
          50% { opacity: 0.6; box-shadow: 0 0 20px rgba(59,130,246,0.5); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(4px); }
        }
        @media (max-width: 1024px) {
          #hero > div > div { grid-template-columns: 1fr !important; }
          #hero > div > div > div:last-child { display: none !important; }
        }
        @media (max-width: 640px) {
          #hero h1 { font-size: 2.8rem !important; }
        }
      `}</style>
    </section>
  )
}
