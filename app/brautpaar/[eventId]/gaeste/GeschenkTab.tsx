'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Edit2, X, Check, Gift, ExternalLink, DollarSign } from 'lucide-react'

interface WishItem {
  id: string
  title: string
  description: string | null
  price: number | null
  priority: 'hoch' | 'mittel' | 'niedrig'
  link: string | null
  is_money_wish: boolean
  money_target: number | null
  status: 'verfuegbar' | 'vergeben'
  sort_order: number
  total_contributed: number
  contribution_count: number
}

interface WishFormData {
  title: string
  description: string
  price: string
  priority: 'hoch' | 'mittel' | 'niedrig'
  link: string
  is_money_wish: boolean
  money_target: string
}

const PRIORITY_CFG = {
  hoch:    { label: 'Hoch',    color: '#B91C1C', bg: '#FEF2F2', border: '#FCA5A5' },
  mittel:  { label: 'Mittel',  color: '#B45309', bg: '#FFFBEB', border: '#FCD34D' },
  niedrig: { label: 'Niedrig', color: '#15803D', bg: '#F0FDF4', border: '#86EFAC' },
}

function emptyForm(): WishFormData {
  return { title: '', description: '', price: '', priority: 'mittel', link: '', is_money_wish: false, money_target: '' }
}

// ── WishCard ─────────────────────────────────────────────────────────────────

function WishCard({ item, onEdit, onDelete }: { item: WishItem; onEdit: () => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const pCfg = PRIORITY_CFG[item.priority]
  const isFullyFunded = item.is_money_wish && item.money_target && item.total_contributed >= Number(item.money_target)
  const progressPct = item.is_money_wish && item.money_target && Number(item.money_target) > 0
    ? Math.min(100, (item.total_contributed / Number(item.money_target)) * 100)
    : 0

  return (
    <div
      className="bp-card"
      style={{
        padding: '1rem 1.25rem',
        opacity: (item.status === 'vergeben' && !item.is_money_wish) || isFullyFunded ? 0.65 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
        {/* Icon */}
        <div style={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          background: item.is_money_wish ? 'var(--bp-gold-pale)' : pCfg.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${item.is_money_wish ? 'var(--bp-rule-gold)' : pCfg.border}`,
        }}>
          {item.is_money_wish
            ? <DollarSign size={17} color="var(--bp-gold)" />
            : <Gift size={17} color={pCfg.color} />}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--bp-ink)', fontSize: '0.9375rem' }}>{item.title}</span>
            <span style={{
              fontSize: '0.625rem', fontWeight: 700, padding: '2px 7px',
              borderRadius: 4, background: pCfg.bg, color: pCfg.color,
              textTransform: 'uppercase', letterSpacing: '0.08em', border: `1px solid ${pCfg.border}`,
            }}>
              {pCfg.label}
            </span>
            {item.is_money_wish && (
              <span style={{
                fontSize: '0.625rem', fontWeight: 700, padding: '2px 7px',
                borderRadius: 4, background: 'var(--bp-gold-pale)', color: 'var(--bp-gold-deep)',
                textTransform: 'uppercase', letterSpacing: '0.08em', border: '1px solid var(--bp-rule-gold)',
              }}>
                Geldwunsch
              </span>
            )}
            {item.status === 'vergeben' && !item.is_money_wish && (
              <span style={{
                fontSize: '0.625rem', fontWeight: 700, padding: '2px 7px',
                borderRadius: 4, background: 'var(--bp-ivory-2)', color: 'var(--bp-ink-3)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Vergeben ✓
              </span>
            )}
            {isFullyFunded && (
              <span style={{
                fontSize: '0.625rem', fontWeight: 700, padding: '2px 7px',
                borderRadius: 4, background: '#F0FDF4', color: '#15803D',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Vollständig finanziert ✓
              </span>
            )}
          </div>

          {item.description && (
            <p className="bp-caption" style={{ marginBottom: '0.375rem', lineHeight: 1.5 }}>{item.description}</p>
          )}

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {item.price && !item.is_money_wish && (
              <span className="bp-caption">€ {Number(item.price).toLocaleString('de-DE')}</span>
            )}
            {item.link && (
              <a
                href={item.link} target="_blank" rel="noopener noreferrer"
                className="bp-caption"
                style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--bp-gold-deep)', textDecoration: 'none' }}
              >
                <ExternalLink size={11} /> Zum Produkt
              </a>
            )}
          </div>

          {/* Geldwunsch progress bar */}
          {item.is_money_wish && item.money_target && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span className="bp-caption">€ {item.total_contributed.toLocaleString('de-DE')} gesammelt</span>
                <span className="bp-caption" style={{ color: 'var(--bp-ink-2)' }}>
                  Ziel: € {Number(item.money_target).toLocaleString('de-DE')}
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--bp-rule)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${progressPct}%`,
                  background: isFullyFunded ? '#22C55E' : 'var(--bp-gold)',
                  borderRadius: 3, transition: 'width 0.4s ease',
                }} />
              </div>
              {item.contribution_count > 0 && (
                <p className="bp-caption" style={{ marginTop: '0.25rem' }}>
                  {item.contribution_count} {item.contribution_count === 1 ? 'Person' : 'Personen'} beteiligt
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
          {confirmDelete ? (
            <>
              <button className="bp-btn bp-btn-danger bp-btn-sm" onClick={onDelete} style={{ fontSize: '0.8125rem' }}>
                Löschen
              </button>
              <button className="bp-btn bp-btn-ghost bp-btn-sm" onClick={() => setConfirmDelete(false)}>
                Abbrechen
              </button>
            </>
          ) : (
            <>
              <button className="bp-btn bp-btn-ghost bp-btn-sm bp-btn-icon" onClick={onEdit} title="Bearbeiten">
                <Edit2 size={14} />
              </button>
              <button
                className="bp-btn bp-btn-ghost bp-btn-sm bp-btn-icon"
                onClick={() => setConfirmDelete(true)}
                title="Löschen"
                style={{ color: '#B91C1C' }}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── WishModal ────────────────────────────────────────────────────────────────

function WishModal({ form, onChange, onSave, onClose, saving, isEdit }: {
  form: WishFormData
  onChange: (f: WishFormData) => void
  onSave: () => void
  onClose: () => void
  saving: boolean
  isEdit: boolean
}) {
  const set = (patch: Partial<WishFormData>) => onChange({ ...form, ...patch })

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(44,40,37,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bp-paper)',
        borderRadius: 'var(--bp-r-lg)',
        padding: '1.75rem',
        width: '100%', maxWidth: 520,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: 'var(--bp-shadow-elevated)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 className="bp-h2" style={{ margin: 0 }}>
            {isEdit ? 'Wunsch bearbeiten' : 'Wunsch hinzufügen'}
          </h2>
          <button className="bp-btn bp-btn-ghost bp-btn-sm bp-btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="bp-field" style={{ marginBottom: 0 }}>
            <label className="bp-label-text">Titel *</label>
            <input
              className="bp-input"
              value={form.title}
              onChange={e => set({ title: e.target.value })}
              placeholder="z.B. KitchenAid Küchenmaschine"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && form.title.trim()) onSave() }}
            />
          </div>

          <div className="bp-field" style={{ marginBottom: 0 }}>
            <label className="bp-label-text">Beschreibung</label>
            <textarea
              className="bp-textarea"
              rows={2}
              value={form.description}
              onChange={e => set({ description: e.target.value })}
              placeholder="Optionale Details…"
              style={{ minHeight: 72 }}
            />
          </div>

          <div className="bp-grid-2" style={{ gap: '0.75rem' }}>
            <div className="bp-field" style={{ marginBottom: 0 }}>
              <label className="bp-label-text">Priorität</label>
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                {(['hoch', 'mittel', 'niedrig'] as const).map(p => {
                  const cfg = PRIORITY_CFG[p]
                  return (
                    <button
                      key={p} type="button"
                      onClick={() => set({ priority: p })}
                      style={{
                        flex: 1, padding: '7px 4px', borderRadius: 'var(--bp-r-sm)',
                        fontSize: '0.75rem', fontWeight: 600, fontFamily: 'inherit',
                        border: `1.5px solid ${form.priority === p ? cfg.color : 'var(--bp-rule)'}`,
                        background: form.priority === p ? cfg.bg : 'transparent',
                        color: form.priority === p ? cfg.color : 'var(--bp-ink-3)',
                        cursor: 'pointer',
                      }}
                    >
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="bp-field" style={{ marginBottom: 0 }}>
              <label className="bp-label-text">Preisvorstellung</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--bp-ink-3)', fontSize: '0.875rem', pointerEvents: 'none',
                }}>€</span>
                <input
                  className="bp-input"
                  type="number" min="0" step="0.01"
                  value={form.price}
                  onChange={e => set({ price: e.target.value })}
                  placeholder="0"
                  style={{ paddingLeft: '1.75rem' }}
                />
              </div>
            </div>
          </div>

          <div className="bp-field" style={{ marginBottom: 0 }}>
            <label className="bp-label-text">Link (optional)</label>
            <input
              className="bp-input"
              type="url"
              value={form.link}
              onChange={e => set({ link: e.target.value })}
              placeholder="https://…"
            />
          </div>

          {/* Geldwunsch toggle */}
          <div style={{
            background: 'var(--bp-ivory)',
            borderRadius: 'var(--bp-r-md)',
            padding: '1rem',
            border: '1px solid var(--bp-rule)',
          }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.is_money_wish}
                onChange={e => set({ is_money_wish: e.target.checked })}
                className="bp-checkbox"
                style={{ marginTop: 2 }}
              />
              <div>
                <div style={{ fontWeight: 500, color: 'var(--bp-ink)', fontSize: '0.9375rem', marginBottom: 2 }}>
                  Geldwunsch
                </div>
                <p className="bp-caption">
                  Gäste können einen beliebigen Betrag beisteuern — der Fortschritt wird als Balken angezeigt.
                </p>
              </div>
            </label>

            {form.is_money_wish && (
              <div style={{ marginTop: '0.875rem' }}>
                <label className="bp-label-text">Zielbetrag</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--bp-ink-3)', fontSize: '0.875rem', pointerEvents: 'none',
                  }}>€</span>
                  <input
                    className="bp-input"
                    type="number" min="0" step="0.01"
                    value={form.money_target}
                    onChange={e => set({ money_target: e.target.value })}
                    placeholder="z.B. 500"
                    style={{ paddingLeft: '1.75rem' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button className="bp-btn bp-btn-ghost" onClick={onClose}>Abbrechen</button>
          <button
            className="bp-btn bp-btn-primary"
            onClick={onSave}
            disabled={saving || !form.title.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            {saving ? '…' : <><Check size={14} /> {isEdit ? 'Speichern' : 'Hinzufügen'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function GeschenkTab({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<WishItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<WishFormData>(emptyForm())
  const [saving, setSaving] = useState(false)

  async function load() {
    const supabase = createClient()
    const [{ data: wishes }, { data: beitraege }] = await Promise.all([
      supabase.from('geschenk_wuensche').select('*').eq('event_id', eventId).order('sort_order').order('created_at'),
      supabase.from('geschenk_beitraege').select('wish_id, amount'),
    ])
    const totals: Record<string, { sum: number; count: number }> = {}
    for (const b of beitraege ?? []) {
      if (!totals[b.wish_id]) totals[b.wish_id] = { sum: 0, count: 0 }
      totals[b.wish_id].sum += Number(b.amount)
      totals[b.wish_id].count += 1
    }
    setItems((wishes ?? []).map(w => ({
      ...w,
      total_contributed: totals[w.id]?.sum ?? 0,
      contribution_count: totals[w.id]?.count ?? 0,
    })))
    setLoading(false)
  }

  useEffect(() => { load() }, [eventId])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(item: WishItem) {
    setEditingId(item.id)
    setForm({
      title: item.title,
      description: item.description ?? '',
      price: item.price != null ? String(item.price) : '',
      priority: item.priority,
      link: item.link ?? '',
      is_money_wish: item.is_money_wish,
      money_target: item.money_target != null ? String(item.money_target) : '',
    })
    setModalOpen(true)
  }

  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload = {
      event_id: eventId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      price: form.price ? Number(form.price) : null,
      priority: form.priority,
      link: form.link.trim() || null,
      is_money_wish: form.is_money_wish,
      money_target: form.is_money_wish && form.money_target ? Number(form.money_target) : null,
    }

    if (editingId) {
      const { error } = await supabase.from('geschenk_wuensche').update(payload).eq('id', editingId)
      if (!error) {
        setItems(prev => prev.map(i => i.id === editingId
          ? { ...i, ...payload, total_contributed: i.total_contributed, contribution_count: i.contribution_count }
          : i,
        ))
      }
    } else {
      const { data, error } = await supabase.from('geschenk_wuensche').insert(payload).select().single()
      if (!error && data) {
        setItems(prev => [...prev, { ...data, total_contributed: 0, contribution_count: 0 }])
      }
    }

    setSaving(false)
    setModalOpen(false)
  }

  async function deleteItem(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('geschenk_wuensche').delete().eq('id', id)
    if (!error) setItems(prev => prev.filter(i => i.id !== id))
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="bp-skeleton" style={{ height: 72, borderRadius: 'var(--bp-r-md)' }} />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <h3 className="bp-section-title" style={{ marginBottom: '0.25rem' }}>Geschenkliste</h3>
          <p className="bp-caption">Gäste sehen diese Liste beim RSVP und können Wünsche reservieren.</p>
        </div>
        <button
          className="bp-btn bp-btn-primary"
          onClick={openCreate}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}
        >
          <Plus size={16} /> Wunsch hinzufügen
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bp-card">
          <div className="bp-empty">
            <div className="bp-empty-icon"><Gift size={40} /></div>
            <div className="bp-empty-title">Noch keine Wünsche</div>
            <div className="bp-empty-body">
              Fügt Geschenkwünsche hinzu — eure Gäste können diese beim RSVP reservieren oder zu Geldwünschen beitragen.
            </div>
            <button
              className="bp-btn bp-btn-primary"
              onClick={openCreate}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Plus size={16} /> Ersten Wunsch hinzufügen
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {items.map(item => (
            <WishCard
              key={item.id}
              item={item}
              onEdit={() => openEdit(item)}
              onDelete={() => deleteItem(item.id)}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <WishModal
          form={form}
          onChange={setForm}
          onSave={save}
          onClose={() => setModalOpen(false)}
          saving={saving}
          isEdit={!!editingId}
        />
      )}
    </div>
  )
}
