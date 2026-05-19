/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['postgres'],
  // @react-pdf/renderer is ESM-only; transpilePackages bundles it into the
  // client bundle sharing the same React instance — required for BlobProvider
  transpilePackages: ['@react-pdf/renderer'],
}
module.exports = nextConfig
