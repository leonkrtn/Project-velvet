import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSubscriptionState } from '@/lib/subscription'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import ChatsClient from '@/app/veranstalter/[eventId]/chats/ChatsClient'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function NachrichtenPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [conversationsRes, membersRes, ownMemberRes] = await Promise.all([
    supabase
      .from('conversations')
      .select(`
        id, name, created_by, created_at, updated_at, is_staff_chat,
        conversation_participants(user_id, profiles(id, name))
      `)
      .eq('event_id', eventId)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false }),
    admin
      .from('event_members')
      .select('id, user_id, role, profiles!user_id(id, name, email)')
      .eq('event_id', eventId),
    supabase
      .from('event_members')
      .select('role')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  // Chat mit Veranstalter/Dienstleistern ist für Solo-Paare ein Pro-Feature.
  // Ohne Pro: bestehende Chats bleiben nutzbar (Bestandsschutz) und der
  // Partner-Chat (brautpaar_solo untereinander) bleibt frei — neue Chats mit
  // anderen Rollen sind nicht möglich (Mitgliederliste wird gefiltert).
  let proLocked = false
  if (ownMemberRes.data?.role === 'brautpaar_solo') {
    const sub = await getSubscriptionState(eventId)
    proLocked = sub.gated && !sub.isPro
  }

  const membersRaw = (membersRes.data ?? [])
    .filter(m => !proLocked || m.role === 'brautpaar_solo')
    .map(m => ({
      ...m,
      profiles: Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : m.profiles,
      category: null,
    }))

  const conversations = (conversationsRes.data ?? []).map(conv => ({
    ...conv,
    conversation_participants: (conv.conversation_participants ?? []).map((p: { user_id: string; profiles: { id: string; name: string }[] | { id: string; name: string } | null }) => ({
      ...p,
      profiles: Array.isArray(p.profiles) ? (p.profiles[0] ?? null) : p.profiles,
    })),
  }))

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {proLocked && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap',
          padding: '0.6rem 1rem', background: 'var(--bp-gold-pale, #F5F0E8)',
          borderBottom: '1px solid var(--bp-gold-mist, #EDE8DC)',
          fontSize: '0.8rem', color: 'var(--bp-ink-2, #5C534A)', flexShrink: 0,
        }}>
          <Sparkles size={14} style={{ color: 'var(--bp-gold-deep, #9C7F4F)', flexShrink: 0 }} />
          <span>
            Chats mit Veranstalter &amp; Dienstleistern sind Teil von <strong>Forevr Pro</strong> —
            der Chat mit eurem Partner ist immer frei.
          </span>
          <Link
            href={`/brautpaar/${eventId}/abo`}
            style={{
              color: 'var(--bp-gold-deep, #9C7F4F)', fontWeight: 700, textDecoration: 'none',
              border: '1px solid var(--bp-gold, #B89968)', borderRadius: 999, padding: '0.18rem 0.8rem',
              fontSize: '0.74rem', whiteSpace: 'nowrap',
            }}
          >
            Upgrade
          </Link>
        </div>
      )}
      <ChatsClient
        eventId={eventId}
        currentUserId={user.id}
        initialConversations={conversations}
        members={membersRaw}
      />
    </div>
  )
}
