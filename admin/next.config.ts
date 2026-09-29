import type { NextConfig } from "next"
import path from "path"

const config: NextConfig = {
  output: "standalone",
  experimental: { serverActions: { allowedOrigins: ["localhost:3010", "admin-zb56yaa3dq-uc.a.run.app"] } },
  outputFileTracingRoot: path.join(__dirname, "../../"),
  typescript: { ignoreBuildErrors: true },
}

export default config
