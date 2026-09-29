"use client"

import { useRef, useEffect, useState } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import ScrollTrigger from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger, useGSAP)

interface ScrollSequenceHeroProps {
  frameCount: number
  framePath?: (index: number) => string
  headline?: string
  subline?: string
}

const defaultFramePath = (i: number) =>
  `/frames/frame_${String(i + 1).padStart(4, "0")}.jpg`

export function ScrollSequenceHero({
  frameCount,
  framePath = defaultFramePath,
  headline = "Scroll to begin",
  subline = "A cinematic experience, one frame at a time",
}: ScrollSequenceHeroProps) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef(0)
  const imagesRef = useRef<HTMLImageElement[]>([])
  const [loaded, setLoaded] = useState(0)

  function drawFrame(index: number) {
    const canvas = canvasRef.current
    const img = imagesRef.current[index]
    if (!canvas || !img || !img.complete) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
    }
    ctx.drawImage(img, 0, 0)
  }

  useEffect(() => {
    const images: HTMLImageElement[] = []
    let done = 0
    for (let i = 0; i < frameCount; i++) {
      const img = new Image()
      img.src = framePath(i)
      img.onload = () => {
        done++
        setLoaded(done)
        if (i === 0) drawFrame(0)
      }
      images[i] = img
    }
    imagesRef.current = images
  }, [frameCount, framePath])

  useGSAP(
    () => {
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      if (prefersReduced) {
        drawFrame(frameCount - 1)
        return
      }

      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "+=250%",
        pin: true,
        scrub: 0.5,
        onUpdate: (self) => {
          const frame = Math.min(
            frameCount - 1,
            Math.round(self.progress * (frameCount - 1)),
          )
          if (frame !== frameRef.current) {
            frameRef.current = frame
            drawFrame(frame)
          }
          if (overlayRef.current) {
            gsap.set(overlayRef.current, {
              opacity: 1 - Math.min(1, self.progress * 2.5),
            })
          }
        },
      })
    },
    { scope: sectionRef, dependencies: [frameCount] },
  )

  const pct = Math.round((loaded / frameCount) * 100)

  return (
    <section ref={sectionRef} className="relative h-screen overflow-hidden" style={{ background: "var(--color-brand-bg, #0c0a09)" }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.45) 100%)",
        }}
      />
      <div
        ref={overlayRef}
        className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center"
      >
        <h1
          className="max-w-3xl text-5xl font-800 leading-tight md:text-7xl"
          style={{
            color: "#fff",
            fontFamily: "var(--font-display, serif)",
            textShadow: "0 2px 24px rgba(0,0,0,0.5)",
          }}
        >
          {headline}
        </h1>
        <p
          className="mt-5 max-w-xl text-lg md:text-xl"
          style={{ color: "rgba(255,255,255,0.85)", textShadow: "0 1px 12px rgba(0,0,0,0.5)" }}
        >
          {subline}
        </p>
        {pct < 100 && (
          <p className="mt-8 text-sm tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>
            LOADING {pct}%
          </p>
        )}
        {pct >= 100 && (
          <div className="mt-10 flex flex-col items-center gap-2">
            <span className="text-xs uppercase tracking-[0.3em]" style={{ color: "rgba(255,255,255,0.7)" }}>
              Scroll
            </span>
            <span
              className="block h-10 w-px animate-pulse"
              style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.8), transparent)" }}
            />
          </div>
        )}
      </div>
    </section>
  )
}
