'use client'
import React, { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import type { DekoItem, DekoCatalogItem, DekoFlatRate } from '@/lib/deko/types'
import { calcCanvasBudget, calcItemPrice } from '@/lib/deko/types'

interface Props {
  items: DekoItem[]
  catalog: DekoCatalogItem[]
  flatRates: DekoFlatRate[]
  eventId: string
}

function fmt(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
}

export default function DekoBudgetBar({ items, catalog, flatRates }: Props) {
  const [expanded, setExpanded] = useState(false)
  const total = calcCanvasBudget(items, catalog, flatRates)

  const priceItems = items.filter(i => ['article', 'fabric', 'flat_rate_article'].includes(i.type))

  return (
    <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
      {/* Summary row — always visible */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', gap: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>
          Budget dieses Canvas
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{fmt(total)}</span>
        {priceItems.length > 0 && (
          <button onClick={() => setExpanded(e => !e)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
            {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        )}
      </div>

      {/* Expanded breakdown */}
      {expanded && priceItems.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '8px 16px', maxHeight: 200, overflowY: 'auto' }}>
          {priceItems.map(item => {
            const cat = catalog.find(c => {
              const d = item.data as { catalog_item_id?: string }
              return c.id === d.catalog_item_id
            })
            if (!cat) return null
            const price = calcItemPrice(item, catalog, flatRates)
            const qty = (item.data as { quantity?: number; quantity_meters?: number }).quantity
              ?? (item.data as { quantity_meters?: number }).quantity_meters
              ?? 1
            const unit = item.type === 'fabric' ? 'm' : '×'
            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 12 }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                  {cat.name}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{unit}{qty}</span>
                {cat.is_free
                  ? <span style={{ color: '#4CAF50', fontWeight: 600, fontSize: 11 }}>Gratis</span>
                  : cat.flat_rate_id
                    ? <span style={{ color: '#C9B99A', fontSize: 11 }}>Pauschale</span>
                    : <span style={{ fontWeight: 600 }}>{fmt(price)}</span>
                }
              </div>
            )
          })}
          {flatRates.filter(fr =>
            items.some(i => i.type === 'flat_rate_article' && (i.data as { flat_rate_id?: string }).flat_rate_id === fr.id)
          ).map(fr => (
            <div key={fr.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 12, paddingTop: 4, borderTop: '1px dashed var(--border)' }}>
              <span style={{ flex: 1, color: 'var(--text-secondary)' }}>Pauschale: {fr.name}</span>
              <span style={{ fontWeight: 600 }}>{fmt(fr.amount)}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>Gesamt: {fmt(total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
