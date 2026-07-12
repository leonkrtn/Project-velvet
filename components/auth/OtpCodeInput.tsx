'use client'

import React, { useRef } from 'react'
import { OTP_CODE_LENGTH } from '@/lib/auth-otp'

type Props = {
  value: string
  onChange: (code: string) => void
  onComplete?: (code: string) => void
  length?: number
  disabled?: boolean
  autoFocus?: boolean
}

/**
 * Segmentierte Code-Eingabe (ein Kästchen pro Ziffer) für den
 * E-Mail-Verifizierungscode. Unterstützt Einfügen (Paste), Auto-Advance,
 * Backspace über Kästchengrenzen und Pfeiltasten.
 */
export default function OtpCodeInput({
  value,
  onChange,
  onComplete,
  length = OTP_CODE_LENGTH,
  disabled = false,
  autoFocus = true,
}: Props) {
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  const focus = (i: number) => {
    const el = inputs.current[Math.max(0, Math.min(length - 1, i))]
    el?.focus()
    el?.select()
  }

  const emit = (next: string) => {
    onChange(next)
    if (next.length === length && !next.includes(' ')) onComplete?.(next)
  }

  const setDigit = (i: number, digit: string) => {
    const arr = digits.slice()
    arr[i] = digit
    emit(arr.join('').replace(/\s+$/g, ''))
  }

  const handleChange = (i: number, raw: string) => {
    const only = raw.replace(/\D/g, '')
    if (!only) { setDigit(i, ''); return }
    if (only.length === 1) {
      setDigit(i, only)
      if (i < length - 1) focus(i + 1)
      return
    }
    // Mehrere Ziffern (Autofill/schnelle Eingabe) ab dieser Position verteilen
    const arr = digits.slice()
    let pos = i
    for (const ch of only) {
      if (pos >= length) break
      arr[pos] = ch
      pos++
    }
    emit(arr.join(''))
    focus(pos)
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[i]) {
        setDigit(i, '')
      } else if (i > 0) {
        setDigit(i - 1, '')
        focus(i - 1)
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault(); focus(i - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault(); focus(i + 1)
    }
  }

  const handlePaste = (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    const arr = digits.slice()
    let pos = i
    for (const ch of pasted) {
      if (pos >= length) break
      arr[pos] = ch
      pos++
    }
    emit(arr.join(''))
    focus(pos)
  }

  return (
    <div className="bp-otp" role="group" aria-label="Bestätigungscode">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { inputs.current[i] = el }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          className="bp-otp-box"
          value={d}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-label={`Ziffer ${i + 1}`}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={e => handlePaste(i, e)}
          onFocus={e => e.target.select()}
        />
      ))}
    </div>
  )
}
