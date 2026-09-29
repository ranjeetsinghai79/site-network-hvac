"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { config } from "@/lib/config"

export default function RestaurantLoadingScreen() {
  const [visible, setVisible] = useState(true)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    document.body.style.overflow = "hidden"
    const start = performance.now()
    const duration = 1800

    const raf = requestAnimationFrame(function tick(now) {
      const p = Math.min((now - start) / duration, 1)
      setProgress(p)
      if (p < 1) requestAnimationFrame(tick)
      else {
        setTimeout(() => {
          setVisible(false)
          document.body.style.overflow = ""
        }, 200)
      }
    })

    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{ background: "#070504" }}
          exit={{ y: "-100%", transition: { duration: 0.75, ease: [0.76, 0, 0.24, 1] } }}
        >
          {/* Aurora blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div style={{ position: "absolute", top: "25%", left: "20%", width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(232,184,75,0.14) 0%, transparent 70%)", filter: "blur(64px)", animation: "ls-blob-a 6s ease-in-out infinite alternate" }} />
            <div style={{ position: "absolute", bottom: "20%", right: "18%", width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(193,68,14,0.10) 0%, transparent 70%)", filter: "blur(64px)", animation: "ls-blob-b 8s ease-in-out infinite alternate" }} />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } }}
            className="relative z-10 text-center"
          >
            <p style={{ fontFamily: "'Karla', sans-serif", fontSize: "0.65rem", letterSpacing: "0.3em", color: "#E8B84B", textTransform: "uppercase", marginBottom: "1rem", opacity: 0.8 }}>
              Fine Dining Experience
            </p>
            <h1 style={{ fontFamily: "'Playfair Display SC', serif", fontSize: "clamp(2.4rem, 6vw, 4rem)", fontWeight: 700, color: "#F5EDD8", letterSpacing: "0.05em", lineHeight: 1.1 }}>
              {config.business.name}
            </h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.4, duration: 0.5 } }}
              style={{ fontFamily: "'Karla', sans-serif", fontSize: "0.8rem", color: "#9A8A72", marginTop: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase" }}
            >
              {config.business.city}
            </motion.p>
          </motion.div>

          {/* Progress bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.6, duration: 0.4 } }}
            style={{ position: "relative", zIndex: 10, marginTop: "3.5rem", width: 200, height: 1, background: "rgba(232,184,75,0.15)", borderRadius: 1 }}
          >
            <motion.div
              style={{ position: "absolute", inset: 0, originX: 0, scaleX: progress, background: "linear-gradient(90deg, #E8B84B, #F0CB6D)", borderRadius: 1 }}
            />
          </motion.div>

          <style>{`
            @keyframes ls-blob-a { from { transform: translate(0,0) scale(1); } to { transform: translate(40px,-30px) scale(1.1); } }
            @keyframes ls-blob-b { from { transform: translate(0,0) scale(1); } to { transform: translate(-30px,40px) scale(1.08); } }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
