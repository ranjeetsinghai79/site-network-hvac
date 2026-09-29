import { geminiText, GEMINI_PRO, GEMINI_FLASH } from '../tools/gemini.js'

async function main() {
  console.log(`Testing ${GEMINI_PRO} on Vertex...`)
  const pro = await geminiText(`Say exactly: "${GEMINI_PRO} on Vertex working"`, { model: GEMINI_PRO })
  console.log('PRO:', pro.trim())

  console.log(`Testing ${GEMINI_FLASH} on Vertex...`)
  const flash = await geminiText(`Say exactly: "${GEMINI_FLASH} on Vertex working"`, { model: GEMINI_FLASH })
  console.log('FLASH:', flash.trim())

  console.log('\nAll Vertex AI text models OK ✓')
}

main().catch(e => { console.error(e); process.exit(1) })
