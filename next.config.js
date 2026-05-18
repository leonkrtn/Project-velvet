/** @type {import('next').NextConfig} */
const nextConfig = {
  // postgres-Paket läuft nur server-seitig (DDL-Migrationen),
  // nicht im Browser-Bundle
  // postgres: server-only DDL migrations
  // @react-pdf/renderer: loaded natively in Node.js API route (renderToBuffer),
  // not bundled by webpack to avoid ESM/reconciler conflicts
  serverExternalPackages: ['postgres', '@react-pdf/renderer'],
}
module.exports = nextConfig
