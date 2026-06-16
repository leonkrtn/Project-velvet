'use client'

import React from 'react'
import { CheckCircle, XCircle, Clock, Phone, CalendarClock } from 'lucide-react'
import {
  HEADING_FONTS, RSVP_TEXT_DEFAULTS, fontHrefFor, bodyFontHrefFor,
  buildRsvpThemeCss, invitationFont, alphaHex, focusPosition, focusSize,
  type DisplaySettings,
} from '@/lib/display-settings'
import { DeviceFrame, screenHeightFor } from './DeviceMock'

export interface PreviewRsvp {
  invitation_text: string
  rsvp_deadline: string | null
  phone_contact: string | null
  show_meal_choice: boolean
  show_plus_one: boolean
}

export interface PreviewImages {
  coverUrl: string | null
  bgPhotoUrl: string | null
  motiveUrl: string | null
}

const hidden = (s: DisplaySettings, key: string) => s.hiddenSections.includes(key)

// Geräte-gerahmte Live-Vorschau der RSVP-/Einladungsseite.
export default function DisplayPreview({
  s, rsvp, images, device, coupleName, dateLabel,
}: {
  s: DisplaySettings
  rsvp: PreviewRsvp
  images: PreviewImages
  device: 'desktop' | 'mobile'
  coupleName: string
  dateLabel: string
}) {
  const effFont = invitationFont(s)
  const headingFamily = HEADING_FONTS[effFont].family
  const headingHref = fontHrefFor(effFont)
  const bodyHref = bodyFontHrefFor(s.bodyFont)
  const themeCss = buildRsvpThemeCss(s)
  const intro = (rsvp.invitation_text?.trim() || 'Liebe/r {{Name}}, wir freuen uns sehr, mit dir zu feiern.')
    .replace(/\{\{\s*Name\s*\}\}/g, 'Anna')

  const heroImg = images.coverUrl || images.motiveUrl
  const heroIsCover = !!images.coverUrl
  const heroFocus = heroIsCover ? s.coverFocus : s.invitation.motiveFocus
  const textOnImage = !!heroImg

  const screenHeight = screenHeightFor(device)

  const screen = (
      <div className="rsvp-root" style={{ position: 'relative', height: screenHeight, overflowY: 'auto', background: s.bgColor }}>
        <style>{themeCss}</style>
        {headingHref && <link rel="stylesheet" href={headingHref} />}
        {bodyHref && <link rel="stylesheet" href={bodyHref} />}

        {/* Ganzseiten-Hintergrundfoto (fix hinter dem Inhalt) */}
        {images.bgPhotoUrl && (
          <>
            <div aria-hidden style={{
              position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
              backgroundImage: `url(${images.bgPhotoUrl})`,
              backgroundSize: focusSize(s.bgPhotoFocus), backgroundPosition: focusPosition(s.bgPhotoFocus),
              filter: s.bgPhotoBlur ? `blur(${s.bgPhotoBlur}px)` : undefined,
              transform: s.bgPhotoBlur ? 'scale(1.06)' : undefined,
            }} />
            <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', background: `${s.bgColor}${alphaHex(s.bgPhotoOverlay)}` }} />
          </>
        )}

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Hero */}
          <div style={{
            padding: device === 'mobile' ? '46px 20px 26px' : '34px 26px 26px', textAlign: 'center',
            minHeight: heroImg ? (device === 'mobile' ? 240 : 200) : undefined,
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            backgroundImage: heroImg
              ? (heroIsCover
                  ? `linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0) 34%, rgba(0,0,0,0.58) 100%), url(${heroImg})`
                  : `linear-gradient(${s.bgColor}cc, ${s.bgColor}f2), url(${heroImg})`)
              : 'linear-gradient(160deg, var(--gold-pale), transparent 72%)',
            backgroundSize: heroImg ? `cover, ${focusSize(heroFocus)}` : undefined,
            backgroundPosition: heroImg ? `center, ${focusPosition(heroFocus)}` : undefined,
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em',
              color: textOnImage && heroIsCover ? '#fff' : 'var(--gold)', margin: '0 0 10px',
              textShadow: textOnImage && heroIsCover ? '0 1px 6px rgba(0,0,0,0.5)' : undefined }}>
              {s.monogram || RSVP_TEXT_DEFAULTS.introEyebrow}
            </p>
            <h1 style={{ fontFamily: headingFamily, fontSize: device === 'mobile' ? 'clamp(26px,7vw,34px)' : '30px',
              fontWeight: 500, lineHeight: 1.12, margin: '0 0 8px',
              color: textOnImage && heroIsCover ? '#fff' : 'var(--text)',
              textShadow: textOnImage && heroIsCover ? '0 2px 14px rgba(0,0,0,0.45)' : undefined }}>
              {coupleName}
            </h1>
            {s.ornaments && (
              <div aria-hidden style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, margin: '12px 0', opacity: 0.8 }}>
                <span style={{ height: 1, width: 40, background: 'linear-gradient(to right, transparent, var(--gold))' }} />
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gold)' }} />
                <span style={{ height: 1, width: 40, background: 'linear-gradient(to left, transparent, var(--gold))' }} />
              </div>
            )}
            <p style={{ fontFamily: headingFamily, fontSize: 15, fontStyle: 'italic', maxWidth: 380, margin: '6px auto 0', lineHeight: 1.5,
              color: textOnImage && heroIsCover ? 'rgba(255,255,255,0.92)' : 'var(--text-light)',
              textShadow: textOnImage && heroIsCover ? '0 1px 8px rgba(0,0,0,0.45)' : undefined }}>
              {intro}
            </p>
            {s.countdown && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 18 }}>
                {[['120', 'Tage'], ['06', 'Std'], ['30', 'Min']].map(([v, l]) => (
                  <div key={l} style={{ minWidth: 52, padding: '8px 6px', borderRadius: 'var(--r-sm)', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: headingFamily, fontSize: 20, fontWeight: 600, color: 'var(--gold)', lineHeight: 1 }}>{v}</div>
                    <div style={{ fontSize: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginTop: 3 }}>{l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Body */}
          <div style={{ padding: device === 'mobile' ? '16px 18px 26px' : '18px 24px 28px', display: 'flex', flexDirection: 'column', gap: 'var(--rsvp-gap, 12px)' }}>
            {[
              { sel: true, icon: <CheckCircle size={18} color="var(--gold)" />, t: 'Ja, ich bin dabei!', sub: 'Ich freue mich auf diesen besonderen Tag.' },
              { sel: false, icon: <XCircle size={18} color="var(--text-dim)" />, t: 'Leider nicht', sub: 'Ich kann leider nicht teilnehmen.' },
            ].map((o, i) => (
              <div key={i} style={{
                padding: 'var(--ui-card-pad, 14px)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 12,
                border: `1.5px solid ${o.sel ? 'var(--gold)' : 'var(--border)'}`,
                background: o.sel ? 'var(--gold-pale)' : 'var(--surface)', boxShadow: 'var(--ui-card-shadow, none)',
              }}>
                {o.icon}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: o.sel ? 'var(--gold)' : 'var(--text)' }}>{o.t}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{o.sub}</div>
                </div>
              </div>
            ))}

            <div style={{ marginTop: 4, padding: 'var(--ui-card-pad, 16px)', borderRadius: 'var(--r-md)', background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--ui-card-shadow, none)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <DetailRow icon={<Clock size={13} color="var(--gold)" />} label="Datum" value={dateLabel} />
              {rsvp.rsvp_deadline && <DetailRow icon={<CalendarClock size={13} color="var(--gold)" />} label="Bitte antworten bis" value={formatDate(rsvp.rsvp_deadline)} />}
              {rsvp.phone_contact && <DetailRow icon={<Phone size={13} color="var(--gold)" />} label="Fragen?" value={rsvp.phone_contact} />}
              {!hidden(s, 'dresscode') && <DetailRow icon={<Dot />} label="Dresscode" value="Elegant" />}
              {!hidden(s, 'children') && <DetailRow icon={<Dot />} label="Kinder" value="Herzlich willkommen" />}
            </div>

            {rsvp.show_meal_choice && !hidden(s, 'allergies') && (
              <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '0 2px' }}>Menüwahl &amp; Allergien werden im Formular abgefragt.</div>
            )}
            {!hidden(s, 'message') && (
              <div style={{ padding: 'var(--ui-card-pad, 14px)', borderRadius: 'var(--r-md)', background: 'var(--surface)', border: '1px dashed var(--border)', fontSize: 12.5, color: 'var(--text-dim)' }}>
                Nachricht an das Brautpaar …
              </div>
            )}

            <button type="button" disabled style={{
              marginTop: 4, padding: '13px', borderRadius: 'var(--ui-btn-radius, 999px)', border: 'none', cursor: 'default',
              color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
              background: s.accentGradient ? 'linear-gradient(135deg, var(--gold), var(--gold-deep))' : 'var(--gold)',
            }}>
              Jetzt antworten
            </button>
          </div>
        </div>
      </div>
  )

  return <DeviceFrame device={device}>{screen}</DeviceFrame>
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ marginTop: 1 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)' }}>{label}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-mid)' }}>{value}</div>
      </div>
    </div>
  )
}

function Dot() {
  return <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'var(--gold)', marginTop: 4 }} />
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return iso }
}
