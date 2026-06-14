/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['postgres'],
  // Linting nicht den Build blockieren lassen (nicht-blockierend);
  // ESLint läuft separat via `npm run lint`.
  eslint: { ignoreDuringBuilds: true },
  // @react-pdf/renderer is ESM-only; transpilePackages bundles it into the
  // client bundle sharing the same React instance — required for BlobProvider
  transpilePackages: ['@react-pdf/renderer'],
  // Disable prerendering for dynamic content
  skipTrailingSlashRedirect: true,
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
}
module.exports = nextConfig
