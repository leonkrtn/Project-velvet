/** Server-side only. Calls the Cloudflare Worker to generate R2 presigned URLs. */

function workerUrl(): string {
  const url = process.env.FILE_WORKER_URL
  if (!url) throw new Error('FILE_WORKER_URL is not configured')
  return url.replace(/\/$/, '')
}

function internalSecret(): string {
  const secret = process.env.FILE_WORKER_INTERNAL_SECRET
  if (!secret) throw new Error('FILE_WORKER_INTERNAL_SECRET is not configured')
  return secret
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${workerUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': internalSecret(),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Worker ${path} failed (${res.status}): ${text}`)
  }
  return res.json() as Promise<T>
}

async function del(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${workerUrl()}${path}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': internalSecret(),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Worker DELETE ${path} failed (${res.status}): ${text}`)
  }
}

export async function requestUploadUrl(key: string, contentType: string): Promise<string> {
  const data = await post<{ uploadUrl: string }>('/presign/upload', { key, contentType })
  return data.uploadUrl
}

export async function requestDownloadUrl(key: string, filename?: string): Promise<string> {
  const data = await post<{ downloadUrl: string }>('/presign/download', { key, filename })
  return data.downloadUrl
}

export async function deleteR2Object(key: string): Promise<void> {
  await del('/object', { key })
}
