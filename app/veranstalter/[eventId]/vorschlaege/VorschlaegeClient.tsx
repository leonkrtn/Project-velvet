'use client'
import React, { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Plus, ChevronRight, Package } from 'lucide-react'
import {
  type ProposalWithDetails,
  type ProposalModule,
  type ProposalRole,
  MODULE_LABELS,
  fetchProposalsForEvent,
  subscribeToProposals,
} from '@/lib/proposals'
import ProposalDetailSheet from '@/components/proposals/ProposalDetailSheet'

const ProposalLightbox = dynamic(() => import('@/components/proposals/ProposalLightbox'), { ssr: false })

interface Recipient {
  userId: string
  role: 'brautpaar' | 'dienstleister'
  label: string
}

interface Props {
  eventId: string
  userId: string
  allRecipients: Recipient[]
}

type Tab = 'module' | 'vendor' | 'hotel' | 'deko'

const TAB_CFG: { key: Tab; label: string; modules: ProposalModule[]; directModule?: ProposalModule }[] = [
  { key: 'module', label: 'Modul-Vorschläge',  modules: ['catering', 'ablaufplan', 'musik', 'patisserie'] },
  { key: 'vendor', label: 'Dienstleister',      modules: ['vendor'],     directModule: 'vendor' },
  { key: 'hotel',  label: 'Hotels',             modules: ['hotel'],      directModule: 'hotel' },
  { key: 'deko',   label: 'Dekoration',         modules: ['deko'],       directModule: 'deko' },
]

// Modules only shown in Modul-Vorschläge picker (not their own tab)
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

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `vor ${mins} Min.`
  const h = Math.floor(mins / 60)
  if (h < 24) return `vor ${h} Std.`
  return `vor ${Math.floor(h / 24)} Tagen`
}

export default function VorschlaegeClient({ eventId, userId, allRecipients }: Props) {
  const [tab, setTab] = useState<Tab>('module')
  const [proposals, setProposals] = useState<ProposalWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProposal, setSelectedProposal] = useState<ProposalWithDetails | null>(null)
  const [activeModule, setActiveModule] = useState<ProposalModule | null>(null)
  const [showModulePicker, setShowModulePicker] = useState(false)

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
    if (currentTabCfg.directModule) {
      setActiveModule(currentTabCfg.directModule)
    } else {
      setShowModulePicker(true)
    }
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>Vorschläge</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Sende strukturierte Vorschläge ans Brautpaar oder an Dienstleister
          </p>
        </div>
        <button
          onClick={handleAdd}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
        >
          <Plus size={15} /> Hinzufügen
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'inline-flex', background: '#EBEBEC', borderRadius: 10, padding: 3, marginBottom: 24, gap: 2 }}>
        {TAB_CFG.map(t => {
          const count = proposals.filter(p => t.modules.includes(p.module)).length
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '7px 16px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
              borderRadius: 8, transition: 'all 0.15s',
              background: tab === t.key ? 'var(--surface)' : 'transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-tertiary)',
              boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
              {t.label}
              {count > 0 && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 4 }}>({count})</span>}
            </button>
          )
        })}
      </div>

      {/* Proposal list */}
      {loading && <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Laden…</p>}

      {!loading && visibleProposals.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--text-secondary)' }}>
          <Package size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 14, marginBottom: 16 }}>
            {tab === 'module' ? 'Noch keine Modul-Vorschläge gesendet.' :
             tab === 'vendor' ? 'Noch keine Dienstleister vorgeschlagen.' :
             tab === 'hotel'  ? 'Noch keine Hotels vorgeschlagen.' :
             'Noch keine Dekorations-Vorschläge gesendet.'}
          </p>
          <button onClick={handleAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
            <Plus size={14} /> Ersten Vorschlag erstellen
          </button>
        </div>
      )}

      {!loading && visibleProposals.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visibleProposals.map(p => {
            const status = p.status ?? 'draft'
            return (
              <button key={p.id} type="button" onClick={() => setSelectedProposal(p)} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', borderRadius: 10, textAlign: 'left', width: '100%',
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
                  {/* Empfänger-Namen */}
                  {p.all_responses.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      An: {allRecipients
                        .filter(r => p.all_responses.some(res => res.recipient_id === r.userId))
                        .map(r => r.label)
                        .join(', ') || 'Empfänger'}
                    </div>
                  )}
                </div>
                <ChevronRight size={16} style={{ opacity: 0.4, flexShrink: 0 }} />
              </button>
            )
          })}
        </div>
      )}

      {/* Module picker (only for "module" tab) */}
      {showModulePicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowModulePicker(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 28, width: 420, maxWidth: '100%', boxShadow: 'var(--shadow-md)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 6 }}>Modul auswählen</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>Für welchen Bereich möchtest du einen Vorschlag senden?</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {MODULE_PICKER_ITEMS.map(({ module: m, disabled }) => (
                <button key={m} type="button"
                  disabled={disabled}
                  onClick={() => { if (!disabled) { setActiveModule(m); setShowModulePicker(false) } }}
                  style={{
                    padding: '14px 16px', borderRadius: 10, textAlign: 'left',
                    border: '1px solid var(--border)', background: disabled ? 'var(--bg)' : 'var(--bg)',
                    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    fontSize: 14, fontWeight: 600,
                    color: disabled ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    opacity: disabled ? 0.5 : 1,
                    transition: 'border-color 0.15s',
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

      {/* Proposal Lightbox */}
      {activeModule && allRecipients.length > 0 && (
        <ProposalLightbox
          eventId={eventId}
          module={activeModule}
          proposerRole="veranstalter"
          availableRecipients={allRecipients as { userId: string; role: ProposalRole; label: string }[]}
          onClose={() => setActiveModule(null)}
          onSent={() => { setActiveModule(null); loadProposals() }}
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
