import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { loadVendorEmailConfig } from '@/lib/vendor/email-config'
import {
  DEFAULT_GREETING, DEFAULT_SIGNATURE, DEFAULT_TEMPLATES, EMAIL_TEMPLATE_KEYS,
  type EmailTemplateKey,
} from '@/lib/vendor/email-templates'

function str(v: unknown, max = 4000): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

// GET — eigene Vorlagen (mit Standards gefuellt) + zentrale Anrede/Signatur.
// Liefert zusaetzlich die Standard-Texte mit, damit der Editor „Zuruecksetzen" kann.
export async function GET() {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx

  const cfg = await loadVendorEmailConfig(admin, vendorId)
  return NextResponse.json({
    templates: cfg.templates,
    greeting: cfg.greeting,
    signature: cfg.signature,
    brand: cfg.brand,
    defaults: { templates: DEFAULT_TEMPLATES, greeting: DEFAULT_GREETING, signature: DEFAULT_SIGNATURE },
  })
}

// PUT — Vorlagen + Anrede/Signatur speichern.
// Body: { templates: { [key]: {subject,heading,body,cta_label} }, greeting, signature }
export async function PUT(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx

  const body = await req.json().catch(() => ({})) as {
    templates?: Record<string, unknown>; greeting?: unknown; signature?: unknown
  }

  // Zentrale Anrede/Signatur am Profil (leer = auf Standard zuruecksetzen -> NULL).
  const greeting = str(body.greeting, 600).trim()
  const signature = str(body.signature, 1200).trim()
  const { error: pErr } = await admin.from('dienstleister_profiles')
    .update({ email_greeting: greeting || null, email_signature: signature || null })
    .eq('id', vendorId)
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  // Vorlagen upserten (nur die drei bekannten Keys).
  const tpl = (body.templates ?? {}) as Record<string, any>
  const rows = EMAIL_TEMPLATE_KEYS
    .filter(k => tpl[k] && typeof tpl[k] === 'object')
    .map((k: EmailTemplateKey) => ({
      dienstleister_id: vendorId,
      template_key: k,
      subject: str(tpl[k].subject, 300).trim(),
      heading: str(tpl[k].heading, 300).trim(),
      body: str(tpl[k].body, 4000),
      cta_label: str(tpl[k].cta_label, 80).trim(),
      enabled: true,
      updated_at: new Date().toISOString(),
    }))

  if (rows.length) {
    const { error } = await admin.from('vendor_email_templates')
      .upsert(rows, { onConflict: 'dienstleister_id,template_key' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

// DELETE — eine einzelne Vorlage auf Standard zuruecksetzen. Body: { key }
export async function DELETE(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx
  const { key } = await req.json().catch(() => ({})) as { key?: string }
  if (!key || !EMAIL_TEMPLATE_KEYS.includes(key as EmailTemplateKey)) {
    return NextResponse.json({ error: 'Ungültiger Vorlagen-Typ' }, { status: 400 })
  }
  const { error } = await admin.from('vendor_email_templates')
    .delete().eq('dienstleister_id', vendorId).eq('template_key', key)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, default: DEFAULT_TEMPLATES[key as EmailTemplateKey] })
}
