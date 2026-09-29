import { Nav, Hero, Services, WhyUs, Reviews, ServiceAreas, Contact, Footer } from "@core/web"
import { SmileGallerySection } from "@/components/smile-gallery"
import { config } from "@/lib/config"

export default function Home() {
  return (
    <>
      <Nav config={config} scrolledTheme="light" />
      <main>
        <Hero config={config} videoSrc={config.heroVideo} posterSrc="/hero-2.jpg" posterBrightness={0.65} />
        <Services config={config} layout="zigzag" />
        <SmileGallerySection config={config} />
        <WhyUs config={config} />
        <Reviews config={config} ctaText={`Book online — ${config.business.review_count}+ patients trust us`} />
        <ServiceAreas config={config} />
        <Contact config={config} heading="Book Your Appointment" paragraph="New patients welcome. Most insurance accepted. Same-day emergency slots available." submitText="Request Appointment" />
      </main>
      <Footer config={config} />
    </>
  )
}
