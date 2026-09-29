import { Nav, Services, WhyUs, Reviews, ServiceAreas, Contact, Footer } from "@core/web"
import SkinClinicHero       from "@/components/skin-clinic-hero"
import SkinClinicTicker     from "@/components/skin-clinic-ticker"
import SkinClinicStats      from "@/components/skin-clinic-stats"
import SkinClinicPhotoStrip from "@/components/skin-clinic-photo-strip"
import { SkinMenuSection }  from "@/components/skin-menu"
import { config }           from "@/lib/config"

export default function Home() {
  return (
    <>
      <Nav config={config} scrolledTheme="dark" />
      <main>
        {/* 1. Cinematic hero — particles + aurora + skin concern selector */}
        <SkinClinicHero config={config} posterSrc="/hero-4.jpg" />

        {/* 2. Trust ticker */}
        <SkinClinicTicker />

        {/* 3. Stats — rating, clients, years, free consult */}
        <SkinClinicStats config={config} />

        {/* 4. Services — horizontal pinned scroll */}
        <Services
          config={config}
          layout="horizontal"
          label="Our Treatments"
          heading="Science-backed skin treatments."
          paragraph="Medical-grade peels, laser resurfacing, microneedling, and more — safe and effective for all skin tones with visible results from session one."
        />

        {/* 5. Treatment menu — full pricing + details */}
        <SkinMenuSection config={config} />

        {/* 6. Photo strip */}
        <SkinClinicPhotoStrip />

        {/* 7. Why us — 3D tilt cards */}
        <WhyUs config={config} label={`Why ${config.business.name.split(" ")[0]}`} heading="Why clients trust us with their skin." />

        {/* 8. Reviews */}
        <Reviews
          config={config}
          ctaText={`Book your free skin consultation — ${config.business.review_count}+ happy clients`}
        />

        {/* 9. Service areas */}
        <ServiceAreas config={config} />

        {/* 10. Contact */}
        <Contact
          config={config}
          heading="Book Your Free Consultation"
          paragraph="Tell us your skin concerns and we'll build a personalized treatment plan. No pressure, no commitment."
          submitText="Book Free Consultation"
        />
      </main>
      <Footer config={config} />
    </>
  )
}
