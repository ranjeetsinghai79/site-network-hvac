import { config } from "@/lib/config"

const links = ["Menu", "About", "Specials", "Contact"]

export default function Footer() {
  return (
    <footer className="bg-surface-950 border-t border-panel py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-10">
          <div className="flex flex-col items-center md:items-start">
            <span className="font-display text-xl text-gold-500 tracking-widest uppercase">{config.business.name}</span>
            <p className="text-muted text-sm font-body mt-1.5">{config.business.tagline} · {config.business.city}</p>
            <p className="text-muted/60 text-sm font-body mt-1">
              <a href={config.business.phoneHref} className="hover:text-gold-400 transition-colors cursor-pointer">
                {config.business.phone}
              </a>
            </p>
          </div>

          <nav className="flex items-center gap-8" aria-label="Footer navigation">
            {links.map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-muted hover:text-gold-400 transition-colors text-sm font-body cursor-pointer"
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <a
              href={config.business.social?.instagram ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full border border-panel hover:border-gold-500/50 flex items-center justify-center text-muted hover:text-gold-500 transition-all duration-200 cursor-pointer"
              aria-label={`${config.business.name} on Instagram`}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden>
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>
            <a
              href={config.business.phoneHref}
              className="w-9 h-9 rounded-full border border-panel hover:border-gold-500/50 flex items-center justify-center text-muted hover:text-gold-500 transition-all duration-200 cursor-pointer"
              aria-label={`Call ${config.business.name}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
            </a>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-panel/60 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-muted/60 text-xs font-body">
            © {new Date().getFullYear()} {config.business.name}. All rights reserved.
          </p>
          <p className="text-muted/40 text-xs font-body">{config.business.city} · {config.business.tagline}</p>
        </div>
      </div>
    </footer>
  )
}
