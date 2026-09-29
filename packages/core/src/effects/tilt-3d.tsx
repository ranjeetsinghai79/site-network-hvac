"use client"

import { useRef } from "react"
import { useTilt } from "../hooks/use-tilt"

interface Props {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function Tilt3D({ children, className, style }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  useTilt(wrapRef, { selector: ".tilt-3d-inner" })

  return (
    <div ref={wrapRef}>
      <div
        ref={cardRef}
        className={`tilt-3d-inner ${className ?? ""}`}
        style={style}
      >
        {children}
      </div>
    </div>
  )
}
