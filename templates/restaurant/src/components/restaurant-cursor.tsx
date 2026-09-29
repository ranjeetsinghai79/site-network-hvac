"use client"

import { useEffect, useRef } from "react"
import { motion, useMotionValue, useSpring } from "framer-motion"

export default function RestaurantCursor() {
  const cursorX = useMotionValue(-100)
  const cursorY = useMotionValue(-100)
  const springX = useSpring(cursorX, { stiffness: 300, damping: 28 })
  const springY = useSpring(cursorY, { stiffness: 300, damping: 28 })
  const isTouch = useRef(false)

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) { isTouch.current = true; return }
    const move = (e: MouseEvent) => { cursorX.set(e.clientX); cursorY.set(e.clientY) }
    window.addEventListener("mousemove", move)
    return () => window.removeEventListener("mousemove", move)
  }, [cursorX, cursorY])

  if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) return null

  return (
    <>
      <motion.div
        style={{ x: springX, y: springY, translateX: "-50%", translateY: "-50%", position: "fixed", top: 0, left: 0, zIndex: 9997, pointerEvents: "none", width: 28, height: 28, borderRadius: "50%", border: "1.5px solid rgba(232,184,75,0.6)", background: "rgba(232,184,75,0.06)", backdropFilter: "blur(2px)" }}
        aria-hidden
      />
      <motion.div
        style={{ x: cursorX, y: cursorY, translateX: "-50%", translateY: "-50%", position: "fixed", top: 0, left: 0, zIndex: 9997, pointerEvents: "none", width: 4, height: 4, borderRadius: "50%", background: "#E8B84B" }}
        aria-hidden
      />
    </>
  )
}
