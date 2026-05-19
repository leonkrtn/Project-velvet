'use client'
import React, { useState, useRef } from 'react'
import { X, Upload, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { ParsedRow } from '@/app/api/veranstalter/[eventId]/guests/import/route'

interface Props {
  eventId: string
  onClose: () => void
  onSuccess: (result: { added: number; updated: number }) => void
}

type Step = 'upload' | 'preview' | 'done'

interface ParseStats {
  total: number
  toCreate: number
  toUpdate: number
  errors: number
}

export default function ImportModal({ eventId, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [stats, setStats] = useState<ParseStats | null>(null)
  const [result, setResult] = useState<{ added: number; updated: number } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.name.endsWith('.xlsx')) {
      setError('Bitte eine .xlsx-Datei auswählen.')
      return
    }
    setError(null)
    setLoading(true)

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/veranstalter/${eventId}/guests/import`, {
        method: 'POST',
        body: form,
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Fehler beim Verarbeiten der Datei.')
        setLoading(false)
        return
      }
      setRows(json.rows)
      setStats(json.stats)
      setStep('preview')
    } catch {
      setError('Fehler beim Hochladen der Datei.')
    } finally {
      setLoading(false)
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function confirmImport() {
    const validRows = rows.filter(r => r.action !== 'error')
    if (validRows.length === 0) return
    setConfirming(true)
    setError(null)
    try {
      const res = await fetch(`/api/veranstalter/${eventId}/guests/import/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: validRows }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Fehler beim Importieren.')
        return
      }
      const importResult = { added: json.added, updated: json.updated }
      setResult(importResult)
      setStep('done')
      onSuccess(importResult)
    } catch {
      setError('Netzwerkfehler beim Importieren.')
    } finally {
      setConfirming(false)
    }
  }

  const hasValidRows = rows.some(r => r.action !== 'error')

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gäste importieren"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 'var(--radius)', width: '100%',
          maxWidth: step === 'preview' ? 860 : 480,
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
            {step === 'upload' && 'Gäste importieren'}
            {step === 'preview' && 'Importvorschau'}
            {step === 'done' && 'Import abgeschlossen'}
          </h3>
          <button
            onClick={onClose}
            aria-label="Schließen"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {step === 'upload' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Lade eine .xlsx-Datei hoch (z.B. die heruntergeladene Vorlage oder einen Export).
                Leere Zellen werden ignoriert und behalten den bestehenden Wert.
              </p>

              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  padding: '40px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragging ? 'rgba(0,0,0,0.02)' : 'var(--surface)',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <Upload size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
                <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                  Datei hierher ziehen oder klicken
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Nur .xlsx-Dateien</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  style={{ display: 'none' }}
                  onChange={onFileInput}
                />
              </div>

              {loading && (
                <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
                  Datei wird verarbeitet…
                </p>
              )}

              {error && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#FEF2F2', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(220,38,38,0.2)' }}>
                  <AlertCircle size={14} style={{ color: '#DC2626', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#DC2626' }}>{error}</span>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && stats && (
            <div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: '#EAF5EE', color: '#3D7A56', fontWeight: 600 }}>
                  {stats.toCreate} neu
                </span>
                <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>
                  {stats.toUpdate} aktualisieren
                </span>
                {stats.errors > 0 && (
                  <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: '#FEF2F2', color: '#DC2626', fontWeight: 600 }}>
                    {stats.errors} Fehler
                  </span>
                )}
              </div>

              {error && (
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#FEF2F2', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(220,38,38,0.2)' }}>
                  <AlertCircle size={14} style={{ color: '#DC2626', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#DC2626' }}>{error}</span>
                </div>
              )}

              <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F5F5F7' }}>
                      {['Zeile', 'Typ', 'Hauptgast', 'Name', 'Status', 'Aktion', 'Fehler'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr
                        key={row.rowIndex}
                        style={{ background: row.errors.length > 0 ? '#FEF2F2' : 'transparent', borderBottom: '1px solid var(--border)' }}
                      >
                        <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>{row.rowIndex}</td>
                        <td style={{ padding: '7px 10px' }}>{row.typ}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>{row.hauptgast ?? '—'}</td>
                        <td style={{ padding: '7px 10px', fontWeight: 500 }}>{row.name || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>leer</span>}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>{row.status ?? '—'}</td>
                        <td style={{ padding: '7px 10px' }}>
                          {row.action === 'create' && (
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#EAF5EE', color: '#3D7A56', fontWeight: 600 }}>Neu</span>
                          )}
                          {row.action === 'update' && (
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>Aktualisieren</span>
                          )}
                          {row.action === 'error' && (
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#FEF2F2', color: '#DC2626', fontWeight: 600 }}>Fehler</span>
                          )}
                        </td>
                        <td style={{ padding: '7px 10px', color: '#DC2626', fontSize: 11 }}>
                          {row.errors.join(', ') || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setStep('upload'); setRows([]); setStats(null); setError(null) }}
                  style={{ padding: '8px 14px', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Zurück
                </button>
                <button
                  onClick={confirmImport}
                  disabled={!hasValidRows || confirming}
                  style={{
                    padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none',
                    borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: !hasValidRows || confirming ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', fontWeight: 500, opacity: !hasValidRows || confirming ? 0.6 : 1,
                  }}
                >
                  {confirming ? 'Wird importiert…' : 'Import bestätigen'}
                </button>
              </div>
            </div>
          )}

          {step === 'done' && result && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <CheckCircle2 size={40} style={{ color: '#3D7A56', marginBottom: 16 }} />
              <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Import abgeschlossen</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
                {result.added > 0 && `${result.added} Gast/Gäste hinzugefügt`}
                {result.added > 0 && result.updated > 0 && ', '}
                {result.updated > 0 && `${result.updated} aktualisiert`}
              </p>
              <button
                onClick={onClose}
                style={{ padding: '9px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
              >
                Schließen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
