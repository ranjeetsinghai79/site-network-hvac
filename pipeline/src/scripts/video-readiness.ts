import 'dotenv/config'
import { config } from 'dotenv'
import { getVideoProviderReadiness } from '../video/providers.js'

config({ path: '../admin/.env.local' })

const items = getVideoProviderReadiness()

console.log('Video Provider Readiness')
console.log('========================')
for (const item of items) {
  console.log(`${item.mode.toUpperCase().padEnd(7)} ${item.label.padEnd(22)} ${item.requirement}`)
}

console.log('')
console.log('Recommendation: RunPod first for custom/open-source video workers; GCP/Veo as managed premium fallback.')
