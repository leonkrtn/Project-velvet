'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check, CreditCard, Sparkles, X, Lock, Loader2, Landmark, Wallet,
  CalendarX, Database, RotateCcw, HeartCrack,
} from 'lucide-react'

interface Promo {
  percent: number
  duration: 'first_month' | 'forever'
  appliesTo: 'all' | 'basis' | 'pro'
}

interface AboState {
  plan: 'trial' | 'basis' | 'pro'
  status: 'trialing' | 'active' | 'canceled' | 'expired'
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  daysLeft: number
  isPro: boolean
  promo: Promo | null
}

function promoAppliesTo(promo: Promo | null, plan: 'basis' | 'pro'): boolean {
  return !!promo && (promo.appliesTo === 'all' || promo.appliesTo === plan)
}
function discounted(price: number, promo: Promo | null, plan: 'basis' | 'pro'): number {
  if (!promoAppliesTo(promo, plan)) return price
  return Math.round(price * (1 - promo!.percent / 100) * 100) / 100
}

interface Props {
  eventId: string
  initialState: AboState
}

const PLAN_INFO = {
  basis: { name: 'Forevr', price: 25 },
  pro:   { name: 'Forevr Pro', price: 55 },
} as const

const CANCEL_REASONS = [
  { key: 'zu_teuer',        label: 'Es ist uns zu teuer' },
  { key: 'hochzeit_vorbei', label: 'Unsere Hochzeit ist vorbei' },
  { key: 'zu_wenig',        label: 'Wir nutzen es zu wenig' },
  { key: 'funktion_fehlt',  label: 'Uns fehlt eine Funktion' },
  { key: 'anderer',         label: 'Anderer Grund' },
] as const

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function AboClient({ eventId, initialState }: Props) {
  const state = initialState
  const [checkoutPlan, setCheckoutPlan] = useState<'basis' | 'pro' | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)

  const isTrialing = state.status === 'trialing'
  const isExpired  = state.status === 'expired'
  const isCanceled = state.status === 'canceled'
  const activePlan = state.status === 'active' || isCanceled ? state.plan : null

  const heroTitle = isTrialing
    ? 'Eure kostenlose Testphase'
    : isExpired
      ? 'Kein aktiver Tarif'
      : state.plan === 'pro' ? 'Forevr Pro' : 'Forevr'

  const heroSub = isTrialing
    ? `Alle Planungsfunktionen bis ${fmtDate(state.trialEndsAt)} — Profi-Team-Funktionen (Chat, Dienstleister, Veranstalter) gibt es mit Forevr Pro.`
    : isExpired
      ? 'Eure Planung ist sicher gespeichert. Wählt einen Tarif, um genau dort weiterzumachen, wo ihr aufgehört habt.'
      : isCanceled
        ? `Gekündigt — euer Zugang läuft noch bis ${fmtDate(state.currentPeriodEnd)}.`
        : `Aktiv — verlängert sich automatisch am ${fmtDate(state.currentPeriodEnd)}. Monatlich kündbar.`

  return (
    <div className="bp-page">
      <div className="bp-page-header">
        <h1 className="bp-page-title">Abo &amp; Tarif</h1>
        <p className="bp-page-subtitle">Euer Zugang zu Forevr — transparent und monatlich kündbar.</p>
      </div>

      {/* Status-Hero */}
      <div className="bp-abo-hero">
        <div className="bp-abo-hero-icon">
          {isTrialing ? <Sparkles size={22} /> : <CreditCard size={22} />}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 className="bp-abo-hero-title">{heroTitle}</h2>
          <p className="bp-abo-hero-sub">{heroSub}</p>
        </div>
        {(isTrialing || isCanceled) && state.daysLeft > 0 && (
          <div className="bp-abo-days">
            <div className="bp-abo-days-num">{state.daysLeft}</div>
            <div className="bp-abo-days-label">{state.daysLeft === 1 ? 'Tag übrig' : 'Tage übrig'}</div>
          </div>
        )}
      </div>

      {/* Gutscheincode einlösen */}
      {state.status !== 'active' && <RedeemBox eventId={eventId} activePromo={state.promo} />}

      {/* Tarifkarten */}
      <div className="bp-plan-grid">
        <PlanCard
          plan="basis"
          promo={state.promo}
          tagline="Ihr plant zu zweit — alle Kernfunktionen für eure Hochzeit."
          features={[
            'Gästeliste & persönliche RSVP-Links',
            'Sitzplan & Tischplanung',
            'Budget, Aufgaben & Zeitplan',
            'Beide Partner, alle Geräte',
          ]}
          current={activePlan === 'basis'}
          ctaLabel={activePlan === 'pro' ? null : isTrialing || isExpired ? 'Forevr wählen' : null}
          onSelect={() => setCheckoutPlan('basis')}
        />
        <PlanCard
          plan="pro"
          highlight
          promo={state.promo}
          tagline="Ihr plant mit Profis — Veranstalter und Dienstleister arbeiten mit."
          features={[
            'Alles aus Forevr, plus:',
            'Euer Hochzeitsplaner arbeitet im selben Dashboard mit',
            'Dienstleister einladen — Caterer, DJ, Florist & Co.',
            'Chat mit eurem ganzen Team',
          ]}
          current={activePlan === 'pro'}
          ctaLabel={activePlan === 'pro' ? null : activePlan === 'basis' ? 'Auf Pro upgraden' : 'Pro wählen'}
          onSelect={() => setCheckoutPlan('pro')}
        />
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--bp-ink-3)', marginTop: '1.1rem', maxWidth: 780, lineHeight: 1.6 }}>
        Monatlich kündbar, kein Jahresvertrag. Beim Upgrade bleibt eure gesamte Planung
        vollständig erhalten.
      </p>

      {(state.status === 'active') && (
        <button
          onClick={() => setCancelOpen(true)}
          style={{
            marginTop: '1.25rem', background: 'none', border: 'none', color: 'var(--bp-ink-3)',
            fontSize: '0.8rem', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', padding: 0,
          }}
        >
          Abo kündigen
        </button>
      )}
      {isCanceled && (
        <ReactivateButton eventId={eventId} />
      )}

      {checkoutPlan && (
        <CheckoutModal
          eventId={eventId}
          plan={checkoutPlan}
          promo={state.promo}
          isUpgrade={activePlan === 'basis' && checkoutPlan === 'pro'}
          onClose={() => setCheckoutPlan(null)}
        />
      )}

      {cancelOpen && (
        <CancelModal
          eventId={eventId}
          periodEnd={state.currentPeriodEnd}
          planName={PLAN_INFO[state.plan === 'pro' ? 'pro' : 'basis'].name}
          onClose={() => setCancelOpen(false)}
        />
      )}
    </div>
  )
}

// ── Tarifkarte ────────────────────────────────────────────────────────────────

function PlanCard({ plan, tagline, features, highlight, current, ctaLabel, onSelect, promo }: {
  plan: 'basis' | 'pro'
  tagline: string
  features: string[]
  highlight?: boolean
  current?: boolean
  ctaLabel: string | null
  onSelect: () => void
  promo?: Promo | null
}) {
  const info = PLAN_INFO[plan]
  const hasPromo = promoAppliesTo(promo ?? null, plan)
  const newPrice = discounted(info.price, promo ?? null, plan)
  return (
    <div className={`bp-plan-card${highlight ? ' pro' : ''}`}>
      {highlight && <span className="bp-plan-badge">Mit Profi-Team</span>}
      <p className="bp-plan-name">{info.name}</p>
      <div className="bp-plan-price">
        {hasPromo ? (
          <>
            <span style={{ textDecoration: 'line-through', color: 'var(--bp-ink-3)', fontWeight: 400, marginRight: 8 }}>{info.price} €</span>
            {newPrice} €
          </>
        ) : (
          <>{info.price} €</>
        )}
        <small>/ Monat</small>
      </div>
      {hasPromo && (
        <p style={{ fontSize: '0.72rem', color: 'var(--bp-gold-deep)', fontWeight: 600, margin: '-0.3rem 0 0.5rem' }}>
          −{promo!.percent} % {promo!.duration === 'forever' ? 'dauerhaft' : 'im ersten Monat'}
        </p>
      )}
      <p className="bp-plan-tagline">{tagline}</p>
      <ul className="bp-plan-features">
        {features.map((f, i) => (
          <li key={i} className="bp-plan-feature">
            <span className="bp-plan-check"><Check size={10} strokeWidth={3} /></span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {current ? (
        <div className="bp-plan-current"><Check size={14} /> Euer aktueller Tarif</div>
      ) : ctaLabel ? (
        <button className={`bp-plan-cta${highlight ? ' solid' : ''}`} onClick={onSelect}>
          {ctaLabel}
        </button>
      ) : (
        <div style={{ height: 42 }} />
      )}
    </div>
  )
}

// ── Checkout-Lightbox (simulierte Zahlung) ────────────────────────────────────

type PayMethod = 'card' | 'paypal' | 'sepa'

function CheckoutModal({ eventId, plan, isUpgrade, onClose, promo }: {
  eventId: string
  plan: 'basis' | 'pro'
  isUpgrade: boolean
  onClose: () => void
  promo?: Promo | null
}) {
  const router = useRouter()
  const info = PLAN_INFO[plan]
  const hasPromo = promoAppliesTo(promo ?? null, plan)
  const price = discounted(info.price, promo ?? null, plan)
  const priceStr = price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const [method, setMethod] = useState<PayMethod>('card')
  const [holder, setHolder] = useState('')
  const [cardNo, setCardNo] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [iban, setIban] = useState('')
  const [phase, setPhase] = useState<'form' | 'processing' | 'success'>('form')
  const [error, setError] = useState<string | null>(null)

  const cardValid = holder.trim().length >= 3 && cardNo.replace(/\s/g, '').length >= 15
    && /^\d{2}\/\d{2}$/.test(expiry) && cvc.length >= 3
  const sepaValid = holder.trim().length >= 3 && iban.replace(/\s/g, '').length >= 15
  const formValid = method === 'paypal' || (method === 'card' ? cardValid : sepaValid)

  function formatCardNo(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, 16)
    return digits.replace(/(.{4})/g, '$1 ').trim()
  }

  function formatExpiry(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, 4)
    if (digits.length <= 2) return digits
    return `${digits.slice(0, 2)}/${digits.slice(2)}`
  }

  async function pay() {
    setPhase('processing')
    setError(null)
    // Simulierte Bearbeitungszeit, damit der Ablauf realistisch wirkt
    const wait = new Promise(r => setTimeout(r, 1600))
    try {
      const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, plan }),
      })
      await wait
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Die Zahlung konnte nicht abgeschlossen werden')
      }
      setPhase('success')
    } catch (e) {
      setPhase('form')
      setError(e instanceof Error ? e.message : 'Die Zahlung konnte nicht abgeschlossen werden')
    }
  }

  function finish() {
    onClose()
    router.refresh()
  }

  return (
    <div className="bp-modal-overlay" onClick={() => phase === 'form' && onClose()}>
      <div className="bp-modal" onClick={e => e.stopPropagation()}>
        {phase !== 'processing' && (
          <button className="bp-modal-close" onClick={phase === 'success' ? finish : onClose} aria-label="Schließen">
            <X size={15} />
          </button>
        )}

        {phase === 'success' ? (
          <div className="bp-pay-success">
            <div className="bp-pay-success-icon"><Check size={30} strokeWidth={2.5} /></div>
            <h2 className="bp-modal-title">Zahlung erfolgreich</h2>
            <p className="bp-modal-sub" style={{ margin: '0.5rem 0 1.5rem' }}>
              Willkommen bei {info.name}! {isUpgrade
                ? 'Euer Upgrade ist sofort aktiv — Veranstalter und Dienstleister können jetzt dazu.'
                : 'Eure Planung läuft nahtlos weiter.'}
            </p>
            <button className="bp-pay-submit" onClick={finish}>Weiter zur Planung</button>
          </div>
        ) : (
          <>
            <div className="bp-modal-head">
              <h2 className="bp-modal-title">{isUpgrade ? `Upgrade auf ${info.name}` : `${info.name} buchen`}</h2>
              <p className="bp-modal-sub">Monatlich kündbar · Abrechnung ab heute</p>
            </div>
            <div className="bp-modal-body">
              {/* Bestellübersicht */}
              <div className="bp-pay-summary">
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--bp-ink)' }}>{info.name} — monatlich</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--bp-ink-3)' }}>jederzeit kündbar</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="bp-font-heading" style={{ fontSize: '1.3rem', color: 'var(--bp-ink)' }}>
                    {hasPromo && <span style={{ textDecoration: 'line-through', color: 'var(--bp-ink-3)', fontSize: '0.85rem', marginRight: 6 }}>{info.price},00 €</span>}
                    {priceStr} €
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--bp-ink-3)' }}>
                    heute fällig{hasPromo ? ` · −${promo!.percent} %${promo!.duration === 'forever' ? '' : ' (1. Monat)'}` : ''}
                  </div>
                </div>
              </div>

              {/* Zahlungsmethode */}
              <div className="bp-pay-tabs">
                {([
                  { key: 'card',   label: 'Karte',  icon: <CreditCard size={15} /> },
                  { key: 'paypal', label: 'PayPal', icon: <Wallet size={15} /> },
                  { key: 'sepa',   label: 'SEPA',   icon: <Landmark size={15} /> },
                ] as const).map(t => (
                  <button
                    key={t.key}
                    className={`bp-pay-tab${method === t.key ? ' active' : ''}`}
                    onClick={() => setMethod(t.key)}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>

              {method === 'card' && (
                <>
                  <div className="bp-pay-field">
                    <label className="bp-pay-label">Karteninhaber</label>
                    <input className="bp-pay-input" value={holder} onChange={e => setHolder(e.target.value)} placeholder="Vor- und Nachname" autoComplete="cc-name" />
                  </div>
                  <div className="bp-pay-field">
                    <label className="bp-pay-label">Kartennummer</label>
                    <input className="bp-pay-input" value={cardNo} onChange={e => setCardNo(formatCardNo(e.target.value))} placeholder="1234 5678 9012 3456" inputMode="numeric" autoComplete="cc-number" />
                  </div>
                  <div className="bp-pay-row">
                    <div className="bp-pay-field">
                      <label className="bp-pay-label">Gültig bis</label>
                      <input className="bp-pay-input" value={expiry} onChange={e => setExpiry(formatExpiry(e.target.value))} placeholder="MM/JJ" inputMode="numeric" autoComplete="cc-exp" />
                    </div>
                    <div className="bp-pay-field">
                      <label className="bp-pay-label">CVC</label>
                      <input className="bp-pay-input" value={cvc} onChange={e => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="123" inputMode="numeric" autoComplete="cc-csc" />
                    </div>
                  </div>
                </>
              )}

              {method === 'paypal' && (
                <p style={{ fontSize: '0.84rem', color: 'var(--bp-ink-2)', lineHeight: 1.6, margin: '0 0 0.4rem' }}>
                  Ihr werdet zur Bestätigung zu PayPal weitergeleitet und kehrt danach
                  automatisch zu Forevr zurück.
                </p>
              )}

              {method === 'sepa' && (
                <>
                  <div className="bp-pay-field">
                    <label className="bp-pay-label">Kontoinhaber</label>
                    <input className="bp-pay-input" value={holder} onChange={e => setHolder(e.target.value)} placeholder="Vor- und Nachname" />
                  </div>
                  <div className="bp-pay-field">
                    <label className="bp-pay-label">IBAN</label>
                    <input className="bp-pay-input" value={iban} onChange={e => setIban(e.target.value.toUpperCase())} placeholder="DE00 0000 0000 0000 0000 00" />
                  </div>
                </>
              )}

              {error && (
                <p style={{ fontSize: '0.8rem', color: 'var(--bp-red)', margin: '0 0 0.6rem' }}>{error}</p>
              )}

              <button className="bp-pay-submit" disabled={!formValid || phase === 'processing'} onClick={pay} style={{ marginTop: '0.4rem' }}>
                {phase === 'processing' ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'bpSpin 0.9s linear infinite' }} />
                    Zahlung wird verarbeitet…
                  </>
                ) : method === 'paypal' ? (
                  'Mit PayPal fortfahren'
                ) : (
                  `Jetzt ${priceStr} € zahlen`
                )}
              </button>

              <div className="bp-pay-secure">
                <Lock size={11} />
                SSL-verschlüsselt · sichere Übertragung
              </div>
              <p className="bp-pay-demo">Demo-Modus — es erfolgt keine echte Abbuchung.</p>
            </div>
          </>
        )}
        <style>{`@keyframes bpSpin { from { transform: rotate(0) } to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}

// ── Kündigungs-Lightbox (mehrstufig) ─────────────────────────────────────────

function CancelModal({ eventId, periodEnd, planName, onClose }: {
  eventId: string
  periodEnd: string | null
  planName: string
  onClose: () => void
}) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [reason, setReason] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmCancel() {
    setBusy(true)
    setError(null)
    try {
      const reasonLabel = CANCEL_REASONS.find(r => r.key === reason)?.label ?? reason
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, reason: note.trim() ? `${reasonLabel}: ${note.trim()}` : reasonLabel }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Kündigung fehlgeschlagen')
      }
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kündigung fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  function finish() {
    onClose()
    router.refresh()
  }

  return (
    <div className="bp-modal-overlay" onClick={() => !busy && (done ? finish() : onClose())}>
      <div className="bp-modal" onClick={e => e.stopPropagation()}>
        <button className="bp-modal-close" onClick={done ? finish : onClose} aria-label="Schließen">
          <X size={15} />
        </button>

        {done ? (
          <div className="bp-pay-success">
            <div className="bp-pay-success-icon" style={{ background: 'var(--bp-ivory-2)', color: 'var(--bp-ink-2)', boxShadow: 'none' }}>
              <Check size={30} strokeWidth={2.5} />
            </div>
            <h2 className="bp-modal-title">Kündigung vorgemerkt</h2>
            <p className="bp-modal-sub" style={{ margin: '0.5rem 0 1.5rem' }}>
              Euer Zugang bleibt bis {fmtDate(periodEnd)} bestehen. Ihr könnt die Kündigung
              bis dahin jederzeit zurücknehmen — eure Planung bleibt gespeichert.
            </p>
            <button className="bp-modal-btn-ghost" onClick={finish}>Schließen</button>
          </div>
        ) : step === 1 ? (
          <>
            <div className="bp-modal-head">
              <h2 className="bp-modal-title">Schade, dass ihr gehen wollt</h2>
              <p className="bp-modal-sub">Verratet ihr uns kurz, warum? Das hilft uns, Forevr besser zu machen.</p>
            </div>
            <div className="bp-modal-body">
              {CANCEL_REASONS.map(r => (
                <div
                  key={r.key}
                  className={`bp-cancel-reason${reason === r.key ? ' selected' : ''}`}
                  onClick={() => setReason(r.key)}
                  role="radio"
                  aria-checked={reason === r.key}
                >
                  <span className="bp-cancel-radio" />
                  {r.label}
                </div>
              ))}
              {reason && (
                <textarea
                  className="bp-cancel-textarea"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Möchtet ihr uns mehr dazu sagen? (optional)"
                  style={{ marginTop: '0.4rem' }}
                />
              )}
              <div className="bp-modal-actions">
                <button className="bp-modal-btn-primary" disabled={!reason} onClick={() => setStep(2)}>
                  Weiter
                </button>
                <button className="bp-modal-btn-ghost" onClick={onClose}>Abbrechen</button>
              </div>
            </div>
          </>
        ) : step === 2 ? (
          <>
            <div className="bp-modal-head">
              <h2 className="bp-modal-title">Das solltet ihr wissen</h2>
              <p className="bp-modal-sub">Was bei einer Kündigung von {planName} passiert:</p>
            </div>
            <div className="bp-modal-body">
              <div className="bp-cancel-fact">
                <CalendarX size={16} style={{ color: 'var(--bp-ink-3)', flexShrink: 0, marginTop: 2 }} />
                <span>Euer Zugang endet am <strong>{fmtDate(periodEnd)}</strong> — bis dahin könnt ihr ganz normal weiterplanen.</span>
              </div>
              <div className="bp-cancel-fact">
                <Database size={16} style={{ color: 'var(--bp-ink-3)', flexShrink: 0, marginTop: 2 }} />
                <span>Eure gesamte Planung — Gäste, Sitzplan, Budget — bleibt sicher gespeichert.</span>
              </div>
              <div className="bp-cancel-fact">
                <RotateCcw size={16} style={{ color: 'var(--bp-ink-3)', flexShrink: 0, marginTop: 2 }} />
                <span>Ihr könnt jederzeit zurückkehren und macht genau dort weiter, wo ihr aufgehört habt.</span>
              </div>
              <div className="bp-modal-actions">
                <button className="bp-modal-btn-primary" onClick={onClose}>Abo behalten</button>
                <button className="bp-modal-btn-ghost" onClick={() => setStep(3)}>Weiter zur Kündigung</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bp-modal-head">
              <h2 className="bp-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <HeartCrack size={20} style={{ color: 'var(--bp-ink-3)' }} />
                Endgültig kündigen?
              </h2>
              <p className="bp-modal-sub">
                {planName} wird zum <strong>{fmtDate(periodEnd)}</strong> beendet und danach
                nicht mehr abgebucht. Diese Entscheidung könnt ihr bis zum Periodenende
                jederzeit rückgängig machen.
              </p>
            </div>
            <div className="bp-modal-body">
              {error && (
                <p style={{ fontSize: '0.8rem', color: 'var(--bp-red)', margin: '0 0 0.6rem' }}>{error}</p>
              )}
              <div className="bp-modal-actions" style={{ marginTop: 0 }}>
                <button className="bp-modal-btn-danger" disabled={busy} onClick={confirmCancel}>
                  {busy ? 'Wird gekündigt…' : 'Ja, endgültig kündigen'}
                </button>
                <button className="bp-modal-btn-primary" onClick={onClose}>Abo behalten</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Gutscheincode einlösen ────────────────────────────────────────────────────

function RedeemBox({ eventId, activePromo }: { eventId: string; activePromo: Promo | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function redeem() {
    if (!code.trim()) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/promo/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Code konnte nicht eingelöst werden')
      setMsg({ ok: true, text: data.message ?? 'Code eingelöst.' })
      setCode('')
      router.refresh()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Code ungültig' })
    } finally {
      setBusy(false)
    }
  }

  if (activePromo && !msg) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'var(--bp-gold-deep)' }}>
        <Sparkles size={15} />
        <span>Aktiver Rabatt: <strong>−{activePromo.percent} %</strong> {activePromo.duration === 'forever' ? 'dauerhaft' : 'im ersten Monat'}.</span>
      </div>
    )
  }

  return (
    <div style={{ margin: '0 0 1.25rem' }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{ background: 'none', border: 'none', color: 'var(--bp-gold-deep)', fontSize: '0.85rem', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
        >
          Gutschein- oder Influencer-Code einlösen
        </button>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter') redeem() }}
            placeholder="CODE EINGEBEN"
            autoFocus
            style={{ height: 40, padding: '0 12px', border: '1px solid var(--bp-rule)', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'inherit', letterSpacing: '0.08em', textTransform: 'uppercase', outline: 'none', minWidth: 180 }}
          />
          <button className="bp-plan-cta" disabled={busy || !code.trim()} onClick={redeem} style={{ width: 'auto', padding: '0.6rem 1.3rem', height: 40 }}>
            {busy ? 'Prüfe…' : 'Einlösen'}
          </button>
        </div>
      )}
      {msg && (
        <p style={{ fontSize: '0.82rem', marginTop: 8, color: msg.ok ? 'var(--bp-green, #15803D)' : 'var(--bp-red)' }}>
          {msg.text}
        </p>
      )}
    </div>
  )
}

// ── Reaktivieren ──────────────────────────────────────────────────────────────

function ReactivateButton({ eventId }: { eventId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function reactivate() {
    setBusy(true)
    try {
      await fetch('/api/subscription/reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={reactivate}
      disabled={busy}
      className="bp-plan-cta"
      style={{ marginTop: '1.25rem', width: 'auto', padding: '0.6rem 1.4rem' }}
    >
      {busy ? 'Einen Moment…' : 'Kündigung zurücknehmen'}
    </button>
  )
}
