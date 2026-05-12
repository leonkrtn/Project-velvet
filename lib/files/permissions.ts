import type { SupabaseClient } from '@supabase/supabase-js'
import type { FileModule } from './types'

export type EventRole = 'veranstalter' | 'brautpaar' | 'trauzeuge' | 'dienstleister'

export async function getEventRole(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
): Promise<EventRole | null> {
  const { data } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.role as EventRole) ?? null
}

async function getDlAccess(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
  tabKey: string,
): Promise<'none' | 'read' | 'write'> {
  const { data } = await supabase
    .from('dienstleister_permissions')
    .select('access')
    .eq('event_id', eventId)
    .eq('dienstleister_user_id', userId)
    .eq('tab_key', tabKey)
    .is('item_id', null)
    .maybeSingle()
  return (data?.access as 'none' | 'read' | 'write') ?? 'none'
}

export async function canReadFiles(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
  module: FileModule,
): Promise<boolean> {
  const role = await getEventRole(supabase, userId, eventId)
  if (!role) return false
  if (role === 'veranstalter' || role === 'brautpaar' || role === 'trauzeuge') return true
  if (role === 'dienstleister') {
    const access = await getDlAccess(supabase, userId, eventId, module)
    return access === 'read' || access === 'write'
  }
  return false
}

export async function canUploadFiles(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
  module: FileModule,
): Promise<boolean> {
  const role = await getEventRole(supabase, userId, eventId)
  if (!role) return false
  // Veranstalter + Brautpaar: full upload rights
  if (role === 'veranstalter' || role === 'brautpaar') return true
  // Trauzeuge: read-only
  if (role === 'trauzeuge') return false
  // Dienstleister: write permission on the target module required
  if (role === 'dienstleister') {
    const access = await getDlAccess(supabase, userId, eventId, module)
    return access === 'write'
  }
  return false
}

export async function canDeleteFile(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
  uploadedBy: string | null,
): Promise<boolean> {
  const role = await getEventRole(supabase, userId, eventId)
  if (!role) return false
  // Veranstalter can delete any file
  if (role === 'veranstalter') return true
  // Others can only delete their own uploads
  return uploadedBy === userId
}

/**
 * Returns which modules a dienstleister has at least read access to,
 * so the UI can filter the files list accordingly.
 */
export async function getDlAccessibleModules(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
): Promise<FileModule[]> {
  const { data } = await supabase
    .from('dienstleister_permissions')
    .select('tab_key, access')
    .eq('event_id', eventId)
    .eq('dienstleister_user_id', userId)
    .is('item_id', null)
    .in('access', ['read', 'write'])
  return ((data ?? []).map(r => r.tab_key) as FileModule[])
}
