'use client'
import React, { useState, useRef } from 'react'
import { X, Upload, AlertCircle, CheckCircle2, Copy, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ParsedRow } from '@/app/api/veranstalter/[eventId]/guests/import/route'

interface Props {
  eventId: string
  onClose: () => void
  onSuccess: (result: { added: number; updated: number }) => void
}

type Step = 'upload' | 'preview' | 'importing' | 'done'

interface ParseStats {
  total: number
  toCreate: number
  toUpdate: number
  errors: number
}

interface ConfirmError {
  rowIndex: number
  name: string
  reason: string
}

export default function ImportModal({ eventId, onClose, onSuccess }: Props) {
  const supabase = createClient()
  const [step, setStep] = useState<Step>('upload')
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [stats, setStats] = useState<ParseStats | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState<{ added: number; updated: number; errors: ConfirmError[] } | null>(null)
  const [importLog, setImportLog] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logRef = useRef<HTMLPreElement>(null)

  function addLog(line: string) {
    setImportLog(prev => [...prev, line])
  }

  async function copyLog() {
    const text = importLog.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select text in pre
      if (logRef.current) {
        const range = document.createRange()
        range.selectNodeContents(logRef.current)
        window.getSelection()?.removeAllRanges()
        window.getSelection()?.addRange(range)
      }
    }
  }

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
    e.target.value = ''
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

    setImportLog([])
    setCopied(false)

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      setError('Nicht angemeldet.')
      addLog(`[AUTH] FEHLER: ${authError?.message ?? 'Kein Benutzer'}`)
      return
    }
    const user = authData.user
    addLog(`[AUTH] Benutzer: ${user.id} (${user.email ?? '–'})`)

    const guestRows = validRows.filter(r => r.typ === 'Gast')
    const begleitRows = validRows.filter(r => r.typ === 'Begleitperson')
    const total = validRows.length

    addLog(`[START] ${guestRows.length} Gäste, ${begleitRows.length} Begleitpersonen`)

    setStep('importing')
    setProgress({ done: 0, total })

    let added = 0
    let updated = 0
    const importErrors: ConfirmError[] = []
    const newGuestMap: Record<string, string> = {}

    for (const row of guestRows) {
      if (row.action === 'update' && row.id) {
        addLog(`[GAST] Zeile ${row.rowIndex} · "${row.name}" → UPDATE id=${row.id}`)
        const payload: Record<string, unknown> = {}
        if (row.name) payload.name = row.name
        if (row.email !== null) payload.email = row.email
        if (row.phone !== null) payload.phone = row.phone
        if (row.status !== null) payload.status = row.status
        if (row.side !== null) payload.side = row.side
        if (row.meal_choice !== null) payload.meal_choice = row.meal_choice
        if (row.allergy_tags.length > 0) payload.allergy_tags = row.allergy_tags
        if (row.allergy_custom !== null) payload.allergy_custom = row.allergy_custom
        if (row.trink_alkohol !== null) payload.trink_alkohol = row.trink_alkohol
        if (row.notes !== null) payload.notes = row.notes

        addLog(`  payload: ${JSON.stringify(payload)}`)
        const { error } = await supabase.from('guests').update(payload).eq('id', row.id)
        if (error) {
          addLog(`  FEHLER: ${error.message} (code=${error.code}, details=${error.details})`)
          importErrors.push({ rowIndex: row.rowIndex, name: row.name, reason: error.message })
        } else {
          addLog(`  OK`)
          newGuestMap[row.name] = row.id
          updated++
        }
      } else {
        addLog(`[GAST] Zeile ${row.rowIndex} · "${row.name}" → INSERT (neu)`)
        const insertPayload = {
          event_id: eventId,
          name: row.name,
          created_by: user.id,
          status: row.status ?? 'angelegt',
          side: row.side ?? null,
          meal_choice: row.meal_choice ?? null,
          allergy_tags: row.allergy_tags.length > 0 ? row.allergy_tags : [],
          allergy_custom: row.allergy_custom ?? null,
          trink_alkohol: row.trink_alkohol ?? null,
          notes: row.notes ?? null,
          email: row.email ?? null,
          phone: row.phone ?? null,
        }
        addLog(`  payload: ${JSON.stringify(insertPayload)}`)

        const { data, error } = await supabase.from('guests').insert(insertPayload).select('id').single()

        if (error) {
          addLog(`  FEHLER: ${error.message} (code=${error.code}, hint=${error.hint ?? '–'}, details=${error.details ?? '–'})`)
          importErrors.push({ rowIndex: row.rowIndex, name: row.name, reason: error.message })
        } else if (data) {
          addLog(`  OK id=${data.id}`)
          newGuestMap[row.name] = data.id
          added++
        } else {
          addLog(`  FEHLER: Keine Daten zurückgegeben (kein Fehler-Objekt)`)
          importErrors.push({ rowIndex: row.rowIndex, name: row.name, reason: 'Kein Datensatz zurückgegeben' })
        }
      }
      setProgress(p => ({ ...p, done: p.done + 1 }))
    }

    for (const row of begleitRows) {
      let parentId: string | null = newGuestMap[row.hauptgast ?? ''] ?? null
      addLog(`[BP] Zeile ${row.rowIndex} · "${row.name}" → Hauptgast: "${row.hauptgast ?? '–'}"`)

      if (!parentId && row.hauptgast) {
        addLog(`  Suche Hauptgast in DB…`)
        const { data, error: lookupErr } = await supabase
          .from('guests')
          .select('id')
          .eq('event_id', eventId)
          .eq('name', row.hauptgast)
          .single()
        if (lookupErr) addLog(`  Lookup-Fehler: ${lookupErr.message}`)
        if (data) { parentId = data.id; addLog(`  Hauptgast gefunden: id=${data.id}`) }
        else addLog(`  Hauptgast NICHT gefunden`)
      } else if (parentId) {
        addLog(`  Hauptgast aus aktuellem Import: id=${parentId}`)
      }

      if (!parentId) {
        addLog(`  FEHLER: Hauptgast nicht vorhanden`)
        importErrors.push({ rowIndex: row.rowIndex, name: row.name, reason: `Hauptgast "${row.hauptgast}" nicht gefunden` })
        setProgress(p => ({ ...p, done: p.done + 1 }))
        continue
      }

      if (row.action === 'update' && row.id) {
        addLog(`  UPDATE id=${row.id}`)
        const payload: Record<string, unknown> = {}
        if (row.name) payload.name = row.name
        if (row.meal_choice !== null) payload.meal_choice = row.meal_choice
        if (row.allergy_tags.length > 0) payload.allergy_tags = row.allergy_tags
        if (row.allergy_custom !== null) payload.allergy_custom = row.allergy_custom
        if (row.trink_alkohol !== null) payload.trink_alkohol = row.trink_alkohol
        if (row.age_category !== null) payload.age_category = row.age_category

        addLog(`  payload: ${JSON.stringify(payload)}`)
        const { error } = await supabase.from('begleitpersonen').update(payload).eq('id', row.id)
        if (error) {
          addLog(`  FEHLER: ${error.message} (code=${error.code})`)
          importErrors.push({ rowIndex: row.rowIndex, name: row.name, reason: error.message })
        } else {
          addLog(`  OK`)
          updated++
        }
      } else {
        addLog(`  INSERT (neu)`)
        const bpPayload = {
          guest_id: parentId,
          name: row.name,
          meal_choice: row.meal_choice ?? null,
          allergy_tags: row.allergy_tags.length > 0 ? row.allergy_tags : [],
          allergy_custom: row.allergy_custom ?? null,
          trink_alkohol: row.trink_alkohol ?? null,
          age_category: row.age_category ?? null,
        }
        addLog(`  payload: ${JSON.stringify(bpPayload)}`)
        const { error } = await supabase.from('begleitpersonen').insert(bpPayload)

        if (error) {
          addLog(`  FEHLER: ${error.message} (code=${error.code}, hint=${error.hint ?? '–'})`)
          importErrors.push({ rowIndex: row.rowIndex, name: row.name, reason: error.message })
        } else {
          addLog(`  OK`)
          added++
        }
      }
      setProgress(p => ({ ...p, done: p.done + 1 }))
    }

    addLog(`[ENDE] hinzugefügt=${added}, aktualisiert=${updated}, fehler=${importErrors.length}`)
    setResult({ added, updated, errors: importErrors })
    setStep('done')
  }

  const hasValidRows = rows.some(r => r.action !== 'error')

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gäste importieren"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={step === 'importing' ? undefined : onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 'var(--radius)', width: '100%', maxWidth: step === 'preview' ? 860 : step === 'done' ? 560 : 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
            {step === 'upload' && 'Gäste importieren'}
            {step === 'preview' && 'Importvorschau'}
            {step === 'importing' && 'Import läuft…'}
            {step === 'done' && 'Import abgeschlossen'}
          </h3>
          {step !== 'importing' && (
            <button onClick={onClose} aria-label="Schließen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: 4 }}>
              <X size={16} />
            </button>
          )}
        </div>

        <div style={{ padding: 20 }}>

          {/* ── Upload ── */}
          {step === 'upload' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Lade eine .xlsx-Datei hoch (Export oder Vorlage). Leere Zellen behalten den bestehenden Wert.
              </p>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{ border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '40px 24px', textAlign: 'center', cursor: 'pointer', background: dragging ? 'rgba(0,0,0,0.02)' : 'var(--surface)', transition: 'border-color 0.15s, background 0.15s' }}
              >
                <Upload size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
                <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Datei hierher ziehen oder klicken</p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Nur .xlsx-Dateien</p>
                <input ref={fileInputRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={onFileInput} />
              </div>
              {loading && <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>Datei wird analysiert…</p>}
              {error && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#FEF2F2', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(220,38,38,0.2)' }}>
                  <AlertCircle size={14} style={{ color: '#DC2626', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#DC2626' }}>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Preview ── */}
          {step === 'preview' && stats && (
            <div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: '#EAF5EE', color: '#3D7A56', fontWeight: 600 }}>{stats.toCreate} neu</span>
                <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>{stats.toUpdate} aktualisieren</span>
                {stats.errors > 0 && <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: '#FEF2F2', color: '#DC2626', fontWeight: 600 }}>{stats.errors} Fehler</span>}
              </div>

              <div style={{ overflowX: 'auto', marginBottom: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F5F5F7' }}>
                      {['Zeile', 'Typ', 'Hauptgast', 'Name', 'Status', 'Aktion', 'Hinweis'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.rowIndex} style={{ background: row.errors.length > 0 ? '#FEF2F2' : 'transparent', borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>{row.rowIndex}</td>
                        <td style={{ padding: '7px 10px' }}>{row.typ}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>{row.hauptgast ?? '—'}</td>
                        <td style={{ padding: '7px 10px', fontWeight: 500 }}>{row.name || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>leer</span>}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>{row.status ?? '—'}</td>
                        <td style={{ padding: '7px 10px' }}>
                          {row.action === 'create' && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#EAF5EE', color: '#3D7A56', fontWeight: 600 }}>Neu</span>}
                          {row.action === 'update' && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>Aktualisieren</span>}
                          {row.action === 'error' && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#FEF2F2', color: '#DC2626', fontWeight: 600 }}>Fehler</span>}
                        </td>
                        <td style={{ padding: '7px 10px', color: '#DC2626', fontSize: 11 }}>{row.errors.join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => { setStep('upload'); setRows([]); setStats(null); setError(null) }} style={{ padding: '8px 14px', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Zurück</button>
                <button onClick={confirmImport} disabled={!hasValidRows} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: !hasValidRows ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 500, opacity: !hasValidRows ? 0.6 : 1 }}>
                  Import bestätigen
                </button>
              </div>
            </div>
          )}

          {/* ── Importing ── */}
          {step === 'importing' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Wird importiert…</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{progress.done} / {progress.total}</p>
              <div style={{ marginTop: 16, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 2, width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`, transition: 'width 0.2s' }} />
              </div>
            </div>
          )}

          {/* ── Done ── */}
          {step === 'done' && result && (
            <div style={{ padding: '8px 0' }}>
              <div style={{ textAlign: 'center', marginBottom: result.errors.length > 0 ? 20 : 24 }}>
                <CheckCircle2 size={36} style={{ color: '#3D7A56', marginBottom: 12 }} />
                <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Import abgeschlossen</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {result.added > 0 && `${result.added} hinzugefügt`}
                  {result.added > 0 && result.updated > 0 && ' · '}
                  {result.updated > 0 && `${result.updated} aktualisiert`}
                  {result.added === 0 && result.updated === 0 && 'Keine Änderungen'}
                </p>
              </div>

              {result.errors.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#DC2626', marginBottom: 8 }}>
                    {result.errors.length} Fehler
                  </p>
                  <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 'var(--radius-sm)' }}>
                    {result.errors.map((e, i) => (
                      <div key={i} style={{ padding: '7px 12px', borderBottom: i < result.errors.length - 1 ? '1px solid rgba(220,38,38,0.1)' : undefined, fontSize: 12 }}>
                        <span style={{ fontWeight: 600 }}>Zeile {e.rowIndex} · {e.name || '—'}: </span>
                        <span style={{ color: '#DC2626' }}>{e.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--text-tertiary)', margin: 0 }}>
                    Protokoll
                  </p>
                  <button
                    onClick={copyLog}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: copied ? '#EAF5EE' : '#F5F5F7', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: copied ? '#3D7A56' : 'var(--text-secondary)', fontWeight: 500 }}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Kopiert' : 'Kopieren'}
                  </button>
                </div>
                <pre
                  ref={logRef}
                  style={{ margin: 0, padding: '10px 12px', background: '#0F172A', color: '#94A3B8', fontSize: 11, fontFamily: 'monospace', borderRadius: 'var(--radius-sm)', maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.6 }}
                >
                  {importLog.join('\n')}
                </pre>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={() => { onSuccess({ added: result.added, updated: result.updated }); onClose() }}
                  style={{ padding: '9px 24px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                >
                  Schließen
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
