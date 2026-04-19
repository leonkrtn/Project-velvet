import { Grid2X2 } from 'lucide-react'

export default function SitzplanPage() {
  return <PlaceholderPage title="Sitzplan" icon="grid" />
}

function PlaceholderPage({ title }: { title: string; icon: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, textAlign: 'center', gap: 16 }}>
      <div style={{ width: 64, height: 64, borderRadius: 'var(--radius)', background: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Grid2X2 size={28} color="var(--text-tertiary)" />
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 600 }}>{title}</h2>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 320 }}>
        Diese Funktion wird bald verfügbar sein. Wir arbeiten noch an dieser Seite.
      </p>
      <span style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', background: 'var(--accent-light)', color: 'var(--accent)' }}>
        In Entwicklung
      </span>
    </div>
  )
}
