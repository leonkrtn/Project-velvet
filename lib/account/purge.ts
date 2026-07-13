/* eslint-disable @typescript-eslint/no-explicit-any */

// Endgültige Löschung von Accounts, deren Lösch-Frist abgelaufen ist, ohne
// dass sich der Nutzer zwischenzeitlich erneut angemeldet hat (das hätte
// /api/account/restore ausgelöst und deleted_at/scheduled_purge_at wieder
// auf NULL gesetzt — solche Accounts tauchen hier gar nicht erst auf).
//
// Reihenfolge: erst die "eigenen Zugriff entfernen"-Schritte (Event-
// Mitgliedschaften), dann die kontoübergreifende Anonymisierung (CRM bei
// allen Dienstleistern per E-Mail-Abgleich), zuletzt der Auth-User selbst
// (löscht dank ON DELETE CASCADE auch die profiles-Zeile).
export async function purgeExpiredAccounts(admin: any): Promise<{ purged: number; errors: string[] }> {
  const errors: string[] = []
  const nowIso = new Date().toISOString()

  const { data: due, error: dueErr } = await admin
    .from('profiles')
    .select('id, email')
    .not('scheduled_purge_at', 'is', null)
    .lte('scheduled_purge_at', nowIso)

  if (dueErr) return { purged: 0, errors: [dueErr.message] }
  if (!due || due.length === 0) return { purged: 0, errors: [] }

  let purged = 0
  for (const profile of due as { id: string; email: string | null }[]) {
    try {
      // 1. Eigenen Zugriff entfernen: geteilte Events (Brautpaar/Veranstalter)
      //    sowie die Verknüpfung zu einem Dienstleister-Unternehmen (Vendor).
      //    Das Unternehmensprofil selbst (dienstleister_profiles) bleibt
      //    bestehen, falls weitere Teammitglieder daran hängen.
      await admin.from('event_members').delete().eq('user_id', profile.id)
      await admin.from('user_dienstleister').delete().eq('user_id', profile.id)

      // 2. Aus dem CRM bei ALLEN Dienstleistern entfernen (per E-Mail-Abgleich —
      //    crm_contacts hat keine direkte user_id-Verknüpfung, nur die vom
      //    jeweiligen Vendor erfasste E-Mail-Adresse). Cascade räumt
      //    crm_contact_persons/crm_activities/crm_tasks automatisch mit auf.
      if (profile.email) {
        await admin.from('crm_contacts').delete().eq('email', profile.email)
      }

      // 3. Auth-User (und damit per ON DELETE CASCADE die profiles-Zeile) löschen.
      const { error: authErr } = await admin.auth.admin.deleteUser(profile.id)
      if (authErr) { errors.push(`${profile.id}: ${authErr.message}`); continue }

      purged++
    } catch (e) {
      errors.push(`${profile.id}: ${e instanceof Error ? e.message : 'unbekannter Fehler'}`)
    }
  }

  return { purged, errors }
}
