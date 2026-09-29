"use client"

import { useRef } from "react"
import { useParticles } from "../hooks/use-particles"

interface Props {
  count?: number
  colorVar?: string
  className?: string
}

export function ParticleField({ count = 50, colorVar = "--brand-particle", className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  useParticles(ref, { count, colorVar })
  return (
    <canvas
      ref={ref}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className ?? ""}`}
      aria-hidden
    />
  )
}
