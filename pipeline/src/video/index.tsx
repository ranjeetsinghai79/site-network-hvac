/**
 * Remotion OutreachVideo composition
 * 15 seconds @ 30fps = 450 frames
 *
 * Timeline:
 *   0-60   (0-2s)   — Dark intro, business name fades in + niche badge
 *   60-180 (2-6s)   — "We built you something" + website URL slides in
 *   180-330 (6-11s) — Browser mockup showing website screenshot slides in
 *   330-420 (11-14s)— CTA: "Visit your free demo site" + phone number
 *   420-450 (14-15s)— Fade out with logo
 */

import { Composition, registerRoot } from 'remotion'
import React from 'react'
import {
  AbsoluteFill,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from 'remotion'

export interface OutreachVideoProps {
  businessName: string
  businessNiche: string
  websiteUrl: string
  phone: string
  city: string
  tagline: string
  googleRating: string
}

const NICHE_COLORS: Record<string, { bg: string; accent: string }> = {
  hvac: { bg: '#0F1F3D', accent: '#F97316' },
  roofing: { bg: '#1A1F2E', accent: '#DC2626' },
  dentist: { bg: '#0F2744', accent: '#14B8A6' },
  medspa: { bg: '#2D1E12', accent: '#C08B6A' },
  lawfirm: { bg: '#111128', accent: '#C9A84C' },
  remodeling: { bg: '#1F4E2C', accent: '#52A36A' },
  cleaning: { bg: '#1E3A8A', accent: '#38BDF8' },
  'junk-removal': { bg: '#14532D', accent: '#F97316' },
  daycare: { bg: '#5B21B6', accent: '#FCD34D' },
  'auto-detailing': { bg: '#0F0F1A', accent: '#06B6D4' },
  restaurant: { bg: '#1A0A00', accent: '#F59E0B' },
}

function OutreachVideoComp({
  businessName,
  businessNiche,
  websiteUrl,
  phone,
  city,
  tagline,
}: OutreachVideoProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const colors = NICHE_COLORS[businessNiche] || { bg: '#0F1F3D', accent: '#F97316' }

  // Phase opacities
  const introOpacity = interpolate(frame, [0, 20, 50, 60], [0, 1, 1, 0], { extrapolateRight: 'clamp' })
  const phase2Opacity = interpolate(frame, [60, 80, 170, 185], [0, 1, 1, 0], { extrapolateRight: 'clamp' })
  const phase3Opacity = interpolate(frame, [180, 200, 320, 335], [0, 1, 1, 0], { extrapolateRight: 'clamp' })
  const ctaOpacity = interpolate(frame, [330, 350, 415, 435], [0, 1, 1, 0], { extrapolateRight: 'clamp' })
  const outroOpacity = interpolate(frame, [435, 450], [0, 1], { extrapolateRight: 'clamp' })

  const nameY = spring({ frame, fps, from: 40, to: 0, config: { damping: 14, stiffness: 100 } })
  const siteX = spring({ frame: frame - 60, fps, from: 60, to: 0, config: { damping: 16, stiffness: 90 } })
  const browserY = spring({ frame: frame - 180, fps, from: 50, to: 0, config: { damping: 18, stiffness: 80 } })
  const ctaScale = spring({ frame: frame - 330, fps, from: 0.85, to: 1, config: { damping: 12, stiffness: 120 } })

  return (
    <AbsoluteFill style={{ background: colors.bg, fontFamily: "'Inter', sans-serif", overflow: 'hidden' }}>

      {/* Subtle grid bg */}
      <AbsoluteFill style={{
        backgroundImage: `linear-gradient(${colors.accent}18 1px, transparent 1px), linear-gradient(90deg, ${colors.accent}18 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }} />

      {/* Glow blob */}
      <div style={{
        position: 'absolute', top: '-20%', right: '-20%',
        width: 600, height: 600,
        background: `radial-gradient(circle, ${colors.accent}30 0%, transparent 70%)`,
        borderRadius: '50%',
      }} />

      {/* Phase 1 — Intro */}
      <AbsoluteFill style={{ opacity: introOpacity, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{
          background: `${colors.accent}20`,
          border: `1px solid ${colors.accent}50`,
          color: colors.accent,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          padding: '8px 20px',
          borderRadius: 100,
        }}>
          {businessNiche.replace(/-/g, ' ')} · {city}
        </div>
        <div style={{
          color: '#ffffff',
          fontSize: 58,
          fontWeight: 900,
          textAlign: 'center',
          lineHeight: 1.1,
          transform: `translateY(${nameY}px)`,
          maxWidth: 800,
          padding: '0 40px',
        }}>
          {businessName}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 20, fontWeight: 400 }}>
          {tagline}
        </div>
      </AbsoluteFill>

      {/* Phase 2 — "We built something" */}
      <AbsoluteFill style={{ opacity: phase2Opacity, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24 }}>
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 18, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
          We built you something
        </div>
        <div style={{
          color: '#ffffff',
          fontSize: 48,
          fontWeight: 900,
          textAlign: 'center',
          transform: `translateX(${siteX}px)`,
          lineHeight: 1.15,
        }}>
          A website that actually<br />
          <span style={{ color: colors.accent }}>gets you customers.</span>
        </div>
        <div style={{
          background: `${colors.accent}15`,
          border: `1px solid ${colors.accent}40`,
          color: colors.accent,
          fontSize: 16,
          fontWeight: 600,
          padding: '12px 28px',
          borderRadius: 100,
          letterSpacing: '0.05em',
          transform: `translateX(${siteX}px)`,
        }}>
          Live at: {websiteUrl.replace('https://', '')}
        </div>
      </AbsoluteFill>

      {/* Phase 3 — Browser mockup */}
      <AbsoluteFill style={{ opacity: phase3Opacity, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          transform: `translateY(${browserY}px)`,
          width: 880,
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: `0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px ${colors.accent}30`,
        }}>
          {/* Browser chrome */}
          <div style={{
            background: '#1a1a2e',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: `1px solid ${colors.accent}20`,
          }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['#FF5F57', '#FEBC2E', '#28C840'].map((c, i) => (
                <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
              ))}
            </div>
            <div style={{
              flex: 1, marginLeft: 12,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6,
              padding: '5px 12px',
              color: 'rgba(255,255,255,0.4)',
              fontSize: 12,
            }}>
              {websiteUrl}
            </div>
          </div>
          {/* "Screenshot" placeholder — real pipeline injects actual screenshot via inputProps */}
          <div style={{
            height: 440,
            background: `linear-gradient(135deg, ${colors.bg} 0%, ${colors.accent}15 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 16,
          }}>
            <div style={{ color: colors.accent, fontSize: 48, fontWeight: 900 }}>{businessName}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18 }}>{tagline}</div>
            <div style={{
              marginTop: 24,
              background: colors.accent,
              color: '#fff',
              fontWeight: 700,
              padding: '14px 32px',
              borderRadius: 100,
              fontSize: 16,
            }}>
              Get Free Estimate
            </div>
          </div>
        </div>
      </AbsoluteFill>

      {/* Phase 4 — CTA */}
      <AbsoluteFill style={{ opacity: ctaOpacity, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 28 }}>
        <div style={{
          transform: `scale(${ctaScale})`,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
        }}>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 18, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
            Your demo is live — for free
          </div>
          <div style={{ color: '#ffffff', fontSize: 44, fontWeight: 900, lineHeight: 1.15, maxWidth: 700, textAlign: 'center' }}>
            Interested? We handle<br />
            <span style={{ color: colors.accent }}>everything else.</span>
          </div>
          <div style={{
            background: colors.accent,
            color: '#fff',
            fontWeight: 800,
            padding: '18px 48px',
            borderRadius: 100,
            fontSize: 20,
            letterSpacing: '0.02em',
            boxShadow: `0 8px 32px ${colors.accent}50`,
          }}>
            {phone}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 15 }}>
            Reply to this email · No commitment
          </div>
        </div>
      </AbsoluteFill>

      {/* Outro fade */}
      <AbsoluteFill style={{ opacity: outroOpacity, background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: colors.accent, fontSize: 24, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          WebsiteDeveloper.ai
        </div>
      </AbsoluteFill>

    </AbsoluteFill>
  )
}

export const RemotionRoot = () => (
  <Composition
    id="OutreachVideo"
    component={OutreachVideoComp}
    durationInFrames={450}
    fps={30}
    width={1280}
    height={720}
    defaultProps={{
      businessName: 'Demo Business',
      businessNiche: 'hvac',
      websiteUrl: 'https://demo.vercel.app',
      phone: '(555) 123-4567',
      city: 'Tracy, CA',
      tagline: 'Fast. Licensed. Trusted.',
      googleRating: '4.9',
    }}
  />
)

registerRoot(RemotionRoot)
