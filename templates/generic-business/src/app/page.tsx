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
        <Reviews config={config} ctaText={`Serving ${config.business.city} since ${config.business.since} — ${config.business.review_count}+ happy customers`} />
        <FAQ config={config} />
        <ServiceAreas config={config} />
        <Contact config={config} heading={`Get In Touch With ${config.business.name}`} paragraph="Tell us what you need — we'll get back to you with a straight answer and a quote." submitText="Send Request" />
      </main>
      <Footer config={config} />
    </>
  )
}
