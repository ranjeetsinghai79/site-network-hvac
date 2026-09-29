"use client"

import { motion } from "framer-motion"
import Image from "next/image"

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
  visible: { transition: { staggerChildren: 0.1 } },
}

// Blur-lift reveal — each image emerges from blur + scale
const blurReveal = {
  hidden: { opacity: 0, scale: 0.88, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: EASE },
  },
}

const gridStagger = {
  visible: { transition: { staggerChildren: 0.07 } },
}

const posts = [
  {
    src: "https://static.wixstatic.com/media/97cecd_8861e5d9f1e34b2eb1c78b13299a840f~mv2.jpg",
    alt: "Masala Mirchi Bajji — crispy fried peppers",
    caption: "Masala Mirchi Bajji",
  },
  {
    src: "https://static.wixstatic.com/media/97cecd_a58a675827ec48139dbc221e8d44d1f6~mv2.jpg",
    alt: "Dragon Chicken — spicy Indo-Chinese",
    caption: "Dragon Chicken",
  },
  {
    src: "https://static.wixstatic.com/media/97cecd_c614729ac4704da1ae1c4b3d67e74fa2~mv2.jpg",
    alt: "Apollo Fish — signature crispy fish",
    caption: "Apollo Fish",
  },
  {
    src: "https://static.wixstatic.com/media/97cecd_33aee7c943eb45c58a5bb9b92f5ed086~mv2.jpg",
    alt: "Dragon Paneer — Indo-Chinese paneer",
    caption: "Dragon Paneer",
  },
  {
    src: "https://static.wixstatic.com/media/97cecd_7202af5c717b402a803f5374477f6945~mv2.jpg",
    alt: "Goat Chops — tender grilled goat",
    caption: "Goat Chops",
  },
  {
    src: "https://static.wixstatic.com/media/97cecd_a78a8d562d684d2889c4915d61e99d34~mv2.jpg",
    alt: "Masala Dosa — crispy South Indian crepe",
    caption: "Masala Dosa",
  },
]

export default function Gallery() {
  return (
    <section className="py-24 px-6 bg-surface-900">
      <div className="max-w-6xl mx-auto">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="flex flex-col items-center mb-12"
        >
          <motion.span variants={fadeUp} className="text-gold-500 text-xs tracking-[0.4em] uppercase font-body mb-4">
            @minervagrand_tracy
          </motion.span>
          <div className="overflow-hidden">
            <motion.h2 variants={maskReveal} className="font-display text-4xl md:text-5xl text-cream text-center">
              Follow Our Journey
            </motion.h2>
          </div>
          <motion.div variants={fadeUp} className="w-16 h-px bg-gold-500 mt-6" />
        </motion.div>

        <motion.div
          variants={gridStagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-2 md:grid-cols-3 gap-3"
        >
          {posts.map((post, i) => (
            <motion.a
              key={i}
              href="https://www.instagram.com/minervagrand_tracy"
              target="_blank"
              rel="noopener noreferrer"
              variants={blurReveal}
              whileHover={{ scale: 1.03 }}
              transition={{ duration: 0.2 }}
              className="group relative aspect-square overflow-hidden rounded-xl cursor-pointer block"
            >
              <Image
                src={post.src}
                alt={post.alt}
                fill
                sizes="(max-width: 768px) 50vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-surface-900/0 group-hover:bg-surface-900/55 transition-all duration-300 flex items-end p-4">
                <span className="text-cream text-sm font-body leading-snug opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-2 group-hover:translate-y-0">
                  {post.caption}
                </span>
              </div>
            </motion.a>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, ease: EASE, delay: 0.3 }}
          className="flex justify-center mt-10"
        >
          <a
            href="https://www.instagram.com/minervagrand_tracy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-gold-500/40 hover:border-gold-500 text-gold-500 hover:text-gold-400 hover:bg-gold-500/10 font-medium px-8 py-3.5 rounded-full text-sm tracking-wide transition-all duration-200 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden>
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
            Follow on Instagram
          </a>
        </motion.div>
      </div>
    </section>
  )
}
