import { Nav, Hero, Services, About, WhyUs, Reviews, FAQ, ServiceAreas, Contact, Footer } from "@core/web"
import { config } from "@/lib/config"
import { FinishShowcaseSection } from "@/components/finish-showcase"

export default function Home() {
  return (
    <>
      <Nav config={config} scrolledTheme="light" />
      <main>
        <Hero config={config} videoSrc={config.heroVideo} posterSrc="/hero-1.jpg" />
        <About config={config} imageSrc="/about-1.jpg" />
        <Services config={config} layout="zigzag" />
        <FinishShowcaseSection config={config} />
        <WhyUs config={config} />
        <Reviews config={config} ctaText={`Garage, commercial, industrial — ${config.business.review_count}+ floors transformed`} />
        <FAQ config={config} />
        <ServiceAreas config={config} />
        <Contact config={config} heading="Get Your Free Epoxy Floor Quote" paragraph="Color chips, metallics, full flake — bring your vision. We deliver." submitText="Get Free Quote" />
      </main>
      <Footer config={config} />
    </>
  )
}
