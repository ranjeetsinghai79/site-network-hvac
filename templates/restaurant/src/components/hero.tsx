"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { config } from "@/lib/config"

const TOTAL_FRAMES = 192

function pad(n: number) {
  return String(n).padStart(4, "0")
}

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imagesRef = useRef<(HTMLImageElement | null)[]>(Array(TOTAL_FRAMES).fill(null))
  const currentFrameRef = useRef(0)
  const [firstFrameReady, setFirstFrameReady] = useState(false)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  })

  // ── Draw ───────────────────────────────────────────────────
  const drawFrame = useCallback((index: number) => {
    const canvas = canvasRef.current
    const img = imagesRef.current[index]
    if (!canvas || !img?.complete || img.naturalWidth === 0) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const cw = canvas.width, ch = canvas.height
    const iw = img.naturalWidth, ih = img.naturalHeight
    const scale = Math.max(cw / iw, ch / ih)
    const sw = iw * scale, sh = ih * scale
    ctx.drawImage(img, (cw - sw) / 2, (ch - sh) / 2, sw, sh)
  }, [])

  // ── Resize ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const setSize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
      drawFrame(currentFrameRef.current)
    }
    const ro = new ResizeObserver(setSize)
    ro.observe(canvas)
    setSize()
    return () => ro.disconnect()
  }, [drawFrame])

  // ── Load ───────────────────────────────────────────────────
  useEffect(() => {
    const imgs = imagesRef.current
    function load(i: number) {
      const img = new Image()
      img.src = `/frames/frame_${pad(i + 1)}.jpg`
      img.onload = () => {
        imgs[i] = img
        if (i === 0) { setFirstFrameReady(true); drawFrame(0) }
      }
    }
    load(0)
    const t = setTimeout(() => { for (let i = 1; i < TOTAL_FRAMES; i++) load(i) }, 200)
    return () => { clearTimeout(t); imagesRef.current = Array(TOTAL_FRAMES).fill(null) }
  }, [drawFrame])

  // ── Scroll → frame (video plays 0–50% of scroll, holds after) ──
  useEffect(() => {
    return scrollYProgress.on("change", (v) => {
      const progress = Math.min(v / 0.5, 1)
      const index = Math.min(Math.round(progress * (TOTAL_FRAMES - 1)), TOTAL_FRAMES - 1)
      if (index === currentFrameRef.current) return
      currentFrameRef.current = index
      if (imagesRef.current[index]?.complete) {
        requestAnimationFrame(() => drawFrame(index))
      } else {
        for (let d = 1; d < 30; d++) {
          const fi = Math.max(0, index - d)
          if (imagesRef.current[fi]?.complete) {
            requestAnimationFrame(() => drawFrame(fi))
            break
          }
        }
      }
    })
  }, [scrollYProgress, drawFrame])

  // ── Scroll-driven transforms ───────────────────────────────

  // Cinematic letterbox bars close open in first 8% of scroll
  const letterboxH = useTransform(scrollYProgress, [0, 0.08], ["10vh", "0vh"])

  // Chapter 1 — "Minerva Grand" hero title
  // Fade in: 0–0.05 | Hold: 0.05–0.22 | Slide up + fade: 0.22–0.32
  const ch1Opacity = useTransform(scrollYProgress, [0, 0.05, 0.22, 0.32], [0, 1, 1, 0])
  const ch1Y = useTransform(scrollYProgress, [0, 0.05, 0.22, 0.32], ["2rem", "0rem", "0rem", "-5rem"])
  const titleScale = useTransform(scrollYProgress, [0, 0.20], [0.94, 1.02])

  // Chapter 2 — floating callout cards
  // Left card: slide in from left
  const card1X = useTransform(scrollYProgress, [0.27, 0.36, 0.52, 0.60], ["-8rem", "0rem", "0rem", "8rem"])
  const card1O = useTransform(scrollYProgress, [0.27, 0.36, 0.52, 0.60], [0, 1, 1, 0])
  // Right card: slide in from right, 40ms stagger
  const card2X = useTransform(scrollYProgress, [0.30, 0.39, 0.52, 0.60], ["8rem", "0rem", "0rem", "-8rem"])
  const card2O = useTransform(scrollYProgress, [0.30, 0.39, 0.52, 0.60], [0, 1, 1, 0])
  // Bottom card: rise from below
  const card3Y = useTransform(scrollYProgress, [0.33, 0.42, 0.52, 0.60], ["5rem", "0rem", "0rem", "5rem"])
  const card3O = useTransform(scrollYProgress, [0.33, 0.42, 0.52, 0.60], [0, 1, 1, 0])

  // Chapter 3 — CTA block
  // Enter: 0.60–0.70 | Hold: 0.70–0.90 | Exit: 0.90–0.97
  const ch3Opacity = useTransform(scrollYProgress, [0.60, 0.70, 0.90, 0.97], [0, 1, 1, 0])
  const ch3Y = useTransform(scrollYProgress, [0.60, 0.70], ["4rem", "0rem"])

  // Dark scrim intensifies for chapter 3
  const darkScrim = useTransform(scrollYProgress, [0.52, 0.68], [0, 0.6])

  // Final fade to black before next section
  const exitBlack = useTransform(scrollYProgress, [0.94, 1.0], [0, 1])

  return (
    <section ref={sectionRef} className="relative min-h-[600vh]">
      <div className="sticky top-0 h-screen min-h-[640px] overflow-hidden bg-surface-900">

        {/* Canvas — biryani frames */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden />

        {/* Spinner until frame 0 ready */}
        {!firstFrameReady && (
          <div className="absolute inset-0 bg-surface-900 flex items-center justify-center z-50">
            <div className="w-10 h-10 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
          </div>
        )}

        {/* Base cinematic gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/10 to-black pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-transparent to-black/25 pointer-events-none" />

        {/* Film grain */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: "256px 256px",
          }}
          aria-hidden
        />

        {/* Ch3 dark scrim */}
        <motion.div
          className="absolute inset-0 bg-surface-900 pointer-events-none"
          style={{ opacity: darkScrim }}
          aria-hidden
        />

        {/* Exit — fade to black */}
        <motion.div
          className="absolute inset-0 bg-surface-900 pointer-events-none z-40"
          style={{ opacity: exitBlack }}
          aria-hidden
        />

        {/* Letterbox — top */}
        <motion.div
          className="absolute top-0 left-0 right-0 bg-surface-900 z-30 origin-top"
          style={{ height: letterboxH }}
          aria-hidden
        />
        {/* Letterbox — bottom */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 bg-surface-900 z-30 origin-bottom"
          style={{ height: letterboxH }}
          aria-hidden
        />

        {/* ── CHAPTER 1 — Minerva Grand ──────────────────── */}
        <motion.div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center pointer-events-none"
          style={{ opacity: ch1Opacity, y: ch1Y }}
        >
          <motion.span
            className="text-gold-400 text-[0.6rem] tracking-[0.55em] uppercase font-body font-medium mb-8 block"
            style={{ scale: titleScale }}
          >
            {config.business.tagline} · {config.business.city}
          </motion.span>
          <motion.h1
            className="font-display text-[5rem] sm:text-[7rem] md:text-[10rem] lg:text-[12rem] text-cream leading-[0.88] tracking-tight"
            style={{ scale: titleScale }}
          >
            {config.business.name.split(" ").map((word, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {word}
              </span>
            ))}
          </motion.h1>
          <motion.div
            className="w-24 h-px bg-gradient-to-r from-transparent via-gold-500 to-transparent mt-10"
            style={{ scale: titleScale }}
          />
          <motion.p
            className="font-body text-base md:text-lg text-cream/55 max-w-sm leading-relaxed mt-5"
            style={{ scale: titleScale }}
          >
            Fragrant biryanis. Rich curries. Crispy dosas.
          </motion.p>
        </motion.div>

        {/* ── CHAPTER 2 — Specials callout cards ─────────── */}

        {/* Left — Wednesday Biryani */}
        <motion.div
          className="absolute left-6 md:left-14 lg:left-20 top-1/2 -translate-y-1/2 z-10 pointer-events-none"
          style={{ x: card1X, opacity: card1O }}
        >
          <div className="border border-gold-500/35 bg-surface-900/65 backdrop-blur-md rounded-2xl px-6 py-5 w-[200px]">
            <p className="text-gold-500 text-[0.55rem] tracking-[0.4em] uppercase font-body mb-3">Every Wednesday</p>
            <p className="font-display text-cream text-xl leading-tight mb-2">Biryani Day</p>
            <p className="text-gold-400 font-display text-4xl">$9.99</p>
            <p className="text-muted text-xs font-body mt-2 leading-snug">6 varieties · All day · Takeout</p>
          </div>
        </motion.div>

        {/* Right — Saturday Buffet */}
        <motion.div
          className="absolute right-6 md:right-14 lg:right-20 top-1/2 -translate-y-1/2 z-10 pointer-events-none"
          style={{ x: card2X, opacity: card2O }}
        >
          <div className="border border-gold-500/35 bg-surface-900/65 backdrop-blur-md rounded-2xl px-6 py-5 w-[200px]">
            <p className="text-gold-500 text-[0.55rem] tracking-[0.4em] uppercase font-body mb-3">Every Saturday</p>
            <p className="font-display text-cream text-xl leading-tight mb-2">Grand Lunch Buffet</p>
            <p className="text-gold-400 font-display text-4xl">$17.99</p>
            <p className="text-muted text-xs font-body mt-2 leading-snug">11:30 AM – 3:00 PM</p>
          </div>
        </motion.div>

        {/* Bottom — Sunday Feast */}
        <motion.div
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
          style={{ y: card3Y, opacity: card3O }}
        >
          <div className="border border-gold-500/35 bg-surface-900/65 backdrop-blur-md rounded-2xl px-8 py-4 flex items-center gap-8 whitespace-nowrap">
            <div className="text-center">
              <p className="text-gold-500 text-[0.55rem] tracking-[0.4em] uppercase font-body mb-1">Every Sunday</p>
              <p className="font-display text-cream text-lg">Royal Sunday Feast</p>
            </div>
            <div className="w-px h-10 bg-gold-500/25" />
            <div className="text-center">
              <p className="text-gold-400 font-display text-4xl">$17.99</p>
              <p className="text-muted text-xs font-body mt-1">11:30 AM – 3:00 PM</p>
            </div>
          </div>
        </motion.div>

        {/* ── CHAPTER 3 — CTA ────────────────────────────── */}
        <motion.div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center"
          style={{ opacity: ch3Opacity, y: ch3Y }}
        >
          <p className="text-gold-400 text-[0.6rem] tracking-[0.55em] uppercase font-body mb-8">
            Tracy, California
          </p>
          <h2 className="font-display text-[3.5rem] sm:text-[5rem] md:text-[7rem] lg:text-[9rem] text-cream leading-[0.9] tracking-tight mb-12">
            Order.
            <br />
            <span className="text-gold-500">Taste.</span>
            <br />
            Return.
          </h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="https://www.clover.com/online-ordering/minervagrand-tracy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-gold-500 hover:bg-gold-400 text-surface-900 font-semibold px-10 py-4 rounded-full text-sm tracking-wide transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 shadow-lg shadow-gold-500/25"
            >
              Order Online
            </a>
            <a
              href="/menu"
              className="inline-flex items-center justify-center border border-cream/25 hover:border-gold-500/60 text-cream hover:text-gold-400 font-medium px-10 py-4 rounded-full text-sm tracking-wide transition-all duration-200 cursor-pointer hover:bg-gold-500/10 backdrop-blur-sm"
            >
              Explore Menu
            </a>
          </div>
        </motion.div>

        {/* Scroll indicator — ch1 only */}
        <motion.div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10 pointer-events-none"
          style={{ opacity: ch1Opacity }}
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          aria-hidden
        >
          <span className="text-muted text-[0.6rem] tracking-widest font-body uppercase">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-gold-500/60 to-transparent" />
        </motion.div>
      </div>
    </section>
  )
}
