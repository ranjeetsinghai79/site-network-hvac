import { chromium } from 'playwright'

async function main() {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const ctx = await b.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', locale: 'en-US' })
  const p = await ctx.newPage()

  await p.goto('https://www.hotfrog.com/search/ca/los-angeles/dentist', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await p.waitForTimeout(2000)

  const title = await p.title()
  const counts = await p.evaluate(() => {
    const sels = ['article','[class*="business"]','[class*="listing"]','[class*="result"]','.card','.company','.item','.entry','li.company','div.company']
    return Object.fromEntries(sels.map(s => [s, document.querySelectorAll(s).length]))
  })
  // Grab first 500 chars of body to see structure
  const body = await p.evaluate(() => document.body.innerHTML.replace(/<script[\s\S]*?<\/script>/g,'').replace(/\s+/g,' ').slice(0, 800))
  // Count links with business-looking text
  const links = await p.$$eval('a', els => els.filter(a => /\bCA\b|dentist|dental/i.test(a.textContent || '')).length)

  console.log('title:', title)
  console.log('counts:', JSON.stringify(counts, null, 2))
  console.log('body:', body)
  console.log('relevant links:', links)
  await b.close()
}

main().catch(e => { console.error(e.message); process.exit(1) })
