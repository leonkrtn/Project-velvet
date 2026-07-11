import React from 'react'
import '@/app/brautpaar/brautpaar.css'

// Sofortiges Lade-Skelett: erscheint beim Klick unmittelbar, während die
// (dynamische) Detailseite serverseitig gerendert wird. Dadurch fühlt sich die
// Navigation direkt an, statt kurz „hängen zu bleiben".
export default function Loading() {
  const box = (style: React.CSSProperties) => (
    <div style={{ background: 'linear-gradient(90deg, #efeae2 25%, #f6f2ec 37%, #efeae2 63%)', backgroundSize: '400% 100%', animation: 'bpShimmer 1.2s ease-in-out infinite', borderRadius: 12, ...style }} />
  )
  return (
    <div className="bp-page">
      <style>{`@keyframes bpShimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}`}</style>
      {box({ width: 150, height: 34, marginBottom: 16 })}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 24, alignItems: 'start' }} className="mp-prev-grid">
        <div>
          {box({ width: '100%', aspectRatio: '16/9', borderRadius: 18 })}
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            {box({ width: 96, height: 72 })}
            {box({ width: 96, height: 72 })}
            {box({ width: 96, height: 72 })}
          </div>
          {box({ width: 120, height: 16, margin: '22px 0 8px' })}
          {box({ width: '70%', height: 30, marginBottom: 12 })}
          {box({ width: '100%', height: 14, marginBottom: 6 })}
          {box({ width: '92%', height: 14, marginBottom: 6 })}
          {box({ width: '80%', height: 14, marginBottom: 24 })}
          {box({ width: '100%', height: 120 })}
        </div>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {box({ width: '100%', height: 180 })}
          {box({ width: '100%', height: 120 })}
        </aside>
      </div>
    </div>
  )
}
