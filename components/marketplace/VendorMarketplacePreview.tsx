'use client'

// Read-only Nachbildung der Marktplatz-Detailseite, exakt so wie ein Brautpaar
// sie sieht. Wird in der Admin-Prüf-Lightbox verwendet (und ist bewusst frei von
// interaktiven Formularen). Importiert das Brautpaar-Theme für identische Optik.
import React, { useState } from 'react'
import { MapPin, Globe, Phone, Mail, Star, Lock, BadgeCheck, ChevronDown } from 'lucide-react'
import { categoryLabel, PRICE_UNITS, SOCIAL_PLATFORMS } from '@/lib/marketplace/types'
import CategoryIcon from '@/components/marketplace/CategoryIcon'
import { brandGoldVars } from '@/lib/vendor/brand'
import ExternalEmbed from '@/components/consent/ExternalEmbed'
import '@/app/brautpaar/brautpaar.css'

export interface PreviewVendor {
  company_name: string | null; name?: string | null; category: string
  description: string | null; street: string | null; zip: string | null; city: string | null
  price_range: string | null; verified: boolean
  social_links: Record<string, string>; service_cities: string[]; service_radius_km: number | null
  logo_url: string | null; photos: { id: string; url: string }[]
}
export interface PreviewPackage { id: string; title: string; description: string; price_from: number | null; price_unit: string }
export interface PreviewFaq { id: string; question: string; answer: string }
export interface PreviewReview { id: string; author_name: string; rating: number; title: string; body: string; created_at: string }

interface Props {
  vendor: PreviewVendor
  packages: PreviewPackage[]; faqs: PreviewFaq[]; reviews: PreviewReview[]
  reviewAvg: number; reviewCount: number; availability: string[]
  /** Steuert, ob Telefon/E-Mail sichtbar wären (im Marktplatz erst nach Annahme). */
  contactUnlocked?: boolean
  /** Markenfarbe (Hex) — färbt Akzente wie auf der echten Anbieterseite. */
  brandColor?: string | null
}

function priceUnitLabel(key: string) { return PRICE_UNITS.find(u => u.key === key)?.label ?? '' }
function Stars({ value, size = 15 }: { value: number; size?: number }) {
  return <span style={{ display: 'inline-flex', color: 'var(--bp-gold)' }}>
    {[1, 2, 3, 4, 5].map(i => <Star key={i} size={size} fill={i <= Math.round(value) ? 'currentColor' : 'none'} />)}
  </span>
}

export default function VendorMarketplacePreview({ vendor, packages, faqs, reviews, reviewAvg, reviewCount, availability, contactUnlocked = false, brandColor }: Props) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<string | null>(null)

  const displayName = vendor.company_name?.trim() || 'Anbieter'
  const addressParts = [vendor.street, [vendor.zip, vendor.city].filter(Boolean).join(' ')].filter(Boolean)
  const address = addressParts.join(', ')
  // Logo ist ein Badge neben dem Namen — NICHT das Titelbild. Hero = nur Galerie.
  const hero = vendor.photos[0]?.url ?? null
  const rest = vendor.photos.slice(1)
  const socials = SOCIAL_PLATFORMS.filter(s => vendor.social_links?.[s.key])

  return (
    <div className="bp-page mp-prev-root" style={{ padding: 0, background: '#fff', ...brandGoldVars(brandColor) }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 24, alignItems: 'start' }} className="mp-prev-grid">
        <div>
          <div style={{ aspectRatio: '16/9', borderRadius: 18, overflow: 'hidden', background: 'linear-gradient(135deg, var(--bp-gold-pale,#f3ecdd), var(--bp-ivory-2,#f2efe9))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: hero ? 'zoom-in' : 'default' }}
            onClick={() => hero && setLightbox(hero)}>
            {hero
              ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hero} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )
              : <div style={{ color: 'var(--bp-gold-deep,#8a6f3f)', opacity: 0.5 }}><CategoryIcon category={vendor.category} size={64} /></div>}
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

          <div style={{ marginTop: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--bp-gold-deep,#8a6f3f)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              <CategoryIcon category={vendor.category} size={14} /> {categoryLabel(vendor.category)}
            </div>
            <h1 className="bp-font-heading" style={{ fontSize: '2rem', fontWeight: 600, margin: '6px 0 8px', color: 'var(--bp-ink)', lineHeight: 1.15, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {vendor.logo_url && (
                <span style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--bp-rule)', background: '#fff', display: 'inline-flex' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={vendor.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </span>
              )}
              {displayName}
              {vendor.verified && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: '#15803D', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '3px 9px', borderRadius: 999 }}>
                  <BadgeCheck size={15} /> Verifiziert
                </span>
              )}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Stars value={reviewAvg} />
              <span style={{ fontSize: 12.5, color: 'var(--bp-ink-3,#999)' }}>
                {reviewCount > 0 ? `${reviewAvg.toFixed(1)} · ${reviewCount} Bewertung${reviewCount === 1 ? '' : 'en'}` : 'Noch keine Bewertungen'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {vendor.city && <span className="bp-badge bp-badge-neutral" style={{ gap: 4 }}><MapPin size={11} /> {vendor.city}</span>}
              {vendor.price_range && <span className="bp-badge bp-badge-neutral">Preisklasse {vendor.price_range}</span>}
            </div>
          </div>

          {vendor.description && <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--bp-ink-2,#666)', margin: '18px 0 0' }}>{vendor.description}</p>}

          {(vendor.service_cities.length > 0 || vendor.service_radius_km) && (
            <div style={{ marginTop: 22 }}>
              <h3 className="bp-font-heading" style={{ fontSize: '1.2rem', margin: '0 0 10px' }}>Einsatzgebiet</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {vendor.service_cities.map(c => <span key={c} className="bp-badge bp-badge-neutral" style={{ gap: 4 }}><MapPin size={11} /> {c}</span>)}
                {vendor.service_radius_km && <span className="bp-badge bp-badge-neutral">Umkreis {vendor.service_radius_km} km</span>}
              </div>
            </div>
          )}

          {packages.length > 0 && (
            <div style={{ marginTop: 26 }}>
              <h3 className="bp-font-heading" style={{ fontSize: '1.2rem', margin: '0 0 12px' }}>Pakete & Leistungen</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {packages.map(p => (
                  <div key={p.id} className="bp-card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                      <strong style={{ fontSize: 15, color: 'var(--bp-ink)' }}>{p.title}</strong>
                      {p.price_from != null && <span style={{ whiteSpace: 'nowrap', fontSize: 14, fontWeight: 700, color: 'var(--bp-gold-deep,#8a6f3f)' }}>{priceUnitLabel(p.price_unit)} {p.price_from.toLocaleString('de-DE')} €</span>}
                    </div>
                    {p.description && <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--bp-ink-2,#666)', lineHeight: 1.6 }}>{p.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

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
                    {openFaq === q.id && <p style={{ margin: 0, padding: '0 16px 14px', fontSize: 13.5, color: 'var(--bp-ink-2,#666)', lineHeight: 1.6 }}>{q.answer}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 26 }}>
            <h3 className="bp-font-heading" style={{ fontSize: '1.2rem', margin: '0 0 12px' }}>Bewertungen</h3>
            {reviews.length === 0 && <p style={{ fontSize: 13.5, color: 'var(--bp-ink-3,#999)', margin: 0 }}>Noch keine Bewertungen.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reviews.map(r => (
                <div key={r.id} className="bp-card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <strong style={{ fontSize: 14, color: 'var(--bp-ink)' }}>{r.author_name}</strong>
                    <Stars value={r.rating} size={13} />
                  </div>
                  {r.title && <p style={{ margin: '8px 0 2px', fontSize: 14, fontWeight: 600, color: 'var(--bp-ink)' }}>{r.title}</p>}
                  {r.body && <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--bp-ink-2,#666)', lineHeight: 1.6 }}>{r.body}</p>}
                </div>
              ))}
            </div>
          </div>

          {address && (
            <div style={{ marginTop: 26 }}>
              <h3 className="bp-font-heading" style={{ fontSize: '1.2rem', margin: '0 0 10px' }}>Standort</h3>
              <p style={{ fontSize: 13.5, color: 'var(--bp-ink-2,#666)', margin: '0 0 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}><MapPin size={14} /> {address}</p>
              <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--bp-rule)' }}>
                <ExternalEmbed provider="Google Maps" privacyUrl="https://policies.google.com/privacy" minHeight={220}>
                  <iframe title="Standort" src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`} style={{ width: '100%', height: 220, border: 0, display: 'block' }} loading="lazy" />
                </ExternalEmbed>
              </div>
            </div>
          )}
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }} className="mp-prev-aside">
          <div className="bp-card" style={{ padding: 18, opacity: 0.85 }}>
            <h3 className="bp-font-heading" style={{ fontSize: '1.2rem', margin: '0 0 4px' }}>Anfrage stellen</h3>
            <p style={{ fontSize: 12.5, color: 'var(--bp-ink-3,#999)', margin: '0 0 12px' }}>So sehen Brautpaare den Anfrage-Bereich.</p>
            <div style={{ background: 'var(--bp-ivory,#f8f8f6)', border: '1px dashed var(--bp-rule)', borderRadius: 10, padding: '20px 14px', textAlign: 'center', fontSize: 12.5, color: 'var(--bp-ink-3,#999)' }}>Anfrageformular (Vorschau)</div>
          </div>

          <div className="bp-card" style={{ padding: 18 }}>
            <h4 className="bp-font-heading" style={{ fontSize: '1.05rem', margin: '0 0 10px' }}>Kontakt</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5 }}>
              {socials.map(s => <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--bp-ink-2,#666)' }}><Globe size={14} /> {s.label}</span>)}
              {contactUnlocked ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--bp-ink-2,#666)' }}><Phone size={14} /> <Mail size={14} /> sichtbar</span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--bp-ink-3,#999)', fontSize: 12.5 }}><Lock size={13} /> Telefon & E-Mail erst nach Annahme</span>
              )}
            </div>
          </div>

          {availability.length > 0 && (
            <div className="bp-card" style={{ padding: 18 }}>
              <h4 className="bp-font-heading" style={{ fontSize: '1.05rem', margin: '0 0 8px' }}>Belegte Termine</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {availability.slice(0, 12).map(d => <span key={d} className="bp-badge bp-badge-neutral" style={{ fontSize: 11.5 }}>{new Date(d).toLocaleDateString('de-DE')}</span>)}
              </div>
            </div>
          )}
        </aside>
      </div>

      <style>{`
        /* Container-Query: reflowt anhand der VORSCHAU-Breite (nicht des Viewports),
           damit der schmale 'Mobil'-Rahmen echt einspaltig umbricht. */
        .mp-prev-root{ container-type: inline-size; }
        @container (max-width: 720px){ .mp-prev-grid{ grid-template-columns:1fr !important; } }
        /* Fallback, falls Container-Queries nicht unterstützt werden */
        @supports not (container-type: inline-size){
          @media (max-width: 720px){ .mp-prev-grid{ grid-template-columns:1fr !important; } }
        }
      `}</style>

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}
