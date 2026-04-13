// lib/db/migrate.ts — Server-only
import 'server-only'
// Führt das idempotente Schema gegen die Supabase-Datenbank aus.
// Benötigt DATABASE_URL (direkte Postgres-Verbindung, nicht die Supabase REST API).

import postgres from 'postgres'
import { SCHEMA_SQL } from './schema'

let _sql: ReturnType<typeof postgres> | null = null

function getConnection() {
  if (!_sql) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL nicht gesetzt. Bitte in .env.local eintragen.')
    _sql = postgres(url, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
    })
  }
  return _sql
}

export async function runMigrations(): Promise<void> {
  const sql = getConnection()
  await sql.unsafe(SCHEMA_SQL)
}
