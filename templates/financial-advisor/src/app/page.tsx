import { Nav, Services, WhyUs, Reviews, ServiceAreas, Contact, Footer, FAQ } from "@core/web"
import FinancialAdvisorHero       from "@/components/financial-advisor-hero"
import FinancialAdvisorTicker     from "@/components/financial-advisor-ticker"
import FinancialAdvisorStats      from "@/components/financial-advisor-stats"
import FinancialAdvisorPhotoStrip from "@/components/financial-advisor-photo-strip"
import WealthServicesSection      from "@/components/wealth-services-section"
import { config }                 from "@/lib/config"

export default function Home() {
  return (
    <>
      <Nav config={config} scrolledTheme="dark" />
      <main>
        {/* 1. Cinematic hero — particles + aurora + wealth goal selector */}
        <FinancialAdvisorHero config={config} posterSrc="/hero-1.jpg" />

        {/* 2. Trust ticker — fiduciary credentials, CFP®, AUM */}
        <FinancialAdvisorTicker />

        {/* 3. Stats — rating, AUM, experience, fiduciary */}
        <FinancialAdvisorStats config={config} />

        {/* 4. Services — horizontal pinned scroll (desktop) */}
        <Services
          config={config}
          layout="horizontal"
          label="What We Do"
          heading="Comprehensive wealth management."
          paragraph="From retirement planning to tax strategy — everything you need to build, protect, and pass on wealth. Coordinated, conflict-free, and always fiduciary."
        />

        {/* 5. Transparent fee schedule */}
        <WealthServicesSection config={config} />

        {/* 6. Photo strip — services visual grid */}
        <FinancialAdvisorPhotoStrip />

        {/* 7. Why us — 3D tilt cards */}
        <WhyUs config={config} label={`Why ${config.business.name.split(" ")[0]}`} heading="Why clients trust us with their wealth." />

        {/* 8. Reviews */}
        <Reviews
          config={config}
          ctaText={`Book your free consultation — ${config.business.review_count}+ happy clients`}
        />

        {/* 9. FAQ */}
        <FAQ config={config} />

        {/* 10. Service areas */}
        <ServiceAreas config={config} />

        {/* 11. Contact */}
        <Contact
          config={config}
          label="Ready to Begin?"
          heading={<>Your <em>free</em> 60-minute consultation awaits.</>}
          paragraph="Tell us your goals and we'll outline a personalized financial plan. No obligation. No sales pitch. Fiduciary from the first call."
          submitText="Book My Free Consultation"
        />
      </main>
      <Footer config={config} />
    </>
  )
}
