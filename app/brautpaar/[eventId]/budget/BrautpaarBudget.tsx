'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil } from 'lucide-react'

type PaymentStatus = 'offen' | 'angezahlt' | 'bezahlt'

interface BudgetItem {
  id: string
  event_id: string
  category: string | null
  description: string | null
  planned: number
  actual: number
  payment_status: PaymentStatus
  notes: string | null
  created_at: string
}

interface Props {
  eventId: string
  organizerFee: number
  organizerFeeType: string
  budgetLimit: number
  initialItems: BudgetItem[]
}

const CATEGORIES = ['Catering', 'Dekoration', 'Musik', 'Location', 'Fotografie', 'Kleidung', 'Transport', 'Sonstiges']
const STATUS_LABELS: Record<PaymentStatus, string> = { offen: 'Offen', angezahlt: 'Angezahlt', bezahlt: 'Bezahlt' }

function formatCurrency(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n)
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const colors: Record<PaymentStatus, string> = {
    offen: 'var(--bp-ink-3)',
    angezahlt: 'var(--bp-gold)',
    bezahlt: '#16A34A',
  }
  return (
    <span className="bp-badge" style={{ color: colors[status], borderColor: colors[status] }}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function ItemRow({ item, onUpdate, onDelete }: { item: BudgetItem; onUpdate: (i: BudgetItem) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(item)
  const [saving, setSaving]   = useState(false)

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('budget_items')
      .update({
        description:    draft.description,
        category:       draft.category,
        planned:        draft.planned,
        actual:         draft.actual,
        payment_status: draft.payment_status,
        notes:          draft.notes,
      })
      .eq('id', item.id)
    setSaving(false)
    if (!error) { onUpdate(draft); setEditing(false) }
  }

  if (editing) {
    return (
      <tr>
        <td colSpan={6} style={{ padding: '0.75rem 1rem' }}>
          <div className="bp-card" style={{ padding: '1rem' }}>
            <div className="bp-grid-2" style={{ marginBottom: '0.75rem' }}>
              <div className="bp-field">
                <label className="bp-label-text">Beschreibung</label>
                <input className="bp-input" value={draft.description ?? ''} onChange={e => setDraft(p => ({ ...p, description: e.target.value || null }))} />
              </div>
              <div className="bp-field">
                <label className="bp-label-text">Kategorie</label>
                <select className="bp-select" value={draft.category ?? ''} onChange={e => setDraft(p => ({ ...p, category: e.target.value || null }))}>
                  <option value="">Keine</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="bp-field">
                <label className="bp-label-text">Geplant (€)</label>
                <input className="bp-input" type="number" min="0" step="0.01" value={draft.planned} onChange={e => setDraft(p => ({ ...p, planned: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="bp-field">
                <label className="bp-label-text">Tatsächlich (€)</label>
                <input className="bp-input" type="number" min="0" step="0.01" value={draft.actual} onChange={e => setDraft(p => ({ ...p, actual: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="bp-field">
                <label className="bp-label-text">Status</label>
                <select className="bp-select" value={draft.payment_status} onChange={e => setDraft(p => ({ ...p, payment_status: e.target.value as PaymentStatus }))}>
                  <option value="offen">Offen</option>
                  <option value="angezahlt">Angezahlt</option>
                  <option value="bezahlt">Bezahlt</option>
                </select>
              </div>
              <div className="bp-field">
                <label className="bp-label-text">Notizen</label>
                <input className="bp-input" value={draft.notes ?? ''} onChange={e => setDraft(p => ({ ...p, notes: e.target.value || null }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="bp-btn bp-btn-secondary bp-btn-sm" onClick={() => { setDraft(item); setEditing(false) }}>Abbrechen</button>
              <button className="bp-btn bp-btn-primary bp-btn-sm" onClick={save} disabled={saving}>{saving ? '…' : 'Speichern'}</button>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td>
        <div style={{ fontWeight: 500, color: 'var(--bp-ink)', fontSize: '0.9375rem' }}>{item.description || '—'}</div>
        {item.notes && <div style={{ fontSize: '0.8125rem', color: 'var(--bp-ink-3)' }}>{item.notes}</div>}
      </td>
      <td>
        {item.category && <span className="bp-badge bp-badge-neutral">{item.category}</span>}
      </td>
      <td style={{ textAlign: 'right', fontFamily: 'Cormorant Garamond, serif', fontSize: '1.0625rem', fontWeight: 600 }}>
        {formatCurrency(item.planned)}
      </td>
      <td style={{ textAlign: 'right', fontFamily: 'Cormorant Garamond, serif', fontSize: '1.0625rem', color: 'var(--bp-ink-2)' }}>
        {item.actual > 0 ? formatCurrency(item.actual) : '—'}
      </td>
      <td><StatusBadge status={item.payment_status} /></td>
      <td style={{ textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
          <button className="bp-btn bp-btn-ghost bp-btn-sm bp-btn-icon" onClick={() => setEditing(true)}>
            <Pencil size={14} />
          </button>
          <button className="bp-btn bp-btn-danger bp-btn-sm bp-btn-icon" onClick={onDelete}>
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

function AddItemForm({ eventId, onAdded }: { eventId: string; onAdded: (i: BudgetItem) => void }) {
  const [open, setOpen]           = useState(false)
  const [description, setDescription] = useState('')
  const [category, setCategory]   = useState('')
  const [planned, setPlanned]     = useState('')
  const [saving, setSaving]       = useState(false)

  async function submit() {
    if (!description.trim() || !planned) return
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('budget_items')
      .insert({
        event_id:       eventId,
        description:    description.trim(),
        category:       category || null,
        planned:        parseFloat(planned),
        actual:         0,
        payment_status: 'offen',
      })
      .select()
      .single()
    setSaving(false)
    if (!error && data) {
      onAdded(data as BudgetItem)
      setDescription(''); setCategory(''); setPlanned(''); setOpen(false)
    }
  }

  if (!open) {
    return (
      <button className="bp-btn bp-btn-secondary" onClick={() => setOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Plus size={16} /> Position hinzufügen
      </button>
    )
  }

  return (
    <div className="bp-card" style={{ padding: '1rem', marginTop: '1rem' }}>
      <div className="bp-grid-2" style={{ marginBottom: '0.75rem' }}>
        <div className="bp-field">
          <label className="bp-label-text">Beschreibung *</label>
          <input className="bp-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="z.B. Catering" />
        </div>
        <div className="bp-field">
          <label className="bp-label-text">Kategorie</label>
          <select className="bp-select" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">Keine</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="bp-field">
          <label className="bp-label-text">Geplant (€) *</label>
          <input className="bp-input" type="number" min="0" step="0.01" value={planned} onChange={e => setPlanned(e.target.value)} placeholder="0" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button className="bp-btn bp-btn-ghost bp-btn-sm" onClick={() => setOpen(false)}>Abbrechen</button>
        <button className="bp-btn bp-btn-primary bp-btn-sm" onClick={submit} disabled={saving || !description.trim() || !planned}>{saving ? '…' : 'Hinzufügen'}</button>
      </div>
    </div>
  )
}

export default function BrautpaarBudget({ eventId, organizerFee, budgetLimit, initialItems }: Props) {
  const [items, setItems] = useState<BudgetItem[]>(initialItems)

  async function deleteItem(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('budget_items').delete().eq('id', id)
    if (!error) setItems(prev => prev.filter(i => i.id !== id))
  }

  const plannedTotal  = items.reduce((s, i) => s + (Number(i.planned) || 0), 0)
  const actualTotal   = items.reduce((s, i) => s + (Number(i.actual)  || 0), 0)
  const totalWithFee  = plannedTotal + organizerFee
  const budgetUsed    = budgetLimit > 0 ? (totalWithFee / budgetLimit) * 100 : 0

  return (
    <div className="bp-page">
      <div className="bp-page-header">
        <h1 className="bp-page-title">Budget</h1>
        <p className="bp-page-subtitle">Ausgaben planen und verfolgen</p>
      </div>

      {/* Summary */}
      <div className="bp-grid-3 bp-mb-8">
        <div className="bp-stat-card">
          <div className="bp-stat-value">{formatCurrency(actualTotal)}</div>
          <div className="bp-stat-label">Tatsächlich ausgegeben</div>
        </div>
        <div className="bp-stat-card">
          <div className="bp-stat-value">{formatCurrency(totalWithFee)}</div>
          <div className="bp-stat-label">Gesamt geplant</div>
        </div>
        {budgetLimit > 0 && (
          <div className="bp-stat-card">
            <div className="bp-stat-value" style={{ color: budgetUsed > 100 ? '#B91C1C' : 'var(--bp-gold-deep)' }}>
              {Math.round(budgetUsed)}%
            </div>
            <div className="bp-stat-label">Budget ausgeschöpft</div>
            <div style={{ marginTop: '0.625rem', height: 4, background: 'var(--bp-rule)', borderRadius: 2 }}>
              <div style={{ height: '100%', width: `${Math.min(budgetUsed, 100)}%`, background: budgetUsed > 100 ? '#B91C1C' : 'var(--bp-gold)', borderRadius: 2 }} />
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bp-card" style={{ overflow: 'hidden', marginBottom: '1rem' }}>
        <div className="bp-card-header">
          <h2 className="bp-section-title" style={{ margin: 0 }}>Positionen ({items.length})</h2>
        </div>
        <table className="bp-table">
          <thead>
            <tr>
              <th>Beschreibung</th>
              <th>Kategorie</th>
              <th style={{ textAlign: 'right' }}>Geplant</th>
              <th style={{ textAlign: 'right' }}>Tatsächlich</th>
              <th>Status</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {organizerFee > 0 && (
              <tr>
                <td>
                  <div style={{ fontWeight: 500, color: 'var(--bp-ink)' }}>Veranstalter-Honorar</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--bp-ink-3)' }}>Wird vom Veranstalter festgelegt</div>
                </td>
                <td><span className="bp-badge bp-badge-gold">Honorar</span></td>
                <td style={{ textAlign: 'right', fontFamily: 'Cormorant Garamond, serif', fontSize: '1.0625rem', fontWeight: 600 }}>
                  {formatCurrency(organizerFee)}
                </td>
                <td>—</td>
                <td></td>
                <td></td>
              </tr>
            )}
            {items.map(item => (
              <ItemRow
                key={item.id}
                item={item}
                onUpdate={updated => setItems(prev => prev.map(i => i.id === updated.id ? updated : i))}
                onDelete={() => deleteItem(item.id)}
              />
            ))}
            {items.length === 0 && !organizerFee && (
              <tr>
                <td colSpan={6}>
                  <div className="bp-empty">
                    <div className="bp-empty-title">Noch keine Positionen</div>
                    <div className="bp-empty-body">Fügt eure ersten Budgetpositionen hinzu.</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--bp-rule)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <AddItemForm eventId={eventId} onAdded={i => setItems(prev => [...prev, i])} />
          <div style={{ textAlign: 'right' }}>
            <div className="bp-label">Gesamt geplant</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 600, color: 'var(--bp-ink)' }}>
              {formatCurrency(totalWithFee)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
