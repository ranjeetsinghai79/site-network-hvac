export interface SiteScore {
  url: string
  mobile_score: number
  desktop_score: number
  issues: string[]
  scored: boolean
  broken?: boolean  // site unreachable / 404 / DNS fail
}

export async function scoreSite(url: string): Promise<SiteScore> {
  const issues: string[] = []
  const noHttps = !url.startsWith('https')
  if (noHttps) issues.push('No HTTPS')

  // Try PageSpeed with Maps key (has PageSpeed in allowlist), fallback to AI key
  const keys = [
    process.env.GOOGLE_PLACES_API_KEY,
    process.env.GOOGLE_AI_API_KEY,
  ].filter(Boolean)

  const base = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

  for (const key of keys) {
    try {
      const [mobileRes, desktopRes] = await Promise.all([
        fetch(`${base}?url=${encodeURIComponent(url)}&strategy=mobile&key=${key}`),
        fetch(`${base}?url=${encodeURIComponent(url)}&strategy=desktop&key=${key}`),
      ])

      const [mobile, desktop] = await Promise.all([
        mobileRes.json() as Promise<any>,
        desktopRes.json() as Promise<any>,
      ])

      // If API key blocked, try next key
      if (mobile.error?.status === 'PERMISSION_DENIED') continue

      // Site unreachable (DNS fail, timeout, 404) — lighthouse returns error code
      const lhError = mobile.lighthouseResult?.runWarnings?.some((w: string) =>
        /failed to load|ERR_|could not be resolved|timed out/i.test(w)
      ) || mobile.lighthouseResult?.runtimeError?.code
      if (lhError) {
        console.log(`  [!] Site unreachable (${lhError}) — broken site, build fresh`)
        return { url, mobile_score: 0, desktop_score: 0, issues: ['Site unreachable or down'], scored: true, broken: true }
      }

      const mobile_score = Math.round((mobile.lighthouseResult?.categories?.performance?.score ?? 0) * 100)
      const desktop_score = Math.round((desktop.lighthouseResult?.categories?.performance?.score ?? 0) * 100)

      if (mobile_score < 50) issues.push('Poor mobile performance')
      if (desktop_score < 60) issues.push('Poor desktop performance')

      const viewport = mobile.lighthouseResult?.audits?.['viewport']?.score
      if (viewport === 0) issues.push('Not mobile-friendly')

      const fcp = mobile.lighthouseResult?.audits?.['first-contentful-paint']?.numericValue
      if (fcp > 3000) issues.push('Slow load time (>3s)')

      return { url, mobile_score, desktop_score, issues, scored: true }
    } catch {
      continue
    }
  }

  // PageSpeed unavailable — fall back to basic checks only
  // Treat as bad site so pipeline continues (HTTPS, etc.)
  if (!noHttps) issues.push('Could not score (PageSpeed unavailable)')
  return { url, mobile_score: 0, desktop_score: 0, issues, scored: false }
}
