// app/api/init-db/route.ts — Server-only
// Erstellt alle Supabase-Tabellen automatisch, falls sie noch nicht existieren.
// Wird beim ersten authentifizierten App-Start aufgerufen.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runMigrations } from '@/lib/db/migrate'

// Caching: verhindert mehrfache Ausführung pro Server-Instanz
let migrationRan = false

export async function POST() {
  // Auth: nur eingeloggte Nutzer dürfen die Migration auslösen. Der Aufruf
  // erfolgt ohnehin nur im angemeldeten App-Kontext (lib/event-context.tsx);
  // ohne diesen Check wäre der DDL-Endpoint anonym erreichbar.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // DATABASE_URL nicht gesetzt → überspringen (App läuft im localStorage-Modus)
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ status: 'skipped', reason: 'DATABASE_URL not set' })
  }

  // Bereits ausgeführt in dieser Server-Instanz
  if (migrationRan) {
    return NextResponse.json({ status: 'already_ran' })
  }

  try {
    await runMigrations()
    migrationRan = true
    return NextResponse.json({ status: 'ok' })
  } catch (err) {
    console.error('[init-db] Migration fehlgeschlagen:', err)
    // Nicht fatal — App kann trotzdem starten
    return NextResponse.json(
      { status: 'error', message: String(err) },
      { status: 500 }
    )
  }
}
