import { config } from "@/lib/config"
import HvacNav        from "@/components/hvac-nav"
import HvacHero       from "@/components/hvac-hero"
import HvacTicker     from "@/components/hvac-ticker"
import HvacStats      from "@/components/hvac-stats"
import HvacServices   from "@/components/hvac-services"
import HvacFeatures   from "@/components/hvac-features"
import HvacGallery    from "@/components/hvac-gallery"
import HvacReviews    from "@/components/hvac-reviews"
import HvacFaq        from "@/components/hvac-faq"
import HvacContact    from "@/components/hvac-contact"
import HvacFooter     from "@/components/hvac-footer"
import HvacMobileCta  from "@/components/hvac-mobile-cta"

export default function Home() {
  return (
    <>
      <HvacNav config={config} />
      <main>
        <HvacHero       config={config} />
        <HvacTicker     config={config} />
        <HvacStats      config={config} />
        <HvacServices   config={config} />
        <HvacFeatures   config={config} />
        <HvacGallery    config={config} />
        <HvacReviews    config={config} />
        <HvacFaq        config={config} />
        <HvacContact    config={config} />
      </main>
      <HvacFooter config={config} />
      <HvacMobileCta config={config} />
    </>
  )
}
