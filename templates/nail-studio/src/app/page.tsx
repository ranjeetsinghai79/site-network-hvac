import { Nav, Hero, Services, WhyUs, Reviews, ServiceAreas, Contact, Footer } from "@core/web"
import { NailMenuSection } from "@/components/nail-menu"
import { config } from "@/lib/config"

export default function Home() {
  return (
    <>
      <Nav config={config} scrolledTheme="dark" />
      <main>
        <Hero config={config} videoSrc={config.heroVideo} posterSrc="/hero-4.jpg" posterBrightness={0.65} />
        <Services config={config} layout="zigzag" />
        <NailMenuSection config={config} />
        <WhyUs config={config} />
        <Reviews
          config={config}
          ctaText={`Book your appointment — ${config.business.review_count}+ nails done`}
        />
        <ServiceAreas config={config} />
        <Contact config={config} />
      </main>
      <Footer config={config} />
    </>
  )
}
