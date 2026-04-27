'use client'
import React, { useState } from 'react'
import { CheckCircle, AlertTriangle, Loader2, ArrowRight } from 'lucide-react'
import type {
  ProposalField, SegmentData, FieldMergeSelection,
} from '@/lib/proposals'
import { buildFieldPath, buildDeltaFields, applyMergeSelections } from '@/lib/proposals'

interface Props {
  proposalId: string
  snapshot: SegmentData
  fields: ProposalField[]
  onMerge: (mergedState: SegmentData, selections: FieldMergeSelection) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '–'
  if (typeof v === 'boolean') return v ? 'Ja' : 'Nein'
  if (typeof v === 'number')  return v.toString()
  if (typeof v === 'string')  return v || '–'
  if (Array.isArray(v))       return v.length === 0 ? '(leer)' : v.map(String).join(', ')
  if (v && typeof v === 'object' && ('name' in v)) return (v as {name: string}).name
  try { return JSON.stringify(v) } catch { return String(v) }
}

function fieldLabel(fieldKey: string): string {
  const labels: Record<string, string> = {
    '__entity__':          'Ganzer Eintrag',
    name:                  'Name', title: 'Titel', price: 'Preis',
    description:           'Beschreibung', notes: 'Notizen',
    time:                  'Uhrzeit', duration_minutes: 'Dauer (min)',
    available:             'Verfügbar', capacity: 'Kapazität',
    quantity:              'Menge', service_style: 'Service-Stil',
    min_persons:           'Min. Personen', contingent: 'Kontingent',
    booked:                'Gebucht', stars: 'Sterne',
    distance_km:           'Entfernung (km)', check_in_date: 'Check-in',
    check_out_date:        'Check-out', date: 'Datum',
    price_per_night:       'Preis/Nacht', theme: 'Thema',
    allergens:             'Allergene', flavors: 'Geschmacksrichtungen',
    tiers:                 'Etagen', servings: 'Portionen',
    servings_total:        'Portionen gesamt', delivery_time: 'Lieferzeit',
    setup_time:            'Aufbauzeit', deposit_amount: 'Anzahlung',
    availability_confirmed:'Verfügbarkeit bestätigt',
  }
  return labels[fieldKey] ?? fieldKey
}

export default function ProposalMergeUI({ snapshot, fields, onMerge, onCancel, loading }: Props) {
  const changedFields = fields.filter(f => f.is_changed)

  // Default: keep_new für alle
  const [selections, setSelections] = useState<FieldMergeSelection>(() => {
    const init: FieldMergeSelection = {}
    changedFields.forEach(f => {
      init[buildFieldPath(f.segment, f.entity_id, f.field_key)] = 'keep_new'
    })
    return init
  })
  const [submitting, setSubmitting] = useState(false)

  const toggle = (path: string) => {
    setSelections(s => ({ ...s, [path]: s[path] === 'keep_new' ? 'keep_old' : 'keep_new' }))
  }

  const handleMerge = async () => {
    setSubmitting(true)
    const merged = applyMergeSelections(snapshot, fields, selections)
    await onMerge(merged, selections)
    setSubmitting(false)
  }

  const deltas = buildDeltaFields(changedFields)
  const isLoading = loading || submitting

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Info-Banner */}
      <div style={{
        background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
        padding: '10px 13px', display: 'flex', gap: 9, alignItems: 'flex-start',
      }}>
        <AlertTriangle size={15} color="#d97706" style={{ marginTop: 1, flexShrink: 0 }} />
        <p style={{ fontSize: 12, color: '#92400e' }}>
          Wähle pro Feld, welcher Wert übernommen wird. Standard: der neue Vorschlag.
        </p>
      </div>

      {deltas.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Keine geänderten Felder vorhanden.
        </p>
      )}

      {/* Pro-Feld-Auswahl */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {deltas.map((d, i) => {
          const path = buildFieldPath(d.segment, d.entity_id, d.field_key)
          const choice = selections[path] ?? 'keep_new'
          const isAdd = d.is_addition
          const isDel = d.is_deletion

          return (
            <div key={i} style={{
              background: 'var(--surface)', borderRadius: 10,
              border: '1px solid var(--border)', padding: '10px 12px',
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
                {d.segment.split('.').pop()?.toUpperCase()} · {fieldLabel(d.field_key)}
              </p>

              {/* Auswahl-Buttons */}
              {!isAdd && !isDel && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setSelections(s => ({ ...s, [path]: 'keep_old' }))}
                    style={{
                      flex: 1, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 12,
                      background: choice === 'keep_old' ? '#fef2f2' : 'none',
                      border: `1.5px solid ${choice === 'keep_old' ? '#dc2626' : 'var(--border)'}`,
                      color: choice === 'keep_old' ? '#dc2626' : 'var(--text-secondary)',
                      fontWeight: choice === 'keep_old' ? 700 : 400,
                    }}
                  >
                    <div style={{ fontSize: 10, marginBottom: 2, opacity: 0.7 }}>Alt</div>
                    {formatValue(d.value_old)}
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                    <ArrowRight size={14} />
                  </div>

                  <button
                    onClick={() => setSelections(s => ({ ...s, [path]: 'keep_new' }))}
                    style={{
                      flex: 1, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 12,
                      background: choice === 'keep_new' ? '#f0fdf4' : 'none',
                      border: `1.5px solid ${choice === 'keep_new' ? '#16a34a' : 'var(--border)'}`,
                      color: choice === 'keep_new' ? '#16a34a' : 'var(--text-primary)',
                      fontWeight: choice === 'keep_new' ? 700 : 400,
                    }}
                  >
                    <div style={{ fontSize: 10, marginBottom: 2, opacity: 0.7 }}>Neu</div>
                    {formatValue(d.value_new)}
                  </button>
                </div>
              )}

              {/* Hinzufügung */}
              {isAdd && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => toggle(path)}
                    style={{
                      flex: 1, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 12,
                      background: choice === 'keep_new' ? '#f0fdf4' : 'none',
                      border: `1.5px solid ${choice === 'keep_new' ? '#16a34a' : 'var(--border)'}`,
                      color: choice === 'keep_new' ? '#16a34a' : 'var(--text-secondary)',
                      fontWeight: choice === 'keep_new' ? 700 : 400,
                    }}
                  >
                    {choice === 'keep_new' ? '✓ Eintrag übernehmen' : '✗ Eintrag nicht übernehmen'}
                  </button>
                </div>
              )}

              {/* Löschung */}
              {isDel && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => toggle(path)}
                    style={{
                      flex: 1, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 12,
                      background: choice === 'keep_new' ? '#fef2f2' : '#f0fdf4',
                      border: `1.5px solid ${choice === 'keep_new' ? '#dc2626' : '#16a34a'}`,
                      color: choice === 'keep_new' ? '#dc2626' : '#16a34a',
                      fontWeight: 600,
                    }}
                  >
                    {choice === 'keep_new' ? '✗ Eintrag löschen' : '✓ Eintrag behalten'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Aktionen */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
        <button
          onClick={onCancel}
          disabled={isLoading}
          style={{
            flex: 1, padding: '11px', borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)', background: 'none',
            fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
            cursor: 'pointer', fontFamily: 'inherit', opacity: isLoading ? 0.5 : 1,
          }}
        >
          Abbrechen
        </button>
        <button
          onClick={handleMerge}
          disabled={isLoading}
          style={{
            flex: 2, padding: '11px', borderRadius: 'var(--r-md)',
            border: 'none', background: 'var(--gold)',
            fontSize: 14, fontWeight: 600, color: '#fff',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', opacity: isLoading ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {isLoading
            ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Merge läuft…</>
            : <><CheckCircle size={15} /> Merge abschließen</>
          }
        </button>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
