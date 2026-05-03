import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BerechtigungenDLClient from './BerechtigungenClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ eventId: string; dienstleisterId: string }>
}

export interface DienstleisterPermRow {
  id: string
  tab_key: string
  item_id: string | null
  access: 'none' | 'read' | 'write'
}

export interface MusicSong {
  id: string
  title: string
  artist: string
}

export interface DekorItem {
  id: string
  title: string
  source: 'decor_setup_items' | 'deko_wishes'
}

export interface MediaItem {
  id: string
  title: string
}

export default async function DienstleisterBerechtigungenPage({ params }: Props) {
  const { eventId, dienstleisterId } = await params
  const supabase = await createClient()

  // Verify current user is Veranstalter for this event
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!member || member.role !== 'veranstalter') redirect('/veranstalter')

  // Load Dienstleister profile
  const { data: dlProfile } = await supabase
    .from('profiles')
    .select('id, name, email')
    .eq('id', dienstleisterId)
    .maybeSingle()

  if (!dlProfile) redirect(`/veranstalter/${eventId}/mitglieder`)

  // Verify this person is actually a Dienstleister in this event
  const { data: dlMember } = await supabase
    .from('event_members')
    .select('id, role')
    .eq('event_id', eventId)
    .eq('user_id', dienstleisterId)
    .single()

  if (!dlMember || dlMember.role !== 'dienstleister') redirect(`/veranstalter/${eventId}/mitglieder`)

  // Load existing permissions
  const { data: perms } = await supabase
    .from('dienstleister_permissions')
    .select('id, tab_key, item_id, access')
    .eq('event_id', eventId)
    .eq('dienstleister_user_id', dienstleisterId)

  // Load items for tabs that have item-level permissions
  const [musikRes, setupItemsRes, dekoWishesRes, mediaRes] = await Promise.all([
    supabase
      .from('music_songs')
      .select('id, title, artist')
      .eq('event_id', eventId)
      .order('sort_order'),
    supabase
      .from('decor_setup_items')
      .select('id, title')
      .eq('event_id', eventId)
      .order('sort_order'),
    supabase
      .from('deko_wishes')
      .select('id, title')
      .eq('event_id', eventId)
      .order('created_at'),
    supabase
      .from('media_shot_items')
      .select('id, title')
      .eq('event_id', eventId)
      .order('sort_order'),
  ])

  const musikSongs: MusicSong[] = (musikRes.data ?? []).map(s => ({
    id: s.id,
    title: s.title,
    artist: s.artist,
  }))

  const dekorItems: DekorItem[] = [
    ...(setupItemsRes.data ?? []).map(i => ({ id: i.id, title: i.title, source: 'decor_setup_items' as const })),
    ...(dekoWishesRes.data ?? []).map(i => ({ id: i.id, title: i.title, source: 'deko_wishes' as const })),
  ]

  const mediaItems: MediaItem[] = (mediaRes.data ?? []).map(i => ({
    id: i.id,
    title: i.title,
  }))

  return (
    <BerechtigungenDLClient
      eventId={eventId}
      dienstleisterId={dienstleisterId}
      dienstleisterName={dlProfile.name ?? 'Dienstleister'}
      dienstleisterEmail={dlProfile.email ?? ''}
      initialPerms={(perms ?? []) as DienstleisterPermRow[]}
      musikSongs={musikSongs}
      dekorItems={dekorItems}
      mediaItems={mediaItems}
    />
  )
}
