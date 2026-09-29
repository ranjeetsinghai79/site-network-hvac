"use client"

import { useScroll, useTransform, motion } from "framer-motion"

export default function RestaurantScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <motion.div
      style={{ scaleX, originX: 0 }}
      className="fixed top-0 left-0 right-0 z-[9998] h-[2px]"
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: 1.8 } }}
    >
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, #E8B84B, #F0CB6D, #E8B84B)", boxShadow: "0 0 8px rgba(232,184,75,0.6)" }} />
    </motion.div>
  )
}
