'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, MapPin, Globe, Phone, Mail, Star, Check, X, MessageSquare, Lock, BadgeCheck, ChevronDown, Flag } from 'lucide-react'
import { categoryLabel, PRICE_UNITS, SOCIAL_PLATFORMS } from '@/lib/marketplace/types'
import CategoryIcon from '@/components/marketplace/CategoryIcon'
import RequestFlow from '@/components/marketplace/RequestFlow'
import CoupleOfferPanel from '@/components/marketplace/CoupleOfferPanel'
import CoupleDataRequests from '@/components/marketplace/CoupleDataRequests'
import { resolveVendorCity, formatVendorAddress } from '@/lib/vendor/location'
import { VideoCarousel, AudioSamplePlayer } from '@/components/marketplace/VendorMediaSection'
import { youtubeVideoId } from '@/lib/marketplace/types'

interface Vendor {
  id: string; company_name: string | null; category: string
  email: string | null; phone: string | null; website: string | null; description: string | null
  street: string | null; zip: string | null; city: string | null
  company_street: string | null; company_zip: string | null; company_city: string | null
  price_range: string | null
  verified: boolean; social_links: Record<string, string>; service_cities: string[]; service_radius_km: number | null
  logo_url: string | null; photos: { id: string; url: string }[]
  video_urls: string[]; audio_url: string | null; audio_title: string | null
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

const REPORT_REASONS = [
  { key: 'falsche_angaben', label: 'Falsche Angaben' },
  { key: 'unangemessene_bilder', label: 'Unangemessene Bilder' },
  { key: 'betrug', label: 'Betrug' },
  { key: 'spam', label: 'Spam' },
] as const

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

  // Anbieter melden
  const [showReport, setShowReport] = useState(false)
  const [reportReason, setReportReason] = useState<string>('falsche_angaben')
  const [reportComment, setReportComment] = useState('')
  const [reportBusy, setReportBusy] = useState(false)
  const [reportDone, setReportDone] = useState(false)
  const [reportErr, setReportErr] = useState('')

  async function submitReport() {
    setReportErr(''); setReportBusy(true)
    try {
      const res = await fetch('/api/vendor/report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId: vendor.id, reason: reportReason, comment: reportComment }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setReportDone(true)
    } catch (e) {
      setReportErr(e instanceof Error ? e.message : 'Fehler beim Senden')
    } finally { setReportBusy(false) }
  }

  const address = formatVendorAddress(vendor)
  const resolvedCity = resolveVendorCity(vendor)
  const hero = vendor.photos[0]?.url ?? vendor.logo_url
  const rest = vendor.photos.slice(1)
  const hasVideos = vendor.video_urls.some(u => youtubeVideoId(u))
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
              ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hero} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )
              : <div style={{ color: 'var(--bp-gold-deep)', opacity: 0.5 }}><CategoryIcon category={vendor.category} size={64} /></div>}
          </div>

          {rest.length > 0 && (
            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              {rest.map(p => (
                <button key={p.id} onClick={() => setLightbox(p.url)} style={{ width: 96, height: 72, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--bp-rule)', cursor: 'zoom-in', padding: 0, background: 'none' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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
              {resolvedCity && <span className="bp-badge bp-badge-neutral" style={{ gap: 4 }}><MapPin size={11} /> {resolvedCity}</span>}
              {vendor.price_range && <span className="bp-badge bp-badge-neutral">Preisklasse {vendor.price_range}</span>}
            </div>
          </div>

          {vendor.description && (
            <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--bp-ink-2)', margin: '18px 0 0' }}>{vendor.description}</p>
          )}

          {/* Videos + Hörprobe (Migration 0133) */}
          {(hasVideos || vendor.audio_url) && (
            <div style={{ marginTop: 26 }}>
              <h3 className="bp-font-heading" style={{ fontSize: '1.2rem', margin: '0 0 12px' }}>
                {hasVideos && vendor.audio_url ? 'Videos & Hörprobe' : hasVideos ? 'Videos' : 'Hörprobe'}
              </h3>
              {hasVideos && <VideoCarousel urls={vendor.video_urls} />}
              {vendor.audio_url && (
                <div style={{ marginTop: hasVideos ? 14 : 0 }}>
                  <AudioSamplePlayer url={vendor.audio_url} title={vendor.audio_title} vendorName={vendor.company_name} />
                </div>
              )}
            </div>
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

          <CoupleDataRequests eventId={eventId} />

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

      {/* Melden-Link */}
      <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--bp-rule)', textAlign: 'right' }}>
        <button
          onClick={() => setShowReport(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--bp-ink-3)', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', padding: 0 }}
        >
          <Flag size={13} /> Anbieter melden
        </button>
      </div>

      <style>{`@media (max-width: 880px){ .mp-detail-grid{ grid-template-columns:1fr !important; } .mp-detail-aside{ position:static !important; } }`}</style>

      {/* Report-Modal */}
      {showReport && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowReport(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            {reportDone ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ width: 48, height: 48, borderRadius: 999, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <Check size={24} style={{ color: '#15803D' }} />
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px', color: 'var(--bp-ink)' }}>Meldung eingegangen</p>
                <p style={{ fontSize: 13.5, color: 'var(--bp-ink-2)', margin: '0 0 18px', lineHeight: 1.6 }}>
                  Wir prüfen deine Meldung und handeln, wenn nötig. Danke für dein Feedback.
                </p>
                <button onClick={() => setShowReport(false)} className="bp-btn">Schließen</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--bp-ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Flag size={16} style={{ color: '#DC2626' }} /> Anbieter melden
                  </h3>
                  <button onClick={() => setShowReport(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bp-ink-3)', padding: 4 }}>
                    <X size={18} />
                  </button>
                </div>

                <p style={{ fontSize: 13.5, color: 'var(--bp-ink-2)', margin: '0 0 16px', lineHeight: 1.6 }}>
                  Bitte wähle den Grund für deine Meldung:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {REPORT_REASONS.map(r => (
                    <label key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '9px 12px', borderRadius: 8, border: `1px solid ${reportReason === r.key ? '#DC2626' : 'var(--bp-rule)'}`, background: reportReason === r.key ? 'rgba(220,38,38,0.04)' : '#fff' }}>
                      <input type="radio" name="reportReason" value={r.key} checked={reportReason === r.key} onChange={() => setReportReason(r.key)} style={{ accentColor: '#DC2626' }} />
                      <span style={{ fontSize: 13.5, fontWeight: reportReason === r.key ? 600 : 450, color: 'var(--bp-ink)' }}>{r.label}</span>
                    </label>
                  ))}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--bp-ink-2)', display: 'block', marginBottom: 6 }}>
                    Kommentar (optional)
                  </label>
                  <textarea
                    value={reportComment}
                    onChange={e => setReportComment(e.target.value)}
                    placeholder="Beschreibe das Problem kurz…"
                    className="bp-textarea"
                    style={{ minHeight: 72 }}
                  />
                </div>

                {reportErr && <p style={{ fontSize: 13, color: '#DC2626', margin: '0 0 12px' }}>{reportErr}</p>}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={submitReport}
                    disabled={reportBusy}
                    style={{ flex: 1, padding: '10px 16px', borderRadius: 9, border: 'none', background: '#DC2626', color: '#fff', fontSize: 14, fontWeight: 600, cursor: reportBusy ? 'wait' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                  >
                    <Flag size={15} /> {reportBusy ? 'Wird gesendet…' : 'Meldung absenden'}
                  </button>
                  <button onClick={() => setShowReport(false)} className="bp-btn" style={{ whiteSpace: 'nowrap' }}>Abbrechen</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}
