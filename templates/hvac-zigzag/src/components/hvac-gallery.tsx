"use client"

import React, { useEffect, useRef, useState } from "react"
import { gsap } from "@core/web"
import type { SiteConfig } from "@core/web/types"

interface Props { config: SiteConfig }

interface GalleryPhoto { src: string; title: string; sub: string }

const PHOTOS: GalleryPhoto[] = [
  { src: "/gallery-1.jpg",  title: "Stocked & Ready",       sub: "Every truck, fully loaded" },
  { src: "/gallery-2.jpg",  title: "Thermostat Install",    sub: "Smart, precise setup" },
  { src: "/gallery-3.jpg",  title: "Condenser Tune-Up",     sub: "Backyard system check" },
  { src: "/gallery-4.jpg",  title: "Furnace Diagnostics",   sub: "No shortcuts, ever" },
  { src: "/gallery-5.jpg",  title: "Commercial HVAC",       sub: "Rooftop units, city-wide" },
  { src: "/gallery-6.jpg",  title: "Full System Checklist", sub: "Every visit, documented" },
  { src: "/gallery-7.jpg",  title: "On Our Way",            sub: "45-minute average response" },
  { src: "/gallery-8.jpg",  title: "Plumbing Repair",       sub: "Fixed in one visit" },
  { src: "/gallery-9.jpg",  title: "Burner Ignition",       sub: "Safety-checked heat" },
  { src: "/gallery-10.jpg", title: "Refrigerant Check",     sub: "Manifold gauge diagnostics" },
  { src: "/gallery-11.jpg", title: "Evening Call",          sub: "We answer around the clock" },
  { src: "/gallery-12.jpg", title: "Late-Night Diagnostics", sub: "Emergency service, done right" },
  { src: "/gallery-13.jpg", title: "New System Install",    sub: "Copper, done to code" },
  { src: "/gallery-14.jpg", title: "Evening Repair",        sub: "Same crew, every time" },
]

export default function HvacGallery({ config }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const headRef    = useRef<HTMLDivElement>(null)
  const stageRef   = useRef<HTMLDivElement>(null)

  const [rotation, setRotation] = useState(0)
  const isScrollingRef  = useRef(false)
  const scrollTimeout    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef           = useRef<number | null>(null)

  useEffect(() => {
    if (!headRef.current) return
    const ctx = gsap.context(() => {
      gsap.from(headRef.current, {
        opacity: 0, y: 30, duration: 0.7, ease: "power3.out",
        immediateRender: false,
        scrollTrigger: { trigger: headRef.current, start: "top 85%", once: true },
      })
    }, headRef)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) return

    const stage = stageRef.current
    if (!stage) return

    const handleScroll = () => {
      isScrollingRef.current = true
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current)

      const rect = stage.getBoundingClientRect()
      const total = rect.height + window.innerHeight
      const progress = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / total))
      setRotation(progress * 360)

      scrollTimeout.current = setTimeout(() => { isScrollingRef.current = false }, 150)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })

    const autoRotate = () => {
      if (!isScrollingRef.current) setRotation(prev => prev + 0.04)
      rafRef.current = requestAnimationFrame(autoRotate)
    }
    rafRef.current = requestAnimationFrame(autoRotate)

    return () => {
      window.removeEventListener("scroll", handleScroll)
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const anglePerItem = 360 / PHOTOS.length
  const radius = 460

  return (
    <section
      ref={sectionRef}
      id="gallery"
      className="relative py-24 lg:py-32 overflow-hidden"
      style={{ background: "var(--brand-bg)" }}
    >
      <div className="relative max-w-[1400px] mx-auto px-6 lg:px-12 xl:px-16">
        <div ref={headRef} className="mb-16 max-w-xl">
          <p className="section-label mb-3">On The Job</p>
          <h2
            className="font-display font-700"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 4.5vw, 3.6rem)",
              lineHeight: 1.02,
              color: "var(--brand-fg)",
              letterSpacing: "-0.02em",
            }}
          >
            Real work.
            <br />
            <span style={{ color: "var(--brand-accent)" }}>Real photos.</span>
          </h2>
        </div>
      </div>

      <div
        ref={stageRef}
        className="relative w-full flex items-center justify-center"
        style={{ height: "70vh", minHeight: 480, perspective: "2000px" }}
      >
        <div
          className="relative w-full h-full"
          style={{ transform: `rotateY(${rotation}deg)`, transformStyle: "preserve-3d" }}
        >
          {PHOTOS.map((photo, i) => {
            const itemAngle = i * anglePerItem
            const relative = (itemAngle + (rotation % 360) + 360) % 360
            const normalized = relative > 180 ? 360 - relative : relative
            const opacity = Math.max(0.25, 1 - normalized / 150)

            return (
              <div
                key={photo.src}
                className="absolute"
                style={{
                  width: 260,
                  height: 340,
                  left: "50%",
                  top: "50%",
                  marginLeft: -130,
                  marginTop: -170,
                  transform: `rotateY(${itemAngle}deg) translateZ(${radius}px)`,
                  opacity,
                  transition: "opacity 0.3s linear",
                }}
              >
                <div
                  className="relative w-full h-full rounded-xl overflow-hidden"
                  style={{
                    border: "1px solid rgba(255,255,255,0.12)",
                    boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
                  }}
                >
                  <img
                    src={photo.src}
                    alt={photo.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.85) 100%)" }}
                  />
                  <div className="absolute bottom-0 left-0 p-4">
                    <p
                      className="font-display font-700"
                      style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem", color: "#fff", lineHeight: 1.15 }}
                    >
                      {photo.title}
                    </p>
                    <p style={{ fontFamily: "var(--font-body)", fontSize: "0.7rem", color: "var(--brand-accent-light, var(--brand-accent))", marginTop: 2 }}>
                      {photo.sub}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="relative max-w-[1400px] mx-auto px-6 lg:px-12 xl:px-16 mt-12 text-center">
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--brand-fg-muted)" }}>
          Real jobs, real {config.business.city ?? "local"} crews — not stock photography.
        </p>
      </div>
    </section>
  )
}
