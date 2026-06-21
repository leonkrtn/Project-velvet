import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

interface Env {
  BUCKET: R2Bucket
  INTERNAL_SECRET: string
  R2_ACCOUNT_ID: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  R2_BUCKET_NAME: string
}

interface PresignUploadBody {
  key: string
  contentType: string
}

interface PresignDownloadBody {
  key: string
  filename?: string
}

interface DeleteBody {
  key: string
}

function makeS3(env: Env): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
}

function isAuthorized(request: Request, env: Env): boolean {
  const secret = request.headers.get('X-Internal-Secret')
  return typeof secret === 'string' && secret.length > 0 && secret === env.INTERNAL_SECRET
}

// Defense-in-depth: Auch mit gültigem Internal-Secret darf der aufrufende
// App-Server nur Keys innerhalb der bekannten Namespaces signieren/löschen.
// Verhindert, dass ein kompromittierter Aufrufer beliebige R2-Objekte adressiert
// oder per Path-Traversal aus dem Namespace ausbricht.
const ALLOWED_KEY_PREFIXES = ['events/', 'profiles/', 'marketplace/']
function isValidKey(key: unknown): key is string {
  if (typeof key !== 'string' || key.length === 0 || key.length > 1024) return false
  if (key.includes('..') || key.startsWith('/') || key.includes('\0')) return false
  return ALLOWED_KEY_PREFIXES.some(p => key.startsWith(p))
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function err(message: string, status = 400): Response {
  return json({ error: message }, status)
}

// CORS headers for local dev (wrangler dev)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Internal-Secret',
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (!isAuthorized(request, env)) {
      return err('Unauthorized', 401)
    }

    const path = url.pathname

    // ─── POST /presign/upload ───────────────────────────────────────────
    // Returns a presigned PUT URL valid for 15 minutes.
    // Client uploads directly to R2 — Worker is not in the upload path.
    if (path === '/presign/upload' && request.method === 'POST') {
      let body: PresignUploadBody
      try {
        body = await request.json<PresignUploadBody>()
      } catch {
        return err('Invalid JSON body')
      }

      const { key, contentType } = body
      if (!key || !contentType) return err('key and contentType are required')
      if (!isValidKey(key)) return err('Invalid key', 403)

      const s3 = makeS3(env)
      const command = new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
      })

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 })
      return json({ uploadUrl, key, expiresIn: 900 })
    }

    // ─── POST /presign/download ─────────────────────────────────────────
    // Returns a presigned GET URL valid for 1 hour.
    // Generate fresh on every download click — user always gets a working link.
    if (path === '/presign/download' && request.method === 'POST') {
      let body: PresignDownloadBody
      try {
        body = await request.json<PresignDownloadBody>()
      } catch {
        return err('Invalid JSON body')
      }

      const { key, filename } = body
      if (!key) return err('key is required')
      if (!isValidKey(key)) return err('Invalid key', 403)

      const s3 = makeS3(env)
      const command = new GetObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        ...(filename && {
          ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        }),
      })

      const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 })
      return json({ downloadUrl, expiresIn: 3600 })
    }

    // ─── DELETE /object ─────────────────────────────────────────────────
    // Hard-deletes the R2 object. Called after soft-delete in DB.
    // Uses R2 binding (no S3 credentials needed for delete).
    if (path === '/object' && request.method === 'DELETE') {
      let body: DeleteBody
      try {
        body = await request.json<DeleteBody>()
      } catch {
        return err('Invalid JSON body')
      }

      const { key } = body
      if (!key) return err('key is required')
      if (!isValidKey(key)) return err('Invalid key', 403)

      await env.BUCKET.delete(key)
      return json({ deleted: true })
    }

    return err('Not found', 404)
  },
}
