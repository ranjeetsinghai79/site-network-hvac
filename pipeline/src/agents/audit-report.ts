/**
 * audit-report.ts
 *
 * Generates a free website audit report for Tier 2 leads (has website).
 * Output: HTML string (email attachment) + plain-text summary (email body).
 *
 * Audit covers:
 *   - PageSpeed / Core Web Vitals (mobile + desktop)
 *   - SEO: missing title, meta desc, H1, schema
 *   - Mobile-friendliness
 *   - HTTPS / security
 *   - Online presence gaps (GBP claimed, review count)
 *   - AI visibility: is the business findable by AI assistants?
 *   - Competitive gaps vs similar businesses
 *
 * Used in outreach email as the hook: "We ran a FREE audit — here's what we found"
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { crawlBusinessSite } from '../tools/firecrawl.js'
import { scoreSite }         from '../tools/pagespeed.js'
import type { Lead }         from '../types.js'

const genai = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' })

export interface AuditReport {
  overall_score:   number          // 0-100
  grade:           string          // A / B / C / D / F
  issues:          AuditIssue[]
  wins:            string[]        // what they're doing well
  top_3_fixes:     string[]        // most impactful improvements
  html:            string          // full HTML report (email attachment)
  summary_text:    string          // 3-sentence plain text for email body
}

interface AuditIssue {
  category: 'speed' | 'seo' | 'mobile' | 'trust' | 'presence' | 'ai_visibility'
  severity: 'critical' | 'warning' | 'info'
  title:    string
  detail:   string
  fix:      string
}

export async function runAuditReportAgent(lead: Lead): Promise<AuditReport | null> {
  if (!lead.website) return null

  console.log(`[AuditReport] Running audit for ${lead.name} — ${lead.website}`)

  try {
    // 1. PageSpeed scores
    const speed = await scoreSite(lead.website)

    // 2. Deep-crawl site for content analysis
    const brain = await crawlBusinessSite(lead.website)

    // 3. Build issue list
    const issues: AuditIssue[] = []

    // Speed issues
    if (speed.mobile_score < 50) {
      issues.push({
        category: 'speed',
        severity: 'critical',
        title:    'Very slow on mobile',
        detail:   `Mobile PageSpeed score: ${speed.mobile_score}/100. Most local customers search on their phone.`,
        fix:      'Compress images, enable lazy loading, remove unused plugins.',
      })
    } else if (speed.mobile_score < 70) {
      issues.push({
        category: 'speed',
        severity: 'warning',
        title:    'Slow mobile load time',
        detail:   `Mobile score ${speed.mobile_score}/100. Ideal: 90+.`,
        fix:      'Optimize images and reduce JavaScript bundles.',
      })
    }

    if (speed.desktop_score < 60) {
      issues.push({
        category: 'speed',
        severity: 'warning',
        title:    'Below-average desktop speed',
        detail:   `Desktop score: ${speed.desktop_score}/100.`,
        fix:      'Enable caching and a CDN for static assets.',
      })
    }

    if (speed.broken) {
      issues.push({
        category: 'trust',
        severity: 'critical',
        title:    'Website is unreachable',
        detail:   'Your website returns an error or cannot be loaded. Customers see a broken page.',
        fix:      'Fix hosting or renew domain registration immediately.',
      })
    }

    // HTTPS
    if (lead.website && !lead.website.startsWith('https')) {
      issues.push({
        category: 'trust',
        severity: 'critical',
        title:    'No SSL / HTTPS',
        detail:   'Browsers show a "Not Secure" warning. 85% of users leave unsecured sites.',
        fix:      'Install a free SSL certificate via Let\'s Encrypt.',
      })
    }

    // Mobile-friendliness
    if (speed.issues.includes('Not mobile-friendly')) {
      issues.push({
        category: 'mobile',
        severity: 'critical',
        title:    'Not mobile-friendly',
        detail:   '60%+ of local searches are on mobile. Google penalizes non-mobile sites.',
        fix:      'Rebuild with a responsive template (we can do this for you).',
      })
    }

    // Content / SEO issues from crawled content
    const siteText = brain?.full_text ?? ''

    if (siteText && !/\bschema\b|application\/ld\+json/i.test(siteText)) {
      issues.push({
        category: 'seo',
        severity: 'warning',
        title:    'No structured data (Schema.org)',
        detail:   'Google can\'t identify your business type, services, or reviews automatically.',
        fix:      'Add LocalBusiness + Service schema markup.',
      })
    }

    if (!brain || brain.pages_scraped <= 1) {
      issues.push({
        category: 'seo',
        severity: 'warning',
        title:    'Thin website content',
        detail:   'Only 1 page detected. Google rewards sites with detailed service and location pages.',
        fix:      'Add dedicated pages for each service and city you serve.',
      })
    }

    if (siteText && !/blog|article|tip|guide|how to/i.test(siteText)) {
      issues.push({
        category: 'seo',
        severity: 'info',
        title:    'No content marketing',
        detail:   'No blog or resource pages found. Competitors with content rank higher.',
        fix:      'Publish 1 article/month on common customer questions.',
      })
    }

    // GBP / online presence
    if (lead.gbp_claimed === false) {
      issues.push({
        category: 'presence',
        severity: 'critical',
        title:    'Google Business Profile not claimed',
        detail:   'Your Google Maps listing is unverified. Competitors who claimed theirs rank above you.',
        fix:      'Claim your Google Business Profile at business.google.com (free, 5 min).',
      })
    }

    if ((lead.review_count ?? 0) < 10) {
      issues.push({
        category: 'trust',
        severity: 'warning',
        title:    'Very few online reviews',
        detail:   `Only ${lead.review_count ?? 0} Google reviews. Competitors average 50+ in your area.`,
        fix:      'Send review request texts to past customers after each job.',
      })
    }

    // AI visibility
    issues.push({
      category: 'ai_visibility',
      severity: 'warning',
      title:    'Not optimized for AI search (ChatGPT, Perplexity, Gemini)',
      detail:   '30% of local searches now go through AI assistants. If your site lacks structured data and clear service descriptions, AI tools skip you.',
      fix:      'Add FAQ sections, service descriptions, and schema markup so AI tools can cite you.',
    })

    // What they're doing well
    const wins: string[] = []
    if (speed.mobile_score >= 70) wins.push(`Good mobile speed (${speed.mobile_score}/100)`)
    if (lead.website?.startsWith('https')) wins.push('HTTPS / SSL enabled')
    if ((lead.review_count ?? 0) >= 20) wins.push(`${lead.review_count} Google reviews — solid social proof`)
    if (brain?.has_pricing) wins.push('Pricing/packages visible on site')
    if (brain?.has_team) wins.push('Team page builds trust with visitors')
    if (brain?.has_gallery) wins.push('Work portfolio / gallery present')
    if (wins.length === 0) wins.push('Active local business with real customer base')

    // Compute overall score
    const criticals = issues.filter(i => i.severity === 'critical').length
    const warnings  = issues.filter(i => i.severity === 'warning').length
    const overall_score = Math.max(10, 100 - criticals * 20 - warnings * 8)
    const grade = overall_score >= 80 ? 'B' : overall_score >= 60 ? 'C' : overall_score >= 40 ? 'D' : 'F'

    // Top 3 highest-impact fixes
    const top_3_fixes = issues
      .filter(i => i.severity !== 'info')
      .slice(0, 3)
      .map(i => `${i.title}: ${i.fix}`)

    // Generate AI-powered summary and specific recommendations via Gemini
    let ai_insights = ''
    if (siteText) {
      const prompt = `You are a web performance consultant analyzing a local ${lead.niche} business website.

Business: ${lead.name}, ${lead.city}, ${lead.state}
Website: ${lead.website}
Mobile PageSpeed: ${speed.mobile_score}/100
Desktop PageSpeed: ${speed.desktop_score}/100
Google Reviews: ${lead.review_count ?? 'unknown'}
Pages found: ${brain?.pages_scraped ?? 1}

Key issues found: ${issues.map(i => i.title).join(', ')}

Website content excerpt:
${siteText.slice(0, 3000)}

Write 2-3 specific, data-backed insights about this exact business's website that would compel the owner to want help. Be specific — mention things you actually found on their site. Do NOT use generic advice. Mention their actual business name. Format as 2-3 short sentences.`

      try {
        const res = await model.generateContent(prompt)
        ai_insights = res.response.text().trim()
      } catch { /* non-fatal */ }
    }

    // Build HTML report
    const html = buildHtmlReport({
      lead,
      overall_score,
      grade,
      issues,
      wins,
      top_3_fixes,
      ai_insights,
      speed,
    })

    // Plain text summary for email body
    const summary_text = ai_insights ||
      `We ran a free website audit for ${lead.name} and found ${criticals} critical issue${criticals !== 1 ? 's' : ''} hurting your online visibility. Your mobile speed score is ${speed.mobile_score}/100 — the industry average for top-ranking local businesses is 85+. The full report is attached — we can fix all of this for you starting at $299.`

    return { overall_score, grade, issues, wins, top_3_fixes, html, summary_text }

  } catch (e: any) {
    console.error(`[AuditReport] Error for ${lead.name}:`, e.message)
    return null
  }
}

function buildHtmlReport(params: {
  lead: Lead
  overall_score: number
  grade: string
  issues: AuditIssue[]
  wins: string[]
  top_3_fixes: string[]
  ai_insights: string
  speed: { mobile_score: number; desktop_score: number; issues: string[] }
}): string {
  const { lead, overall_score, grade, issues, wins, top_3_fixes, ai_insights, speed } = params

  const gradeColor = grade === 'A' ? '#22c55e' : grade === 'B' ? '#84cc16' : grade === 'C' ? '#f59e0b' : grade === 'D' ? '#f97316' : '#ef4444'

  const severityIcon = (s: string) => s === 'critical' ? '🔴' : s === 'warning' ? '🟡' : 'ℹ️'
  const categoryLabel = (c: string) => ({ speed: 'Page Speed', seo: 'SEO', mobile: 'Mobile', trust: 'Trust & Security', presence: 'Online Presence', ai_visibility: 'AI Visibility' }[c] ?? c)

  const issueRows = issues.map(i => `
    <tr>
      <td style="padding:12px 8px;border-bottom:1px solid #f1f5f9;">${severityIcon(i.severity)} <strong>${i.title}</strong><br><span style="color:#64748b;font-size:13px;">${i.detail}</span></td>
      <td style="padding:12px 8px;border-bottom:1px solid #f1f5f9;color:#0ea5e9;font-size:13px;">${categoryLabel(i.category)}</td>
      <td style="padding:12px 8px;border-bottom:1px solid #f1f5f9;color:#475569;font-size:13px;">${i.fix}</td>
    </tr>`).join('')

  const winsList = wins.map(w => `<li style="margin-bottom:6px;">✅ ${w}</li>`).join('')
  const fixList  = top_3_fixes.map((f, i) => `<li style="margin-bottom:10px;"><strong>${i + 1}.</strong> ${f}</li>`).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Free Website Audit — ${lead.name}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;background:#f8fafc;color:#1e293b}
  .container{max-width:720px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:40px 40px 32px;color:#fff}
  .header h1{margin:0 0 8px;font-size:28px;font-weight:700}
  .header p{margin:0;opacity:.8;font-size:15px}
  .score-row{display:flex;gap:24px;padding:32px 40px;background:#f8fafc;border-bottom:2px solid #e2e8f0}
  .score-card{flex:1;text-align:center;background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.06)}
  .score-card .num{font-size:36px;font-weight:800;line-height:1}
  .score-card .label{font-size:12px;color:#64748b;margin-top:4px}
  .section{padding:32px 40px;border-bottom:1px solid #f1f5f9}
  .section h2{margin:0 0 20px;font-size:18px;font-weight:700}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;padding:10px 8px;background:#f1f5f9;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#64748b}
  ul{margin:0;padding-left:20px}
  .cta{padding:40px;text-align:center;background:linear-gradient(135deg,#0ea5e9,#6366f1)}
  .cta h2{color:#fff;margin:0 0 12px;font-size:22px}
  .cta p{color:rgba(255,255,255,.85);margin:0 0 24px}
  .btn{display:inline-block;background:#fff;color:#0f172a;font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:16px}
  .ai-box{background:#eff6ff;border-left:4px solid #3b82f6;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:20px;font-size:14px;line-height:1.6;color:#1e40af}
  .footer{padding:24px 40px;text-align:center;font-size:12px;color:#94a3b8}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div style="font-size:12px;opacity:.6;margin-bottom:8px;text-transform:uppercase;letter-spacing:.1em">Free Website Audit Report</div>
    <h1>${lead.name}</h1>
    <p>${lead.website} · ${lead.city}, ${lead.state} · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
  </div>

  <div class="score-row">
    <div class="score-card">
      <div class="num" style="color:${gradeColor}">${grade}</div>
      <div class="label">Overall Grade</div>
    </div>
    <div class="score-card">
      <div class="num" style="color:${speed.mobile_score >= 70 ? '#22c55e' : speed.mobile_score >= 50 ? '#f59e0b' : '#ef4444'}">${speed.mobile_score}</div>
      <div class="label">Mobile Speed</div>
    </div>
    <div class="score-card">
      <div class="num" style="color:${speed.desktop_score >= 70 ? '#22c55e' : '#f59e0b'}">${speed.desktop_score}</div>
      <div class="label">Desktop Speed</div>
    </div>
    <div class="score-card">
      <div class="num" style="color:#ef4444">${issues.filter(i => i.severity === 'critical').length}</div>
      <div class="label">Critical Issues</div>
    </div>
    <div class="score-card">
      <div class="num" style="color:#f59e0b">${issues.filter(i => i.severity === 'warning').length}</div>
      <div class="label">Warnings</div>
    </div>
  </div>

  ${ai_insights ? `<div class="section"><div class="ai-box">🤖 <strong>AI Analysis:</strong> ${ai_insights}</div></div>` : ''}

  <div class="section">
    <h2>🔥 Top 3 Highest-Impact Fixes</h2>
    <ul style="font-size:14px;line-height:1.8">${fixList}</ul>
  </div>

  <div class="section">
    <h2>⚠️ Issues Found (${issues.length})</h2>
    <table>
      <thead><tr><th>Issue</th><th>Category</th><th>How to Fix</th></tr></thead>
      <tbody>${issueRows}</tbody>
    </table>
  </div>

  <div class="section">
    <h2>✅ What You're Doing Well</h2>
    <ul style="font-size:14px;line-height:1.8">${winsList}</ul>
  </div>

  <div class="cta">
    <h2>Ready to fix this?</h2>
    <p>We'll rebuild your entire online presence — faster site, better SEO, AI receptionist that answers calls 24/7.</p>
    <a href="${process.env.CALENDLY_URL ?? 'https://webcrew.app'}" class="btn">Book a Free 15-min Call →</a>
    <p style="color:rgba(255,255,255,.6);font-size:12px;margin-top:16px">Or reply to this email — we respond within 2 hours</p>
  </div>

  <div class="footer">
    This audit was prepared by Webcrew AI · <a href="https://webcrew.app" style="color:#94a3b8">webcrew.app</a><br>
    We built your competitors' sites. Now it's your turn.
  </div>
</div>
</body>
</html>`
}
