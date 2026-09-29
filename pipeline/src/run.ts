import 'dotenv/config'
import { runPipeline } from './orchestrator.js'
import type { PipelineConfig } from './types.js'

const config: PipelineConfig = {
  niche: (process.env.NICHE as PipelineConfig['niche']) || 'medspa',
  location: process.env.LOCATION || 'Los Angeles, CA',
  city: process.env.CITY || 'Los Angeles',
  state: process.env.STATE || 'CA',
  count: parseInt(process.env.COUNT || '10'),
  templateOwner: process.env.TEMPLATE_OWNER || 'ranjeetsinghai79',
  templateRepo: process.env.TEMPLATE_REPO || 'websitedeveloper',
  deployOwner: process.env.DEPLOY_OWNER || 'ranjeetsinghai79',
  dryRun: process.env.DRY_RUN === 'true',
}

runPipeline(config).catch(console.error)
