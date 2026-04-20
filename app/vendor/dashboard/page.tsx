import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { CalendarDays } from 'lucide-react'

export default async function VendorOverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/vendor/dashboard')

  const { data: memberships } = await supabase
    .from('event_members')
    .select('event_id, events(id, title, date, venue)')
    .eq('user_id', user.id)
    .eq('role', 'dienstleister')
    .order('created_at', { ascending: false })

  type EventRow = { id: string; title: string; date: string | null; venue: string | null }
  const events = (memberships ?? [])
    .map(m => (Array.isArray(m.events) ? m.events[0] : m.events) as EventRow | null)
    .filter((e): e is EventRow => !!e)

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '40px 24px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        <div style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: 'var(--gold)', letterSpacing: '-1px', lineHeight: 1, marginBottom: 8 }}>Velvet.</p>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 4 }}>Meine Events</h1>
          <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Alle Events, bei denen du als Dienstleister eingetragen bist.</p>
        </div>

        {events.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '40px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 15, color: 'var(--text-dim)', marginBottom: 8 }}>Noch keine Events</p>
            <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Sobald dich ein Veranstalter zu einem Event einlädt, erscheint es hier.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {events.map(event => (
              <Link
                key={event.id}
                href={`/vendor/dashboard/${event.id}`}
                style={{ display: 'block', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '20px 24px', textDecoration: 'none', color: 'inherit', transition: 'box-shadow 0.15s' }}
              >
                <p style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 6 }}>{event.title}</p>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {event.date && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-dim)' }}>
                      <CalendarDays size={13} />
                      {new Date(event.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  )}
                  {event.venue && (
                    <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{event.venue}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <form action="/auth/signout" method="post">
            <button type="submit" style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--text-dim)', cursor: 'pointer', textDecoration: 'underline' }}>
              Abmelden
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
