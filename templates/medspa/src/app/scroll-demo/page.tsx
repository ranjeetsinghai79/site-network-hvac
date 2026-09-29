import { ScrollSequenceHero } from "@core/web"
import { MagicTreatmentMenu } from "@/components/magic-treatment-menu"
import { MagicTestimonials } from "@/components/magic-testimonials"

export const metadata = {
  title: "Scroll Sequence Demo",
}

export default function ScrollDemoPage() {
  return (
    <main>
      <ScrollSequenceHero
        frameCount={143}
        headline="Radiance, revealed"
        subline="Scroll through the treatment — frame by frame"
      />
      <MagicTreatmentMenu />
      <MagicTestimonials />
    </main>
  )
}
