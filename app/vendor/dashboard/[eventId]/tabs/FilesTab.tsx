'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, Download } from 'lucide-react'

interface EventFile { id: string; name: string; file_url: string; category: string; uploaded_at: string }

const CATEGORY_LABELS: Record<string, string> = {
  vertrag:       'Vertrag',
  versicherung:  'Versicherung',
  genehmigung:   'Genehmigung',
  rider:         'Rider',
  sonstiges:     'Sonstiges',
}

const CATEGORY_ORDER = ['vertrag', 'versicherung', 'genehmigung', 'rider', 'sonstiges']

export default function FilesTab({ eventId }: { eventId: string }) {
  const [files, setFiles]   = useState<EventFile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('event_files').select('id, name, file_url, category, uploaded_at').eq('event_id', eventId).order('uploaded_at', { ascending: false })
      .then(({ data }) => { setFiles(data ?? []); setLoading(false) })
  }, [eventId])

  const grouped = CATEGORY_ORDER.reduce<Record<string, EventFile[]>>((acc, cat) => {
    const catFiles = files.filter(f => f.category === cat)
    if (catFiles.length > 0) acc[cat] = catFiles
    return acc
  }, {})

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>Dokumente</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{files.length} Dokument{files.length !== 1 ? 'e' : ''}</p>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Wird geladen…</div>
      ) : files.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '32px 24px', textAlign: 'center', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 14 }}>
          Noch keine Dokumente hinterlegt.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640 }}>
          {Object.entries(grouped).map(([cat, catFiles]) => (
            <div key={cat}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                {CATEGORY_LABELS[cat] ?? cat}
              </p>
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                {catFiles.map((f, i) => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: i < catFiles.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={16} style={{ color: 'var(--accent)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {new Date(f.uploaded_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <a href={f.file_url} target="_blank" rel="noreferrer" download={f.name} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-primary)', textDecoration: 'none', background: '#F5F5F7', flexShrink: 0 }}>
                      <Download size={12} /> Download
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
