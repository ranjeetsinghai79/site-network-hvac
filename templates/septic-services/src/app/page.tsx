import { Nav, Hero, Services, About, WhyUs, Reviews, FAQ, ServiceAreas, Contact, Footer } from "@core/web"
import { config } from "@/lib/config"

export default function Home() {
  return (
    <>
      <Nav config={config} scrolledTheme="light" />
      <main>
        <Hero config={config} videoSrc={config.heroVideo} posterSrc="/hero-1.jpg" />
        <About config={config} imageSrc="/about-1.jpg" />
        <Services config={config} layout="zigzag" />
        <WhyUs config={config} />
        <Reviews config={config} ctaText={`Licensed & EPA compliant — ${config.business.review_count}+ systems serviced`} />
        <FAQ config={config} />
        <ServiceAreas config={config} />
        <Contact config={config} heading="Schedule Your Septic Service" paragraph="Pumping, inspection, repair — fully licensed, EPA compliant." submitText="Schedule Service" />
      </main>
      <Footer config={config} />
    </>
  )
}
