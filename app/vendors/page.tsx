'use client'
import React, { useState, useEffect } from 'react'
import { type Event, type Vendor, type VendorCategory, type VendorStatus, saveEvent, DEFAULT_FEATURE_TOGGLES } from "@/lib/store"
import { useEvent } from "@/lib/event-context"
import { PageShell, Card, SectionTitle, Toast, Button, Input, Select, Textarea } from '@/components/ui'
import { Plus, Trash2, Phone, Mail, ChevronDown, ChevronUp, Pencil, X } from 'lucide-react'
import { useFeatureEnabled, FeatureDisabledScreen } from '@/components/FeatureGate'

function uid() { return Math.random().toString(36).slice(2,9) }
function fmtMoney(n:number) { return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n) }

const CATEGORIES: VendorCategory[] = ['Fotograf','Videograf','Catering','Floristik','Musik / Band','DJ','Location','Hochzeitsplaner','Transport','Konditorei','Sonstiges']
const STATUS_LABELS: Record<VendorStatus,string> = { angefragt:'Angefragt', bestätigt:'Bestätigt', abgesagt:'Abgesagt' }
const STATUS_COLORS: Record<VendorStatus,string> = { angefragt:'var(--gold)', bestätigt:'var(--green)', abgesagt:'var(--red)' }
const STATUS_BG: Record<VendorStatus,string>     = { angefragt:'var(--gold-pale)', bestätigt:'var(--green-pale)', abgesagt:'var(--red-pale)' }

const iStyle: React.CSSProperties = {
  padding:'8px 11px', background:'var(--bg)', border:'1px solid var(--border)',
  borderRadius:8, fontSize:13, color:'var(--text)', outline:'none', fontFamily:'inherit', width:'100%',
}


export default function VendorsPage() {
  const enabled = useFeatureEnabled('vendors')
  const [toast,setToast]   = useState<string|null>(null)
  const [expanded,setExp]  = useState<string|null>(null)
  const [editing,setEdit]  = useState<string|null>(null)
  const [drafts,setDrafts] = useState<Record<string,Partial<Vendor>>>({})
  const [adding,setAdding] = useState(false)
  const [draft,setDraft]   = useState<Partial<Vendor>>({category:'Sonstiges',status:'angefragt'})

  const { event, updateEvent } = useEvent()
  if (!event) return null
  if (!enabled) return <PageShell title="Dienstleister" back="/dashboard"><FeatureDisabledScreen /></PageShell>

  const startEdit = (v: Vendor) => {
    setDrafts(d => ({ ...d, [v.id]: { ...v } }))
    setEdit(v.id)
    setExp(v.id) // always keep expanded when editing
  }

  const saveEdit = (id: string) => {
    const d = drafts[id]
    if (!d) return
    updateEvent({ ...event, vendors: event.vendors.map(v => v.id === id ? { ...v, ...d } as Vendor : v) })
    setEdit(null)
    setToast('Gespeichert')
  }

  const cancelEdit = (id: string) => {
    setEdit(null)
    setDrafts(d => { const n={...d}; delete n[id]; return n })
  }

  const patchDraft = (id: string, changes: Partial<Vendor>) =>
    setDrafts(d => ({ ...d, [id]: { ...d[id], ...changes } }))

  const addVendor = () => {
    if (!draft.name) return
    const v: Vendor = { id:uid(), name:draft.name, category:draft.category??'Sonstiges', status:draft.status??'angefragt', contactName:draft.contactName, phone:draft.phone, email:draft.email, price:draft.price, notes:draft.notes }
    updateEvent({ ...event, vendors:[...event.vendors,v] })
    setDraft({category:'Sonstiges',status:'angefragt'})
    setAdding(false); setToast('Dienstleister hinzugefügt')
  }

  const deleteVendor = (id:string) => {
    updateEvent({...event,vendors:event.vendors.filter(v=>v.id!==id)})
    setEdit(null); setExp(null); setToast('Dienstleister entfernt')
  }

  const updateStatus = (id:string, status:VendorStatus) =>
    updateEvent({...event,vendors:event.vendors.map(v=>v.id===id?{...v,status}:v)})

  const confirmed   = event.vendors.filter(v=>v.status==='bestätigt').length
  const totalBudget = event.vendors.reduce((a,v)=>a+(v.price??0),0)

  return (
    <PageShell title="Dienstleister" back="/dashboard">
      {/* Summary */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:16}}>
        {[
          {v:event.vendors.length, l:'Gesamt'},
          {v:confirmed,            l:'Bestätigt'},
          {v:fmtMoney(totalBudget),l:'Gesamtkosten'},
        ].map(s=>(
          <div key={s.l} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-sm)',padding:'12px 10px',textAlign:'center'}}>
            <p style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:500,color:'var(--gold)',lineHeight:1}}>{s.v}</p>
            <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--text-dim)',marginTop:4}}>{s.l}</p>
          </div>
        ))}
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:14}}>
        {event.vendors.map(v => {
          const isExp  = expanded === v.id
          const isEdit = editing  === v.id
          const d      = drafts[v.id] ?? v

          return (
            <Card key={v.id} style={{border:`1px solid ${v.status==='bestätigt'?'rgba(61,122,86,0.2)':v.status==='abgesagt'?'rgba(160,64,64,0.2)':'var(--border)'}`}}>

              {/* Header — toggle expand, but NOT when in edit mode */}
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <button
                  onClick={()=>{ if(isEdit) return; setExp(isExp?null:v.id) }}
                  style={{flex:1,display:'flex',alignItems:'center',gap:12,background:'none',border:'none',cursor:isEdit?'default':'pointer',fontFamily:'inherit',padding:0,textAlign:'left'}}
                >
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                      <p style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{v.name}</p>
                      <span style={{fontSize:9,fontWeight:700,padding:'2px 8px',borderRadius:100,background:STATUS_BG[v.status],color:STATUS_COLORS[v.status],textTransform:'uppercase',letterSpacing:'0.06em'}}>
                        {STATUS_LABELS[v.status]}
                      </span>
                    </div>
                    <p style={{fontSize:11,color:'var(--text-dim)'}}>
                      {v.category}{v.price ? ` · ${fmtMoney(v.price)}` : ''}
                    </p>
                  </div>
                </button>
                {!isEdit && (
                  <>
                    <button
                      onClick={e=>{ e.stopPropagation(); startEdit(v) }}
                      style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-dim)',display:'flex',padding:6,borderRadius:8,flexShrink:0}}
                      title="Bearbeiten"
                    >
                      <Pencil size={14}/>
                    </button>
                    <button
                      onClick={()=>setExp(isExp?null:v.id)}
                      style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-dim)',display:'flex',padding:6,borderRadius:8,flexShrink:0}}
                    >
                      {isExp ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                    </button>
                  </>
                )}
                {isEdit && (
                  <button onClick={()=>cancelEdit(v.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-dim)',display:'flex',padding:6,borderRadius:8,flexShrink:0}}>
                    <X size={15}/>
                  </button>
                )}
              </div>

              {/* Expanded view */}
              {isExp && !isEdit && (
                <div style={{marginTop:14,borderTop:'1px solid var(--border)',paddingTop:14}}>
                  <div style={{display:'flex',gap:6,marginBottom:14}}>
                    {(['angefragt','bestätigt','abgesagt'] as VendorStatus[]).map(s=>(
                      <button key={s} onClick={()=>updateStatus(v.id,s)} style={{flex:1,padding:'7px 4px',borderRadius:100,border:`1.5px solid ${v.status===s?STATUS_COLORS[s]:'var(--border)'}`,background:v.status===s?STATUS_BG[s]:'none',color:v.status===s?STATUS_COLORS[s]:'var(--text-dim)',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:'inherit',transition:'all 0.15s'}}>
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:12}}>
                    {v.contactName && <p style={{fontSize:12,color:'var(--text-light)'}}>Kontakt: <strong style={{color:'var(--text-mid)'}}>{v.contactName}</strong></p>}
                    {v.phone && <a href={`tel:${v.phone}`} style={{display:'flex',alignItems:'center',gap:8,color:'var(--gold)',fontSize:13,textDecoration:'none'}}><Phone size={14}/>{v.phone}</a>}
                    {v.email && <a href={`mailto:${v.email}`} style={{display:'flex',alignItems:'center',gap:8,color:'var(--gold)',fontSize:13,textDecoration:'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}><Mail size={14}/>{v.email}</a>}
                    {v.notes && <p style={{fontSize:12,color:'var(--text-dim)',fontStyle:'italic'}}>„{v.notes}"</p>}
                  </div>
                  <button onClick={()=>deleteVendor(v.id)} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:100,border:'1px solid var(--border)',background:'none',fontSize:11,fontWeight:600,color:'var(--text-dim)',cursor:'pointer',fontFamily:'inherit'}}>
                    <Trash2 size={12}/> Entfernen
                  </button>
                </div>
              )}

              {/* Edit mode */}
              {isEdit && (
                <div style={{marginTop:14,borderTop:'1px solid var(--border)',paddingTop:14}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                    <div>
                      <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--text-dim)',marginBottom:5}}>Name</p>
                      <input value={d.name??''} onChange={e=>patchDraft(v.id,{name:e.target.value})} style={iStyle}/>
                    </div>
                    <div>
                      <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--text-dim)',marginBottom:5}}>Preis (€)</p>
                      <input type="number" value={d.price??''} onChange={e=>patchDraft(v.id,{price:Number(e.target.value)||undefined})} style={iStyle}/>
                    </div>
                  </div>
                  <div style={{marginBottom:8}}>
                    <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--text-dim)',marginBottom:5}}>Kategorie</p>
                    <select value={d.category??'Sonstiges'} onChange={e=>patchDraft(v.id,{category:e.target.value as VendorCategory})} style={{...iStyle,appearance:'none'}}>
                      {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                    <div>
                      <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--text-dim)',marginBottom:5}}>Ansprechpartner</p>
                      <input value={d.contactName??''} onChange={e=>patchDraft(v.id,{contactName:e.target.value})} style={iStyle}/>
                    </div>
                    <div>
                      <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--text-dim)',marginBottom:5}}>Telefon</p>
                      <input value={d.phone??''} onChange={e=>patchDraft(v.id,{phone:e.target.value})} style={iStyle}/>
                    </div>
                  </div>
                  <div style={{marginBottom:8}}>
                    <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--text-dim)',marginBottom:5}}>E-Mail</p>
                    <input type="email" value={d.email??''} onChange={e=>patchDraft(v.id,{email:e.target.value})} style={iStyle}/>
                  </div>
                  <div style={{marginBottom:14}}>
                    <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--text-dim)',marginBottom:5}}>Notizen</p>
                    <textarea value={d.notes??''} onChange={e=>patchDraft(v.id,{notes:e.target.value})} rows={2} style={{...iStyle,resize:'vertical'}}/>
                  </div>
                  {/* Status in edit mode too */}
                  <div style={{display:'flex',gap:6,marginBottom:14}}>
                    {(['angefragt','bestätigt','abgesagt'] as VendorStatus[]).map(s=>(
                      <button key={s} onClick={()=>patchDraft(v.id,{status:s})} style={{flex:1,padding:'7px 4px',borderRadius:100,border:`1.5px solid ${d.status===s?STATUS_COLORS[s]:'var(--border)'}`,background:d.status===s?STATUS_BG[s]:'none',color:d.status===s?STATUS_COLORS[s]:'var(--text-dim)',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>saveEdit(v.id)} style={{padding:'9px 20px',borderRadius:100,border:'none',background:'var(--gold)',color:'#FFFFFF',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Speichern</button>
                    <button onClick={()=>cancelEdit(v.id)} style={{padding:'9px 16px',borderRadius:100,border:'1px solid var(--border)',background:'none',fontSize:12,fontWeight:600,color:'var(--text-dim)',cursor:'pointer',fontFamily:'inherit'}}>Abbrechen</button>
                    <button onClick={()=>deleteVendor(v.id)} style={{padding:'9px 16px',borderRadius:100,border:'none',background:'var(--red-pale)',fontSize:12,fontWeight:600,color:'var(--red)',cursor:'pointer',fontFamily:'inherit',marginLeft:'auto'}}>Entfernen</button>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {adding ? (
        <Card>
          <p style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:500,color:'var(--text)',marginBottom:14}}>Neuer Dienstleister</p>
          <Input label="Name" value={draft.name??''} onChange={v=>setDraft(d=>({...d,name:v}))} required placeholder="Firmenname"/>
          <Select label="Kategorie" value={draft.category??'Sonstiges'} onChange={v=>setDraft(d=>({...d,category:v as VendorCategory}))} options={CATEGORIES.map(c=>({value:c,label:c}))}/>
          <Input label="Ansprechpartner" value={draft.contactName??''} onChange={v=>setDraft(d=>({...d,contactName:v}))} placeholder="Vorname Nachname"/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <Input label="Telefon" value={draft.phone??''} onChange={v=>setDraft(d=>({...d,phone:v}))} type="tel"/>
            <Input label="Preis (€)" value={String(draft.price??'')} onChange={v=>setDraft(d=>({...d,price:Number(v)||undefined}))} type="number"/>
          </div>
          <Input label="E-Mail" value={draft.email??''} onChange={v=>setDraft(d=>({...d,email:v}))} type="email"/>
          <Textarea label="Notizen" value={draft.notes??''} onChange={v=>setDraft(d=>({...d,notes:v}))} placeholder="Vertragsdetails …" rows={2}/>
          <div style={{display:'flex',gap:8}}>
            <Button variant="gold" onClick={addVendor}>Hinzufügen</Button>
            <Button variant="ghost" onClick={()=>setAdding(false)}>Abbrechen</Button>
          </div>
        </Card>
      ) : (
        <button onClick={()=>setAdding(true)} style={{width:'100%',padding:'13px',borderRadius:'var(--r-md)',border:'1px dashed var(--border)',background:'none',fontSize:13,fontWeight:600,color:'var(--text-dim)',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          <Plus size={15}/> Dienstleister hinzufügen
        </button>
      )}
      {toast&&<Toast message={toast} onClose={()=>setToast(null)}/>}
    </PageShell>
  )
}
