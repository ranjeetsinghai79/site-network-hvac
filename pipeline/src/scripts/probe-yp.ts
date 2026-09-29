import { chromium } from 'playwright'

async function main() {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const p = await b.newPage()
  await p.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
  await p.goto('https://www.yellowpages.com/search?search_terms=medical+spas&geo_location_terms=Los+Angeles%2C+CA', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await p.waitForTimeout(2500)

  const title = await p.title()
  const h1    = await p.$eval('h1', (e: Element) => e.textContent).catch(() => 'no h1')

  const counts = await p.evaluate(() => {
    const sel = ['.result.organic','article.result','.result','.srp-listing','.listing','[class*="listing"]','[class*="result"]']
    return Object.fromEntries(sel.map(s => [s, document.querySelectorAll(s).length]))
  })

  const sample = await p.evaluate(() => {
    const divs = Array.from(document.querySelectorAll('div,article,li'))
      .filter((d: any) => /result|listing|card/i.test(d.className))
    return divs.slice(0, 6).map((d: any) => d.className.slice(0, 100))
  })

  const bodySnippet = await p.evaluate(() => document.body.innerHTML.slice(0, 500))

  console.log('title:', title)
  console.log('h1:', h1?.trim())
  console.log('counts:', JSON.stringify(counts))
  console.log('sample classes:', JSON.stringify(sample))
  console.log('body snippet:', bodySnippet.replace(/\s+/g, ' ').slice(0, 300))
  await b.close()
}

main().catch(e => { console.error(e.message); process.exit(1) })
