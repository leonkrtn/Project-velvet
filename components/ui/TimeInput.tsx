'use client'
import React from 'react'

interface TimeInputProps {
  value: string
  onChange: (val: string) => void
  style?: React.CSSProperties
  className?: string
  placeholder?: string
  onFocus?: React.FocusEventHandler<HTMLInputElement>
  onBlur?: React.FocusEventHandler<HTMLInputElement>
}

export default function TimeInput({ value, onChange, style, className, placeholder = 'HH:MM', onFocus, onBlur }: TimeInputProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/[^0-9]/g, '')
    if (digits.length > 4) return
    let formatted = digits
    if (digits.length >= 3) formatted = digits.slice(0, 2) + ':' + digits.slice(2)
    onChange(formatted)
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (value) {
      const digits = value.replace(/[^0-9]/g, '')
      if (digits.length >= 2) {
        const h = parseInt(digits.slice(0, 2))
        const m = digits.length >= 4 ? parseInt(digits.slice(2, 4)) : 0
        if (h <= 23 && m <= 59) {
          onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
        } else {
          onChange('')
        }
      } else {
        onChange('')
      }
    }
    onBlur?.(e)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={onFocus}
      placeholder={placeholder}
      maxLength={5}
      style={style}
      className={className}
    />
  )
}
