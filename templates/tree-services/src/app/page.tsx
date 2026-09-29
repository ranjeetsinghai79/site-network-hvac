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
        <Reviews config={config} ctaText={`Fully insured, ISA certified — ${config.business.review_count}+ trees safely removed`} />
        <FAQ config={config} />
        <ServiceAreas config={config} />
        <Contact config={config} heading="Get Your Free Tree Estimate" paragraph="On-site assessment and written quote. No hidden fees." submitText="Get Free Estimate" />
      </main>
      <Footer config={config} />
    </>
  )
}
