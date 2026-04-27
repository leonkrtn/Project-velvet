'use client'
import React, { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Plus, ChevronRight, Package, Trash2, ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  type ProposalWithDetails,
  type ProposalModule,
  type ProposalRole,
  MODULE_LABELS,
  fetchProposalsForEvent,
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

type Tab = 'module' | 'vendor' | 'hotel' | 'deko'

const TAB_CFG: { key: Tab; label: string; modules: ProposalModule[]; directModule?: ProposalModule }[] = [
  { key: 'module', label: 'Modul-Vorschläge',  modules: ['catering', 'ablaufplan', 'musik', 'patisserie'] },
  { key: 'vendor', label: 'Dienstleister',      modules: ['vendor'],  directModule: 'vendor' },
  { key: 'hotel',  label: 'Hotels',             modules: ['hotel'],   directModule: 'hotel' },
  { key: 'deko',   label: 'Dekoration',         modules: ['deko'],    directModule: 'deko' },
]

const MODULE_PICKER_ITEMS: { module: ProposalModule; disabled?: boolean }[] = [
  { module: 'catering' },
  { module: 'ablaufplan' },
  { module: 'musik' },
  { module: 'patisserie' },
  { module: 'sitzplan', disabled: true },
]

const STATUS_LABEL: Record<string, string> = {
  sent: 'Gesendet', accepted: 'Angenommen', rejected: 'Abgelehnt',
  conflict: 'Konflikt', resolved: 'Erledigt', draft: 'Entwurf',
}
const STATUS_COLOR: Record<string, string> = {
  sent: 'var(--gold)', accepted: '#16a34a', rejected: '#dc2626',
  conflict: '#ea580c', resolved: 'var(--text-tertiary)', draft: 'var(--text-tertiary)',
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
  const [tab, setTab] = useState<Tab>('module')
  const [proposals, setProposals] = useState<ProposalWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProposal, setSelectedProposal] = useState<ProposalWithDetails | null>(null)
  const [activeModule, setActiveModule] = useState<ProposalModule | null>(null)
  const [editingDraft, setEditingDraft] = useState<ProposalWithDetails | null>(null)
  const [showModulePicker, setShowModulePicker] = useState(false)

  // Legacy suggestion state
  const [vendors, setVendors] = useState(initialVendors)
  const [hotels, setHotels] = useState(initialHotels)
  const [deko, setDeko] = useState(initialDeko)

  const loadProposals = useCallback(async () => {
    const all = await fetchProposalsForEvent(eventId)
    setProposals(all.filter(p => p.proposer_role === 'veranstalter'))
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    loadProposals()
    const unsub = subscribeToProposals(eventId, loadProposals)
    return unsub
  }, [eventId, loadProposals])

  const currentTabCfg = TAB_CFG.find(t => t.key === tab)!
  const visibleProposals = proposals.filter(p => currentTabCfg.modules.includes(p.module))

  function handleAdd() {
    if (currentTabCfg.directModule) setActiveModule(currentTabCfg.directModule)
    else setShowModulePicker(true)
  }

  async function handleDeleteProposal(id: string) {
    if (!confirm('Vorschlag wirklich löschen?')) return
    await deleteProposal(id)
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

      {/* Tabs */}
      <div style={{ display: 'inline-flex', background: '#EBEBEC', borderRadius: 10, padding: 3, marginBottom: 24, gap: 2 }}>
        {TAB_CFG.map(t => {
          const propCount = proposals.filter(p => t.modules.includes(p.module)).length
          const legacyCount = t.key === 'vendor' ? vendors.length : t.key === 'hotel' ? hotels.length : t.key === 'deko' ? deko.length : 0
          const total = propCount + legacyCount
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '7px 16px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
              borderRadius: 8, transition: 'all 0.15s',
              background: tab === t.key ? 'var(--surface)' : 'transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-tertiary)',
              boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
              {t.label}
              {total > 0 && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 4 }}>({total})</span>}
            </button>
          )
        })}
      </div>

      {/* ── Modul-Vorschläge Tab ── */}
      {tab === 'module' && (
        <>
          {loading && <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Laden…</p>}
          {!loading && visibleProposals.length === 0 && (
            <EmptyState label="Noch keine Modul-Vorschläge gesendet." onAdd={handleAdd} />
          )}
          {!loading && visibleProposals.length > 0 && (
            <ProposalList proposals={visibleProposals} allRecipients={allRecipients} userId={userId} onSelect={setSelectedProposal} onEdit={setEditingDraft} onDelete={handleDeleteProposal} />
          )}
        </>
      )}

      {/* ── Dienstleister Tab ── */}
      {tab === 'vendor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* New proposals */}
          {loading && <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Laden…</p>}
          {!loading && visibleProposals.length > 0 && (
            <>
              <SectionLabel label="Versendete Vorschläge" />
              <ProposalList proposals={visibleProposals} allRecipients={allRecipients} userId={userId} onSelect={setSelectedProposal} onEdit={setEditingDraft} onDelete={handleDeleteProposal} />
            </>
          )}
          {/* Legacy suggestions */}
          {vendors.length > 0 && (
            <>
              <SectionLabel label="Bestehende Einträge" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
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
            </>
          )}
          {!loading && visibleProposals.length === 0 && vendors.length === 0 && (
            <EmptyState label="Noch keine Dienstleister vorgeschlagen." onAdd={handleAdd} />
          )}
        </div>
      )}

      {/* ── Hotels Tab ── */}
      {tab === 'hotel' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!loading && visibleProposals.length > 0 && (
            <>
              <SectionLabel label="Versendete Vorschläge" />
              <ProposalList proposals={visibleProposals} allRecipients={allRecipients} userId={userId} onSelect={setSelectedProposal} onEdit={setEditingDraft} onDelete={handleDeleteProposal} />
            </>
          )}
          {hotels.length > 0 && (
            <>
              <SectionLabel label="Bestehende Einträge" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
            </>
          )}
          {!loading && visibleProposals.length === 0 && hotels.length === 0 && (
            <EmptyState label="Noch keine Hotels vorgeschlagen." onAdd={handleAdd} />
          )}
        </div>
      )}

      {/* ── Dekoration Tab ── */}
      {tab === 'deko' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!loading && visibleProposals.length > 0 && (
            <>
              <SectionLabel label="Versendete Vorschläge" />
              <ProposalList proposals={visibleProposals} allRecipients={allRecipients} userId={userId} onSelect={setSelectedProposal} onEdit={setEditingDraft} onDelete={handleDeleteProposal} />
            </>
          )}
          {deko.length > 0 && (
            <>
              <SectionLabel label="Bestehende Einträge" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
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
            </>
          )}
          {!loading && visibleProposals.length === 0 && deko.length === 0 && (
            <EmptyState label="Noch keine Deko-Vorschläge." onAdd={handleAdd} />
          )}
        </div>
      )}

      {/* Module picker */}
      {showModulePicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowModulePicker(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 28, width: 420, maxWidth: '100%', boxShadow: 'var(--shadow-md)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 6 }}>Modul auswählen</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>Für welchen Bereich möchtest du einen Vorschlag senden?</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {MODULE_PICKER_ITEMS.map(({ module: m, disabled }) => (
                <button key={m} type="button" disabled={disabled}
                  onClick={() => { if (!disabled) { setActiveModule(m); setShowModulePicker(false) } }}
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

      {/* Proposal Lightbox — new proposal */}
      {activeModule && !editingDraft && allRecipients.length > 0 && (
        <ProposalLightbox
          eventId={eventId}
          module={activeModule}
          proposerRole="veranstalter"
          availableRecipients={allRecipients as { userId: string; role: ProposalRole; label: string }[]}
          onClose={() => setActiveModule(null)}
          onSent={() => { setActiveModule(null); loadProposals() }}
        />
      )}

      {/* Proposal Lightbox — edit/send existing draft */}
      {editingDraft && allRecipients.length > 0 && (
        <ProposalLightbox
          eventId={eventId}
          module={editingDraft.module}
          proposerRole="veranstalter"
          availableRecipients={allRecipients as { userId: string; role: ProposalRole; label: string }[]}
          existingProposalId={editingDraft.id}
          initialData={editingDraft.latest_submission?.data}
          initialSections={editingDraft.latest_submission?.sections_enabled}
          onClose={() => setEditingDraft(null)}
          onSent={() => { setEditingDraft(null); loadProposals() }}
        />
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
        const isOwn = p.proposer_id === userId
        const recipientNames = allRecipients
          .filter(r => p.all_responses.some(res => res.recipient_id === r.userId))
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
                  {p.all_responses.length > 0 && ` · ${p.all_responses.filter(r => r.status !== 'pending').length}/${p.all_responses.length} geantwortet`}
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
