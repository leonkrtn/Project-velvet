/** @type {import('next').NextConfig} */
const nextConfig = {
  // postgres-Paket läuft nur server-seitig (DDL-Migrationen),
  // nicht im Browser-Bundle
  experimental: {
    serverExternalPackages: ['postgres'],
  },
}
module.exports = nextConfig
