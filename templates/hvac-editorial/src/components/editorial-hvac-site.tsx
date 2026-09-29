"use client"

import { FormEvent, useRef, useState } from "react"
import { useGSAP } from "@gsap/react"
import { AnimatedCounter, AuroraBlobs, ImageReveal, ParticleField, SplitText, Tilt3D, gsap, useReducedMotion, useStaggerReveal, useTextReveal } from "@core/web"
import type { SiteConfig } from "@core/web/types"

gsap.registerPlugin(useGSAP)

function Heading({ children, light = false, className = "" }: { children: string; light?: boolean; className?: string }) {
  const ref = useRef<HTMLElement>(null)
  useTextReveal(ref, { start: "top 86%" })
  return <SplitText ref={ref} as="h2" className={`display ${className}`} style={{ color: light ? "var(--brand-fg)" : "var(--brand-ink)" }}>{children}</SplitText>
}

export function EditorialHvacSite({ config }: { config: SiteConfig }) {
  const { business } = config
  const services = config.services ?? []
  const reasons = config.reasons ?? []
  const reviews = config.testimonials ?? []
  const heroRef = useRef<HTMLElement>(null)
  const heroLabel = useRef<HTMLParagraphElement>(null)
  const heroTitle = useRef<HTMLElement>(null)
  const heroCopy = useRef<HTMLParagraphElement>(null)
  const heroCtas = useRef<HTMLDivElement>(null)
  const heroTrust = useRef<HTMLDivElement>(null)
  const serviceSection = useRef<HTMLElement>(null)
  const serviceTrack = useRef<HTMLDivElement>(null)
  const reviewGrid = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [status, setStatus] = useState("")

  useStaggerReveal(reviewGrid, ".review-card", { y: 44, scale: .97, stagger: .08 })

  useGSAP(() => {
    const words = heroTitle.current?.querySelectorAll(".split-word") ?? []
    if (reduced) {
      gsap.set([heroLabel.current, words, heroCopy.current, heroCtas.current, heroTrust.current], { opacity: 1, y: 0 })
      return
    }
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
    tl.from(heroLabel.current, { opacity: 0, y: -16, duration: .45 })
      .from(words, { opacity: 0, yPercent: 110, stagger: .045, duration: .75 }, "-=.2")
      .from(heroCopy.current, { opacity: 0, y: 24, duration: .6 }, "-=.5")
      .from(heroCtas.current, { opacity: 0, y: 16, duration: .5 }, "-=.4")
      .from(heroTrust.current, { opacity: 0, y: 8, duration: .4 }, "-=.3")
    gsap.to(".hero-photo", { yPercent: -14, ease: "none", scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: 1.5 } })
    gsap.to(".hero-copy", { opacity: 0, y: -35, ease: "none", scrollTrigger: { trigger: heroRef.current, start: "55% top", end: "bottom top", scrub: 1 } })
  }, { scope: heroRef, dependencies: [reduced] })

  useGSAP(() => {
    if (reduced || !serviceTrack.current) return
    const mm = gsap.matchMedia()
    mm.add("(min-width: 1024px)", () => {
      const track = serviceTrack.current!
      const distance = Math.max(0, track.scrollWidth - window.innerWidth + 100)
      if (!distance) return
      gsap.to(track, { x: -distance, ease: "none", scrollTrigger: { trigger: serviceSection.current, pin: true, scrub: 1, end: `+=${distance}` } })
    })
    return () => mm.revert()
  }, { scope: serviceSection, dependencies: [reduced] })

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const payload = Object.fromEntries(new FormData(form).entries())
    setStatus("Sending…")
    try {
      const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, businessName: business.name, niche: "hvac" }) })
      if (!res.ok) throw new Error("Request failed")
      form.reset()
      setStatus("Thanks — we’ll confirm your appointment window shortly.")
    } catch {
      setStatus(`Please call ${business.phone} and we’ll help right away.`)
    }
  }

  return <>
    <header className="absolute inset-x-0 top-0 z-40 border-b" style={{ borderColor: "var(--brand-border)" }}>
      <div className="border-b py-2 text-[11px]" style={{ borderColor: "var(--brand-border)", color: "var(--brand-fg-muted)" }}>
        <div className="shell flex justify-between gap-4"><span>● Serving {business.city} and nearby communities</span><span className="hidden sm:block">{business.hours}</span></div>
      </div>
      <div className="shell flex h-20 items-center justify-between">
        <a href="#top" className="display text-2xl tracking-wide"><span style={{ color: "var(--brand-accent)" }}>◆</span> {business.name}</a>
        <nav className="hidden items-center gap-8 text-sm md:flex"><a href="#services">Services</a><a href="#why">Why us</a><a href="#reviews">Reviews</a><a href="#contact">Contact</a></nav>
        <a href={business.phoneHref} className="hidden rounded-md border px-4 py-3 text-sm font-bold sm:block" style={{ borderColor: "var(--brand-border-hover)", color: "var(--brand-accent)" }}>Call {business.phone}</a>
      </div>
    </header>

    <main>
      <section id="top" ref={heroRef} className="hero-fallback relative min-h-[900px] overflow-hidden pt-28 lg:min-h-screen">
        <div className="hero-photo absolute inset-0 scale-110 bg-cover bg-center" style={{ backgroundImage: "url('/hero-1.jpg')" }} />
        <div className="hero-overlay absolute inset-0" />
        <div className="absolute inset-0 opacity-[.08] editorial-grid" />
        <AuroraBlobs /><ParticleField count={50} />
        <div className="shell hero-copy relative z-10 flex min-h-[780px] items-center py-28 lg:min-h-screen">
          <div className="max-w-[770px]">
            <p ref={heroLabel} className="eyebrow mb-8">— Serving {business.city} since {business.since}</p>
            <SplitText ref={heroTitle} as="h1" className="display text-[clamp(4.4rem,10vw,8.2rem)]" style={{ color: "var(--brand-fg)" }}>{business.tagline}</SplitText>
            <p ref={heroCopy} className="mt-8 max-w-[55ch] text-lg leading-8" style={{ color: "var(--brand-fg-muted)" }}>{config.about?.body ?? `Reliable, straightforward service for homes and businesses across ${business.city}.`}</p>
            <div ref={heroCtas} className="mt-9 flex flex-col gap-3 sm:flex-row"><a href="#contact" className="btn-main">Book service →</a><a href={business.phoneHref} className="btn-line">Call now</a></div>
            <div ref={heroTrust} className="mt-12 grid max-w-2xl grid-cols-3 border-y py-6" style={{ borderColor: "var(--brand-border)" }}>
              {config.stats?.slice(0,3).map((s) => <div key={s.label} className="border-r px-4 first:pl-0 last:border-0" style={{ borderColor: "var(--brand-border)" }}><strong className="display block text-3xl" style={{ color: "var(--brand-accent)" }}><AnimatedCounter to={Number(s.value)} decimals={s.decimals} suffix={s.suffix} /></strong><span className="text-[11px] uppercase tracking-wider" style={{ color: "var(--brand-fg-muted)" }}>{s.label}</span></div>)}
            </div>
          </div>
        </div>
      </section>

      <section id="services" ref={serviceSection} className="paper section-pad min-h-screen overflow-hidden">
        <div className="shell"><p className="eyebrow">— What we handle</p><div className="mt-6 flex items-end justify-between gap-10"><Heading className="max-w-3xl text-[clamp(3.8rem,8vw,6rem)]">{`${business.name.split(' ')[0]}'s work. Done right.`}</Heading><p className="hidden max-w-sm leading-7 lg:block" style={{ color: "var(--brand-copy)" }}>{`From the first call to the finished job, ${business.name} makes it clear, clean, and built to last.`}</p></div></div>
        <div ref={serviceTrack} className="mt-16 flex gap-0 px-[max(1rem,calc((100vw-1180px)/2))]">
          {services.map((s, i) => <article key={s.title} className="service-card group flex min-h-[360px] flex-col justify-between"><div><span className="eyebrow">0{i + 1}</span><div className="mt-10 grid h-11 w-11 place-items-center rounded-full" style={{ background: "var(--brand-paper-2)", color: "var(--brand-accent)" }}>+</div></div><div><h3 className="display text-4xl">{s.title}</h3><p className="mt-3 leading-7" style={{ color: "var(--brand-copy)" }}>{s.desc}</p></div></article>)}
        </div>
      </section>

      <section id="why" className="ink section-pad relative overflow-hidden"><div className="shell grid gap-14 lg:grid-cols-2 lg:items-center"><ImageReveal src="/editorial-hvac.svg" alt={`${business.name} at work`} className="aspect-[4/3] bg-[var(--brand-bg-card)]" /><div><p className="eyebrow">— Our standard</p><Heading light className="mt-6 text-[clamp(3.8rem,7vw,5.5rem)]">{config.about?.heading ?? "Straight answers. Solid work."}</Heading><p className="mt-6 max-w-xl leading-8" style={{ color: "var(--brand-fg-muted)" }}>{config.about?.body}</p><div className="mt-8">{reasons.map((r) => <Tilt3D key={r.title} className="reason-card"><div className="flex gap-4"><span style={{ color: "var(--brand-accent)" }}>✓</span><div><strong>{r.title}</strong><p className="mt-1 text-sm" style={{ color: "var(--brand-fg-muted)" }}>{r.desc}</p></div></div></Tilt3D>)}</div></div></div></section>

      <section id="reviews" className="paper section-pad"><div className="shell"><p className="eyebrow">— Neighbor approved</p><Heading className="mt-6 max-w-4xl text-[clamp(3.7rem,7vw,5.5rem)]">Local service people remember.</Heading><div ref={reviewGrid} className="mt-14 grid gap-0 md:grid-cols-3">{reviews.map((r) => <blockquote key={r.name} className="review-card hover-lift"><div style={{ color: "var(--brand-accent)" }}>★★★★★</div><p className="mt-7 text-lg leading-8">“{r.text}”</p><footer className="mt-8 text-sm font-bold">{r.name} · {r.location}</footer></blockquote>)}</div></div></section>

      <section className="ink section-pad"><div className="shell grid gap-12 lg:grid-cols-[1fr_.8fr] lg:items-center"><div><p className="eyebrow">— Close by when it counts</p><Heading light className="mt-6 text-[clamp(3.8rem,7vw,5.5rem)]">{`Proudly serving ${business.city}.`}</Heading><p className="mt-6 leading-8" style={{ color: "var(--brand-fg-muted)" }}>Fast local response across {business.city} and surrounding communities.</p></div><div className="grid grid-cols-2 border" style={{ borderColor: "var(--brand-border)" }}>{business.serviceAreas.map(a => <div key={a} className="border p-5 text-sm font-bold" style={{ borderColor: "var(--brand-border)" }}><span style={{ color: "var(--brand-accent)" }}>⌖</span> {a}</div>)}</div></div></section>

      <section id="contact" className="paper section-pad"><div className="shell grid gap-14 lg:grid-cols-[.8fr_1.2fr]"><div><p className="eyebrow">— Let’s get started</p><Heading className="mt-6 text-[clamp(3.8rem,7vw,5.5rem)]">Book your service.</Heading><p className="mt-6 leading-8" style={{ color: "var(--brand-copy)" }}>Tell us what you need. We’ll contact you to confirm the details.</p><a href={business.phoneHref} className="mt-8 inline-block font-bold" style={{ color: "var(--brand-accent)" }}>Call {business.phone} →</a></div><form onSubmit={submit} className="grid gap-5 border p-6 md:p-10" style={{ borderColor: "rgba(7,23,36,.16)" }}><div className="grid gap-5 md:grid-cols-2"><label className="text-sm font-bold">Full name<input name="name" required className="input mt-2" /></label><label className="text-sm font-bold">Phone<input name="phone" required className="input mt-2" /></label></div><label className="text-sm font-bold">What do you need?<select name="service" className="input mt-2">{config.formServiceOptions?.map(x => <option key={x}>{x}</option>)}</select></label><label className="text-sm font-bold">What’s happening?<textarea name="message" rows={4} className="input mt-2" /></label><button className="btn-main" type="submit">Request appointment →</button><p aria-live="polite" className="text-sm" style={{ color: "var(--brand-copy)" }}>{status}</p></form></div></section>
    </main>

    <footer className="border-t py-10" style={{ borderColor: "var(--brand-border)", background: "var(--brand-bg)" }}><div className="shell flex flex-col justify-between gap-4 text-sm sm:flex-row"><strong className="display text-2xl">{business.name}</strong><span style={{ color: "var(--brand-fg-muted)" }}>© {new Date().getFullYear()} · {business.address} · {business.license}</span></div></footer>
    <a href={business.phoneHref} className="mobile-call btn-main fixed bottom-4 left-4 right-4 z-50">Call {business.phone}</a>
  </>
}
