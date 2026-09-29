import { Nav, Services, WhyUs, Reviews, ServiceAreas, Contact, Footer, FAQ, ScrollSequenceHero } from "@core/web"
import { TreatmentMenuSection } from "@/components/treatment-menu"
import { MedSpaHero }           from "@/components/medspa-hero"
import { SocialProofStrip }     from "@/components/social-proof-strip"
import MedspaTicker             from "@/components/medspa-ticker"
import MedspaStats              from "@/components/medspa-stats"
import { config }               from "@/lib/config"

export default function Home() {
  return (
    <>
      <Nav config={config} scrolledTheme="light" />
      <main>
        {/* 1. Cinematic hero — scroll-scrubbed frame sequence when generated, else inline booking form */}
        {config.heroFrames ? (
          <ScrollSequenceHero
            frameCount={config.heroFrames.count}
            framePath={(i) => `${config.heroFrames!.basePath}/frame_${String(i + 1).padStart(4, "0")}.jpg`}
            headline={config.business.tagline}
            subline={`Book your free consultation — ${config.business.review_count}+ happy clients`}
          />
        ) : (
          <MedSpaHero config={config} posterSrc="/hero-4.jpg" />
        )}

        {/* 2. Trust ticker — credentials scrolling strip */}
        <MedspaTicker />

        {/* 3. Stats — rating, clients, experience, free consult */}
        <MedspaStats config={config} />

        {/* 4. Credibility strip — dark band: certifications */}
        <SocialProofStrip config={config} />

        {/* 5. Services — horizontal pinned scroll (desktop) */}
        <Services
          config={config}
          layout="horizontal"
          label="Our Treatments"
          heading="Medical-grade treatments. Visible results."
          paragraph="From injectables to laser resurfacing — every treatment performed by board-certified providers in a clinical setting."
        />

        {/* 6. Treatment menu — editorial two-col full pricing */}
        <TreatmentMenuSection config={config} />

        {/* 7. Why us — 3D tilt cards */}
        <WhyUs config={config} />

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
          heading={<>Your <em>complimentary</em> consultation awaits.</>}
          paragraph="Tell us your goals and we'll build a personalized treatment plan. No pressure. No commitment."
          submitText="Request My Free Consultation"
        />
      </main>
      <Footer config={config} />
    </>
  )
}
