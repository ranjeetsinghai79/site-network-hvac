"use client"

import { config } from "@/lib/config"

export default function BrandStorySection() {
  const chapters = config.brandStoryChapters ?? []

  return (
    <section aria-label="Brand story" className="relative">
      {chapters.map((c) => (
        <div
          key={c.index}
          className="min-h-screen flex flex-col px-6 py-24"
          style={{ background: c.bg, color: c.fg }}
        >
          <p
            className="text-xs font-bold uppercase tracking-[0.2em] mb-2"
            style={{ color: c.bg === "var(--brand-accent)" ? "#fff" : "var(--brand-accent)" }}
          >
            {c.index} — {c.label}
          </p>
          <hr className="my-[2vw] border-t opacity-30" style={{ borderColor: "currentColor" }} />
          <h2
            className="font-display uppercase tracking-tight"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(3rem, 11vw, 12rem)",
              lineHeight: 0.85,
              fontWeight: 800,
            }}
          >
            {c.heading.split(" ").map((word, i) => (
              <span key={i} className="block">{word}</span>
            ))}
          </h2>
          <hr className="my-[2vw] border-t opacity-30" style={{ borderColor: "currentColor" }} />
          <p
            className="mt-auto max-w-[50ch] font-normal leading-relaxed"
            style={{ fontSize: "clamp(1rem, 2.5vw, 2rem)", opacity: 0.85 }}
          >
            {c.body}
          </p>
          {c.items && (
            <>
              <hr className="my-[2vw] border-t opacity-30" style={{ borderColor: "currentColor" }} />
              <div className="flex flex-wrap gap-[3vw]">
                {c.items.map((item) => (
                  <div key={item.n} className="min-w-[180px] flex-1">
                    <p
                      className="mb-2 text-sm font-bold uppercase tracking-wider"
                      style={{ color: c.bg === "var(--brand-accent)" ? "#fff" : "var(--brand-accent)" }}
                    >
                      {item.n} — {item.title}
                    </p>
                    <p
                      className="leading-relaxed opacity-75"
                      style={{ fontSize: "clamp(0.85rem, 1.3vw, 1.05rem)" }}
                    >
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </section>
  )
}
