/** @type {import('next').NextConfig} */
const nextConfig = {
  // @react-pdf/renderer MUSS serverseitig unbundled laufen (serverExternalPackages):
  // Wird es vom Webpack-Server-Build gebundlet, bricht der interne Reconciler beim
  // Rendern mit "Cannot read properties of undefined (reading 'S')". Unbundled (Node-
  // Import des vorkompilierten lib/react-pdf.js) rendert es korrekt — Voraussetzung ist,
  // dass App- und Server-React dieselbe Major-Version haben (React 19), damit
  // @react-pdf/reconciler den passenden Reconciler (react-19.2) waehlt. Andernfalls
  // lieferten ALLE Angebots-PDF-Routen keinen Output (PDF-Vorschau lud endlos).
  serverExternalPackages: ['postgres', '@react-pdf/renderer'],
  // ESLint im Build erzwingen: schlägt nur bei Errors fehl (Warnings sind ok),
  // damit Lint-Fehler nicht unbemerkt in Produktion gelangen.
  eslint: { ignoreDuringBuilds: false },
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
