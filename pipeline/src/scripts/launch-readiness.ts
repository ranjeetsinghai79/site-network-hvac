import { config } from 'dotenv'
import { getLaunchReadiness } from '../compliance/index.js'

config({ path: '.env' })
config({ path: '../.env.local' })
config({ path: '../admin/.env.local' })

const items = getLaunchReadiness()
const blocked = items.filter((item) => item.status === 'blocked')
const manual = items.filter((item) => item.status === 'manual')

console.log('Launch Readiness')
console.log('================')
for (const item of items) {
  const icon = item.status === 'ready' ? 'OK' : item.status === 'manual' ? 'MANUAL' : 'BLOCKED'
  console.log(`${icon.padEnd(7)} ${item.area.padEnd(12)} ${item.requirement}`)
}

console.log('')
console.log(`Ready: ${items.filter((item) => item.status === 'ready').length}`)
console.log(`Manual: ${manual.length}`)
console.log(`Blocked: ${blocked.length}`)

if (blocked.length) process.exitCode = 1
