import { Nav, Hero, Services, WhyUs, Reviews, ServiceAreas, Contact, Footer } from "@core/web"
import { DripMenuSection } from "@/components/drip-menu"
import { config } from "@/lib/config"

export default function Home() {
  return (
    <>
      <Nav config={config} scrolledTheme="light" />
      <main>
        <Hero config={config} videoSrc={config.heroVideo} posterSrc="/hero-4.jpg" posterBrightness={0.6} />
        <Services config={config} layout="zigzag" />
        <DripMenuSection config={config} />
        <WhyUs config={config} />
        <Reviews
          config={config}
          ctaText={`Book your IV drip session — ${config.business.review_count}+ clients feeling better`}
        />
        <ServiceAreas config={config} />
        <Contact config={config} />
      </main>
      <Footer config={config} />
    </>
  )
}
