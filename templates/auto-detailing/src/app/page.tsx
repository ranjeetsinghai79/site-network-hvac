import { Nav, Services, WhyUs, Reviews, ServiceAreas, Contact, Footer } from "@core/web"
import AutoDetailingHero      from "@/components/auto-detailing-hero"
import AutoDetailingTicker    from "@/components/auto-detailing-ticker"
import AutoDetailingStats     from "@/components/auto-detailing-stats"
import AutoDetailingPhotoStrip from "@/components/auto-detailing-photo-strip"
import { PackagesSection }    from "@/components/packages-section"
import { config }             from "@/lib/config"

export default function Home() {
  return (
    <>
      <Nav config={config} scrolledTheme="dark" />
      <main>
        {/* 1. Cinematic hero — particle canvas + aurora + service selector widget */}
        <AutoDetailingHero config={config} posterSrc="/hero-1.jpg" />

        {/* 2. Trust ticker — credentials scrolling strip */}
        <AutoDetailingTicker />

        {/* 3. Stats — animated counters: rating, vehicles, years, warranty */}
        <AutoDetailingStats config={config} />

        {/* 4. Services — horizontal pinned scroll (desktop) */}
        <Services
          config={config}
          layout="horizontal"
          label="What We Do"
          heading="Premium detailing services."
          paragraph="From a single-step polish to a multi-year ceramic coating. We assess your paint and recommend exactly what it needs."
        />

        {/* 5. Packages — tiered pricing with gloss meters */}
        <PackagesSection config={config} />

        {/* 6. Photo strip — 6-panel work gallery */}
        <AutoDetailingPhotoStrip />

        {/* 7. Why us — 3D tilt cards with stat counters */}
        <WhyUs config={config} label={`Why ${config.business.name.split(" ")[0]}`} heading="Why serious car owners choose us." />

        {/* 8. Reviews */}
        <Reviews
          config={config}
          ctaText={`Book your detail — ${config.business.review_count}+ vehicles transformed`}
        />

        {/* 9. Service areas */}
        <ServiceAreas config={config} />

        {/* 10. Contact / booking */}
        <Contact
          config={config}
          heading="Book Your Detail"
          paragraph="Not sure which package? We'll inspect your paint and recommend for free. No commitment."
          submitText="Book My Detail"
        />
      </main>
      <Footer config={config} />
    </>
  )
}
