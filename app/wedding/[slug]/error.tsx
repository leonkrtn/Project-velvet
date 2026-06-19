'use client'
// Fängt unerwartete Render-Fehler der öffentlichen Hochzeitswebsite ab.
export default function WeddingError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: '2rem', gap: '0.75rem', fontFamily: 'system-ui, sans-serif', color: '#6b6258',
    }}>
      <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.6rem', color: '#2c2622' }}>
        Seite momentan nicht verfügbar
      </p>
      <p style={{ fontSize: '0.9rem', maxWidth: 360 }}>
        Bitte versuche es in einem Moment erneut.
      </p>
      <button onClick={reset} style={{
        marginTop: '0.5rem', padding: '0.55rem 1.2rem', border: '1px solid #ddd',
        borderRadius: 8, background: '#fff', cursor: 'pointer',
      }}>Neu laden</button>
    </div>
  )
}
