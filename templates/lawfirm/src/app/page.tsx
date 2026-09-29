import { Nav, Hero, ScrollHero, Services, WhyUs, Reviews, ServiceAreas, Contact, Footer } from "@core/web"
import { PracticeAreasSection } from "@/components/practice-areas"
import { AttorneySection } from "@/components/attorney-section"
import { config } from "@/lib/config"

export default function Home() {
  const isPremium = config.tier === "premium"
  return (
    <>
      <Nav config={config} scrolledTheme="light" />
      <main>
        {isPremium
          ? <ScrollHero config={config} videoSrc={config.heroVideo ?? "/hero-bg.mp4"} posterSrc="/hero-1.jpg" />
          : <Hero config={config} videoSrc={config.heroVideo} posterSrc="/hero-1.jpg" />
        }
        <Services config={config} layout="zigzag" />
        <PracticeAreasSection config={config} />
        <AttorneySection config={config} />
        <WhyUs config={config} />
        <Reviews
          config={config}
          ctaText={`Free case evaluation — ${config.business.review_count}+ clients represented`}
        />
        <ServiceAreas config={config} />
        <Contact
          config={config}
          heading="Get Your Free Case Evaluation"
          paragraph="Tell us what happened. Our attorneys review every submission and respond within 2 hours."
          submitText="Request Free Evaluation"
        />
      </main>
      <Footer config={config} />
    </>
  )
}
