import { Nav, Services, WhyUs, Reviews, ServiceAreas, Contact, Footer } from "@core/web"
import RoofingHero       from "@/components/roofing-hero"
import RoofingTicker     from "@/components/roofing-ticker"
import RoofingStats      from "@/components/roofing-stats"
import RoofingPhotoStrip from "@/components/roofing-photo-strip"
import { MaterialsSection } from "@/components/materials-section"
import { config }        from "@/lib/config"

export default function Home() {
  return (
    <>
      <Nav config={config} scrolledTheme="dark" />
      <main>
        {/* 1. Cinematic hero — particles + aurora + damage type selector widget */}
        <RoofingHero config={config} posterSrc="/hero-1.jpg" />

        {/* 2. Trust ticker */}
        <RoofingTicker />

        {/* 3. Stats — rating, roofs, years, insurance coverage */}
        <RoofingStats config={config} />

        {/* 4. Services — horizontal pinned scroll (desktop) */}
        <Services
          config={config}
          layout="horizontal"
          label="Our Services"
          heading="Complete roofing solutions."
          paragraph="From emergency tarping to full replacement — GAF Master Elite certified with a 10-year workmanship warranty on every job."
        />

        {/* 5. Materials showcase */}
        <MaterialsSection config={config} />

        {/* 6. Photo strip */}
        <RoofingPhotoStrip />

        {/* 7. Why us — 3D tilt cards */}
        <WhyUs config={config} label={`Why ${config.business.name.split(" ")[0]}`} heading="Why homeowners trust us with their biggest investment." />

        {/* 8. Reviews */}
        <Reviews config={config} ctaText={`Free roof inspection — ${config.business.review_count}+ roofs installed`} />

        {/* 9. Service areas */}
        <ServiceAreas config={config} />

        {/* 10. Contact */}
        <Contact
          config={config}
          heading="Get Your Free Roof Inspection"
          paragraph="Drone inspection + written report at no charge. Most insurance claims handled directly — we work with your adjuster."
          submitText="Schedule Free Inspection"
        />
      </main>
      <Footer config={config} />
    </>
  )
}
