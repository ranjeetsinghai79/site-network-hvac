import { Nav, Hero, Services, WhyUs, Reviews, ServiceAreas, Contact, Footer } from "@core/web"
import { CurriculumSection } from "@/components/curriculum-section"
import { config } from "@/lib/config"

export default function Home() {
  return (
    <>
      <Nav config={config} scrolledTheme="light" />
      <main>
        <Hero config={config} videoSrc={config.heroVideo} posterSrc="/hero-1.jpg" />
        <Services config={config} layout="zigzag" />
        <CurriculumSection config={config} />
        <WhyUs config={config} />
        <Reviews config={config} ctaText={`Schedule a tour — ${config.business.review_count}+ families enrolled`} />
        <ServiceAreas config={config} />
        <Contact config={config} heading="Schedule Your Tour" paragraph="Every family gets a personal walkthrough before enrollment. No pressure — just a conversation." submitText="Book a Tour" />
      </main>
      <Footer config={config} />
    </>
  )
}
