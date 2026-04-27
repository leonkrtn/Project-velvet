'use client'
import React, { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Plus, ChevronRight, Package, Trash2, ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  type ProposalWithDetails,
  type ProposalModule,
  type ProposalRole,
  type ProposalModuleData,
  MODULE_LABELS,
  fetchProposalsForEvent,
  fetchMasterState,
  subscribeToProposals,
  deleteProposal,
} from '@/lib/proposals'
import ProposalDetailSheet from '@/components/proposals/ProposalDetailSheet'

const ProposalLightbox = dynamic(() => import('@/components/proposals/ProposalLightbox'), { ssr: false })

interface Recipient {
  userId: string
  role: 'brautpaar' | 'dienstleister'
  label: string
}

type SuggestionStatus = 'vorschlag' | 'akzeptiert' | 'abgelehnt'

interface VendorSuggestion {
  id: string; event_id: string; name: string | null; category: string | null
  description: string | null; price_estimate: number; contact_email: string | null
  contact_phone: string | null; status: SuggestionStatus; created_at: string
}
interface HotelSuggestion {
  id: string; event_id: string; name: string | null; address: string | null
  distance_km: number; price_per_night: number; total_rooms: number
  description: string | null; status: SuggestionStatus; created_at: string
}
interface DekoSuggestion {
  id: string; event_id: string; title: string | null; description: string | null
  image_url: string | null; status: SuggestionStatus; created_at: string
}

interface Props {
  eventId: string
  userId: string
  allRecipients: Recipient[]
  initialVendors: VendorSuggestion[]
  initialHotels: HotelSuggestion[]
  initialDeko: DekoSuggestion[]
}

const MODULE_PICKER_ITEMS: { module: ProposalModule; disabled?: boolean }[] = [
  { module: 'catering' },
  { module: 'ablaufplan' },
  { module: 'musik' },
  { module: 'patisserie' },
  { module: 'vendor' },
  { module: 'hotel' },
  { module: 'deko' },
  { module: 'sitzplan', disabled: true },
]

const STATUS_LABEL: Record<string, string> = {
  pending: 'Gesendet', accepted: 'Angenommen', rejected: 'Abgelehnt',
  in_case: 'In Klärung', draft: 'Entwurf',
}
const STATUS_COLOR: Record<string, string> = {
  pending: 'var(--gold)', accepted: '#16a34a', rejected: '#dc2626',
  in_case: '#ea580c', draft: 'var(--text-tertiary)',
}
const SUGG_CFG: Record<SuggestionStatus, { label: string; bg: string; color: string }> = {
  vorschlag:  { label: 'Vorschlag',   bg: '#F0F0F0', color: '#666' },
  akzeptiert: { label: 'Akzeptiert',  bg: '#EAF5EE', color: '#3D7A56' },
  abgelehnt:  { label: 'Abgelehnt',  bg: '#FDEAEA', color: '#A04040' },
}

function fmtMoney(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `vor ${mins} Min.`
  const h = Math.floor(mins / 60)
  if (h < 24) return `vor ${h} Std.`
  return `vor ${Math.floor(h / 24)} Tagen`
}

function StatusPill({ status, onChange }: { status: SuggestionStatus; onChange?: (s: SuggestionStatus) => void }) {
  const cfg = SUGG_CFG[status]
  if (!onChange) {
    return <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
  }
  return (
    <select value={status} onChange={e => onChange(e.target.value as SuggestionStatus)}
      style={{ padding: '3px 8px', borderRadius: 12, fontSize: 12, fontWeight: 500, background: cfg.bg, color: cfg.color, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
      {(Object.entries(SUGG_CFG) as [SuggestionStatus, typeof SUGG_CFG[SuggestionStatus]][]).map(([k, v]) => (
        <option key={k} value={k}>{v.label}</option>
      ))}
    </select>
  )
}

export default function VorschlaegeClient({ eventId, userId, allRecipients, initialVendors, initialHotels, initialDeko }: Props) {
  const supabase = createClient()
  const [proposals, setProposals] = useState<ProposalWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProposal, setSelectedProposal] = useState<ProposalWithDetails | null>(null)
  const [activeModule, setActiveModule] = useState<ProposalModule | null>(null)
  const [editingDraft, setEditingDraft] = useState<ProposalWithDetails | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showModulePicker, setShowModulePicker] = useState(false)
  const [masterStateData, setMasterStateData] = useState<ProposalModuleData | null>(null)
  const [fetchingMaster, setFetchingMaster] = useState(false)

  // Legacy suggestion state
  const [vendors, setVendors] = useState(initialVendors)
  const [hotels, setHotels] = useState(initialHotels)
  const [deko, setDeko] = useState(initialDeko)

  const loadProposals = useCallback(async () => {
    const all = await fetchProposalsForEvent(eventId)
    setProposals(all.filter(p => p.created_by_role === 'veranstalter'))
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    loadProposals()
    const unsub = subscribeToProposals(eventId, loadProposals)
    return unsub
  }, [eventId, loadProposals])

  function handleAdd() {
    setShowModulePicker(true)
  }

  async function confirmDelete() {
    if (!deletingId) return
    setDeleting(true)
    await deleteProposal(deletingId)
    setDeletingId(null)
    setDeleting(false)
    loadProposals()
  }

  async function updateVendorStatus(id: string, status: SuggestionStatus) {
    await supabase.from('organizer_vendor_suggestions').update({ status }).eq('id', id)
    setVendors(v => v.map(x => x.id === id ? { ...x, status } : x))
  }
  async function updateHotelStatus(id: string, status: SuggestionStatus) {
    await supabase.from('organizer_hotel_suggestions').update({ status }).eq('id', id)
    setHotels(h => h.map(x => x.id === id ? { ...x, status } : x))
  }
  async function updateDekoStatus(id: string, status: SuggestionStatus) {
    await supabase.from('deko_suggestions').update({ status }).eq('id', id)
    setDeko(d => d.map(x => x.id === id ? { ...x, status } : x))
  }
  async function deleteVendor(id: string) {
    await supabase.from('organizer_vendor_suggestions').delete().eq('id', id)
    setVendors(v => v.filter(x => x.id !== id))
  }
  async function deleteHotel(id: string) {
    await supabase.from('organizer_hotel_suggestions').delete().eq('id', id)
    setHotels(h => h.filter(x => x.id !== id))
  }
  async function deleteDeko(id: string) {
    await supabase.from('deko_suggestions').delete().eq('id', id)
    setDeko(d => d.filter(x => x.id !== id))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>Vorschläge</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Sende strukturierte Vorschläge ans Brautpaar oder an Dienstleister
          </p>
        </div>
        <button onClick={handleAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
          <Plus size={15} /> Hinzufügen
        </button>
      </div>

      {/* ── All proposals (flat) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {loading && <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Laden…</p>}

        {!loading && proposals.length > 0 && (
          <ProposalList proposals={proposals} allRecipients={allRecipients} userId={userId} onSelect={setSelectedProposal} onEdit={setEditingDraft} onDelete={setDeletingId} />
        )}

        {/* Legacy: Dienstleister */}
        {vendors.length > 0 && (
          <div>
            <SectionLabel label="Dienstleister (Alteinträge)" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginTop: 10 }}>
              {vendors.map(v => (
                <div key={v.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{v.name ?? 'Unbenannt'}</div>
                      {v.category && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{v.category}</div>}
                    </div>
                    <button onClick={() => deleteVendor(v.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {v.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{v.description}</p>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{fmtMoney(v.price_estimate)}</span>
                    <StatusPill status={v.status} onChange={s => updateVendorStatus(v.id, s)} />
                  </div>
                  {(v.contact_email || v.contact_phone) && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {v.contact_email && <div>{v.contact_email}</div>}
                      {v.contact_phone && <div>{v.contact_phone}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legacy: Hotels */}
        {hotels.length > 0 && (
          <div>
            <SectionLabel label="Hotels (Alteinträge)" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              {hotels.map(h => (
                <div key={h.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{h.name ?? 'Unbenannt'}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {h.address ?? '—'} · {h.distance_km} km · {h.total_rooms} Zimmer · {fmtMoney(h.price_per_night)}/Nacht
                      </div>
                      {h.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{h.description}</p>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 12 }}>
                      <StatusPill status={h.status} onChange={s => updateHotelStatus(h.id, s)} />
                      <button onClick={() => deleteHotel(h.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legacy: Dekoration */}
        {deko.length > 0 && (
          <div>
            <SectionLabel label="Dekoration (Alteinträge)" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginTop: 10 }}>
              {deko.map(d => (
                <div key={d.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div style={{ height: 140, background: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {d.image_url
                      ? <img src={d.image_url} alt={d.title ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <ImageIcon size={28} color="var(--text-tertiary)" />
                    }
                    <button onClick={() => deleteDeko(d.id)} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer', padding: 5, borderRadius: 6, color: '#fff', display: 'flex' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{d.title ?? 'Unbenannt'}</div>
                    {d.description && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{d.description}</p>}
                    <StatusPill status={d.status} onChange={s => updateDekoStatus(d.id, s)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && proposals.length === 0 && vendors.length === 0 && hotels.length === 0 && deko.length === 0 && (
          <EmptyState label="Noch keine Vorschläge erstellt." onAdd={handleAdd} />
        )}
      </div>

      {/* Module picker */}
      {showModulePicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowModulePicker(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 28, width: 420, maxWidth: '100%', boxShadow: 'var(--shadow-md)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 6 }}>Modul auswählen</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>Für welchen Bereich möchtest du einen Vorschlag senden?</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {MODULE_PICKER_ITEMS.map(({ module: m, disabled }) => (
                <button key={m} type="button" disabled={disabled || fetchingMaster}
                  onClick={async () => {
                    if (disabled) return
                    setFetchingMaster(true)
                    const ms = await fetchMasterState(eventId, m)
                    setMasterStateData(ms)
                    setFetchingMaster(false)
                    setActiveModule(m)
                    setShowModulePicker(false)
                  }}
                  style={{
                    padding: '14px 16px', borderRadius: 10, textAlign: 'left',
                    border: '1px solid var(--border)', background: 'var(--bg)',
                    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    fontSize: 14, fontWeight: 600,
                    color: disabled ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    opacity: disabled ? 0.5 : 1,
                  }}>
                  {MODULE_LABELS[m]}
                  {disabled && <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', marginTop: 2 }}>Bald verfügbar</span>}
                </button>
              ))}
            </div>
            <button onClick={() => setShowModulePicker(false)} style={{ marginTop: 16, width: '100%', padding: '9px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Proposal Lightbox — new proposal (pre-filled with master state) */}
      {activeModule && !editingDraft && allRecipients.length > 0 && (
        <ProposalLightbox
          eventId={eventId}
          module={activeModule}
          proposerRole="veranstalter"
          availableRecipients={allRecipients as { userId: string; role: ProposalRole; label: string }[]}
          initialData={masterStateData ?? undefined}
          onClose={() => { setActiveModule(null); setMasterStateData(null) }}
          onSent={() => { setActiveModule(null); setMasterStateData(null); loadProposals() }}
        />
      )}

      {/* Proposal Lightbox — edit/send existing draft */}
      {editingDraft && (
        <ProposalLightbox
          eventId={eventId}
          module={editingDraft.module}
          proposerRole="veranstalter"
          availableRecipients={allRecipients as { userId: string; role: ProposalRole; label: string }[]}
          existingProposalId={editingDraft.id}
          initialData={editingDraft.snapshot?.snapshot_json as import('@/lib/proposals').ProposalModuleData | undefined}
          onClose={() => setEditingDraft(null)}
          onSent={() => { setEditingDraft(null); loadProposals() }}
        />
      )}

      {/* Delete confirmation */}
      {deletingId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => !deleting && setDeletingId(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 28, width: 380, maxWidth: '100%', boxShadow: 'var(--shadow-md)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 8 }}>Vorschlag löschen?</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
              Der Vorschlag wird unwiderruflich gelöscht — inklusive aller Antworten der Empfänger.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeletingId(null)} disabled={deleting}
                style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
                Abbrechen
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                style={{ padding: '9px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: deleting ? 'wait' : 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'inherit' }}>
                {deleting ? 'Löschen…' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Sheet */}
      {selectedProposal && (
        <ProposalDetailSheet
          proposal={selectedProposal}
          userId={userId}
          userRole="veranstalter"
          onClose={() => setSelectedProposal(null)}
          onAccept={() => setSelectedProposal(null)}
          onReject={() => setSelectedProposal(null)}
          onCounter={() => setSelectedProposal(null)}
          onRefresh={loadProposals}
        />
      )}
    </div>
  )
}

// ── Helper components ────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: -4 }}>
      {label}
    </div>
  )
}

function EmptyState({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--text-secondary)' }}>
      <Package size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
      <p style={{ fontSize: 14, marginBottom: 16 }}>{label}</p>
      <button onClick={onAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
        <Plus size={14} /> Ersten Vorschlag erstellen
      </button>
    </div>
  )
}

function ProposalList({ proposals, allRecipients, userId, onSelect, onEdit, onDelete }: {
  proposals: ProposalWithDetails[]
  allRecipients: Recipient[]
  userId: string
  onSelect: (p: ProposalWithDetails) => void
  onEdit: (p: ProposalWithDetails) => void
  onDelete: (id: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {proposals.map(p => {
        const status = p.status ?? 'draft'
        const isOwn = p.created_by === userId
        const recipientNames = allRecipients
          .filter(r => p.recipients.some(r2 => r2.user_id === r.userId))
          .map(r => r.label)
        return (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button type="button" onClick={() => isOwn ? onEdit(p) : onSelect(p)} style={{
              display: 'flex', alignItems: 'center', gap: 14, flex: 1,
              padding: '14px 16px', borderRadius: 10, textAlign: 'left',
              background: 'var(--surface)', border: '1px solid var(--border)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {MODULE_LABELS[p.module]}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: STATUS_COLOR[status] ?? 'var(--text-tertiary)',
                    background: `${STATUS_COLOR[status] ?? 'var(--border)'}18`,
                    padding: '2px 7px', borderRadius: 100,
                  }}>
                    {STATUS_LABEL[status] ?? status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {timeAgo(p.created_at)}
                  {p.recipients.length > 0 && ` · ${p.recipients.filter(r => r.status !== 'pending').length}/${p.recipients.length} geantwortet`}
                </div>
                {recipientNames.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    An: {recipientNames.join(', ')}
                  </div>
                )}
              </div>
              <ChevronRight size={16} style={{ opacity: 0.4, flexShrink: 0 }} />
            </button>
            {isOwn && (
              <button type="button" onClick={() => onDelete(p.id)} title="Vorschlag löschen"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
