'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, CreditCard, ShieldCheck, Sparkles, X } from 'lucide-react'

interface AboState {
  plan: 'trial' | 'basis' | 'pro'
  status: 'trialing' | 'active' | 'canceled' | 'expired'
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  daysLeft: number
  isPro: boolean
}

interface Props {
  eventId: string
  initialState: AboState
}

const GOLD = 'var(--bp-gold, #B8923A)'

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function AboClient({ eventId, initialState }: Props) {
  const router = useRouter()
  const [state] = useState(initialState)
  const [checkoutPlan, setCheckoutPlan] = useState<'basis' | 'pro' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function callApi(path: string, body: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Etwas ist schiefgelaufen')
      }
      router.refresh()
      setCheckoutPlan(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Etwas ist schiefgelaufen')
    } finally {
      setBusy(false)
    }
  }

  const isTrialing = state.status === 'trialing'
  const isExpired  = state.status === 'expired'
  const isCanceled = state.status === 'canceled'
  const activePlan = state.status === 'active' || isCanceled ? state.plan : null

  const statusText = isTrialing
    ? `Testphase — ${state.daysLeft === 1 ? 'noch 1 Tag' : `noch ${state.daysLeft} Tage`} voller Funktionsumfang (bis ${fmtDate(state.trialEndsAt)})`
    : isExpired
      ? 'Eure Testphase ist beendet. Wählt einen Tarif, um weiterzuplanen — eure Daten sind sicher gespeichert.'
      : isCanceled
        ? `Gekündigt — euer Zugang läuft noch bis ${fmtDate(state.currentPeriodEnd)}.`
        : `Aktiv — verlängert sich am ${fmtDate(state.currentPeriodEnd)}.`

  return (
    <div className="bp-page">
      <div className="bp-page-header">
        <h1 className="bp-page-title">Abo &amp; Tarif</h1>
        <p className="bp-page-subtitle">Euer Zugang zu Velvet — transparent und monatlich kündbar.</p>
      </div>

      {/* Status-Karte */}
      <div className="bp-card" style={{ marginBottom: '1.5rem' }}>
        <div className="bp-card-body" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: 'var(--bp-gold-light, #F4ECDD)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isTrialing ? <Sparkles size={18} style={{ color: GOLD }} /> : <CreditCard size={18} style={{ color: GOLD }} />}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--bp-ink)' }}>
              {isTrialing ? 'Kostenlose Testphase' : isExpired ? 'Kein aktiver Tarif' : state.plan === 'pro' ? 'Velvet Pro' : 'Velvet'}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--bp-ink-2)', marginTop: 2 }}>{statusText}</div>
          </div>
          {isCanceled && (
            <button
              onClick={() => callApi('/api/subscription/reactivate', { eventId })}
              disabled={busy}
              style={{
                background: 'none', border: `1px solid ${GOLD}`, color: GOLD, borderRadius: 999,
                padding: '0.45rem 1.1rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Kündigung zurücknehmen
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          background: '#FBEFEF', border: '1px solid #E2B5B5', color: '#9B3535',
          borderRadius: 10, padding: '0.7rem 1rem', fontSize: '0.8125rem', marginBottom: '1.5rem',
        }}>
          {error}
        </div>
      )}

      {/* Tarifkarten */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', alignItems: 'stretch', maxWidth: 760 }}>
        <PlanCard
          name="Velvet"
          price={25}
          tagline="Ihr plant zu zweit"
          features={[
            'Gästeliste & RSVP-Links',
            'Sitzplan & Tischplanung',
            'Budget, Aufgaben, Zeitplan',
            'Beide Partner, alle Geräte',
          ]}
          current={activePlan === 'basis'}
          cta={
            activePlan === 'basis'
              ? null
              : activePlan === 'pro'
                ? null // kein Downgrade-Flow (bei Bedarf kündigen + neu buchen)
                : { label: isTrialing ? 'Velvet wählen' : 'Velvet buchen', onClick: () => setCheckoutPlan('basis') }
          }
        />
        <PlanCard
          name="Velvet Pro"
          price={55}
          tagline="Ihr plant mit Profis"
          highlight
          features={[
            'Alles aus Velvet, plus:',
            'Euer Hochzeitsplaner arbeitet im selben Dashboard mit',
            'Dienstleister einladen — Caterer, DJ, Florist',
            'Chat mit eurem ganzen Team',
          ]}
          current={activePlan === 'pro'}
          cta={
            activePlan === 'pro'
              ? null
              : { label: activePlan === 'basis' ? 'Auf Pro upgraden' : isTrialing ? 'Pro wählen' : 'Pro buchen', onClick: () => setCheckoutPlan('pro') }
          }
        />
      </div>

      <p style={{ fontSize: '0.8125rem', color: 'var(--bp-ink-3)', marginTop: '1rem', maxWidth: 760 }}>
        Monatlich kündbar, kein Jahresvertrag. Upgrade von Velvet auf Pro jederzeit möglich —
        eure Planung bleibt dabei vollständig erhalten.
      </p>

      {/* Kündigen */}
      {state.status === 'active' && (
        <button
          onClick={() => {
            if (confirm('Abo zum Ende der laufenden Periode kündigen? Euer Zugang bleibt bis dahin bestehen, eure Daten werden nicht gelöscht.')) {
              callApi('/api/subscription/cancel', { eventId })
            }
          }}
          disabled={busy}
          style={{
            marginTop: '1.5rem', background: 'none', border: 'none', color: 'var(--bp-ink-3)',
            fontSize: '0.8125rem', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', padding: 0,
          }}
        >
          Abo kündigen
        </button>
      )}

      {/* Simulierter Checkout */}
      {checkoutPlan && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(40,34,26,0.45)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}
          onClick={() => !busy && setCheckoutPlan(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bp-surface, #fff)', borderRadius: 16, padding: '1.75rem',
              maxWidth: 400, width: '100%', position: 'relative',
            }}
          >
            <button
              onClick={() => !busy && setCheckoutPlan(null)}
              aria-label="Schließen"
              style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bp-ink-3)', padding: 4 }}
            >
              <X size={16} />
            </button>
            <h2 className="bp-font-display" style={{ fontSize: '1.25rem', margin: '0 0 0.4rem' }}>
              {checkoutPlan === 'pro' ? 'Velvet Pro' : 'Velvet'} buchen
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--bp-ink-2)', margin: '0 0 1.25rem' }}>
              {checkoutPlan === 'pro' ? '55 €' : '25 €'} pro Monat · monatlich kündbar
            </p>
            <div style={{
              background: 'var(--bp-gold-light, #F4ECDD)', borderRadius: 10, padding: '0.8rem 1rem',
              fontSize: '0.8125rem', color: 'var(--bp-ink-2)', display: 'flex', gap: 10, alignItems: 'flex-start',
              marginBottom: '1.25rem',
            }}>
              <ShieldCheck size={16} style={{ color: GOLD, flexShrink: 0, marginTop: 1 }} />
              <span>
                <strong>Demo-Modus:</strong> Die Zahlung wird aktuell simuliert — es wird nichts
                abgebucht. Der echte Bezahlvorgang folgt mit der Anbindung des Zahlungsdienstleisters.
              </span>
            </div>
            <button
              onClick={() => callApi('/api/subscription/checkout', { eventId, plan: checkoutPlan })}
              disabled={busy}
              style={{
                width: '100%', background: GOLD, color: '#fff', border: 'none', borderRadius: 999,
                padding: '0.75rem', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? 'Einen Moment…' : 'Zahlung simulieren & abschließen'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PlanCard({ name, price, tagline, features, highlight, current, cta }: {
  name: string
  price: number
  tagline: string
  features: string[]
  highlight?: boolean
  current?: boolean
  cta: { label: string; onClick: () => void } | null
}) {
  return (
    <div style={{
      background: 'var(--bp-surface, #fff)',
      border: highlight ? `1.5px solid ${GOLD}` : '1px solid var(--bp-border, #E5DED2)',
      borderRadius: 16, padding: '1.5rem', display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      {highlight && (
        <span style={{
          position: 'absolute', top: -10, right: 16, background: GOLD, color: '#fff',
          fontSize: '0.6875rem', fontWeight: 600, borderRadius: 999, padding: '0.15rem 0.7rem',
          letterSpacing: '0.04em',
        }}>
          Mit Profi-Team
        </span>
      )}
      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--bp-ink)' }}>{name}</div>
      <div style={{ margin: '0.4rem 0 0.2rem' }}>
        <span className="bp-font-display" style={{ fontSize: '1.9rem', color: 'var(--bp-ink)' }}>{price} €</span>
        <span style={{ fontSize: '0.8125rem', color: 'var(--bp-ink-3)' }}> / Monat</span>
      </div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--bp-ink-2)', marginBottom: '1rem' }}>{tagline}</div>
      <ul style={{ listStyle: 'none', margin: '0 0 1.25rem', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        {features.map((f, i) => (
          <li key={i} style={{ display: 'flex', gap: 8, fontSize: '0.8125rem', color: 'var(--bp-ink-2)', alignItems: 'flex-start' }}>
            <Check size={14} style={{ color: GOLD, flexShrink: 0, marginTop: 2 }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {current ? (
        <div style={{
          textAlign: 'center', fontSize: '0.8125rem', fontWeight: 600, color: GOLD,
          border: `1px dashed ${GOLD}`, borderRadius: 999, padding: '0.6rem',
        }}>
          Euer aktueller Tarif
        </div>
      ) : cta ? (
        <button
          onClick={cta.onClick}
          style={{
            background: highlight ? GOLD : 'none',
            color: highlight ? '#fff' : GOLD,
            border: `1px solid ${GOLD}`, borderRadius: 999, padding: '0.6rem',
            fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {cta.label}
        </button>
      ) : (
        <div style={{ height: 38 }} />
      )}
    </div>
  )
}
