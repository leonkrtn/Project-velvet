'use client'
import React, { useState, useEffect } from 'react'
import { type Event, type SubEvent } from '@/lib/store'
import { useEvent } from '@/lib/event-context'
import { PageShell, Card, SectionTitle, Toast, Button, Input, Textarea, Avatar } from '@/components/ui'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

function uid() { return Math.random().toString(36).slice(2,9) }

export default function SubEventsPage() {
  const { event, updateEvent } = useEvent()
  const [toast,setToast] = useState<string|null>(null)
  const [expanded,setExp] = useState<string|null>(null)
  const [adding,setAdding] = useState(false)
  const [draft,setDraft] = useState<Partial<SubEvent>>({guestIds:[]})

  useEffect(()=>{ if(event && expanded===null && event.subEvents.length>0) setExp(event.subEvents[0].id) },[event])
  if (!event) return null

  const addSubEvent = () => {
    if (!draft.name||!draft.date) return
    const se: SubEvent = { id:uid(), name:draft.name, date:draft.date, time:draft.time, venue:draft.venue??'', description:draft.description, guestIds:draft.guestIds??[] }
    updateEvent({...event,subEvents:[...event.subEvents,se]})
    setDraft({guestIds:[]}); setAdding(false); setToast('Sub-Event hinzugefügt')
  }

  const deleteSubEvent = (id:string) => {
    updateEvent({...event,subEvents:event.subEvents.filter(s=>s.id!==id)})
    setToast('Sub-Event entfernt')
  }

  const toggleGuest = (seId:string, gId:string) => {
    updateEvent({...event,subEvents:event.subEvents.map(se=>{
      if(se.id!==seId) return se
      const has = se.guestIds.includes(gId)
      return {...se, guestIds: has?se.guestIds.filter(g=>g!==gId):[...se.guestIds,gId]}
    })})
  }

  const fmtDate = (d:string) => new Date(d).toLocaleDateString('de-DE',{weekday:'short',day:'numeric',month:'long',year:'numeric'})

  return (
    <PageShell title="Sub-Events" back="/dashboard">
      <p style={{fontSize:13,color:'var(--text-light)',marginBottom:16,lineHeight:1.6}}>
        Polterabend, Standesamt, Kirchliche Trauung, Brunch — alle Veranstaltungen an einem Ort.
      </p>

      <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:14}}>
        {event.subEvents.map(se=>{
          const isExp = expanded===se.id
          const guests = event.guests.filter(g=>se.guestIds.includes(g.id))
          return (
            <Card key={se.id} style={{border:isExp?'1px solid rgba(201,168,76,0.25)':'1px solid var(--border)'}}>
              <button onClick={()=>setExp(isExp?null:se.id)} style={{width:'100%',display:'flex',alignItems:'flex-start',gap:12,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',padding:0,textAlign:'left'}}>
                <div style={{flex:1}}>
                  <p style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:500,color:'var(--text)',marginBottom:3}}>{se.name}</p>
                  <p style={{fontSize:11,color:'var(--text-dim)'}}>{fmtDate(se.date)}{se.time?` · ${se.time}`:''}</p>
                  <p style={{fontSize:11,color:'var(--text-light)',marginTop:2}}>{se.venue}</p>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                  <span style={{fontSize:11,color:'var(--gold)',fontWeight:600}}>{guests.length} Gäste</span>
                  {isExp?<ChevronUp size={15} color="var(--text-dim)"/>:<ChevronDown size={15} color="var(--text-dim)"/>}
                </div>
              </button>

              {isExp&&(
                <div style={{marginTop:14,borderTop:'1px solid var(--border)',paddingTop:14}}>
                  {se.description&&<p style={{fontSize:13,color:'var(--text-light)',marginBottom:14,lineHeight:1.6,fontStyle:'italic'}}>{se.description}</p>}

                  <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:'var(--text-dim)',marginBottom:10}}>Gästeliste ({guests.length})</p>
                  <div style={{display:'flex',flexDirection:'column',gap:0}}>
                    {event.guests.map(g=>{
                      const included = se.guestIds.includes(g.id)
                      return (
                        <div key={g.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                          <button onClick={()=>toggleGuest(se.id,g.id)} style={{width:20,height:20,borderRadius:5,border:`1.5px solid ${included?'var(--gold)':'var(--border)'}`,background:included?'var(--gold-pale)':'none',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s'}}>
                            {included&&<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-5" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </button>
                          <Avatar name={g.name} size={24}/>
                          <span style={{flex:1,fontSize:13,color:'var(--text)',fontWeight:included?500:400,opacity:included?1:0.55}}>{g.name}</span>
                          <span style={{fontSize:10,color:'var(--text-dim)'}}>
                            {g.status==='zugesagt'?'Zugesagt':g.status==='abgesagt'?'Abgesagt':'Ausstehend'}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  <button onClick={()=>deleteSubEvent(se.id)} style={{marginTop:14,display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:100,border:'1px solid var(--border)',background:'none',fontSize:11,fontWeight:600,color:'var(--text-dim)',cursor:'pointer',fontFamily:'inherit'}}>
                    <Trash2 size={12}/> Sub-Event entfernen
                  </button>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {adding?(
        <Card>
          <p style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:500,color:'var(--text)',marginBottom:14}}>Neues Sub-Event</p>
          <Input label="Name" value={draft.name??''} onChange={v=>setDraft(d=>({...d,name:v}))} placeholder="z.B. Polterabend" required/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <Input label="Datum" type="date" value={draft.date??''} onChange={v=>setDraft(d=>({...d,date:v}))} required/>
            <Input label="Uhrzeit" type="time" value={draft.time??''} onChange={v=>setDraft(d=>({...d,time:v}))}/>
          </div>
          <Input label="Ort / Venue" value={draft.venue??''} onChange={v=>setDraft(d=>({...d,venue:v}))} placeholder="Adresse oder Beschreibung"/>
          <Textarea label="Beschreibung (optional)" value={draft.description??''} onChange={v=>setDraft(d=>({...d,description:v}))} placeholder="Worum geht es?" rows={2}/>
          <div style={{display:'flex',gap:8}}>
            <Button variant="gold" onClick={addSubEvent}>Erstellen</Button>
            <Button variant="ghost" onClick={()=>setAdding(false)}>Abbrechen</Button>
          </div>
        </Card>
      ):(
        <button onClick={()=>setAdding(true)} style={{width:'100%',padding:'13px',borderRadius:'var(--r-md)',border:'1px dashed var(--border)',background:'none',fontSize:13,fontWeight:600,color:'var(--text-dim)',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          <Plus size={15}/> Sub-Event hinzufügen
        </button>
      )}
      {toast&&<Toast message={toast} onClose={()=>setToast(null)}/>}
    </PageShell>
  )
}
