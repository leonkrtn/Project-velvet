import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// In-memory rate limiting: ip → { count, windowStart, blockedUntil }
const failMap = new Map<string, { count: number; windowStart: number; blockedUntil: number }>()
const MAX_FAILURES = 5
const WINDOW_MS = 10 * 60 * 1000   // 10 min
const BLOCK_MS  = 30 * 60 * 1000   // 30 min

function getIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}

function checkRateLimit(ip: string): { blocked: boolean } {
  const now = Date.now()
  const entry = failMap.get(ip)
  if (!entry) return { blocked: false }
  if (entry.blockedUntil > now) return { blocked: true }
  if (now - entry.windowStart > WINDOW_MS) {
    failMap.delete(ip)
    return { blocked: false }
  }
  return { blocked: false }
}

function recordFailure(ip: string): void {
  const now = Date.now()
  const entry = failMap.get(ip)
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    failMap.set(ip, { count: 1, windowStart: now, blockedUntil: 0 })
    return
  }
  entry.count += 1
  if (entry.count >= MAX_FAILURES) {
    entry.blockedUntil = now + BLOCK_MS
    console.warn(`[admin/create-organizer] IP ${ip} blocked after ${MAX_FAILURES} failures at ${new Date().toISOString()}`)
  }
}

function clearFailures(ip: string): void {
  failMap.delete(ip)
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  // dummy compare if lengths differ to normalize timing, then return false
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab)
    return false
  }
  return timingSafeEqual(ab, bb)
}

// Simple HMAC-SHA256 token using ADMIN_SECRET as key
async function signToken(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  const b64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(sig))))
  return `${payload}.${b64}`
}

async function verifyToken(token: string, secret: string): Promise<{ valid: boolean; expired: boolean }> {
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx === -1) return { valid: false, expired: false }
    const payload = token.slice(0, dotIdx)
    const expected = await signToken(payload, secret)
    if (expected !== token) return { valid: false, expired: false }
    const data = JSON.parse(atob(payload))
    if (data.exp < Date.now()) return { valid: false, expired: true }
    return { valid: true, expired: false }
  } catch {
    return { valid: false, expired: false }
  }
}

export async function POST(request: Request) {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const ip = getIp(request)
  if (checkRateLimit(ip).blocked) {
    return NextResponse.json({ error: 'Zu viele Versuche. Bitte warte 30 Minuten.' }, { status: 429 })
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const phase = body.phase as string

  // ── Phase 1: Verify admin code ──────────────────────────────────────────────
  if (phase === 'verify') {
    const code = body.code as string | undefined
    if (!code || !safeEqual(code, adminSecret)) {
      recordFailure(ip)
      console.warn(`[admin/create-organizer] Failed verify attempt from ${ip} at ${new Date().toISOString()}`)
      return NextResponse.json({ error: 'Ungültiger Code' }, { status: 401 })
    }

    clearFailures(ip)
    const payload = btoa(JSON.stringify({ iat: Date.now(), exp: Date.now() + 15 * 60 * 1000 }))
    const token = await signToken(payload, adminSecret)
    return NextResponse.json({ token })
  }

  // ── Phase 2: Create organizer ───────────────────────────────────────────────
  if (phase === 'create') {
    const token = body.token as string | undefined
    if (!token) {
      return NextResponse.json({ error: 'Token fehlt' }, { status: 401 })
    }

    const { valid, expired } = await verifyToken(token, adminSecret)
    if (!valid) {
      return NextResponse.json({ error: expired ? 'Token abgelaufen' : 'Ungültiges Token' }, { status: 401 })
    }

    const name        = body.name as string | undefined
    const email       = body.email as string | undefined
    const password    = body.password as string | undefined
    const companyName = body.companyName as string | undefined

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, E-Mail und Passwort erforderlich' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        ...(companyName ? { company_name: companyName } : {}),
      },
    })

    if (createErr || !newUser.user) {
      return NextResponse.json({ error: createErr?.message ?? 'User konnte nicht erstellt werden' }, { status: 500 })
    }

    const { error: approveErr } = await admin.rpc('approve_organizer', {
      p_user_id: newUser.user.id,
    })

    if (approveErr) {
      return NextResponse.json({ error: approveErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, userId: newUser.user.id })
  }

  return NextResponse.json({ error: 'Unbekannte Phase' }, { status: 400 })
}
