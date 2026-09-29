"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"

const links = [
  { label: "Menu", href: "/menu" },
  { label: "About", href: "#about" },
  { label: "Specials", href: "#specials" },
  { label: "Contact", href: "#contact" },
]

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <motion.header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-surface-900/95 backdrop-blur-md shadow-lg shadow-black/40 border-b border-panel/50"
          : "bg-transparent"
      }`}
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <a
          href="#"
          className="font-display text-xl tracking-widest text-gold-500 hover:text-gold-400 transition-colors duration-200 cursor-pointer"
        >
          MINERVA GRAND
        </a>

        <nav className="hidden md:flex items-center gap-8">
          {links.map((item) => (
            item.href.startsWith("/") ? (
              <Link
                key={item.label}
                href={item.href}
                className="text-cream/70 hover:text-gold-400 transition-colors duration-200 text-sm tracking-wide font-body cursor-pointer"
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.label}
                href={item.href}
                className="text-cream/70 hover:text-gold-400 transition-colors duration-200 text-sm tracking-wide font-body cursor-pointer"
              >
                {item.label}
              </a>
            )
          ))}
        </nav>

        <a
          href="https://www.clover.com/online-ordering/minervagrand-tracy"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:inline-flex items-center bg-gold-500 hover:bg-gold-400 text-surface-900 font-semibold text-sm px-5 py-2.5 rounded-full transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
        >
          Order Online
        </a>

        <button
          onClick={() => setOpen(!open)}
          className="md:hidden p-2 cursor-pointer text-cream"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          <span className={`block w-5 h-0.5 bg-current transition-all duration-300 ${open ? "rotate-45 translate-y-1.5" : ""}`} />
          <span className={`block w-5 h-0.5 bg-current my-1.5 transition-all duration-300 ${open ? "opacity-0 scale-x-0" : ""}`} />
          <span className={`block w-5 h-0.5 bg-current transition-all duration-300 ${open ? "-rotate-45 -translate-y-1.5" : ""}`} />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="md:hidden overflow-hidden bg-surface-800/98 backdrop-blur-md border-t border-panel/50"
          >
            <div className="px-6 py-5 flex flex-col gap-4">
              {links.map((item) =>
                item.href.startsWith("/") ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="text-cream/80 hover:text-gold-400 transition-colors py-1.5 text-base font-body cursor-pointer"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="text-cream/80 hover:text-gold-400 transition-colors py-1.5 text-base font-body cursor-pointer"
                  >
                    {item.label}
                  </a>
                )
              )}
              <a
                href="https://www.clover.com/online-ordering/minervagrand-tracy"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 bg-gold-500 hover:bg-gold-400 text-surface-900 font-semibold text-sm px-5 py-3.5 rounded-full text-center cursor-pointer transition-colors duration-200"
              >
                Order Online
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
