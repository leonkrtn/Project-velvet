/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['postgres'],
  // ESLint im Build erzwingen: schlägt nur bei Errors fehl (Warnings sind ok),
  // damit Lint-Fehler nicht unbemerkt in Produktion gelangen.
  eslint: { ignoreDuringBuilds: false },
  // @react-pdf/renderer is ESM-only; transpilePackages bundles it into the
  // client bundle sharing the same React instance — required for BlobProvider
  transpilePackages: ['@react-pdf/renderer'],
  // Disable prerendering for dynamic content
  skipTrailingSlashRedirect: true,
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  async headers() {
    // Defense-in-depth-Header für alle Routen. Bewusst ohne strenge CSP,
    // da die App externe iframes (Spotify/YouTube/Apple Music) und Supabase/R2
    // einbindet — eine zu enge CSP würde diese brechen. Clickjacking-Schutz via
    // frame-ancestors; Self-Embedding (eigene Vorschau-iframes) bleibt erlaubt.
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
    ]
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}
module.exports = nextConfig
