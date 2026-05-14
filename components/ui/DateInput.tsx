'use client'
import React, { useState, useEffect } from 'react'

interface DateInputProps {
  value: string | null  // YYYY-MM-DD
  onChange: (val: string | null) => void
  style?: React.CSSProperties
  className?: string
  placeholder?: string
}

function isoToDisplay(iso: string | null): string {
  if (!iso) return ''
  const parts = iso.split('-')
  if (parts.length !== 3) return ''
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

function displayToIso(display: string): string | null {
  const digits = display.replace(/[^0-9]/g, '')
  if (digits.length !== 8) return null
  const day = parseInt(digits.slice(0, 2))
  const month = parseInt(digits.slice(2, 4))
  const year = parseInt(digits.slice(4, 8))
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function DateInput({ value, onChange, style, className, placeholder = 'TT.MM.JJJJ' }: DateInputProps) {
  const [display, setDisplay] = useState(() => isoToDisplay(value))

  useEffect(() => {
    setDisplay(isoToDisplay(value))
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/[^0-9]/g, '')
    if (digits.length > 8) return
    let formatted = digits
    if (digits.length > 4) formatted = digits.slice(0, 2) + '.' + digits.slice(2, 4) + '.' + digits.slice(4)
    else if (digits.length > 2) formatted = digits.slice(0, 2) + '.' + digits.slice(2)
    setDisplay(formatted)
  }

  function handleBlur() {
    if (!display) {
      onChange(null)
      return
    }
    const iso = displayToIso(display)
    if (iso) {
      setDisplay(isoToDisplay(iso))
      onChange(iso)
    } else {
      setDisplay(isoToDisplay(value))
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      maxLength={10}
      style={style}
      className={className}
    />
  )
}
