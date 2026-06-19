'use client'
// Fängt unerwartete Render-Fehler der Editor-Vorschau ab, damit das iframe
// nie die generische Next.js-Fehlerseite zeigt.
export default function PreviewError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: '2rem', gap: '0.75rem', fontFamily: 'system-ui, sans-serif', color: '#6b6258',
    }}>
      <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', color: '#2c2622' }}>
        Vorschau konnte nicht geladen werden
      </p>
      <p style={{ fontSize: '0.85rem', maxWidth: 320 }}>
        Speichert eure Änderungen und versucht es erneut.
      </p>
      <button onClick={reset} style={{
        marginTop: '0.5rem', padding: '0.5rem 1.1rem', border: '1px solid #ddd',
        borderRadius: 8, background: '#fff', cursor: 'pointer',
      }}>Neu laden</button>
    </div>
  )
}
