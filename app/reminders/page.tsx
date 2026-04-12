'use client'
import React, { useState, useEffect } from 'react'
import { type Event, type Reminder, type ReminderType } from "@/lib/store"
import { useEvent } from "@/lib/event-context"
import { PageShell, Card, SectionTitle, Toast, Button, Input, Select } from '@/components/ui'
import { Plus, Trash2, Send, Bell, CreditCard, Clock } from 'lucide-react'
import { useFeatureEnabled, FeatureDisabledScreen } from '@/components/FeatureGate'

function uid() { return Math.random().toString(36).slice(2,9) }

const TYPE_ICONS: Record<ReminderType, React.ReactNode> = {
  'rsvp-followup': <Bell size={14}/>,
  'deadline':      <Clock size={14}/>,
  'payment':       <CreditCard size={14}/>,
}
const TYPE_LABELS: Record<ReminderType,string> = {
  'rsvp-followup': 'RSVP-Nachfassung',
  'deadline':      'Deadline',
  'payment':       'Zahlung fällig',
}
const TYPE_COLORS: Record<ReminderType,string> = {
  'rsvp-followup': 'var(--gold)',
  'deadline':      '#7BC99A',
  'payment':       '#C97B7B',
}
const TYPE_BG: Record<ReminderType,string> = {
  'rsvp-followup': 'var(--gold-pale)',
  'deadline':      'var(--green-pale)',
  'payment':       'var(--red-pale)',
}

export default function RemindersPage() {
  const enabled = useFeatureEnabled('reminders')
  const [toast,setToast] = useState<string|null>(null)
  const [adding,setAdding] = useState(false)
  const [draft,setDraft] = useState<Partial<Reminder>>({type:'deadline',sent:false})

  const { event, updateEvent } = useEvent()

  if (!event) return null
  if (!enabled) return <PageShell title="Erinnerungen" back="/dashboard"><FeatureDisabledScreen /></PageShell>

  const markSent = (id:string) => {
    updateEvent({...event,reminders:event.reminders.map(r=>r.id===id?{...r,sent:true}:r)})
    setToast('Als gesendet markiert')
  }

  const deleteReminder = (id:string) => {
    updateEvent({...event,reminders:event.reminders.filter(r=>r.id!==id)})
    setToast('Erinnerung entfernt')
  }

  const addReminder = () => {
    if (!draft.title) return
    const r: Reminder = { id:uid(), type:draft.type??'deadline', title:draft.title, targetDate:draft.targetDate, sent:false, notes:draft.notes }
    updateEvent({...event,reminders:[...event.reminders,r]})
    setDraft({type:'deadline',sent:false})
    setAdding(false)
    setToast('Erinnerung hinzugefügt')
  }

  // auto-generate RSVP reminders for pending guests
  const pendingGuests = event.guests.filter(g=>g.status==='angelegt'||g.status==='eingeladen')
  const pending = event.reminders.filter(r=>!r.sent)
  const sent    = event.reminders.filter(r=>r.sent)

  return (
    <PageShell title="Erinnerungen" back="/dashboard">
      {/* Auto RSVP hints */}
      {pendingGuests.length>0&&(
        <div style={{background:'var(--gold-pale)',border:'1px solid rgba(201,168,76,0.2)',borderRadius:'var(--r-md)',padding:'14px 16px',marginBottom:14}}>
          <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--gold)',marginBottom:6}}>Noch keine Antwort</p>
          <p style={{fontSize:13,color:'var(--text-mid)',lineHeight:1.6}}>
            {pendingGuests.length} {pendingGuests.length===1?'Gast hat':'Gäste haben'} noch nicht geantwortet:
          </p>
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:10}}>
            {pendingGuests.map(g=>(
              <span key={g.id} style={{fontSize:11,fontWeight:500,padding:'3px 10px',borderRadius:100,background:'var(--gold-pale)',color:'var(--gold)',border:'1px solid rgba(201,168,76,0.2)'}}>
                {g.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pending reminders */}
      {pending.length>0&&(
        <div style={{marginBottom:14}}>
          <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:'var(--text-dim)',marginBottom:10}}>Ausstehend ({pending.length})</p>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {pending.map(r=>(
              <Card key={r.id} style={{border:`1px solid ${TYPE_COLORS[r.type]}22`}}>
                <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                  <div style={{width:36,height:36,borderRadius:10,background:TYPE_BG[r.type],display:'flex',alignItems:'center',justifyContent:'center',color:TYPE_COLORS[r.type],flexShrink:0}}>
                    {TYPE_ICONS[r.type]}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:13,fontWeight:600,color:'var(--text)',marginBottom:3}}>{r.title}</p>
                    <p style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.08em',color:TYPE_COLORS[r.type]}}>{TYPE_LABELS[r.type]}</p>
                    {r.targetDate&&<p style={{fontSize:11,color:'var(--text-dim)',marginTop:3}}>{new Date(r.targetDate).toLocaleDateString('de-DE',{day:'numeric',month:'long',year:'numeric'})}</p>}
                    {r.notes&&<p style={{fontSize:11,color:'var(--text-dim)',marginTop:3,fontStyle:'italic'}}>{r.notes}</p>}
                  </div>
                  <button onClick={()=>deleteReminder(r.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-dim)',display:'flex',padding:2,flexShrink:0}}><Trash2 size={13}/></button>
                </div>
                <div style={{marginTop:12,display:'flex',gap:8}}>
                  <button onClick={()=>markSent(r.id)} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:100,border:'none',background:'var(--gold)',color:'#FFFFFF',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                    <Send size={11}/> Als gesendet markieren
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Sent */}
      {sent.length>0&&(
        <div style={{marginBottom:14}}>
          <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:'var(--text-dim)',marginBottom:10}}>Erledigt ({sent.length})</p>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {sent.map(r=>(
              <div key={r.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-sm)',opacity:0.55}}>
                <div style={{color:TYPE_COLORS[r.type]}}>{TYPE_ICONS[r.type]}</div>
                <p style={{flex:1,fontSize:13,color:'var(--text-dim)',textDecoration:'line-through'}}>{r.title}</p>
                <button onClick={()=>deleteReminder(r.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-dim)',display:'flex'}}><Trash2 size={12}/></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add */}
      {adding?(
        <Card style={{marginBottom:14}}>
          <p style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:500,color:'var(--text)',marginBottom:14}}>Neue Erinnerung</p>
          <Select label="Typ" value={draft.type??'deadline'} onChange={v=>setDraft(d=>({...d,type:v as ReminderType}))}
            options={[{value:'rsvp-followup',label:'RSVP-Nachfassung'},{value:'deadline',label:'Deadline'},{value:'payment',label:'Zahlung fällig'}]}/>
          <Input label="Titel" value={draft.title??''} onChange={v=>setDraft(d=>({...d,title:v}))} placeholder="z.B. Catering-Restzahlung" required/>
          <Input label="Datum (optional)" type="date" value={draft.targetDate??''} onChange={v=>setDraft(d=>({...d,targetDate:v}))}/>
          <Input label="Notiz (optional)" value={draft.notes??''} onChange={v=>setDraft(d=>({...d,notes:v}))} placeholder="Details …"/>
          <div style={{display:'flex',gap:8}}>
            <Button variant="gold" onClick={addReminder}>Hinzufügen</Button>
            <Button variant="ghost" onClick={()=>setAdding(false)}>Abbrechen</Button>
          </div>
        </Card>
      ):(
        <button onClick={()=>setAdding(true)} style={{width:'100%',padding:'13px',borderRadius:'var(--r-md)',border:'1px dashed var(--border)',background:'none',fontSize:13,fontWeight:600,color:'var(--text-dim)',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          <Plus size={15}/> Erinnerung hinzufügen
        </button>
      )}

      {toast&&<Toast message={toast} onClose={()=>setToast(null)}/>}
    </PageShell>
  )
}
