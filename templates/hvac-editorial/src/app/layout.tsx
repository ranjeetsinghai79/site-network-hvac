import type { Metadata } from "next"
import { LoadingScreen, MagneticCursor, ScrollProgress, SmoothScroll } from "@core/web"
import { config } from "@/lib/config"
import "./globals.css"

export const metadata: Metadata = {
  title: `${config.business.name} | ${config.business.city}`,
  description: `${config.business.name} — ${config.business.tagline} Serving ${config.business.city}.`,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body data-theme={config.business.theme}>
        <LoadingScreen name={config.business.name} tagline={config.business.tagline} />
        <ScrollProgress />
        <MagneticCursor />
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  )
}
