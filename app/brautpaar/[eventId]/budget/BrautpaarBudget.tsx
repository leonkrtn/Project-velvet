'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, Settings, ChevronDown, ChevronRight, X } from 'lucide-react'
import { useAutoSave } from '@/hooks/useAutoSave'
import { SaveStatus } from '@/components/ui/SaveStatus'
import { runOptimistic, runOptimisticInsert, tempId } from '@/lib/optimistic'
import { useBpToast } from '@/components/ui/BpToast'
import { toUserMessage } from '@/lib/errors'

type PaymentStatus = 'offen' | 'angezahlt' | 'bezahlt'

interface CateringCostItem {
  id: string
  category: string | null
  price_per_person: number
  notes: string | null
}

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
  cateringCosts: CateringCostItem[]
  effectiveGuestCount: number
  getränkeBilling: 'honorar' | 'einzeln'
  getränkeBpTotal: number
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
  const [delConfirm, setDelConfirm] = useState(false)

  // "Tatsächlich/bezahlt" ist permanent inline editierbar (kein Bearbeiten-Klick nötig)
  // und wird daher mit einem eigenen, vom restlichen Edit-Modus unabhängigen
  // Auto-Save-State geführt.
  const [actualDraft, setActualDraft] = useState(item.actual)
  // Externe Änderungen (z. B. Rollback im Elternstate) nachziehen, solange der
  // Wert nicht gerade lokal abweicht (vermeidet Überschreiben während der Eingabe).
  const actualDraftRef = useRef(actualDraft)
  actualDraftRef.current = actualDraft
  useEffect(() => {
    if (item.actual !== actualDraftRef.current) setActualDraft(item.actual)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.actual])

  async function save(d: BudgetItem) {
    const prev = item // letzter committeter Stand → Rollback-Snapshot
    const supabase = createClient()
    const ok = await runOptimistic({
      apply: () => onUpdate(d),
      rollback: () => onUpdate(prev),
      commit: () => supabase
        .from('budget_items')
        .update({
          description:    d.description,
          category:       d.category,
          planned:        d.planned,
          payment_status: d.payment_status,
          notes:          d.notes,
        })
        .eq('id', item.id),
      onError: (e) => console.error('Budget-Position speichern fehlgeschlagen', e),
    })
    // useAutoSave erwartet Throw bei Fehler, um Status 'error' zu zeigen
    if (!ok) throw new Error('save failed')
  }

  async function saveActual(value: number) {
    const prev = item // letzter committeter Stand → Rollback-Snapshot
    const supabase = createClient()
    const ok = await runOptimistic({
      apply: () => onUpdate({ ...prev, actual: value }),
      rollback: () => { onUpdate(prev); setActualDraft(prev.actual) },
      commit: () => supabase
        .from('budget_items')
        .update({ actual: value })
        .eq('id', item.id),
      onError: (e) => console.error('Bezahlter Betrag speichern fehlgeschlagen', e),
    })
    if (!ok) throw new Error('save failed')
  }

  const { status: saveStatus } = useAutoSave(draft, save, { enabled: editing })
  const { status: actualSaveStatus, flush: flushActual } = useAutoSave(actualDraft, saveActual)

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
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--bp-ink-3)' }}>Änderungen werden automatisch gespeichert.</span>
              <SaveStatus status={saveStatus} />
              <button className="bp-btn bp-btn-primary bp-btn-sm" onClick={() => setEditing(false)}>Fertig</button>
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
      <td data-label="Kategorie">
        {item.category && <span className="bp-badge bp-badge-neutral">{item.category}</span>}
      </td>
      <td data-label="Geplant" style={{ textAlign: 'right', fontFamily: 'Cormorant Garamond, serif', fontSize: '1.0625rem', fontWeight: 600 }}>
        {formatCurrency(item.planned)}
      </td>
      <td data-label="Tatsächlich" style={{ textAlign: 'right' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.375rem' }}>
          {actualSaveStatus !== 'idle' && <SaveStatus status={actualSaveStatus} />}
          <input
            className="bp-input"
            type="number"
            min="0"
            step="0.01"
            value={actualDraft === 0 ? '' : actualDraft}
            placeholder="0"
            onChange={e => setActualDraft(parseFloat(e.target.value) || 0)}
            onBlur={flushActual}
            aria-label="Bezahlter Betrag (€)"
            style={{
              width: 100,
              textAlign: 'right',
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: '1.0625rem',
              color: 'var(--bp-ink-2)',
              padding: '0.25rem 0.5rem',
            }}
          />
        </div>
      </td>
      <td data-label="Status"><StatusBadge status={item.payment_status} /></td>
      <td style={{ textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end', alignItems: 'center' }}>
          {delConfirm ? (
            <>
              <button className="bp-btn bp-btn-danger bp-btn-sm" onClick={() => { setDelConfirm(false); onDelete() }}>
                Löschen
              </button>
              <button className="bp-btn bp-btn-ghost bp-btn-sm bp-btn-icon" onClick={() => setDelConfirm(false)} aria-label="Abbrechen">
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <button className="bp-btn bp-btn-ghost bp-btn-sm bp-btn-icon" onClick={() => setEditing(true)}>
                <Pencil size={14} />
              </button>
              <button className="bp-btn bp-btn-danger bp-btn-sm bp-btn-icon" onClick={() => setDelConfirm(true)} aria-label="Eintrag löschen">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

function CateringRow({ costs, effectiveGuestCount }: { costs: CateringCostItem[]; effectiveGuestCount: number }) {
  const [expanded, setExpanded] = useState(false)
  const totalPricePerPerson = costs.reduce((s, c) => s + (Number(c.price_per_person) || 0), 0)
  const total = totalPricePerPerson * effectiveGuestCount

  return (
    <>
      <tr
        onClick={() => costs.length > 0 && setExpanded(p => !p)}
        style={{ cursor: costs.length > 0 ? 'pointer' : 'default', background: expanded ? 'var(--bp-surface-2, #faf9f7)' : undefined }}
      >
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {costs.length > 0 && (expanded ? <ChevronDown size={14} color="var(--bp-ink-3)" /> : <ChevronRight size={14} color="var(--bp-ink-3)" />)}
            <div>
              <div style={{ fontWeight: 500, color: 'var(--bp-ink)', fontSize: '0.9375rem' }}>Catering</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--bp-ink-3)' }}>
                {costs.length > 0
                  ? `${formatCurrency(totalPricePerPerson)}/P · ${costs.length} Posten · ${effectiveGuestCount} Gäste`
                  : 'Noch keine Posten hinterlegt'}
              </div>
            </div>
          </div>
        </td>
        <td data-label="Kategorie"><span className="bp-badge" style={{ color: 'var(--bp-gold-deep)', borderColor: 'var(--bp-gold)' }}>Catering</span></td>
        <td data-label="Geplant" style={{ textAlign: 'right', fontFamily: 'Cormorant Garamond, serif', fontSize: '1.0625rem', fontWeight: 600 }}>
          {formatCurrency(total)}
        </td>
        <td data-label="Tatsächlich" style={{ textAlign: 'right', color: 'var(--bp-ink-3)' }}>—</td>
        <td></td>
        <td></td>
      </tr>
      {expanded && costs.map(c => {
        const pp        = Number(c.price_per_person) || 0
        const itemTotal = pp * effectiveGuestCount
        return (
          <tr key={c.id} style={{ background: 'var(--bp-surface-2, #faf9f7)' }}>
            <td style={{ paddingLeft: '2.75rem' }}>
              <div style={{ color: 'var(--bp-ink-2)', fontSize: '0.9rem' }}>{c.category || 'Sonstiges'}</div>
            </td>
            <td>
              <span style={{ fontSize: '0.8125rem', color: 'var(--bp-ink-3)' }}>
                {formatCurrency(pp)}/P
              </span>
            </td>
            <td style={{ textAlign: 'right', fontFamily: 'Cormorant Garamond, serif', fontSize: '1rem', color: 'var(--bp-ink-2)' }}>
              {formatCurrency(itemTotal)}
            </td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        )
      })}
    </>
  )
}

function GetränkeRow({ total }: { total: number }) {
  return (
    <tr>
      <td>
        <div style={{ fontWeight: 500, color: 'var(--bp-ink)', fontSize: '0.9375rem' }}>Getränke</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--bp-ink-3)' }}>Einzeln abgerechnet</div>
      </td>
      <td data-label="Kategorie"><span className="bp-badge" style={{ color: 'var(--bp-gold-deep)', borderColor: 'var(--bp-gold)' }}>Getränke</span></td>
      <td data-label="Geplant" style={{ textAlign: 'right', fontFamily: 'Cormorant Garamond, serif', fontSize: '1.0625rem', fontWeight: 600 }}>
        {formatCurrency(total)}
      </td>
      <td data-label="Tatsächlich" style={{ textAlign: 'right', color: 'var(--bp-ink-3)' }}>—</td>
      <td></td>
      <td></td>
    </tr>
  )
}

function AddItemForm({ eventId, onInsert, onReconcile, onRemove }: {
  eventId: string
  onInsert: (i: BudgetItem) => void
  onReconcile: (tempId: string, real: BudgetItem) => void
  onRemove: (id: string) => void
}) {
  const [open, setOpen]           = useState(false)
  const [description, setDescription] = useState('')
  const [category, setCategory]   = useState('')
  const [planned, setPlanned]     = useState('')
  const [saving, setSaving]       = useState(false)

  async function submit() {
    if (!description.trim() || !planned) return
    const supabase = createClient()
    const tmpId = tempId()
    const placeholder: BudgetItem = {
      id:             tmpId,
      event_id:       eventId,
      description:    description.trim(),
      category:       category || null,
      planned:        parseFloat(planned),
      actual:         0,
      payment_status: 'offen',
      notes:          null,
      created_at:     new Date().toISOString(),
    }
    setSaving(true)
    const result = await runOptimisticInsert<BudgetItem>({
      apply: () => onInsert(placeholder),
      commit: async () => {
        const { data, error } = await supabase
          .from('budget_items')
          .insert({
            event_id:       eventId,
            description:    placeholder.description,
            category:       placeholder.category,
            planned:        placeholder.planned,
            actual:         0,
            payment_status: 'offen',
          })
          .select()
          .single()
        if (error || !data) throw error ?? new Error('insert failed')
        return data as BudgetItem
      },
      reconcile: (real) => onReconcile(tmpId, real),
      rollback: () => onRemove(tmpId),
      onError: (e) => console.error('Budget-Position hinzufügen fehlgeschlagen', e),
    })
    setSaving(false)
    if (result) {
      setDescription(''); setCategory(''); setPlanned(''); setOpen(false)
    }
  }

  if (!open) {
    return (
      <button data-tour="bp-add-budget" className="bp-btn bp-btn-secondary bp-btn-mobile-full" onClick={() => setOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Plus size={16} /> Position hinzufügen
      </button>
    )
  }

  return (
    <div className="bp-card" style={{ padding: '1rem', marginTop: '1rem', width: '100%', flexBasis: '100%' }}>
      <div className="bp-grid-2" style={{ marginBottom: '0.75rem' }}>
        <div className="bp-field">
          <label className="bp-label-text">Beschreibung *</label>
          <input data-tour="bp-budget-desc" className="bp-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="z.B. Catering" />
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
          <input data-tour="bp-budget-planned" className="bp-input" type="number" min="0" step="0.01" value={planned} onChange={e => setPlanned(e.target.value)} placeholder="0" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button className="bp-btn bp-btn-ghost bp-btn-sm" onClick={() => setOpen(false)}>Abbrechen</button>
        <button data-tour="bp-budget-submit" className="bp-btn bp-btn-primary bp-btn-sm" onClick={submit} disabled={saving || !description.trim() || !planned}>{saving ? '…' : 'Hinzufügen'}</button>
      </div>
    </div>
  )
}

export default function BrautpaarBudget({ eventId, organizerFee, budgetLimit, initialItems, cateringCosts, effectiveGuestCount, getränkeBilling, getränkeBpTotal }: Props) {
  const [items, setItems] = useState<BudgetItem[]>(initialItems)
  const [limit, setLimit] = useState<number>(budgetLimit)
  const [editingLimit, setEditingLimit] = useState(false)
  const [limitInput, setLimitInput] = useState(String(budgetLimit || ''))
  const [savingLimit, setSavingLimit] = useState(false)
  const showToast = useBpToast()

  async function saveLimit() {
    const val = Math.max(0, Math.round(parseFloat(limitInput.replace(',', '.')) || 0))
    setSavingLimit(true)
    const supabase = createClient()
    const { error } = await supabase.from('events').update({ budget_total: val }).eq('id', eventId)
    setSavingLimit(false)
    if (!error) { setLimit(val); setEditingLimit(false) }
  }

  async function deleteItem(id: string) {
    const snapshot = items // Rollback-Snapshot der Liste
    const deleted = items.find(i => i.id === id)
    const supabase = createClient()
    const ok = await runOptimistic({
      apply: () => setItems(prev => prev.filter(i => i.id !== id)),
      rollback: () => setItems(snapshot),
      commit: () => supabase.from('budget_items').delete().eq('id', id),
      onError: (e) => {
        console.error('Budget-Position löschen fehlgeschlagen', e)
        showToast(toUserMessage(e, 'Position konnte nicht gelöscht werden.'), 'error')
      },
    })
    if (ok && deleted) {
      showToast('Position gelöscht', {
        actionLabel: 'Rückgängig',
        onAction: async () => {
          await runOptimisticInsert<BudgetItem>({
            apply: () => setItems(prev => [...prev, deleted]),
            commit: async () => {
              const { data, error } = await supabase
                .from('budget_items')
                .insert({
                  event_id: deleted.event_id,
                  description: deleted.description,
                  category: deleted.category,
                  planned: deleted.planned,
                  actual: deleted.actual,
                  payment_status: deleted.payment_status,
                  notes: deleted.notes,
                })
                .select()
                .single()
              if (error || !data) throw error ?? new Error('insert failed')
              return data as BudgetItem
            },
            reconcile: (real) => setItems(prev => prev.map(i => i.id === deleted.id ? real : i)),
            rollback: () => setItems(prev => prev.filter(i => i.id !== deleted.id)),
            onError: (e) => {
              console.error('Rückgängig machen fehlgeschlagen', e)
              showToast(toUserMessage(e, 'Rückgängig machen fehlgeschlagen.'), 'error')
            },
          })
        },
      })
    }
  }

  const visibleItems    = items.filter(i => i.category?.toLowerCase() !== 'catering')
  const cateringTotal   = cateringCosts.reduce((s, c) => s + (Number(c.price_per_person) || 0), 0) * effectiveGuestCount
  const plannedTotal    = visibleItems.reduce((s, i) => s + (Number(i.planned) || 0), 0)
  const actualTotal     = visibleItems.reduce((s, i) => s + (Number(i.actual)  || 0), 0)
  const getränkeInTotal = getränkeBilling === 'einzeln' ? getränkeBpTotal : 0
  const totalWithFee    = plannedTotal + organizerFee + cateringTotal + getränkeInTotal
  const budgetUsed      = limit > 0 ? (totalWithFee / limit) * 100 : 0

  return (
    <div className="bp-page">
      <div className="bp-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="bp-page-title">Budget</h1>
          <p className="bp-page-subtitle">Ausgaben planen und verfolgen</p>
        </div>
        {editingLimit ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              data-tour="bp-budget-max-input"
              type="number" min={0} autoFocus
              value={limitInput}
              onChange={e => setLimitInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveLimit(); if (e.key === 'Escape') setEditingLimit(false) }}
              placeholder="Gesamtbudget (€)"
              style={{ height: 38, padding: '0 12px', border: '1px solid var(--bp-rule)', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', width: 160 }}
            />
            <button data-tour="bp-budget-max-save" className="bp-btn bp-btn-primary" disabled={savingLimit} onClick={saveLimit} style={{ fontSize: '0.875rem' }}>
              {savingLimit ? 'Speichert…' : 'Speichern'}
            </button>
            <button className="bp-btn bp-btn-secondary" onClick={() => setEditingLimit(false)} style={{ fontSize: '0.875rem' }}>
              Abbrechen
            </button>
          </div>
        ) : (
          <button
            data-tour="bp-budget-max"
            onClick={() => { setLimitInput(String(limit || '')); setEditingLimit(true) }}
            className="bp-btn bp-btn-secondary bp-btn-mobile-full"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
          >
            <Settings size={15} />
            {limit > 0 ? `Gesamtbudget: ${formatCurrency(limit)}` : 'Gesamtbudget festlegen'}
          </button>
        )}
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
        {limit > 0 && (
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
          <h2 className="bp-section-title" style={{ margin: 0 }}>Positionen ({visibleItems.length + 1})</h2>
        </div>
        <div className="bp-scroll-x bp-stack-scroll">
        <table className="bp-table bp-stack-sm" style={{ minWidth: 560 }}>
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
                <td data-label="Kategorie"><span className="bp-badge bp-badge-gold">Honorar</span></td>
                <td data-label="Geplant" style={{ textAlign: 'right', fontFamily: 'Cormorant Garamond, serif', fontSize: '1.0625rem', fontWeight: 600 }}>
                  {formatCurrency(organizerFee)}
                </td>
                <td data-label="Tatsächlich">—</td>
                <td></td>
                <td></td>
              </tr>
            )}
            <CateringRow costs={cateringCosts} effectiveGuestCount={effectiveGuestCount} />
            {getränkeBilling === 'einzeln' && getränkeBpTotal > 0 && (
              <GetränkeRow total={getränkeBpTotal} />
            )}
            {visibleItems.map(item => (
              <ItemRow
                key={item.id}
                item={item}
                onUpdate={updated => setItems(prev => prev.map(i => i.id === updated.id ? updated : i))}
                onDelete={() => deleteItem(item.id)}
              />
            ))}
            {visibleItems.length === 0 && !organizerFee && (
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
        </div>
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--bp-rule)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <AddItemForm
            eventId={eventId}
            onInsert={i => setItems(prev => [...prev, i])}
            onReconcile={(tmpId, real) => setItems(prev => prev.map(i => i.id === tmpId ? real : i))}
            onRemove={id => setItems(prev => prev.filter(i => i.id !== id))}
          />
          <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
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
