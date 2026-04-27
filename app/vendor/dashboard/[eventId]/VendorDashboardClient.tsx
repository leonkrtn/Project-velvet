'use client'
import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Menu, X, CalendarDays, ChevronLeft, Lightbulb, Inbox, Plus } from 'lucide-react'
import { ALL_MODULES, MODULE_MAP } from '@/lib/vendor-modules'
import type { ProposalModule, ProposalRole, ProposalWithDetails } from '@/lib/proposals'
import { fetchProposalsForEvent, subscribeToProposals, acceptProposal, rejectProposal, MODULE_LABELS } from '@/lib/proposals'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'

// Tab-Komponenten
import ChatTab       from './tabs/ChatTab'
import TimelineTab   from './tabs/TimelineTab'
import LocationTab   from './tabs/LocationTab'
import GuestsTab     from './tabs/GuestsTab'
import SeatingTab    from './tabs/SeatingTab'
import CateringTab   from './tabs/CateringTab'
import PatisserieTab from './tabs/PatisserieTab'
import MediaTab      from './tabs/MediaTab'
import MusicTab      from './tabs/MusicTab'
import DecorTab      from './tabs/DecorTab'
import FilesTab      from './tabs/FilesTab'

const ProposalLightbox      = dynamic(() => import('@/components/proposals/ProposalLightbox'), { ssr: false })
const ProposalDetailSheet   = dynamic(() => import('@/components/proposals/ProposalDetailSheet'), { ssr: false })
const CounterProposalSheet  = dynamic(() => import('@/components/proposals/CounterProposalSheet'), { ssr: false })

const TAB_REGISTRY: Record<string, React.ComponentType<{ eventId: string }>> = {
  mod_chat:       ChatTab,
  mod_timeline:   TimelineTab,
  mod_location:   LocationTab,
  mod_guests:     GuestsTab,
  mod_seating:    SeatingTab,
  mod_catering:   CateringTab,
  mod_patisserie: PatisserieTab,
  mod_media:      MediaTab,
  mod_music:      MusicTab,
  mod_decor:      DecorTab,
  mod_files:      FilesTab,
}

const PROPOSAL_MODULE_MAP: Partial<Record<string, ProposalModule>> = {
  mod_catering:   'catering',
  mod_timeline:   'ablaufplan',
  mod_seating:    'sitzplan',
  mod_decor:      'deko',
  mod_music:      'musik',
  mod_patisserie: 'patisserie',
}

interface Recipient {
  userId: string
  role: ProposalRole
  label: string
}

interface Props {
  eventId:             string
  permissions:         string[]
  eventTitle:          string
  eventDate:           string | null
  eventCode?:          string | null
  initialTab:          string | null
  proposalRecipients:  Recipient[]
}

export default function VendorDashboardClient({ eventId, permissions, eventTitle, eventDate, eventCode, initialTab, proposalRecipients }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  const visibleModules = ALL_MODULES.filter(m => permissions.includes(m.key))
  const defaultTab = visibleModules[0]?.key ?? ''

  const [activeTab, setActiveTab]         = useState(initialTab ?? defaultTab)
  const [mobileOpen, setMobileOpen]       = useState(false)
  const [showProposal, setShowProposal]   = useState(false)
  const [showInbox, setShowInbox]         = useState(false)
  const [pendingCount, setPendingCount]   = useState(0)
  const [userId, setUserId]               = useState<string | null>(null)

  const resolvedTab = permissions.includes(activeTab) ? activeTab : defaultTab
  const currentModule = PROPOSAL_MODULE_MAP[resolvedTab]

  useEffect(() => {
    if (resolvedTab !== activeTab) setActiveTab(resolvedTab)
  }, [resolvedTab, activeTab])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  useEffect(() => {
    let unsub: (() => void) | undefined
    const load = async () => {
      if (!userId) return
      const proposals = await fetchProposalsForEvent(eventId)
      const count = proposals.filter(p => {
        const myRecipient = p.recipients.find(r => r.user_id === userId)
        return myRecipient?.status === 'pending' && p.created_by !== userId
      }).length
      setPendingCount(count)
    }
    load()
    unsub = subscribeToProposals(eventId, load)
    return () => unsub?.()
  }, [eventId, userId])

  function navigate(key: string) {
    setActiveTab(key)
    setMobileOpen(false)
    setShowInbox(false)
    router.replace(`${pathname}?tab=${key}`, { scroll: false })
  }

  const TabComponent = TAB_REGISTRY[resolvedTab] ?? null

  const sidebar = (
    <nav style={{
      width: 220, minWidth: 220,
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflowY: 'auto',
    }}>
      <div style={{ padding: '12px 12px 8px' }}>
        <button
          onClick={() => router.push('/vendor/dashboard')}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 500,
            padding: '2px 0', marginBottom: 6, fontFamily: 'inherit',
          }}
        >
          <ChevronLeft size={14} />
          Alle Events
        </button>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 4 }}>
          Dienstleister-Portal
        </p>
      </div>

      <div style={{ padding: '0 12px 14px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.2px', lineHeight: 1.3 }}>
          {eventTitle}
        </p>
        {eventDate && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, color: 'var(--text-secondary)', fontSize: 12 }}>
            <CalendarDays size={12} />
            {new Date(eventDate).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        )}
      </div>

      <div style={{ padding: '8px 8px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }}>
          {visibleModules.map(({ key, label, icon: Icon }) => {
            const active = resolvedTab === key && !showInbox
            return (
              <button
                key={key}
                onClick={() => navigate(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  padding: '8px 10px', borderRadius: 8, marginBottom: 1,
                  fontSize: 14, fontWeight: active ? 500 : 450,
                  color: 'var(--text-primary)',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: active ? 'var(--surface)' : 'transparent',
                  boxShadow: active ? 'var(--shadow-sm)' : 'none',
                  transition: 'background 0.12s',
                  fontFamily: 'inherit',
                }}
              >
                <Icon size={16} style={{ opacity: active ? 1 : 0.5, flexShrink: 0 }} />
                <span>{label}</span>
              </button>
            )
          })}
        </div>

        {/* Posteingang */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 8 }}>
          <button
            onClick={() => { setShowInbox(true); setMobileOpen(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 9, width: '100%',
              padding: '8px 10px', borderRadius: 8,
              fontSize: 14, fontWeight: showInbox ? 500 : 450,
              color: 'var(--text-primary)',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              background: showInbox ? 'var(--surface)' : 'transparent',
              boxShadow: showInbox ? 'var(--shadow-sm)' : 'none',
              fontFamily: 'inherit',
            }}
          >
            <Inbox size={16} style={{ opacity: showInbox ? 1 : 0.5, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>Posteingang</span>
            {pendingCount > 0 && (
              <span style={{
                background: 'var(--gold)', color: '#fff', fontSize: 10, fontWeight: 700,
                minWidth: 18, height: 18, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
              }}>
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {eventCode && (
          <div style={{ padding: '12px 10px 8px', borderTop: '1px solid var(--border)', marginTop: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', margin: '0 0 3px' }}>
              Event-Code
            </p>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)', margin: 0, fontFamily: 'monospace', letterSpacing: '0.12em' }}>
              #{eventCode}
            </p>
          </div>
        )}
      </div>
    </nav>
  )

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Desktop Sidebar */}
      <div className="sidebar-desktop" style={{ display: 'none' }}>
        {sidebar}
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}
          onClick={() => setMobileOpen(false)}
        >
          <div style={{ width: 220, height: '100%' }} onClick={e => e.stopPropagation()}>
            {sidebar}
          </div>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.4)' }} />
        </div>
      )}

      {/* Hauptinhalt */}
      <div style={{ flex: 1, overflow: resolvedTab === 'mod_chat' ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Mobile Topbar */}
        <div className="mobile-topbar" style={{ display: 'none', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => setMobileOpen(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>
            {showInbox ? 'Posteingang' : (MODULE_MAP[resolvedTab]?.label ?? eventTitle)}
          </span>
          {pendingCount > 0 && !showInbox && (
            <button onClick={() => setShowInbox(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: 4, display: 'flex' }}>
              <Inbox size={18} />
              <span style={{ position: 'absolute', top: 0, right: 0, background: 'var(--gold)', color: '#fff', fontSize: 9, fontWeight: 700, width: 14, height: 14, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {pendingCount}
              </span>
            </button>
          )}
        </div>

        {showInbox ? (
          <VendorInboxView eventId={eventId} userId={userId} onClose={() => setShowInbox(false)} />
        ) : resolvedTab === 'mod_chat' ? (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {TabComponent ? <TabComponent eventId={eventId} /> : null}
          </div>
        ) : (
          <main style={{ flex: 1, padding: '36px 40px 60px', width: '100%', boxSizing: 'border-box', position: 'relative' }}>
            {currentModule && (
              <button
                onClick={() => setShowProposal(true)}
                style={{
                  position: 'absolute', top: 28, right: 32,
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '8px 16px', borderRadius: 100,
                  border: '1px solid var(--gold)',
                  background: 'var(--gold-pale)',
                  color: 'var(--gold)',
                  fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s',
                  zIndex: 10,
                }}
              >
                <Lightbulb size={14} />
                Vorschlag machen
              </button>
            )}

            {TabComponent ? (
              <TabComponent eventId={eventId} />
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                Keine Berechtigung für diesen Bereich.
              </div>
            )}
          </main>
        )}
      </div>

      {showProposal && currentModule && (
        <ProposalLightbox
          eventId={eventId}
          module={currentModule}
          proposerRole="dienstleister"
          availableRecipients={proposalRecipients}
          onClose={() => setShowProposal(false)}
          onSent={() => setPendingCount(c => c)}
        />
      )}

      <style>{`
        @media (min-width: 768px) { .sidebar-desktop { display: block !important; } }
        @media (max-width: 767px) { .mobile-topbar { display: flex !important; } main { padding: 20px 16px !important; } }
      `}</style>
    </div>
  )
}

// ── Vendor Inbox ──────────────────────────────────────────────────────────────

function VendorInboxView({ eventId, userId, onClose }: { eventId: string; userId: string | null; onClose: () => void }) {
  const [proposals, setProposals] = useState<ProposalWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProposal, setSelectedProposal] = useState<ProposalWithDetails | null>(null)
  const [counterTarget, setCounterTarget] = useState<ProposalWithDetails | null>(null)

  const load = async () => {
    const data = await fetchProposalsForEvent(eventId)
    setProposals(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const unsub = subscribeToProposals(eventId, load)
    return unsub
  }, [eventId])

  async function handleAccept(p: ProposalWithDetails) {
    await acceptProposal(p.id)
    setSelectedProposal(null)
    load()
  }

  async function handleReject(p: ProposalWithDetails) {
    await rejectProposal(p.id)
    setSelectedProposal(null)
    load()
  }

  function handleCounter(p: ProposalWithDetails) {
    setSelectedProposal(null)
    setCounterTarget(p)
  }

  const inbox = proposals.filter(p => {
    const myRecipient = p.recipients.find(r => r.user_id === userId)
    return myRecipient?.status === 'pending' && p.created_by !== userId
  })

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '36px 40px 60px', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 2 }}>
          Posteingang
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px' }}>Eingegangene Vorschläge</h1>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Wird geladen…</div>
      ) : inbox.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
          <Inbox size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Keine offenen Vorschläge</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
            Wenn der Veranstalter einen Vorschlag sendet, erscheint er hier.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {inbox.map(p => (
            <button key={p.id} onClick={() => setSelectedProposal(p)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 18px', borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                width: '100%',
              }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {MODULE_LABELS[p.module]}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                    background: 'rgba(201,168,76,0.15)', color: 'var(--gold)',
                  }}>Offen</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {new Date(p.created_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {p.creator_profile?.full_name ? ` · von ${p.creator_profile.full_name}` : ''}
                </p>
              </div>
              <span style={{ fontSize: 20, color: 'var(--text-tertiary)' }}>›</span>
            </button>
          ))}
        </div>
      )}

      {selectedProposal && userId && (
        <ProposalDetailSheet
          proposal={selectedProposal}
          userId={userId}
          userRole="dienstleister"
          onClose={() => setSelectedProposal(null)}
          onAccept={() => handleAccept(selectedProposal)}
          onReject={() => handleReject(selectedProposal)}
          onCounter={() => handleCounter(selectedProposal)}
          onRefresh={load}
        />
      )}

      {counterTarget && userId && (
        <CounterProposalSheet
          proposal={counterTarget}
          userId={userId}
          userRole="dienstleister"
          eventId={eventId}
          onClose={() => setCounterTarget(null)}
          onSent={() => { setCounterTarget(null); load() }}
        />
      )}
    </div>
  )
}
