'use client'
import { useState, useCallback } from 'react'
import type { FileModule } from '@/lib/files/types'

export interface UploadState {
  uploading: boolean
  progress: number   // 0–100
  error: string | null
}

export interface UploadedFile {
  fileId: string
  filename: string
}

export function useFileUpload() {
  const [state, setState] = useState<UploadState>({
    uploading: false,
    progress: 0,
    error: null,
  })

  const upload = useCallback(async (
    file: File,
    eventId: string,
    module: FileModule,
    category = 'sonstiges',
    visibleToRoles?: string[] | null,
  ): Promise<UploadedFile | null> => {
    setState({ uploading: true, progress: 0, error: null })

    try {
      // 1. Request presigned upload URL from Next.js API
      const reqRes = await fetch('/api/files/request-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          module,
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          category,
          visible_to_roles: visibleToRoles !== undefined ? visibleToRoles : null,
        }),
      })

      if (!reqRes.ok) {
        const { error } = await reqRes.json().catch(() => ({ error: 'Unbekannter Fehler' }))
        throw new Error(error ?? `HTTP ${reqRes.status}`)
      }

      const { fileId, uploadUrl } = await reqRes.json() as { fileId: string; uploadUrl: string }

      // 2. Upload directly to R2 via presigned PUT URL — with XHR for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setState(s => ({ ...s, progress: Math.round((e.loaded / e.total) * 90) }))
          }
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`R2 Upload fehlgeschlagen (${xhr.status})`))
        }
        xhr.onerror = () => reject(new Error('Netzwerkfehler beim Upload'))
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
        xhr.send(file)
      })

      setState(s => ({ ...s, progress: 95 }))

      // 3. Confirm upload — marks DB record as active
      const confirmRes = await fetch(`/api/files/${fileId}/confirm`, { method: 'PATCH' })
      if (!confirmRes.ok) {
        const { error } = await confirmRes.json().catch(() => ({ error: 'Bestätigung fehlgeschlagen' }))
        throw new Error(error)
      }

      setState({ uploading: false, progress: 100, error: null })
      return { fileId, filename: file.name }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload fehlgeschlagen'
      setState({ uploading: false, progress: 0, error: message })
      return null
    }
  }, [])

  const reset = useCallback(() => {
    setState({ uploading: false, progress: 0, error: null })
  }, [])

  return { ...state, upload, reset }
}
