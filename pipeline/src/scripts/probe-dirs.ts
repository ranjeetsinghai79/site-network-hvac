/**
 * Quick probe to find which directories work without Cloudflare blocks
 */
import { chromium } from 'playwright'

async function probe(name: string, url: string, checkFn: (html: string) => { ok: boolean; count?: number; selector?: string }) {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] })
  const ctx = await b.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
  })
  const p = await ctx.newPage()
  try {
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    await p.waitForTimeout(2000)
    const html = await p.content()
    const title = await p.title()
    const r = checkFn(html)
    console.log(`[${r.ok ? '✅' : '❌'}] ${name.padEnd(20)} | ${r.ok ? `${r.count ?? '?'} results | ${r.selector ?? ''}` : 'BLOCKED'} | "${title.slice(0,50)}"`)
  } catch(e: any) {
    console.log(`[💥] ${name.padEnd(20)} | error: ${e.message.slice(0,60)}`)
  } finally {
    await b.close()
  }
}

const checks = [
  {
    name: 'Manta dentists',
    url: 'https://www.manta.com/mb_46_E1ADBADC_000/dentist?search_term=dentist&search_location=Los+Angeles%2C+CA',
    check: (h: string) => ({ ok: h.includes('business-result') || h.includes('manta-card'), count: (h.match(/class="[^"]*card/g) || []).length })
  },
  {
    name: 'Superpages dentists',
    url: 'https://www.superpages.com/dental-offices/dentist-los-angeles-ca',
    check: (h: string) => ({ ok: !h.includes('you have been blocked') && !h.includes('Cloudflare'), count: (h.match(/class="[^"]*result/g) || []).length })
  },
  {
    name: 'Yelp dentists',
    url: 'https://www.yelp.com/search?find_desc=dentists&find_loc=Los+Angeles%2C+CA',
    check: (h: string) => ({ ok: !h.includes('you have been blocked') && h.includes('businessName'), count: (h.match(/"businessName"/g) || []).length })
  },
  {
    name: 'BBB dentists',
    url: 'https://www.bbb.org/search?find_country=USA&find_text=dentist&find_loc=Los+Angeles%2C+CA',
    check: (h: string) => ({ ok: !h.includes('you have been blocked') && h.includes('result'), count: (h.match(/class="[^"]*result/g) || []).length })
  },
  {
    name: 'Hotfrog medspas',
    url: 'https://www.hotfrog.com/search/ca/los-angeles/medical-spas',
    check: (h: string) => ({ ok: !h.includes('you have been blocked') && h.includes('business'), count: (h.match(/class="[^"]*business/g) || []).length })
  },
  {
    name: 'DnB dentists',
    url: 'https://www.dnb.com/business-directory/company-information.dentist.us.html',
    check: (h: string) => ({ ok: !h.includes('you have been blocked') && h.includes('result'), count: (h.match(/class="[^"]*result/g) || []).length })
  },
]

async function main() {
  for (const c of checks) {
    await probe(c.name, c.url, c.check)
    await new Promise(r => setTimeout(r, 1000))
  }
  console.log('\nDone.')
}
main().catch(e => { console.error(e.message); process.exit(1) })
