'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, MapPin, Globe, Phone, Mail, Star, Check, X, MessageSquare, Lock, BadgeCheck, ChevronDown } from 'lucide-react'
import { categoryLabel, PRICE_UNITS, SOCIAL_PLATFORMS } from '@/lib/marketplace/types'
import CategoryIcon from '@/components/marketplace/CategoryIcon'
import RequestFlow from '@/components/marketplace/RequestFlow'
import CoupleOfferPanel from '@/components/marketplace/CoupleOfferPanel'

interface Vendor {
  id: string; company_name: string | null; category: string
  email: string | null; phone: string | null; website: string | null; description: string | null
  street: string | null; zip: string | null; city: string | null; price_range: string | null
  verified: boolean; social_links: Record<string, string>; service_cities: string[]; service_radius_km: number | null
  logo_url: string | null; photos: { id: string; url: string }[]
}
interface Pkg { id: string; title: string; description: string; price_from: number | null; price_unit: string }
interface Faq { id: string; question: string; answer: string }
interface Review { id: string; author_name: string; rating: number; title: string; body: string; created_at: string }
interface Existing { id: string; status: string; conversation_id: string | null }

interface Props {
  eventId: string; vendor: Vendor
  packages: Pkg[]; faqs: Faq[]; reviews: Review[]; reviewAvg: number; reviewCount: number
  availability: string[]; contactUnlocked: boolean; canReview: boolean; existing: Existing | null
}

function priceUnitLabel(key: string) { return PRICE_UNITS.find(u => u.key === key)?.label ?? '' }
function Stars({ value, size = 15 }: { value: number; size?: number }) {
  return <span style={{ display: 'inline-flex', color: 'var(--bp-gold)' }}>
    {[1, 2, 3, 4, 5].map(i => <Star key={i} size={size} fill={i <= Math.round(value) ? 'currentColor' : 'none'} />)}
  </span>
}

export default function AnbieterDetailClient({ eventId, vendor, packages, faqs, reviews, reviewAvg, reviewCount, availability, contactUnlocked, canReview, existing }: Props) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [sent, setSent] = useState<Existing | null>(existing)
  const [openFaq, setOpenFaq] = useState<string | null>(null)

  // Bewertung schreiben
  const [revRating, setRevRating] = useState(5)
  const [revTitle, setRevTitle] = useState('')
  const [revBody, setRevBody] = useState('')
  const [revBusy, setRevBusy] = useState(false)
  const [revDone, setRevDone] = useState(false)
  const [revErr, setRevErr] = useState('')

  const addressParts = [vendor.street, [vendor.zip, vendor.city].filter(Boolean).join(' ')].filter(Boolean)
  const address = addressParts.join(', ')
  const hero = vendor.photos[0]?.url ?? vendor.logo_url
  const rest = vendor.photos.slice(1)
  const socials = SOCIAL_PLATFORMS.filter(s => vendor.social_links?.[s.key])

  async function submitReview() {
    setRevErr(''); setRevBusy(true)
    try {
      const res = await fetch('/api/marketplace/reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId: vendor.id, eventId, rating: revRating, title: revTitle, body: revBody }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setRevDone(true)
    } catch (e) {
      setRevErr(e instanceof Error ? e.message : 'Fehler')
    } finally { setRevBusy(false) }
  }

  return (
    <div className="bp-page">
      <Link href={`/brautpaar/${eventId}/dienstleister`} className="bp-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, width: 'fit-content' }}>
        <ChevronLeft size={16} /> Zurück zum Marktplatz
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 28, alignItems: 'start' }} className="mp-detail-grid">
        {/* ── Hauptspalte ── */}
        <div>
          <div style={{ aspectRatio: '16/9', borderRadius: 18, overflow: 'hidden', background: 'linear-gradient(135deg, var(--bp-gold-pale), var(--bp-ivory-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: hero ? 'zoom-in' : 'default' }}
            onClick={() => hero && setLightbox(hero)}>
            {hero
              ? <img src={hero} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ color: 'var(--bp-gold-deep)', opacity: 0.5 }}><CategoryIcon category={vendor.category} size={64} /></div>}
          </div>

          {rest.length > 0 && (
            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              {rest.map(p => (
                <button key={p.id} onClick={() => setLightbox(p.url)} style={{ width: 96, height: 72, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--bp-rule)', cursor: 'zoom-in', padding: 0, background: 'none' }}>
                  <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}

          {/* Kopf */}
          <div style={{ marginTop: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--bp-gold-deep)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              <CategoryIcon category={vendor.category} size={14} /> {categoryLabel(vendor.category)}
            </div>
            <h1 className="bp-font-heading" style={{ fontSize: '2.1rem', fontWeight: 600, margin: '6px 0 8px', color: 'var(--bp-ink)', lineHeight: 1.15, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {vendor.company_name || 'Anbieter'}
              {vendor.verified && (
                <span title="Von Forevr verifiziert" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: '#15803D', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '3px 9px', borderRadius: 999 }}>
                  <BadgeCheck size={15} /> Verifiziert
                </span>
              )}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Stars value={reviewAvg} />
              <span style={{ fontSize: 12.5, color: 'var(--bp-ink-3)' }}>
                {reviewCount > 0 ? `${reviewAvg.toFixed(1)} · ${reviewCount} Bewertung${reviewCount === 1 ? '' : 'en'}` : 'Noch keine Bewertungen'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {vendor.city && <span className="bp-badge bp-badge-neutral" style={{ gap: 4 }}><MapPin size={11} /> {vendor.city}</span>}
              {vendor.price_range && <span className="bp-badge bp-badge-neutral">Preisklasse {vendor.price_range}</span>}
            </div>
          </div>

          {vendor.description && (
            <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--bp-ink-2)', margin: '18px 0 0' }}>{vendor.description}</p>
          )}

          {/* Einsatzgebiet */}
          {(vendor.service_cities.length > 0 || vendor.service_radius_km) && (
            <div style={{ marginTop: 22 }}>
              <h3 className="bp-font-heading" style={{ fontSize: '1.2rem', margin: '0 0 10px' }}>Einsatzgebiet</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {vendor.service_cities.map(c => <span key={c} className="bp-badge bp-badge-neutral" style={{ gap: 4 }}><MapPin size={11} /> {c}</span>)}
                {vendor.service_radius_km && <span className="bp-badge bp-badge-neutral">Umkreis {vendor.service_radius_km} km</span>}
              </div>
            </div>
          )}

          {/* Pakete */}
          {packages.length > 0 && (
            <div style={{ marginTop: 26 }}>
              <h3 className="bp-font-heading" style={{ fontSize: '1.2rem', margin: '0 0 12px' }}>Pakete & Leistungen</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {packages.map(p => (
                  <div key={p.id} className="bp-card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                      <strong style={{ fontSize: 15, color: 'var(--bp-ink)' }}>{p.title}</strong>
                      {p.price_from != null && (
                        <span style={{ whiteSpace: 'nowrap', fontSize: 14, fontWeight: 700, color: 'var(--bp-gold-deep)' }}>
                          {priceUnitLabel(p.price_unit)} {p.price_from.toLocaleString('de-DE')} €
                        </span>
                      )}
                    </div>
                    {p.description && <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--bp-ink-2)', lineHeight: 1.6 }}>{p.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FAQ */}
          {faqs.length > 0 && (
            <div style={{ marginTop: 26 }}>
              <h3 className="bp-font-heading" style={{ fontSize: '1.2rem', margin: '0 0 12px' }}>Häufige Fragen</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {faqs.map(q => (
                  <div key={q.id} className="bp-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <button onClick={() => setOpenFaq(openFaq === q.id ? null : q.id)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--bp-ink)' }}>
                      {q.question}
                      <ChevronDown size={16} style={{ transform: openFaq === q.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                    </button>
                    {openFaq === q.id && <p style={{ margin: 0, padding: '0 16px 14px', fontSize: 13.5, color: 'var(--bp-ink-2)', lineHeight: 1.6 }}>{q.answer}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bewertungen */}
          <div style={{ marginTop: 26 }}>
            <h3 className="bp-font-heading" style={{ fontSize: '1.2rem', margin: '0 0 12px' }}>Bewertungen</h3>
            {reviews.length === 0 && <p style={{ fontSize: 13.5, color: 'var(--bp-ink-3)', margin: 0 }}>Noch keine Bewertungen.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reviews.map(r => (
                <div key={r.id} className="bp-card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <strong style={{ fontSize: 14, color: 'var(--bp-ink)' }}>{r.author_name}</strong>
                    <Stars value={r.rating} size={13} />
                  </div>
                  {r.title && <p style={{ margin: '8px 0 2px', fontSize: 14, fontWeight: 600, color: 'var(--bp-ink)' }}>{r.title}</p>}
                  {r.body && <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--bp-ink-2)', lineHeight: 1.6 }}>{r.body}</p>}
                </div>
              ))}
            </div>

            {canReview && !revDone && (
              <div className="bp-card" style={{ padding: 16, marginTop: 12 }}>
                <h4 className="bp-font-heading" style={{ fontSize: '1.05rem', margin: '0 0 10px' }}>Bewertung abgeben</h4>
                <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <button key={i} onClick={() => setRevRating(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--bp-gold)' }}>
                      <Star size={22} fill={i <= revRating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
                {revErr && <p style={{ color: '#C62828', fontSize: 12.5, margin: '0 0 8px' }}>{revErr}</p>}
                <input className="bp-input" placeholder="Titel (optional)" value={revTitle} onChange={e => setRevTitle(e.target.value)} style={{ marginBottom: 8 }} />
                <textarea className="bp-textarea" placeholder="Wie war die Zusammenarbeit?" value={revBody} onChange={e => setRevBody(e.target.value)} style={{ minHeight: 80, marginBottom: 10 }} />
                <button onClick={submitReview} disabled={revBusy} className="bp-btn bp-btn-primary"><Star size={15} /> {revBusy ? 'Sendet…' : 'Bewertung senden'}</button>
              </div>
            )}
            {revDone && <p style={{ fontSize: 13.5, color: '#15803D', marginTop: 12, fontWeight: 600 }}>Danke für deine Bewertung!</p>}
          </div>

          {/* Standort */}
          {address && (
            <div style={{ marginTop: 26 }}>
              <h3 className="bp-font-heading" style={{ fontSize: '1.2rem', margin: '0 0 10px' }}>Standort</h3>
              <p style={{ fontSize: 13.5, color: 'var(--bp-ink-2)', margin: '0 0 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}><MapPin size={14} /> {address}</p>
              <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--bp-rule)' }}>
                <iframe title="Standort" src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`} style={{ width: '100%', height: 260, border: 0 }} loading="lazy" />
              </div>
            </div>
          )}
        </div>

        {/* ── Sticky Anfrage + Kontakt ── */}
        <aside style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 14 }} className="mp-detail-aside">
          <div className="bp-card" style={{ padding: 18 }}>
            {sent ? (
              <div style={{ background: '#E6F4EA', borderRadius: 10, padding: '14px 16px', fontSize: 13.5, color: '#1E7E34' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 4 }}>
                  <Check size={16} /> {sent.status === 'accepted' ? 'Anfrage angenommen' : 'Anfrage gesendet'}
                </div>
                <p style={{ margin: 0, lineHeight: 1.5 }}>
                  {sent.status === 'accepted' ? 'Ihr könnt jetzt im Chat schreiben.' : 'Ihr werdet benachrichtigt, sobald der Dienstleister euer Angebot freigibt.'}
                </p>
                {sent.status === 'accepted' && (
                  <Link href={`/brautpaar/${eventId}/nachrichten`} className="bp-btn bp-btn-primary" style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                    <MessageSquare size={15} /> Zum Chat
                  </Link>
                )}
              </div>
            ) : (
              <RequestFlow eventId={eventId} vendorId={vendor.id} onSent={setSent} />
            )}
          </div>

          {sent && <CoupleOfferPanel requestId={sent.id} />}

          {/* Kontakt — Website offen, Kontaktdaten erst nach Annahme */}
          <div className="bp-card" style={{ padding: 18 }}>
            <h4 className="bp-font-heading" style={{ fontSize: '1.05rem', margin: '0 0 10px' }}>Kontakt</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5 }}>
              {vendor.website && <a href={vendor.website} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--bp-gold-deep)', textDecoration: 'none' }}><Globe size={14} /> Website</a>}
              {socials.map(s => (
                <a key={s.key} href={vendor.social_links[s.key]} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--bp-ink-2)', textDecoration: 'none' }}>
                  <Globe size={14} /> {s.label}
                </a>
              ))}
              {contactUnlocked ? (
                <>
                  {vendor.phone && <a href={`tel:${vendor.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--bp-ink-2)', textDecoration: 'none' }}><Phone size={14} /> {vendor.phone}</a>}
                  {vendor.email && <a href={`mailto:${vendor.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--bp-ink-2)', textDecoration: 'none' }}><Mail size={14} /> {vendor.email}</a>}
                </>
              ) : (
                (vendor.phone || vendor.email) && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--bp-ink-3)', fontSize: 12.5 }}>
                    <Lock size={13} /> Telefon & E-Mail nach Annahme der Anfrage sichtbar
                  </span>
                )
              )}
            </div>
          </div>

          {/* Verfügbarkeit */}
          {availability.length > 0 && (
            <div className="bp-card" style={{ padding: 18 }}>
              <h4 className="bp-font-heading" style={{ fontSize: '1.05rem', margin: '0 0 8px' }}>Belegte Termine</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {availability.slice(0, 12).map(d => (
                  <span key={d} className="bp-badge bp-badge-neutral" style={{ fontSize: 11.5 }}>{new Date(d).toLocaleDateString('de-DE')}</span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      <style>{`@media (max-width: 880px){ .mp-detail-grid{ grid-template-columns:1fr !important; } .mp-detail-aside{ position:static !important; } }`}</style>

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
          <img src={lightbox} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}
