'use client'
import React, { useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Check, ArrowLeft, LayoutDashboard, Settings, UtensilsCrossed, MessageSquare, Lightbulb, Calendar, Music2, Cake, Flower2, Camera, Grid2X2, LucideIcon } from 'lucide-react'
import type { DienstleisterPermRow, MusicSong, DekorItem, MediaItem } from './page'

// ── Types ────────────────────────────────────────────────────────────────────

type Access = 'none' | 'read' | 'write'

interface TabConfig {
  key: string
  label: string
  icon: LucideIcon
  hasItems: boolean
}

const CONFIGURABLE_TABS: TabConfig[] = [
  { key: 'uebersicht',  label: 'Übersicht',          icon: LayoutDashboard,  hasItems: false },
  { key: 'allgemein',   label: 'Allgemein',           icon: Settings,         hasItems: false },
  { key: 'catering',    label: 'Catering & Menü',     icon: UtensilsCrossed,  hasItems: false },
  { key: 'chats',       label: 'Chats',               icon: MessageSquare,    hasItems: false },
  { key: 'vorschlaege', label: 'Vorschläge',          icon: Lightbulb,        hasItems: false },
  { key: 'ablaufplan',  label: 'Ablaufplan',          icon: Calendar,         hasItems: false },
  { key: 'musik',       label: 'Musik',               icon: Music2,           hasItems: true  },
  { key: 'patisserie',  label: 'Patisserie',          icon: Cake,             hasItems: false },
  { key: 'dekoration',  label: 'Dekoration',          icon: Flower2,          hasItems: true  },
  { key: 'medien',      label: 'Medien & Aufnahmen',  icon: Camera,           hasItems: true  },
  { key: 'sitzplan',    label: 'Sitzplan',            icon: Grid2X2,          hasItems: false },
]

interface Props {
  eventId: string
  dienstleisterId: string
  dienstleisterName: string
  dienstleisterEmail: string
  initialPerms: DienstleisterPermRow[]
  musikSongs: MusicSong[]
  dekorItems: DekorItem[]
  mediaItems: MediaItem[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildInitialTabPerms(perms: DienstleisterPermRow[]): Record<string, Access> {
  const result: Record<string, Access> = {}
  for (const p of perms) {
    if (p.item_id === null) {
      result[p.tab_key] = p.access
    }
  }
  return result
}

function buildInitialItemPerms(perms: DienstleisterPermRow[]): Record<string, Record<string, Access>> {
  const result: Record<string, Record<string, Access>> = {}
  for (const p of perms) {
    if (p.item_id !== null) {
      if (!result[p.tab_key]) result[p.tab_key] = {}
      result[p.tab_key][p.item_id] = p.access
    }
  }
  return result
}

// ── Toggle Button Group ───────────────────────────────────────────────────────

interface ToggleGroupProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  disabled?: boolean
}

function ToggleGroup<T extends string>({ options, value, onChange, disabled }: ToggleGroupProps<T>) {
  return (
    <div style={{
      display: 'inline-flex',
      background: 'var(--bg)',
      border: '1px solid var(--border2)',
      borderRadius: 10,
      padding: 2,
      gap: 2,
      flexShrink: 0,
    }}>
      {options.map(opt => {
        const active = opt.value === value
        const isWrite = opt.value === 'write'
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(opt.value)}
            style={{
              padding: '5px 11px',
              borderRadius: 8,
              border: 'none',
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              cursor: disabled ? 'default' : 'pointer',
              transition: 'all 0.15s ease',
              background: active
                ? isWrite
                  ? 'var(--accent)'
                  : active
                    ? '#fff'
                    : 'transparent'
                : 'transparent',
              color: active
                ? isWrite
                  ? '#fff'
                  : 'var(--text-primary)'
                : 'var(--text-tertiary)',
              boxShadow: active && !isWrite ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function BerechtigungenDLClient({
  eventId,
  dienstleisterId,
  dienstleisterName,
  dienstleisterEmail,
  initialPerms,
  musikSongs,
  dekorItems,
  mediaItems,
}: Props) {
  const supabase = createClient()
  const [tabPerms, setTabPerms] = useState<Record<string, Access>>(buildInitialTabPerms(initialPerms))
  const [itemPerms, setItemPerms] = useState<Record<string, Record<string, Access>>>(buildInitialItemPerms(initialPerms))
  const [saving, setSaving] = useState(false)
  const [savedKey, setSavedKey] = useState<string | null>(null)

  function flashSaved(key: string) {
    setSavedKey(key)
    setTimeout(() => setSavedKey(k => k === key ? null : k), 1500)
  }

  // ── Tab-level toggle ──────────────────────────────────────────────────────

  const handleTabToggle = useCallback(async (tabKey: string, access: Access) => {
    setTabPerms(prev => ({ ...prev, [tabKey]: access }))
    setSaving(true)
    try {
      if (access === 'none') {
        await supabase
          .from('dienstleister_permissions')
          .delete()
          .eq('event_id', eventId)
          .eq('dienstleister_user_id', dienstleisterId)
          .eq('tab_key', tabKey)
          .is('item_id', null)
      } else {
        await supabase
          .from('dienstleister_permissions')
          .upsert(
            { event_id: eventId, dienstleister_user_id: dienstleisterId, tab_key: tabKey, item_id: null, access },
            { onConflict: 'event_id,dienstleister_user_id,tab_key,item_id' }
          )
      }
      flashSaved(`tab:${tabKey}`)
    } finally {
      setSaving(false)
    }
  }, [eventId, dienstleisterId, supabase])

  // ── Item-level toggle ─────────────────────────────────────────────────────

  const handleItemToggle = useCallback(async (tabKey: string, itemId: string, access: Access | 'inherit') => {
    setItemPerms(prev => {
      const tab = { ...(prev[tabKey] ?? {}) }
      if (access === 'inherit') {
        delete tab[itemId]
      } else {
        tab[itemId] = access
      }
      return { ...prev, [tabKey]: tab }
    })
    setSaving(true)
    try {
      if (access === 'inherit') {
        await supabase
          .from('dienstleister_permissions')
          .delete()
          .eq('event_id', eventId)
          .eq('dienstleister_user_id', dienstleisterId)
          .eq('tab_key', tabKey)
          .eq('item_id', itemId)
      } else {
        await supabase
          .from('dienstleister_permissions')
          .upsert(
            { event_id: eventId, dienstleister_user_id: dienstleisterId, tab_key: tabKey, item_id: itemId, access },
            { onConflict: 'event_id,dienstleister_user_id,tab_key,item_id' }
          )
      }
      flashSaved(`item:${tabKey}:${itemId}`)
    } finally {
      setSaving(false)
    }
  }, [eventId, dienstleisterId, supabase])

  // ── Item data per tab ─────────────────────────────────────────────────────

  function getItemsForTab(tabKey: string): { id: string; label: string }[] {
    if (tabKey === 'musik') {
      return musikSongs.map(s => ({ id: s.id, label: s.artist ? `${s.title} — ${s.artist}` : s.title }))
    }
    if (tabKey === 'dekoration') {
      return dekorItems.map(i => ({ id: i.id, label: i.title }))
    }
    if (tabKey === 'medien') {
      return mediaItems.map(i => ({ id: i.id, label: i.title }))
    }
    return []
  }

  // ── Tab access summary for sidebar ───────────────────────────────────────

  const writeCount = CONFIGURABLE_TABS.filter(t => tabPerms[t.key] === 'write').length
  const readCount  = CONFIGURABLE_TABS.filter(t => tabPerms[t.key] === 'read').length
  const noneCount  = CONFIGURABLE_TABS.filter(t => !tabPerms[t.key] || tabPerms[t.key] === 'none').length

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <style>{`
        .dl-perm-grid {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 24px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .dl-perm-grid { grid-template-columns: 1fr; }
        }
        .tab-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          overflow: hidden;
          margin-bottom: 10px;
          transition: box-shadow 0.15s ease;
        }
        .tab-card:last-child { margin-bottom: 0; }
        .tab-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          gap: 12px;
        }
        .tab-row-has-access {
          border-left: 3px solid var(--accent);
        }
        .tab-row-no-access {
          border-left: 3px solid transparent;
        }
        .item-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 18px 10px 38px;
          border-top: 1px solid var(--border);
          gap: 12px;
          background: rgba(0,0,0,0.01);
        }
        .item-row-label {
          font-size: 12.5px;
          color: var(--text-secondary);
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .saved-flash {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--green);
          font-weight: 500;
          animation: fadeIn 0.15s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Back nav */}
      <Link
        href={`/veranstalter/${eventId}/mitglieder`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none',
          marginBottom: 22, fontWeight: 500,
        }}
      >
        <ArrowLeft size={15} />
        Zurück zu Mitglieder
      </Link>

      <div className="dl-perm-grid">
        {/* Left: tab list */}
        <div>
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 4 }}>
              Berechtigungen
            </h1>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
              {dienstleisterName}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{dienstleisterEmail}</p>
          </div>

          {/* Global save indicator */}
          <div style={{ height: 20, marginBottom: 16 }}>
            {saving && (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Speichern…</span>
            )}
          </div>

          {/* Tab cards */}
          {CONFIGURABLE_TABS.map(tab => {
            const tabAccess = tabPerms[tab.key] ?? 'none'
            const hasAccess = tabAccess !== 'none'
            const items = tab.hasItems ? getItemsForTab(tab.key) : []

            const tabOptions: { value: Access; label: string }[] = [
              { value: 'none',  label: 'Kein Zugriff' },
              { value: 'read',  label: 'Lesen' },
              { value: 'write', label: 'Schreiben' },
            ]
            const itemOptions: { value: Access | 'inherit'; label: string }[] = [
              { value: 'inherit', label: 'Erbt' },
              { value: 'read',    label: 'Lesen' },
              { value: 'write',   label: 'Schreiben' },
            ]

            return (
              <div key={tab.key} className="tab-card">
                {/* Tab-level row */}
                <div className={`tab-row ${hasAccess ? 'tab-row-has-access' : 'tab-row-no-access'}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <tab.icon size={18} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {tab.label}
                    </span>
                    {savedKey === `tab:${tab.key}` && (
                      <span className="saved-flash"><Check size={12} /> Gespeichert</span>
                    )}
                  </div>
                  <ToggleGroup
                    options={tabOptions}
                    value={tabAccess}
                    onChange={v => handleTabToggle(tab.key, v)}
                  />
                </div>

                {/* Item-level rows */}
                {tab.hasItems && items.length > 0 && (
                  <div>
                    {items.map(item => {
                      const itemAccess = itemPerms[tab.key]?.[item.id] ?? 'inherit'
                      return (
                        <div key={item.id} className="item-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>↳</span>
                            <span className="item-row-label" title={item.label}>{item.label}</span>
                            {savedKey === `item:${tab.key}:${item.id}` && (
                              <span className="saved-flash" style={{ flexShrink: 0 }}><Check size={11} /> Gespeichert</span>
                            )}
                          </div>
                          <ToggleGroup
                            options={itemOptions as { value: Access | 'inherit'; label: string }[]}
                            value={itemAccess}
                            onChange={v => handleItemToggle(tab.key, item.id, v)}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Right: summary sidebar */}
        <div style={{ position: 'sticky', top: 24 }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 20,
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Zugriffsübersicht</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Schreibzugriff</span>
                <span style={{
                  padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                  background: writeCount > 0 ? 'var(--accent)' : 'var(--bg)',
                  color: writeCount > 0 ? '#fff' : 'var(--text-tertiary)',
                }}>{writeCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Lesezugriff</span>
                <span style={{
                  padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                  background: readCount > 0 ? '#EEF2FF' : 'var(--bg)',
                  color: readCount > 0 ? '#4F46E5' : 'var(--text-tertiary)',
                }}>{readCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Kein Zugriff</span>
                <span style={{
                  padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                  background: 'var(--bg)',
                  color: 'var(--text-tertiary)',
                }}>{noneCount}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Tabs mit Zugriff
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {CONFIGURABLE_TABS.map(tab => {
                  const access = tabPerms[tab.key] ?? 'none'
                  if (access === 'none') return null
                  return (
                    <div key={tab.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <tab.icon size={14} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
                        {tab.label}
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                        background: access === 'write' ? 'var(--accent)' : '#EEF2FF',
                        color: access === 'write' ? '#fff' : '#4F46E5',
                      }}>
                        {access === 'write' ? 'Schreiben' : 'Lesen'}
                      </span>
                    </div>
                  )
                })}
                {writeCount === 0 && readCount === 0 && (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Kein Zugriff konfiguriert</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
