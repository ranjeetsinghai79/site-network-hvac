"use client"

import { useRef, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import gsap from "gsap"
import ScrollTrigger from "gsap/ScrollTrigger"
import { useGSAP } from "@gsap/react"
import type { SiteConfig } from "@core/web/types"
import { useTextReveal, useStaggerReveal, useTilt, useReducedMotion } from "@core/web/hooks"

gsap.registerPlugin(ScrollTrigger, useGSAP)

// WebGL — client-only, and skipped entirely on slow connections (see mount guard below)
const FloorViewer3D = dynamic(() => import("./floor-viewer-3d").then((m) => m.FloorViewer3D), {
  ssr: false,
})

interface Finish {
  name: string
  tagline: string
  image: string
  /** "r,g,b" — tints the liquid shimmer + glass glow for this finish */
  tint: string
}

const FINISHES: Finish[] = [
  { name: "Full-Broadcast Flake", tagline: "Textured, slip-resistant, hides slab imperfections", image: "/service-1.jpg", tint: "99,102,241" },
  { name: "Metallic Pearl",       tagline: "Swirled pigment, one-of-a-kind showroom finish",       image: "/service-3.jpg", tint: "129,140,248" },
  { name: "Quartz Blend",         tagline: "Fine aggregate broadcast, matte industrial durability", image: "/service-6.jpg", tint: "56,189,248" },
  { name: "Industrial Solid",     tagline: "Chemical & impact resistant, zero-maintenance",         image: "/service-4.jpg", tint: "100,116,139" },
]

export function FinishShowcaseSection({ config }: { config: SiteConfig }) {
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [show3d, setShow3d] = useState(false)

  useTextReveal(headingRef, { start: "top 85%" })
  useStaggerReveal(gridRef, ".finish-card", { y: 56, scale: 0.94, stagger: 0.08 })
  useTilt(gridRef, { selector: ".finish-card", maxRotY: 9, maxRotX: 7, zDepth: 14 })

  useEffect(() => {
    const conn = (navigator as unknown as { connection?: { effectiveType?: string } }).connection
    if (conn && (conn.effectiveType === "slow-2g" || conn.effectiveType === "2g")) return
    setShow3d(true)
  }, [])

  const active = FINISHES[activeIndex]

  return (
    <section
      ref={sectionRef}
      className="relative py-24 md:py-28 px-6 overflow-hidden"
      style={{ background: "var(--brand-bg-section)" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14 md:mb-16">
          <span className="section-label">Finish Gallery</span>
          <h2
            ref={headingRef}
            className="font-display font-800 mt-3"
            style={{ color: "var(--brand-fg)", fontSize: "clamp(2rem, 4.5vw, 3.25rem)" }}
          >
            {"Every Floor Cures To A Mirror".split(" ").map((word, i) => (
              <span key={i} className="split-word-wrap inline-block overflow-hidden align-top">
                <span className="split-word inline-block">{word}&nbsp;</span>
              </span>
            ))}
          </h2>
          <p className="mt-4 max-w-xl mx-auto" style={{ color: "var(--brand-fg-muted)" }}>
            Pick a system below and watch it in the 3D viewer. Every one goes down over the same
            diamond-ground prep and cures harder than the concrete underneath it.
          </p>
        </div>

        {show3d ? (
          <div className="mb-10">
            <FloorViewer3D tint={active.tint} />
          </div>
        ) : (
          <div
            className="mb-10 w-full h-[380px] md:h-[440px] rounded-2xl flex items-center justify-center"
            style={{ background: `radial-gradient(circle at 50% 30%, rgba(${active.tint},0.25), var(--brand-bg-mid))` }}
          >
            <span style={{ color: "var(--brand-fg-muted)" }}>{active.name}</span>
          </div>
        )}

        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FINISHES.map((finish, i) => (
            <FinishCard
              key={finish.name}
              finish={finish}
              active={i === activeIndex}
              onSelect={() => setActiveIndex(i)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function FinishCard({ finish, active, onSelect }: { finish: Finish; active: boolean; onSelect: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const glareRef = useRef<HTMLDivElement>(null)

  useLiquidShimmer(canvasRef, finish.tint)

  useGSAP(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced || !imgRef.current) return
    gsap.fromTo(
      imgRef.current,
      { clipPath: "inset(0 100% 0 0)" },
      {
        clipPath: "inset(0 0% 0 0)",
        duration: 1.1,
        ease: "power4.inOut",
        scrollTrigger: { trigger: cardRef.current, start: "top 85%", once: true },
      },
    )
  }, { scope: cardRef })

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = cardRef.current!.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    cardRef.current!.style.setProperty("--mx", `${x}%`)
    cardRef.current!.style.setProperty("--my", `${y}%`)
    if (glareRef.current) glareRef.current.style.opacity = "1"
  }
  function onLeave() {
    if (glareRef.current) glareRef.current.style.opacity = "0"
  }

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      className="finish-card tilt-3d group relative rounded-2xl overflow-hidden hover-lift cursor-pointer focus-visible:outline-none"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect() } }}
      style={{
        border: active ? "2px solid var(--brand-accent)" : "1px solid var(--brand-card-border)",
        boxShadow: active ? "var(--shadow-cta)" : "var(--shadow-card)",
        background: "var(--brand-card-bg)",
      }}
    >
      <div className="relative h-56 overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />
        <img
          ref={imgRef}
          src={finish.image}
          alt={`${finish.name} epoxy floor finish`}
          className="absolute inset-0 w-full h-full object-cover mix-blend-luminosity opacity-80 transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div
          ref={glareRef}
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300"
          style={{
            background: "radial-gradient(circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.45), transparent 55%)",
            mixBlendMode: "overlay",
          }}
        />
      </div>
      <div className="relative z-10 p-5">
        <h3 className="font-display font-700 text-lg" style={{ color: "var(--brand-fg)" }}>
          {finish.name}
        </h3>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--brand-fg-muted)" }}>
          {finish.tagline}
        </p>
      </div>
    </div>
  )
}

/** Slow drifting blurred color blobs behind each card — simulates light moving under a poured glass finish. */
function useLiquidShimmer(ref: React.RefObject<HTMLCanvasElement | null>, tint: string) {
  const reduced = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let w = (canvas.width = canvas.offsetWidth)
    let h = (canvas.height = canvas.offsetHeight)

    const blobs = Array.from({ length: 3 }, (_, i) => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: w * (0.35 + i * 0.08),
    }))

    function drawFrame() {
      ctx!.clearRect(0, 0, w, h)
      ctx!.globalCompositeOperation = "lighter"
      for (const b of blobs) {
        const grad = ctx!.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
        grad.addColorStop(0, `rgba(${tint},0.35)`)
        grad.addColorStop(1, `rgba(${tint},0)`)
        ctx!.fillStyle = grad
        ctx!.fillRect(0, 0, w, h)
      }
      ctx!.globalCompositeOperation = "source-over"
    }

    if (reduced) {
      drawFrame()
      return
    }

    let raf = 0
    let running = true
    function tick() {
      if (!running) return
      for (const b of blobs) {
        b.x += b.vx
        b.y += b.vy
        if (b.x < 0 || b.x > w) b.vx *= -1
        if (b.y < 0 || b.y > h) b.vy *= -1
      }
      drawFrame()
      raf = requestAnimationFrame(tick)
    }

    const io = new IntersectionObserver(([entry]) => {
      running = entry.isIntersecting
      if (running && !raf) tick()
    })
    io.observe(canvas)

    const resize = () => {
      w = canvas.width = canvas.offsetWidth
      h = canvas.height = canvas.offsetHeight
    }
    window.addEventListener("resize", resize)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener("resize", resize)
    }
  }, [ref, reduced, tint])
}
