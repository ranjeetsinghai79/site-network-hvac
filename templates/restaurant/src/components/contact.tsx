"use client"

import { motion } from "framer-motion"
import { config } from "@/lib/config"

const EASE = [0.25, 0.46, 0.45, 0.94] as const

const maskReveal = {
  hidden: { y: "105%" },
  visible: { y: "0%", transition: { duration: 0.85, ease: EASE } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 45 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
}

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
}

// Hours rows reveal left-to-right with a line width expand
const rowReveal = {
  hidden: { opacity: 0, x: -30 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.55, ease: EASE, delay: i * 0.08 },
  }),
}

const hours = [
  { day: "Monday – Thursday", time: "11:30 AM – 9:30 PM" },
  { day: "Friday", time: "11:30 AM – 10:30 PM" },
  { day: "Saturday", time: "11:30 AM – 10:30 PM" },
  { day: "Sunday", time: "11:30 AM – 9:30 PM" },
]

function IconCircle({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-10 h-10 rounded-full bg-gold-500/10 border border-gold-500/30 flex items-center justify-center shrink-0 text-gold-500">
      {children}
    </div>
  )
}

export default function Contact() {
  return (
    <section id="contact" className="py-24 px-6 bg-surface-800 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-px bg-gradient-to-r from-transparent via-gold-500/40 to-transparent" aria-hidden />

      <div className="max-w-6xl mx-auto">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="flex flex-col items-center mb-16"
        >
          <motion.span variants={fadeUp} className="text-gold-500 text-xs tracking-[0.4em] uppercase font-body mb-4">
            Find Us
          </motion.span>
          <div className="overflow-hidden">
            <motion.h2 variants={maskReveal} className="font-display text-4xl md:text-5xl text-cream text-center">
              Visit Us
            </motion.h2>
          </div>
          <motion.div variants={fadeUp} className="w-16 h-px bg-gold-500 mt-6" />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.div variants={fadeUp} className="mb-10">
              <h3 className="font-display text-xl text-gold-500 mb-5">Hours</h3>
              <div className="space-y-0">
                {hours.map((h, i) => (
                  <motion.div
                    key={h.day}
                    variants={rowReveal}
                    custom={i}
                    className="flex justify-between items-center py-3.5 border-b border-panel/60"
                  >
                    <span className="text-cream/75 font-body text-sm">{h.day}</span>
                    <span className="text-cream font-body text-sm font-medium">{h.time}</span>
                  </motion.div>
                ))}
              </div>
              <p className="text-muted/60 text-xs font-body mt-3">* Hours may vary on public holidays</p>
            </motion.div>

            <motion.div variants={stagger} className="space-y-5 mb-8">
              <motion.div variants={fadeUp} className="flex items-start gap-4">
                <IconCircle>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                  </svg>
                </IconCircle>
                <div>
                  <p className="text-cream/50 text-xs font-body mb-1 tracking-widest uppercase">Location</p>
                  <p className="text-cream font-body">{config.business.city}</p>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(config.business.name + " " + config.business.city)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold-500 text-sm hover:text-gold-400 transition-colors cursor-pointer"
                  >
                    Get Directions →
                  </a>
                </div>
              </motion.div>

              <motion.div variants={fadeUp} className="flex items-start gap-4">
                <IconCircle>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                  </svg>
                </IconCircle>
                <div>
                  <p className="text-cream/50 text-xs font-body mb-1 tracking-widest uppercase">Phone</p>
                  <a href="tel:+12092192950" className="text-cream hover:text-gold-400 transition-colors font-body cursor-pointer text-lg">
                    (209) 219-2950
                  </a>
                </div>
              </motion.div>

              <motion.div variants={fadeUp} className="flex items-start gap-4">
                <IconCircle>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden>
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </IconCircle>
                <div>
                  <p className="text-cream/50 text-xs font-body mb-1 tracking-widest uppercase">Instagram</p>
                  <a
                    href="https://www.instagram.com/minervagrand_tracy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cream hover:text-gold-400 transition-colors font-body cursor-pointer"
                  >
                    @minervagrand_tracy
                  </a>
                </div>
              </motion.div>
            </motion.div>

            <motion.div variants={fadeUp}>
              <a
                href="https://www.clover.com/online-ordering/minervagrand-tracy"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center bg-gold-500 hover:bg-gold-400 text-surface-900 font-semibold px-8 py-4 rounded-full text-sm tracking-wide transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 shadow-lg shadow-gold-500/20"
              >
                Order Online Now
              </a>
            </motion.div>
          </motion.div>

          {/* Map — slides in from right */}
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.85, ease: EASE }}
            className="rounded-2xl overflow-hidden border border-panel h-96 lg:h-full min-h-80"
          >
            <iframe
              src={`https://maps.google.com/maps?q=${encodeURIComponent(config.business.name + " " + config.business.city)}&output=embed`}
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: "320px", filter: "grayscale(20%) invert(90%) hue-rotate(180deg)" }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`${config.business.name} location`}
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
