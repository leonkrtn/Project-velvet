/** @type {import('next').NextConfig} */
const nextConfig = {
  // postgres-Paket läuft nur server-seitig (DDL-Migrationen),
  // nicht im Browser-Bundle
  serverExternalPackages: ['postgres'],
  // @react-pdf/renderer is an ESM package — must be transpiled
  transpilePackages: ['@react-pdf/renderer'],
}
module.exports = nextConfig
