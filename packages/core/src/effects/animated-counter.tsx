"use client"

import { useRef } from "react"
import { useCounter } from "../hooks/use-counter"

interface Props {
  to: number
  decimals?: number
  suffix?: string
  prefix?: string
  duration?: number
  className?: string
  style?: React.CSSProperties
}

export function AnimatedCounter({ to, decimals, suffix, prefix, duration, className, style }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  useCounter(ref, { to, decimals, suffix, prefix, duration })
  return (
    <span ref={ref} className={className} style={style}>
      0{suffix ?? ""}
    </span>
  )
}
