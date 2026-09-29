import { Nav, Hero, Services, WhyUs, Reviews, ServiceAreas, Contact, Footer } from "@core/web"
import { ProcessSection } from "@/components/process-section"
import { config } from "@/lib/config"

export default function Home() {
  return (
    <>
      <Nav config={config} scrolledTheme="light" />
      <main>
        <Hero config={config} videoSrc={config.heroVideo} posterSrc="/hero-1.jpg" />
        <Services config={config} layout="zigzag" />
        <ProcessSection config={config} />
        <WhyUs config={config} />
        <Reviews config={config} ctaText={`Same-day available — ${config.business.review_count}+ loads hauled`} />
        <ServiceAreas config={config} />
        <Contact config={config} heading="Get Your Upfront Quote" paragraph="Tell us what you need gone. We'll give you a price before we touch anything." submitText="Get My Quote" />
      </main>
      <Footer config={config} />
    </>
  )
}
