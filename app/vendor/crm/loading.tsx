import {
  Users, Search, Filter, ListChecks, RefreshCw, Upload, Download, Plus, LayoutGrid, List,
} from 'lucide-react'

export default function Loading() {
  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px',
    borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg)',
    fontSize: 12, color: 'var(--text-secondary)', pointerEvents: 'none',
  }
  const iconBtnStyle: React.CSSProperties = {
    padding: '8px 10px', border: 'none', background: 'var(--bg)',
    color: 'var(--text-secondary)', pointerEvents: 'none',
  }

  return (
    <div style={{ padding: '28px 24px 48px', background: 'var(--bg)', flex: 1, overflow: 'auto' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>

        {/* Header — identical to CrmClient header so there's no flash on hydration */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>CRM — Kundendaten</h1>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0', visibility: 'hidden' }}>0 Kontakte</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', pointerEvents: 'none' }}>
              <div style={btnStyle}><ListChecks size={13} /><span>Aufgaben</span></div>
              <div style={btnStyle}><RefreshCw size={13} /><span>Auto-Import</span></div>
              <div style={btnStyle}><Upload size={13} /><span>CSV Import</span></div>
              <div style={btnStyle}><Download size={13} /><span>Vorlage</span></div>
              <div style={btnStyle}><Download size={13} /><span>Export</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600 }}>
                <Plus size={14} /> Neu
              </div>
            </div>
          </div>

          {/* Search + filter row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <div style={{ width: '100%', padding: '8px 12px 8px 30px', borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 13, color: 'var(--text-tertiary)', boxSizing: 'border-box' as const }}>
                Name, E-Mail oder Telefon…
              </div>
            </div>
            <div style={{ ...btnStyle, gap: 5 }}><Filter size={13} /> Filter</div>
            <div style={{ display: 'flex', border: '1px solid var(--border2)', borderRadius: 9, overflow: 'hidden' }}>
              <div style={{ ...iconBtnStyle, background: 'var(--accent)', color: '#fff' }}><List size={14} /></div>
              <div style={iconBtnStyle}><LayoutGrid size={14} /></div>
            </div>
          </div>
        </div>

        {/* List header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 160px 120px 100px 90px', gap: 12, padding: '10px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
          <div />
          {(['Kontakt', 'Veranstaltung', 'Wert', 'Quelle', 'Status'] as const).map((label, i) => (
            <span key={label} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i >= 2 ? 'right' : 'left' }}>{label}</span>
          ))}
        </div>

        {/* Skeleton list rows */}
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 160px 120px 100px 90px', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
            <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 9 }} />
            <div>
              <div className="skeleton" style={{ height: 14, width: 140 + (i % 3) * 30, marginBottom: 7, borderRadius: 5 }} />
              <div className="skeleton" style={{ height: 12, width: 100 + (i % 2) * 40, borderRadius: 4 }} />
            </div>
            <div>
              <div className="skeleton" style={{ height: 13, width: 90 + (i % 3) * 20, marginBottom: 6, borderRadius: 4 }} />
              <div className="skeleton" style={{ height: 11, width: 60, borderRadius: 4 }} />
            </div>
            <div className="skeleton" style={{ height: 14, width: 60 + (i % 2) * 20, borderRadius: 4, marginLeft: 'auto' }} />
            <div className="skeleton" style={{ height: 12, width: 50, borderRadius: 4, margin: '0 auto' }} />
            <div className="skeleton" style={{ height: 20, width: 58, borderRadius: 100, marginLeft: 'auto' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
