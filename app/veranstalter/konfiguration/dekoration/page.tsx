'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronRight } from 'lucide-react'
import type { DekoOrganizerTemplate, DekoOrganizerFlatRate } from '@/lib/deko/types'

// ── Styles ────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', border: '1px solid var(--border)',
  borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none',
  background: 'var(--surface)', boxSizing: 'border-box',
}

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({
  template, flatRates, onRename, onDelete, onAddFlatRate, onDeleteFlatRate,
}: {
  template: DekoOrganizerTemplate
  flatRates: DekoOrganizerFlatRate[]
  onRename: (name: string) => void
  onDelete: () => void
  onAddFlatRate: (fr: Omit<DekoOrganizerFlatRate, 'id' | 'organizer_id'>) => void
  onDeleteFlatRate: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(template.name)
  const [addingFr, setAddingFr] = useState(false)
  const [frName, setFrName] = useState('')
  const [frAmount, setFrAmount] = useState('')
  const [frDesc, setFrDesc] = useState('')

  const myFlatRates = flatRates.filter(f => f.template_id === template.id)

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'var(--surface)', gap: 10 }}>
        <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {editingName
          ? <input autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)}
              onBlur={() => { setEditingName(false); onRename(nameDraft) }}
              onKeyDown={e => { if (e.key === 'Enter') { setEditingName(false); onRename(nameDraft) } }}
              style={{ ...inputStyle, flex: 1, height: 32 }} />
          : <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{template.name}</span>
        }
        <button onClick={() => setEditingName(true)} style={iconBtn}><Edit2 size={13} /></button>
        <button onClick={onDelete} style={{ ...iconBtn, color: '#E06C75' }}><Trash2 size={13} /></button>
      </div>

      {expanded && (
        <div style={{ padding: '14px 16px', background: '#fdfcfa', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Pauschalen</p>

          {myFlatRates.map(fr => (
            <div key={fr.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600 }}>{fr.name}</p>
                {fr.description && <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{fr.description}</p>}
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(fr.amount)}
              </span>
              <button onClick={() => onDeleteFlatRate(fr.id)} style={{ ...iconBtn, color: '#E06C75' }}><Trash2 size={12} /></button>
            </div>
          ))}

          {!addingFr
            ? <button onClick={() => setAddingFr(true)}
                style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                + Pauschale hinzufügen
              </button>
            : <div style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={labelStyle}>Name *</label>
                  <input value={frName} onChange={e => setFrName(e.target.value)} style={inputStyle} placeholder="z.B. Blumenpauschale" />
                </div>
                <div>
                  <label style={labelStyle}>Betrag (€) *</label>
                  <input type="number" value={frAmount} onChange={e => setFrAmount(e.target.value)} style={inputStyle} placeholder="0.00" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Beschreibung</label>
                  <input value={frDesc} onChange={e => setFrDesc(e.target.value)} style={inputStyle} placeholder="Optional…" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => {
                  if (!frName.trim() || !frAmount) return
                  onAddFlatRate({ template_id: template.id, name: frName.trim(), description: frDesc.trim() || null, amount: parseFloat(frAmount) })
                  setFrName(''); setFrAmount(''); setFrDesc(''); setAddingFr(false)
                }} style={{ padding: '6px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                  Hinzufügen
                </button>
                <button onClick={() => setAddingFr(false)} style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
                  <X size={12} />
                </button>
              </div>
            </div>
          }
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DekoKonfigurationPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<DekoOrganizerTemplate[]>([])
  const [flatRates, setFlatRates] = useState<DekoOrganizerFlatRate[]>([])
  const [loading, setLoading] = useState(true)
  const [addingTemplate, setAddingTemplate] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      Promise.all([
        supabase.from('deko_organizer_templates').select('*').eq('organizer_id', user.id).order('sort_order'),
        supabase.from('deko_organizer_flat_rates').select('*').eq('organizer_id', user.id),
      ]).then(([{ data: t }, { data: f }]) => {
        setTemplates((t ?? []) as DekoOrganizerTemplate[])
        setFlatRates((f ?? []) as DekoOrganizerFlatRate[])
        setLoading(false)
      })
    })
  }, [])

  async function createTemplate() {
    if (!newTemplateName.trim() || !userId) return
    const { data } = await supabase.from('deko_organizer_templates').insert({
      organizer_id: userId,
      name: newTemplateName.trim(),
      sort_order: templates.length,
    }).select().single()
    if (data) {
      setTemplates(prev => [...prev, data as DekoOrganizerTemplate])
      setNewTemplateName('')
      setAddingTemplate(false)
    }
  }

  async function renameTemplate(id: string, name: string) {
    await supabase.from('deko_organizer_templates').update({ name }).eq('id', id)
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, name } : t))
  }

  async function deleteTemplate(id: string) {
    await supabase.from('deko_organizer_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  async function addFlatRate(fr: Omit<DekoOrganizerFlatRate, 'id' | 'organizer_id'>) {
    if (!userId) return
    const { data } = await supabase.from('deko_organizer_flat_rates').insert({ ...fr, organizer_id: userId }).select().single()
    if (data) setFlatRates(prev => [...prev, data as DekoOrganizerFlatRate])
  }

  async function deleteFlatRate(id: string) {
    await supabase.from('deko_organizer_flat_rates').delete().eq('id', id)
    setFlatRates(prev => prev.filter(f => f.id !== id))
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Lädt…</div>

  return (
    <div style={{ padding: 24, maxWidth: 680 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>Dekoration — Vorlagen</h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
        Erstelle Vorlagen mit Pauschalen die beim Erstellen eines Events auf den Dekorationsbereich angewendet werden können.
      </p>

      {templates.map(t => (
        <TemplateCard
          key={t.id}
          template={t}
          flatRates={flatRates}
          onRename={name => renameTemplate(t.id, name)}
          onDelete={() => deleteTemplate(t.id)}
          onAddFlatRate={addFlatRate}
          onDeleteFlatRate={deleteFlatRate}
        />
      ))}

      {templates.length === 0 && !addingTemplate && (
        <div style={{ padding: '32px 24px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 10, color: 'var(--text-tertiary)', marginBottom: 16 }}>
          Noch keine Vorlagen erstellt.
        </div>
      )}

      {addingTemplate
        ? <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input autoFocus value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createTemplate(); if (e.key === 'Escape') setAddingTemplate(false) }}
            placeholder="Vorlage benennen…" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={createTemplate} style={{ padding: '8px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
            Erstellen
          </button>
          <button onClick={() => setAddingTemplate(false)} style={{ padding: '8px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
        : <button onClick={() => setAddingTemplate(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', border: '1px dashed var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'inherit', marginTop: 8 }}>
          <Plus size={15} /> Neue Vorlage erstellen
        </button>
      }
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 6,
  background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.08em',
  color: 'var(--text-tertiary)', marginBottom: 4,
}
