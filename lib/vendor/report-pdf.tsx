import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, Font,
} from '@react-pdf/renderer'
import type { ReportData, ReportSection } from './monthly-report'

// ── Styles ────────────────────────────────────────────────────────────────────

const BLUE   = '#2352C8'
const DARK   = '#111827'
const MID    = '#374151'
const LIGHT  = '#6B7280'
const BORDER = '#E5E7EB'
const BG     = '#F3F6FF'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: DARK, padding: '40 44', backgroundColor: '#FFFFFF' },
  cover: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 0 },
  coverTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: BLUE, marginBottom: 6, letterSpacing: 1 },
  coverSub: { fontSize: 13, color: MID, marginBottom: 4 },
  coverMeta: { fontSize: 9, color: LIGHT, marginTop: 16 },

  sectionHeading: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: BLUE, marginBottom: 10, marginTop: 20, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: BLUE },
  kpiGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  kpiCard: { flex: 1, backgroundColor: BG, borderRadius: 6, padding: '10 12' },
  kpiLabel: { fontSize: 7.5, color: LIGHT, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: DARK },
  kpiSub: { fontSize: 7, color: LIGHT, marginTop: 2 },

  tableHeader: { flexDirection: 'row', backgroundColor: BLUE, padding: '5 8', borderRadius: 4, marginBottom: 2 },
  tableHeaderText: { fontFamily: 'Helvetica-Bold', color: '#FFFFFF', fontSize: 8 },
  tableRow: { flexDirection: 'row', padding: '5 8', borderBottomWidth: 0.5, borderBottomColor: BORDER },
  tableRowAlt: { backgroundColor: '#F9FAFB' },
  tableCell: { fontSize: 8, color: MID },
  tableCellBold: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: DARK },

  compareRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  compareLabel: { width: 160, fontSize: 8, color: MID, paddingTop: 3 },
  compareBar: { flex: 1 },

  footer: { position: 'absolute', bottom: 24, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 6 },
  footerText: { fontSize: 7, color: LIGHT },

  tag: { borderRadius: 3, padding: '2 5', fontSize: 7, alignSelf: 'flex-start' },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function eur(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(n))
}

function pct(a: number, b: number): string {
  if (b === 0) return '—'
  const d = ((a - b) / b) * 100
  return `${d > 0 ? '+' : ''}${Math.round(d)}%`
}

function DeltaTag({ cur, base }: { cur: number; base: number }) {
  if (base === 0) return null
  const d = cur - base
  const p = Math.round(((cur - base) / base) * 100)
  const pos = d >= 0
  return (
    <View style={{ ...s.tag, backgroundColor: pos ? 'rgba(30,126,52,0.12)' : 'rgba(197,34,31,0.10)' }}>
      <Text style={{ color: pos ? '#1E7E34' : '#C5221F' }}>{pos ? '+' : ''}{p}%</Text>
    </View>
  )
}

function Footer({ label, pageNum }: { label: string; pageNum: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>Forevr · {label}</Text>
      <Text style={s.footerText}>{pageNum}</Text>
    </View>
  )
}

// ── KPI Cards Row ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={s.kpiCard}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={s.kpiValue}>{value}</Text>
      {sub ? <Text style={s.kpiSub}>{sub}</Text> : null}
    </View>
  )
}

// ── Comparison table helper ───────────────────────────────────────────────────

type CompareRow = { label: string; cur: number | string; prev: number | string; ly: number | string; isMoney?: boolean; isPct?: boolean }

function CompareTable({ rows, periodLabel }: { rows: CompareRow[]; periodLabel: string }) {
  return (
    <View>
      <View style={s.tableHeader}>
        <Text style={{ ...s.tableHeaderText, flex: 2 }}>Kennzahl</Text>
        <Text style={{ ...s.tableHeaderText, flex: 1 }}>{periodLabel}</Text>
        <Text style={{ ...s.tableHeaderText, flex: 1 }}>Vorperiode</Text>
        <Text style={{ ...s.tableHeaderText, flex: 1 }}>Vorjahr</Text>
        <Text style={{ ...s.tableHeaderText, flex: 0.7 }}>Δ Vor.</Text>
        <Text style={{ ...s.tableHeaderText, flex: 0.7 }}>Δ Vj.</Text>
      </View>
      {rows.map((r, i) => {
        const curN = typeof r.cur === 'number' ? r.cur : 0
        const prevN = typeof r.prev === 'number' ? r.prev : 0
        const lyN = typeof r.ly === 'number' ? r.ly : 0
        const fmt = r.isMoney ? eur : r.isPct ? (n: number) => `${n}%` : (n: number) => String(Math.round(n))
        return (
          <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
            <Text style={{ ...s.tableCell, flex: 2 }}>{r.label}</Text>
            <Text style={{ ...s.tableCellBold, flex: 1 }}>{fmt(curN)}</Text>
            <Text style={{ ...s.tableCell, flex: 1 }}>{fmt(prevN)}</Text>
            <Text style={{ ...s.tableCell, flex: 1 }}>{fmt(lyN)}</Text>
            <Text style={{ ...s.tableCell, flex: 0.7, color: curN >= prevN ? '#1E7E34' : '#C5221F' }}>{pct(curN, prevN)}</Text>
            <Text style={{ ...s.tableCell, flex: 0.7, color: curN >= lyN ? '#1E7E34' : '#C5221F' }}>{pct(curN, lyN)}</Text>
          </View>
        )
      })}
    </View>
  )
}

// ── Main Document ─────────────────────────────────────────────────────────────

export default function ReportPDF({ data }: { data: ReportData }) {
  const cur = data.current
  const prev = data.prev_period
  const ly = data.same_period_last_year
  const generated = new Date(data.generated_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <Document>
      {/* ── Cover Page ── */}
      <Page size="A4" style={s.page}>
        <View style={s.cover}>
          <Text style={s.coverTitle}>FOREVR</Text>
          <Text style={s.coverSub}>{data.period_type === 'quarter' ? 'Quartalsbericht' : 'Monatsbericht'}</Text>
          <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: DARK, marginTop: 12 }}>{data.period_label}</Text>
          {data.company_name ? <Text style={{ ...s.coverSub, marginTop: 8 }}>{data.company_name}</Text> : null}
          <Text style={s.coverMeta}>Erstellt am {generated}</Text>
        </View>
        <Footer label={data.period_label} pageNum="1" />
      </Page>

      {/* ── Finance Page ── */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionHeading}>Finanzen</Text>

        {/* KPI row */}
        <View style={s.kpiGrid}>
          <KpiCard label="Umsatz" value={eur(cur.finance.accepted_revenue)} sub={`${cur.finance.accepted_count} Aufträge`} />
          <KpiCard label="Ø Auftragswert" value={eur(cur.finance.avg_order_value)} />
          <KpiCard label="Pipeline" value={eur(cur.finance.pipeline_value)} sub={`${cur.finance.pipeline_count} offen`} />
          <KpiCard label="Conversion" value={`${cur.requests.conversion_rate}%`} />
        </View>

        {/* Delta vs prev */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <View style={{ flex: 1, backgroundColor: '#F9FAFB', borderRadius: 6, padding: '8 12' }}>
            <Text style={{ fontSize: 7.5, color: LIGHT, marginBottom: 4 }}>vs. Vorperiode</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold' }}>{eur(cur.finance.accepted_revenue)}</Text>
              <DeltaTag cur={cur.finance.accepted_revenue} base={prev.finance.accepted_revenue} />
            </View>
          </View>
          <View style={{ flex: 1, backgroundColor: '#F9FAFB', borderRadius: 6, padding: '8 12' }}>
            <Text style={{ fontSize: 7.5, color: LIGHT, marginBottom: 4 }}>vs. Vorjahr</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold' }}>{eur(cur.finance.accepted_revenue)}</Text>
              <DeltaTag cur={cur.finance.accepted_revenue} base={ly.finance.accepted_revenue} />
            </View>
          </View>
        </View>

        {/* Detail table */}
        <CompareTable
          periodLabel={data.period_label}
          rows={[
            { label: 'Umsatz (angenommene Angebote)',   cur: cur.finance.accepted_revenue,  prev: prev.finance.accepted_revenue,  ly: ly.finance.accepted_revenue,  isMoney: true },
            { label: 'Anzahl angenommene Angebote',     cur: cur.finance.accepted_count,     prev: prev.finance.accepted_count,    ly: ly.finance.accepted_count },
            { label: 'Ø Auftragswert',                  cur: cur.finance.avg_order_value,    prev: prev.finance.avg_order_value,   ly: ly.finance.avg_order_value,   isMoney: true },
            { label: 'Median Auftragswert',             cur: cur.finance.median_order_value, prev: prev.finance.median_order_value,ly: ly.finance.median_order_value, isMoney: true },
            { label: 'Pipeline-Wert',                   cur: cur.finance.pipeline_value,     prev: prev.finance.pipeline_value,    ly: ly.finance.pipeline_value,    isMoney: true },
            { label: 'Pipeline Anzahl',                 cur: cur.finance.pipeline_count,     prev: prev.finance.pipeline_count,    ly: ly.finance.pipeline_count },
            { label: 'Anzahlungen fällig',              cur: cur.finance.deposits_due,       prev: prev.finance.deposits_due,      ly: ly.finance.deposits_due,      isMoney: true },
            { label: 'Restbetrag ausstehend',           cur: cur.finance.balance_outstanding,prev: prev.finance.balance_outstanding,ly: ly.finance.balance_outstanding,isMoney: true },
          ]}
        />

        <Footer label={data.period_label} pageNum="2" />
      </Page>

      {/* ── Requests & Conversion Page ── */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionHeading}>Anfragen & Angebote</Text>

        <View style={s.kpiGrid}>
          <KpiCard label="Anfragen" value={String(cur.requests.received)} />
          <KpiCard label="Versendet" value={String(cur.requests.offers_sent)} />
          <KpiCard label="Angenommen" value={String(cur.requests.offers_accepted)} />
          <KpiCard label="Conversion" value={`${cur.requests.conversion_rate}%`} sub="Versendet → Angenommen" />
        </View>

        <CompareTable
          periodLabel={data.period_label}
          rows={[
            { label: 'Anfragen eingegangen', cur: cur.requests.received,         prev: prev.requests.received,         ly: ly.requests.received },
            { label: 'Entwürfe',             cur: cur.requests.offers_draft,      prev: prev.requests.offers_draft,     ly: ly.requests.offers_draft },
            { label: 'Angebote versendet',   cur: cur.requests.offers_sent,       prev: prev.requests.offers_sent,      ly: ly.requests.offers_sent },
            { label: 'Angenommen',           cur: cur.requests.offers_accepted,   prev: prev.requests.offers_accepted,  ly: ly.requests.offers_accepted },
            { label: 'Abgelehnt',            cur: cur.requests.offers_declined,   prev: prev.requests.offers_declined,  ly: ly.requests.offers_declined },
            { label: 'Conversion Rate',      cur: cur.requests.conversion_rate,   prev: prev.requests.conversion_rate,  ly: ly.requests.conversion_rate, isPct: true },
          ]}
        />

        <Footer label={data.period_label} pageNum="3" />
      </Page>

      {/* ── Events Page ── */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionHeading}>Events im Zeitraum</Text>

        <View style={s.kpiGrid}>
          <KpiCard label="Events" value={String(cur.events.count)} />
          <KpiCard label="Vorperiode" value={String(prev.events.count)} />
          <KpiCard label="Vorjahr" value={String(ly.events.count)} />
        </View>

        {cur.events.list.length > 0 ? (
          <View>
            <View style={s.tableHeader}>
              <Text style={{ ...s.tableHeaderText, flex: 1 }}>Event</Text>
              <Text style={{ ...s.tableHeaderText, flex: 1 }}>Datum</Text>
            </View>
            {cur.events.list.map((e, i) => (
              <View key={e.event_id} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
                <Text style={{ ...s.tableCell, flex: 1 }}>{e.label}</Text>
                <Text style={{ ...s.tableCell, flex: 1 }}>{new Date(e.date + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ fontSize: 9, color: LIGHT }}>Keine Events in diesem Zeitraum.</Text>
        )}

        <Footer label={data.period_label} pageNum="4" />
      </Page>
    </Document>
  )
}
