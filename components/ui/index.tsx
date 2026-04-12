// components/ui/index.tsx — Velvet · Black/White/Gold
'use client'
import React from 'react'
import type { MealChoice, AllergyTag } from '@/lib/store'

// ── Shared input style ────────────────────────────────────────────────────
export const inputStyle: React.CSSProperties = {
  width:'100%', padding:'11px 14px',
  background:'#FFFFFF', border:'1px solid var(--border)',
  borderRadius:'var(--r-sm)', fontSize:14, color:'var(--text)',
  outline:'none', fontFamily:'inherit', transition:'border-color 0.15s',
}

// ── Label ─────────────────────────────────────────────────────────────────
export function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display:'block', fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', color:'var(--text-dim)', marginBottom:7 }}>
      {children}{required && <span style={{ color:'var(--gold)', marginLeft:2 }}>*</span>}
    </label>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────
type BadgeVariant = 'angelegt'|'eingeladen'|'zugesagt'|'abgesagt'|'gold'|'neutral'|'sand'|'sage'|'accent'

const bStyles: Record<BadgeVariant, React.CSSProperties> = {
  angelegt:  { background:'var(--bg)',           color:'var(--text-dim)' },
  eingeladen:{ background:'var(--gold-pale)',        color:'var(--gold)'  },
  zugesagt:  { background:'rgba(61,122,86,0.12)',   color:'var(--green)' },
  abgesagt:  { background:'rgba(160,64,64,0.1)',    color:'var(--red)'   },
  gold:      { background:'var(--gold-pale)',        color:'var(--gold)'  },
  neutral:   { background:'var(--bg)',           color:'var(--text-dim)' },
  sand:      { background:'var(--bg)',           color:'var(--text-dim)' },
  sage:      { background:'rgba(61,122,86,0.12)',   color:'var(--green)' },
  accent:    { background:'var(--gold-pale)',        color:'var(--gold)'  },
}
const bLabels: Record<string,string> = { angelegt:'Angelegt', eingeladen:'Eingeladen', zugesagt:'Zugesagt', abgesagt:'Abgesagt' }

export function Badge({ variant, label }: { variant: BadgeVariant; label?: string }) {
  return (
    <span style={{ ...bStyles[variant], fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:100, textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>
      {label ?? bLabels[variant] ?? variant}
    </span>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────
export function Avatar({ name, size=32 }: { name:string; size?:number }) {
  const init = name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:'var(--gold-pale)', color:'var(--gold)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:size*0.32, flexShrink:0 }}>
      {init}
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────
export function Card({ children, style, onClick, padding=18 }: {
  children:React.ReactNode; style?:React.CSSProperties; onClick?:()=>void; padding?:number
}) {
  return (
    <div onClick={onClick} style={{ background:'var(--surface)', borderRadius:'var(--r-md)', border:'1px solid var(--border)', padding, cursor:onClick?'pointer':undefined, ...style }}>
      {children}
    </div>
  )
}

// ── Section title ─────────────────────────────────────────────────────────
export function SectionTitle({ children }: { children:React.ReactNode }) {
  return (
    <p style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.14em', color:'var(--text-dim)', marginBottom:10 }}>
      {children}
    </p>
  )
}

// ── Gold rule ─────────────────────────────────────────────────────────────
export function GoldRule() {
  return <div style={{ height:1, background:'linear-gradient(to right,var(--gold),transparent)', opacity:0.4, margin:'16px 0' }}/>
}

// ── Progress bar ──────────────────────────────────────────────────────────
export function ProgressBar({ value, max, color='var(--gold)' }: { value:number; max:number; color?:string }) {
  const pct = max>0 ? Math.min(100,Math.round(value/max*100)) : 0
  return (
    <div style={{ height:4, background:'var(--bg)', borderRadius:2, overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${pct}%`, borderRadius:2, background:color, transition:'width 0.5s ease' }}/>
    </div>
  )
}

// ── Button ────────────────────────────────────────────────────────────────
type BtnV = 'primary'|'secondary'|'ghost'|'danger'|'gold'

export function Button({ children, variant='primary', onClick, disabled, fullWidth, size='md', type='button' }: {
  children:React.ReactNode; variant?:BtnV; onClick?:()=>void
  disabled?:boolean; fullWidth?:boolean; size?:'sm'|'md'|'lg'; type?:'button'|'submit'
}) {
  const vs: Record<BtnV,React.CSSProperties> = {
    primary:   { background:'var(--text)',     color:'#FFFFFF'           },
    secondary: { background:'var(--bg)',       color:'var(--text-mid)'   },
    ghost:     { background:'transparent',     color:'var(--text-dim)',  border:'1px solid var(--border)' },
    danger:    { background:'var(--red-pale)', color:'var(--red)'        },
    gold:      { background:'var(--gold)',     color:'#FFFFFF', fontWeight:700 },
  }
  const ss = { sm:{fontSize:11,padding:'7px 14px'}, md:{fontSize:13,padding:'11px 22px'}, lg:{fontSize:15,padding:'14px 28px'} }
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8, fontWeight:600, borderRadius:100, border:'none', fontFamily:'inherit', width:fullWidth?'100%':undefined, opacity:disabled?0.35:1, cursor:disabled?'not-allowed':'pointer', transition:'opacity 0.15s', ...vs[variant], ...ss[size] }}>
      {children}
    </button>
  )
}

// ── Input ─────────────────────────────────────────────────────────────────
export function Input({ label, value, onChange, placeholder, type='text', required }: {
  label?:string; value:string; onChange:(v:string)=>void
  placeholder?:string; type?:string; required?:boolean
}) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <FieldLabel required={required}>{label}</FieldLabel>}
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} required={required}
        style={inputStyle}
        onFocus={e=>{e.target.style.borderColor='var(--gold)'}}
        onBlur={e=>{e.target.style.borderColor='var(--border)'}}
      />
    </div>
  )
}

// ── Select ────────────────────────────────────────────────────────────────
export function Select({ label, value, onChange, options, required }: {
  label?:string; value:string; onChange:(v:string)=>void
  options:{value:string;label:string}[]; required?:boolean
}) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <FieldLabel required={required}>{label}</FieldLabel>}
      <select value={value} onChange={e=>onChange(e.target.value)} required={required}
        style={{ ...inputStyle, appearance:'none', backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none' viewBox='0 0 12 8'%3E%3Cpath stroke='%236B6B6B' stroke-width='1.5' d='M1 1l5 5 5-5'/%3E%3C/svg%3E")`, backgroundRepeat:'no-repeat', backgroundPosition:'right 14px center', paddingRight:36 }}
        onFocus={e=>{e.target.style.borderColor='var(--gold)'}}
        onBlur={e=>{e.target.style.borderColor='var(--border)'}}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ── Textarea ──────────────────────────────────────────────────────────────
export function Textarea({ label, value, onChange, placeholder, rows=3 }: {
  label?:string; value:string; onChange:(v:string)=>void; placeholder?:string; rows?:number
}) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
        style={{ ...inputStyle, resize:'vertical' }}
        onFocus={e=>{e.target.style.borderColor='var(--gold)'}}
        onBlur={e=>{e.target.style.borderColor='var(--border)'}}
      />
    </div>
  )
}

// ── Meal picker ───────────────────────────────────────────────────────────
const MEALS: {value:MealChoice; label:string}[] = [
  {value:'fleisch',label:'Fleisch'}, {value:'fisch',label:'Fisch'},
  {value:'vegetarisch',label:'Vegetarisch'}, {value:'vegan',label:'Vegan'},
]

export function MealPicker({ value, onChange, label }: { value:MealChoice|undefined; onChange:(v:MealChoice)=>void; label?:string }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <FieldLabel required>{label}</FieldLabel>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        {MEALS.map(m => (
          <button key={m.value} type="button" onClick={()=>onChange(m.value)} data-sel={value===m.value?'':undefined} style={{
            padding:'11px 10px', borderRadius:'var(--r-sm)', fontFamily:'inherit',
            border:`1.5px solid ${value===m.value?'var(--gold)':'var(--border)'}`,
            background: value===m.value?'var(--gold-pale)':'var(--bg)',
            color: value===m.value?'var(--gold)':'var(--text-dim)',
            fontSize:13, fontWeight:600, cursor:'pointer', transition:'all 0.15s',
          }}>
            {m.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Allergy picker ────────────────────────────────────────────────────────
const ALLERGY_TAGS: AllergyTag[] = ['Gluten','Laktose','Nüsse','Fisch','Soja','Halal','Kosher','Ei']

export function AllergyPicker({ label, tags, onTagsChange, custom, onCustomChange }: {
  label?:string; tags:AllergyTag[]; onTagsChange:(v:AllergyTag[])=>void
  custom:string; onCustomChange:(v:string)=>void
}) {
  const toggle = (t:AllergyTag) => onTagsChange(tags.includes(t)?tags.filter(x=>x!==t):[...tags,t])
  return (
    <div style={{ marginBottom:14 }}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
        {ALLERGY_TAGS.map(tag => {
          const active = tags.includes(tag)
          return (
            <button key={tag} type="button" onClick={()=>toggle(tag)} data-sel={active?'':undefined} style={{
              padding:'5px 12px', borderRadius:100, fontFamily:'inherit',
              border:`1.5px solid ${active?'var(--gold)':'var(--border)'}`,
              background: active?'var(--gold-pale)':'var(--bg)',
              color: active?'var(--gold)':'var(--text-dim)',
              fontSize:11, fontWeight:600, cursor:'pointer', transition:'all 0.15s',
            }}>{tag}</button>
          )
        })}
      </div>
      <input type="text" value={custom} onChange={e=>onCustomChange(e.target.value)}
        placeholder="Weitere (z.B. Sellerie, Senf …)"
        style={{ ...inputStyle, fontSize:13 }}
        onFocus={e=>{e.target.style.borderColor='var(--gold)'}}
        onBlur={e=>{e.target.style.borderColor='var(--border)'}}
      />
      <p style={{ fontSize:10, color:'var(--text-dim)', marginTop:4 }}>Mehrere Angaben mit Komma trennen</p>
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────
export function Toast({ message, onClose }: { message:string; onClose:()=>void }) {
  React.useEffect(()=>{ const t=setTimeout(onClose,3000); return ()=>clearTimeout(t) },[onClose])
  return (
    <div style={{ position:'fixed', bottom:32, left:'50%', transform:'translateX(-50%)', background:'#1A1A1A', color:'#FFFFFF', border:'none', padding:'11px 20px', borderRadius:100, fontSize:13, fontWeight:500, zIndex:1000, boxShadow:'0 4px 24px rgba(0,0,0,0.15)', animation:'slideUp 0.3s ease', whiteSpace:'nowrap' }}>
      {message}
    </div>
  )
}

// ── Page shell (content wrapper only — header is provided by ClientLayout) ─
export function PageShell({ title, back, children }: { title:string; back?:string; children:React.ReactNode }) {
  return (
    <div style={{ background:'var(--bg)', minHeight:'100dvh', paddingBottom:88 }}>
      <div style={{ padding:'20px 16px', maxWidth:1200, margin:'0 auto' }}>
        {children}
      </div>
    </div>
  )
}

// ── Stat chip ─────────────────────────────────────────────────────────────
export function StatBox({ value, label, gold }: { value:string|number; label:string; gold?:boolean }) {
  return (
    <div style={{ background:'var(--bg)', borderRadius:'var(--r-sm)', padding:'14px 10px', textAlign:'center', border:'1px solid var(--border)' }}>
      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:500, color:gold?'var(--gold)':'var(--text)', lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.09em', color:'var(--text-dim)', marginTop:5 }}>{label}</div>
    </div>
  )
}
