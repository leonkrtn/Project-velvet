/** @type {import('next').NextConfig} */
const nextConfig = {
  // postgres-Paket läuft nur server-seitig (DDL-Migrationen),
  // nicht im Browser-Bundle
  serverExternalPackages: ['postgres'],
  // @react-pdf/renderer: transpiled (not external) so both client and API route
  // share ONE React instance — avoids $$typeof symbol mismatch / error #31
  transpilePackages: ['@react-pdf/renderer'],
}
module.exports = nextConfig
