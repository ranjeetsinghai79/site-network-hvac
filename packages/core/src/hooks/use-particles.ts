"use client"

import { useEffect } from "react"
import { useReducedMotion } from "./use-reduced-motion"

interface Options {
  count?: number
  speedRange?: number
  radiusRange?: [number, number]
  opacityRange?: [number, number]
  colorVar?: string
}

export function useParticles(
  ref: React.RefObject<HTMLCanvasElement | null>,
  options?: Options,
) {
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const color =
      getComputedStyle(document.documentElement)
        .getPropertyValue(options?.colorVar ?? "--brand-particle")
        .trim() || "rgba(255,255,255,0.4)"

    let w = (canvas.width = canvas.offsetWidth)
    let h = (canvas.height = canvas.offsetHeight)

    const count = options?.count ?? 50
    const speed = options?.speedRange ?? 0.25
    const [rMin, rMax] = options?.radiusRange ?? [0.3, 1.7]
    const [oMin, oMax] = options?.opacityRange ?? [0.1, 0.5]

    const pts = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.5) * speed,
      r: Math.random() * (rMax - rMin) + rMin,
      o: Math.random() * (oMax - oMin) + oMin,
    }))

    let raf = 0
    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      for (const p of pts) {
        p.x = (p.x + p.vx + w) % w
        p.y = (p.y + p.vy + h) % h
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.globalAlpha = p.o
        ctx.fill()
        ctx.globalAlpha = 1
      }
      raf = requestAnimationFrame(draw)
    }
    draw()

    const resize = () => {
      w = canvas.width = canvas.offsetWidth
      h = canvas.height = canvas.offsetHeight
    }
    window.addEventListener("resize", resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
    }
  }, [ref, reduced, options?.count, options?.speedRange, options?.radiusRange, options?.opacityRange, options?.colorVar])
}
