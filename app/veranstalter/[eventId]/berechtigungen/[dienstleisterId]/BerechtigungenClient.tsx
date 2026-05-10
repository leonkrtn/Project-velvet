'use client'
import React, { useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Check, ArrowLeft, ChevronDown, ChevronRight, HelpCircle,
  LayoutDashboard, UtensilsCrossed, MessageSquare,
  Calendar, Music2, Cake, Flower2, Camera, Grid2X2, Users,
  LucideIcon,
} from 'lucide-react'
import type { DienstleisterPermRow } from './page'

// ── Types ─────────────────────────────────────────────────────────────────────

type Access = 'none' | 'read' | 'write'

interface SectionConfig {
  key: string
  label: string
  tooltip: string
}

interface TabConfig {
  key: string
  label: string
  icon: LucideIcon
  sections: SectionConfig[]
}

// ── Static config ─────────────────────────────────────────────────────────────

const CONFIGURABLE_TABS: TabConfig[] = [
  {
    key: 'uebersicht', label: 'Übersicht', icon: LayoutDashboard,
    sections: [
      { key: 'mitglieder',  label: 'Beteiligte',          tooltip: 'Anzahl der Beteiligten' },
      { key: 'einladungen', label: 'Offene Einladungen',   tooltip: 'Ausstehende Einladungen' },
      { key: 'countdown',   label: 'Tage bis Event',       tooltip: 'Countdown bis zum Veranstaltungsdatum' },
      { key: 'event',       label: 'Event',                tooltip: 'Eventname und grundlegende Infos' },
      { key: 'kontakte',    label: 'Wichtige Kontakte',    tooltip: 'Kontaktpersonen wie Brautpaar und Trauzeugen' },
      { key: 'margin',      label: 'Veranstalter-Marge',   tooltip: 'Interne Kalkulation und Marge (vertraulich)' },
      { key: 'todos',       label: 'Meine To-Dos',         tooltip: 'Persönliche Aufgabenliste' },
    ],
  },
  {
    key: 'catering', label: 'Catering & Menü', icon: UtensilsCrossed,
    sections: [
      { key: 'konzept',    label: 'Menü & Essenskonzept',         tooltip: 'Service-Stil, Essensoptionen, Kinderspeisen' },
      { key: 'menuplaene', label: 'Menügänge je Essensoption',    tooltip: 'Die einzelnen Gänge des Menüs pro Essensoption' },
      { key: 'service',    label: 'Service & Ablauf',             tooltip: 'Servicestil, Küche, Personal und Zeitplanung' },
      { key: 'getraenke',  label: 'Getränke',                     tooltip: 'Abrechnung, Sortiment, Wein und Sektempfang' },
      { key: 'equipment',  label: 'Equipment & Ausstattung',      tooltip: 'Geschirr, Gläser, Tischdecken, Buffet-Tische' },
      { key: 'budget',     label: 'Budget & Kalkulation',         tooltip: 'Budget pro Person und Gesamtkalkulation' },
      { key: 'statistik',  label: 'Gäste-Statistik',              tooltip: 'Menüwahl-Übersicht und Allergien der Gäste' },
      { key: 'kosten',     label: 'Catering-Kosten',              tooltip: 'Kostenaufstellung (vertraulich)' },
    ],
  },
  {
    key: 'chats', label: 'Chats', icon: MessageSquare,
    sections: [
      { key: 'liste',       label: 'Chat-Liste',         tooltip: 'Übersicht aller Konversationen' },
      { key: 'nachrichten', label: 'Nachrichten-Fenster', tooltip: 'Nachrichten lesen und senden' },
    ],
  },
  {
    key: 'ablaufplan', label: 'Ablaufplan', icon: Calendar,
    sections: [
      { key: 'zeitplan', label: 'Zeitplan-Eintrag',             tooltip: 'Ablaufpunkte mit Zeit, Ort und Kategorie' },
      { key: 'details',  label: 'Detailansicht Programmpunkt',  tooltip: 'Detaillierte Ansicht einzelner Programmpunkte' },
    ],
  },
  {
    key: 'gaesteliste', label: 'Gästeliste', icon: Users,
    sections: [
      { key: 'namen',     label: 'Gästenamen',      tooltip: 'Vor- und Nachname aller Gäste' },
      { key: 'essen',     label: 'Essenswahl',      tooltip: 'Gewähltes Menü pro Gast' },
      { key: 'allergien', label: 'Allergien',        tooltip: 'Unverträglichkeiten und spezielle Ernährungsanforderungen' },
      { key: 'tische',    label: 'Tischzuordnung',  tooltip: 'Welcher Gast an welchem Tisch sitzt' },
      { key: 'status',    label: 'Status',           tooltip: 'Zusage/Absage-Status pro Gast' },
    ],
  },
  {
    key: 'musik', label: 'Musik', icon: Music2,
    sections: [
      { key: 'anforderungen', label: 'Technische Anforderungen', tooltip: 'Soundcheck, PA-System, Bühne, Mikrofone, Strom' },
      { key: 'songliste',     label: 'Songliste',                tooltip: 'Wunsch-, No-Go- und Playlist-Songs' },
    ],
  },
  {
    key: 'patisserie', label: 'Patisserie', icon: Cake,
    sections: [
      { key: 'lieferung', label: 'Lieferung',            tooltip: 'Lieferdatum, Uhrzeit und Aufstellort' },
      { key: 'kuehlung',  label: 'Kühlung erforderlich',  tooltip: 'Kühllagerung und besondere Hinweise' },
      { key: 'torte',     label: 'Hochzeitstorte',        tooltip: 'Beschreibung, Schichten und Geschmacksrichtungen' },
    ],
  },
  {
    key: 'dekoration', label: 'Dekoration', icon: Flower2,
    sections: [
      { key: 'aufbau',   label: 'Aufbau-Aufgaben', tooltip: 'Aufgaben und Dekorations-Aufbaupunkte mit Ort und Zeiten' },
      { key: 'wuensche', label: 'Dekor-Wünsche',   tooltip: 'Inspirationsbilder und Moodboard-Einträge' },
    ],
  },
  {
    key: 'medien', label: 'Medien & Aufnahmen', icon: Camera,
    sections: [
      { key: 'briefing',  label: 'Briefing',   tooltip: 'Anweisungen und Wünsche für Foto und Video' },
      { key: 'shotliste', label: 'Shot-Liste',  tooltip: 'Gewünschte und obligatorische Aufnahmen' },
    ],
  },
  {
    key: 'sitzplan', label: 'Sitzplan', icon: Grid2X2,
    sections: [
      { key: 'grundriss', label: 'Grundriss', tooltip: 'Tischübersicht und Gast-Zuweisungen' },
    ],
  },
]

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  eventId: string
  dienstleisterId: string
  dienstleisterName: string
  dienstleisterEmail: string
  initialPerms: DienstleisterPermRow[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildInitialTabPerms(perms: DienstleisterPermRow[]): Record<string, Access> {
  const result: Record<string, Access> = {}
  for (const p of perms) {
    if (p.item_id === null) result[p.tab_key] = p.access
  }
  return result
}

function buildInitialSectionPerms(perms: DienstleisterPermRow[]): Record<string, Record<string, Access>> {
  const result: Record<string, Record<string, Access>> = {}
  for (const p of perms) {
    if (p.item_id !== null) {
      if (!result[p.tab_key]) result[p.tab_key] = {}
      result[p.tab_key][p.item_id] = p.access
    }
  }
  return result
}

// ── Toggle Group ──────────────────────────────────────────────────────────────

interface ToggleGroupProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  small?: boolean
}

function ToggleGroup<T extends string>({ options, value, onChange, small }: ToggleGroupProps<T>) {
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
        const isNone = opt.value === 'none'
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              padding: small ? '4px 9px' : '5px 11px',
              borderRadius: 8,
              border: 'none',
              fontSize: small ? 11 : 12,
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              background: active
                ? isWrite
                  ? 'var(--accent)'
                  : isNone
                    ? '#f3f3f3'
                    : '#fff'
                : 'transparent',
              color: active
                ? isWrite ? '#fff' : 'var(--text-primary)'
                : 'var(--text-tertiary)',
              boxShadow: active && !isWrite ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

const TAB_OPTIONS: { value: Access; label: string }[] = [
  { value: 'none',  label: 'Kein Zugriff' },
  { value: 'read',  label: 'Lesen' },
  { value: 'write', label: 'Schreiben' },
]

const SECTION_OPTIONS: { value: Access | 'inherit'; label: string }[] = [
  { value: 'inherit', label: 'Vererbt' },
  { value: 'none',    label: 'Kein Zugriff' },
  { value: 'read',    label: 'Lesen' },
  { value: 'write',   label: 'Schreiben' },
]

export default function BerechtigungenDLClient({
  eventId,
  dienstleisterId,
  dienstleisterName,
  dienstleisterEmail,
  initialPerms,
}: Props) {
  const supabase = createClient()
  const [tabPerms, setTabPerms] = useState<Record<string, Access>>(buildInitialTabPerms(initialPerms))
  const [sectionPerms, setSectionPerms] = useState<Record<string, Record<string, Access> | undefined>>(buildInitialSectionPerms(initialPerms))
  const [expandedTab, setExpandedTab] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedKey, setSavedKey] = useState<string | null>(null)

  function flashSaved(key: string) {
    setSavedKey(key)
    setTimeout(() => setSavedKey(k => k === key ? null : k), 1500)
  }

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

  const handleSectionToggle = useCallback(async (tabKey: string, sectionKey: string, access: Access | 'inherit') => {
    setSectionPerms(prev => {
      const tab = { ...(prev[tabKey] ?? {}) }
      if (access === 'inherit') {
        delete tab[sectionKey]
      } else {
        tab[sectionKey] = access
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
          .eq('item_id', sectionKey)
      } else {
        await supabase
          .from('dienstleister_permissions')
          .upsert(
            { event_id: eventId, dienstleister_user_id: dienstleisterId, tab_key: tabKey, item_id: sectionKey, access },
            { onConflict: 'event_id,dienstleister_user_id,tab_key,item_id' }
          )
      }
      flashSaved(`section:${tabKey}:${sectionKey}`)
    } finally {
      setSaving(false)
    }
  }, [eventId, dienstleisterId, supabase])

  const writeCount = CONFIGURABLE_TABS.filter(t => tabPerms[t.key] === 'write').length
  const readCount  = CONFIGURABLE_TABS.filter(t => tabPerms[t.key] === 'read').length

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
        .tab-expand-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 6px;
          color: var(--text-tertiary);
          font-size: 12px;
          transition: background 0.1s ease, color 0.1s ease;
          flex-shrink: 0;
        }
        .tab-expand-btn:hover {
          background: var(--bg);
          color: var(--text-secondary);
        }
        .section-rows {
          border-top: 1px solid var(--border);
          background: rgba(0,0,0,0.01);
        }
        .section-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 18px 10px 40px;
          border-bottom: 1px solid var(--border);
          gap: 12px;
        }
        .section-row:last-child { border-bottom: none; }
        .section-label {
          font-size: 12.5px;
          color: var(--text-secondary);
          flex: 1;
          min-width: 0;
        }
        .section-tooltip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          cursor: help;
          color: var(--text-tertiary);
          flex-shrink: 0;
        }
        .saved-flash {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--green);
          font-weight: 500;
          animation: fadeIn 0.15s ease;
          flex-shrink: 0;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <Link
        href={`/veranstalter/${eventId}/mitglieder`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none',
          marginBottom: 22, fontWeight: 500,
        }}
      >
        <ArrowLeft size={15} />
        Zurück zu Beteiligte
      </Link>

      <div className="dl-perm-grid">
        {/* Left: tab list */}
        <div>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 4 }}>
              Berechtigungen
            </h1>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
              {dienstleisterName}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{dienstleisterEmail}</p>
          </div>

          <div style={{ height: 20, marginBottom: 16 }}>
            {saving && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Speichern…</span>}
          </div>

          {CONFIGURABLE_TABS.map(tab => {
            const tabAccess = tabPerms[tab.key] ?? 'none'
            const hasAccess = tabAccess !== 'none'
            const isExpanded = expandedTab === tab.key

            return (
              <div key={tab.key} className="tab-card">
                {/* Tab row */}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      className="tab-expand-btn"
                      onClick={() => setExpandedTab(isExpanded ? null : tab.key)}
                      title={isExpanded ? 'Sektionen ausblenden' : 'Sektionen anzeigen'}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span>{tab.sections.length}</span>
                    </button>
                    <ToggleGroup
                      options={TAB_OPTIONS}
                      value={tabAccess}
                      onChange={v => handleTabToggle(tab.key, v)}
                    />
                  </div>
                </div>

                {/* Section rows (accordion) */}
                {isExpanded && (
                  <div className="section-rows">
                    {tab.sections.map(section => {
                      const sectionAccess = sectionPerms[tab.key]?.[section.key] ?? 'inherit'
                      const isInherit = sectionAccess === 'inherit'
                      return (
                        <div key={section.key} className="section-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: 12, flexShrink: 0 }}>↳</span>
                            <span className="section-label">
                              {section.label}
                              {isInherit && (
                                <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                  (vererbt: {tabAccess === 'none' ? 'kein Zugriff' : tabAccess === 'read' ? 'lesen' : 'schreiben'})
                                </span>
                              )}
                            </span>
                            <span
                              className="section-tooltip"
                              title={section.tooltip}
                            >
                              <HelpCircle size={13} />
                            </span>
                            {savedKey === `section:${tab.key}:${section.key}` && (
                              <span className="saved-flash"><Check size={11} /> Gespeichert</span>
                            )}
                          </div>
                          <ToggleGroup
                            options={SECTION_OPTIONS as { value: Access | 'inherit'; label: string }[]}
                            value={sectionAccess}
                            onChange={v => handleSectionToggle(tab.key, section.key, v)}
                            small
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
              {[
                { label: 'Schreibzugriff', count: writeCount, bg: writeCount > 0 ? 'var(--accent)' : 'var(--bg)', color: writeCount > 0 ? '#fff' : 'var(--text-tertiary)' },
                { label: 'Lesezugriff',    count: readCount,  bg: readCount > 0 ? '#EEF2FF' : 'var(--bg)', color: readCount > 0 ? '#4F46E5' : 'var(--text-tertiary)' },
                { label: 'Kein Zugriff',   count: CONFIGURABLE_TABS.length - writeCount - readCount, bg: 'var(--bg)', color: 'var(--text-tertiary)' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{row.label}</span>
                  <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: row.bg, color: row.color }}>
                    {row.count}
                  </span>
                </div>
              ))}
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
