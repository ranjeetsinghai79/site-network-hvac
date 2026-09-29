import { Pool, neonConfig } from "@neondatabase/serverless"

// Use HTTP fetch instead of WebSocket — required for CF Workers/Pages edge runtime
neonConfig.poolQueryViaFetch = true

export { Pool }
