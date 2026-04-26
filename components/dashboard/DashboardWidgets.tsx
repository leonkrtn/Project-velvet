'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Plus, Flower2, Lightbulb } from 'lucide-react'
import { Card, SectionTitle } from '@/components/ui'
import { getStats, type Event } from '@/lib/store'

type Stats = ReturnType<typeof getStats>

export function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('de-DE', {day:'numeric', month:'long', year:'numeric'})
}
export function fmtMoney(n: number) {
  return new Intl.NumberFormat('de-DE', {style:'currency', currency:'EUR', maximumFractionDigits:0}).format(n)
}

export function CountdownWidget({days, date}: {days: number; date: string}) {
  return (
    <Card>
      <div style={{marginBottom:12}}><SectionTitle>Countdown</SectionTitle></div>
      <div style={{display:'flex', alignItems:'center', gap:16}}>
        <div style={{textAlign:'center', background:'var(--gold-pale)', border:'1px solid rgba(201,168,76,0.18)', borderRadius:12, padding:'12px 16px', flexShrink:0}}>
          <div style={{fontFamily:"'Playfair Display',serif", fontSize:38, fontWeight:500, color:'var(--gold)', lineHeight:1}}>{days}</div>
          <div style={{fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.09em', color:'var(--gold)', opacity:0.65, marginTop:4}}>Tage</div>
        </div>
        <div>
          <p style={{fontSize:13, fontWeight:500, color:'var(--text)', lineHeight:1.3, marginBottom:6}}>bis zur Hochzeit</p>
          <p style={{fontSize:11, color:'var(--text-dim)'}}>{fmtDate(date)}</p>
        </div>
      </div>
    </Card>
  )
}

export function RsvpWidget({guestCount, stats}: {guestCount: number; stats: Stats}) {
  return (
    <Card>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
        <SectionTitle>Rückmeldungen</SectionTitle>
        <span style={{fontSize:10, color:'var(--text-dim)'}}>{stats.rsvpRate}% geantwortet</span>
      </div>
      <div style={{display:'flex', alignItems:'center', gap:16}}>
        <div style={{width:72, height:72, borderRadius:'50%', flexShrink:0, background:`conic-gradient(var(--gold) 0% ${stats.confirmed/Math.max(guestCount,1)*100}%, var(--gold-lt) ${stats.confirmed/Math.max(guestCount,1)*100}% ${(stats.confirmed+stats.declined)/Math.max(guestCount,1)*100}%, #E8E8E8 ${(stats.confirmed+stats.declined)/Math.max(guestCount,1)*100}% 100%)`, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{width:48, height:48, borderRadius:'50%', background:'var(--surface)', display:'flex', alignItems:'center', justifyContent:'center'}}>
            <span style={{fontFamily:"'Playfair Display',serif", fontSize:14, fontWeight:500, color:'var(--text)'}}>{guestCount}</span>
          </div>
        </div>
        <div style={{flex:1}}>
          {[{c:'var(--gold)',l:'Zugesagt',v:stats.confirmed},{c:'#E8E8E8',l:'Ausstehend',v:stats.pending},{c:'var(--gold-lt)',l:'Abgesagt',v:stats.declined}].map(s=>(
            <div key={s.l} style={{display:'flex', alignItems:'center', gap:7, marginBottom:5}}>
              <div style={{width:8, height:8, borderRadius:2, background:s.c, flexShrink:0}}/>
              <span style={{fontSize:11, color:'var(--text-light)', flex:1}}>{s.l}</span>
              <span style={{fontSize:12, fontWeight:700, color:'var(--text)'}}>{s.v}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

export function BudgetWidget({stats, budgetPct, overBudget}: {stats: Stats; budgetPct: number; overBudget: boolean}) {
  return (
    <Card>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
        <SectionTitle>Budget</SectionTitle>
        <Link href="/brautpaar/budget" style={{color:'var(--text-dim)', display:'flex', alignItems:'center'}}><ChevronRight size={14}/></Link>
      </div>
      <div style={{display:'flex', alignItems:'center', gap:16}}>
        <div style={{width:72, height:72, borderRadius:'50%', flexShrink:0, background:`conic-gradient(${overBudget?'var(--red)':'var(--gold)'} 0% ${Math.min(budgetPct,100)}%, #E8E8E8 ${Math.min(budgetPct,100)}% 100%)`, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{width:48, height:48, borderRadius:'50%', background:'var(--surface)', display:'flex', alignItems:'center', justifyContent:'center'}}>
            <span style={{fontFamily:"'Playfair Display',serif", fontSize:12, fontWeight:500, color:overBudget?'var(--red)':'var(--gold)'}}>{budgetPct}%</span>
          </div>
        </div>
        <div style={{flex:1}}>
          <div style={{marginBottom:6}}>
            <p style={{fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--text-dim)', marginBottom:2}}>Ausgegeben</p>
            <p style={{fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:500, color:overBudget?'var(--red)':'var(--gold)'}}>{fmtMoney(stats.budgetActual)}</p>
          </div>
          <div>
            <p style={{fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--text-dim)', marginBottom:2}}>Geplant</p>
            <p style={{fontFamily:"'Playfair Display',serif", fontSize:14, fontWeight:400, color:'var(--text-light)'}}>{fmtMoney(stats.budgetPlanned)}</p>
          </div>
        </div>
      </div>
    </Card>
  )
}

export function TasksWidget({taskPct, done, total}: {taskPct: number; done: number; total: number}) {
  return (
    <Card>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
        <SectionTitle>Aufgaben</SectionTitle>
        <Link href="/brautpaar/tasks" style={{color:'var(--text-dim)', display:'flex', alignItems:'center'}}><ChevronRight size={14}/></Link>
      </div>
      <div style={{display:'flex', alignItems:'center', gap:16}}>
        <div style={{width:72, height:72, borderRadius:'50%', flexShrink:0, background:`conic-gradient(var(--gold) 0% ${taskPct}%, #E8E8E8 ${taskPct}% 100%)`, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{width:48, height:48, borderRadius:'50%', background:'var(--surface)', display:'flex', alignItems:'center', justifyContent:'center'}}>
            <span style={{fontFamily:"'Playfair Display',serif", fontSize:13, fontWeight:500, color:'var(--gold)'}}>{taskPct}%</span>
          </div>
        </div>
        <div style={{flex:1}}>
          <p style={{fontSize:22, fontFamily:"'Playfair Display',serif", fontWeight:500, color:'var(--text)', lineHeight:1, marginBottom:4}}>{done}<span style={{fontSize:14, color:'var(--text-dim)'}}> / {total}</span></p>
          <p style={{fontSize:11, color:'var(--text-light)'}}>Aufgaben erledigt</p>
          <p style={{fontSize:11, color:'var(--text-dim)', marginTop:4}}>{total-done} noch offen</p>
        </div>
      </div>
    </Card>
  )
}

export function SeatingWidget({seatedCount, confirmed}: {seatedCount: number; confirmed: number}) {
  const pct = Math.round(seatedCount/Math.max(confirmed,1)*100)
  return (
    <Card>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
        <SectionTitle>Sitzplan</SectionTitle>
        <Link href="/brautpaar/seating" style={{color:'var(--text-dim)', display:'flex', alignItems:'center'}}><ChevronRight size={14}/></Link>
      </div>
      <div style={{display:'flex', alignItems:'center', gap:16}}>
        <div style={{width:72, height:72, borderRadius:'50%', flexShrink:0, background:`conic-gradient(var(--gold) 0% ${pct}%, #E8E8E8 ${pct}% 100%)`, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{width:48, height:48, borderRadius:'50%', background:'var(--surface)', display:'flex', alignItems:'center', justifyContent:'center'}}>
            <span style={{fontFamily:"'Playfair Display',serif", fontSize:13, fontWeight:500, color:'var(--gold)'}}>{pct}%</span>
          </div>
        </div>
        <div style={{flex:1}}>
          <p style={{fontSize:22, fontFamily:"'Playfair Display',serif", fontWeight:500, color:'var(--text)', lineHeight:1, marginBottom:4}}>{seatedCount}<span style={{fontSize:14, color:'var(--text-dim)'}}> / {confirmed}</span></p>
          <p style={{fontSize:11, color:'var(--text-light)'}}>Gäste platziert</p>
        </div>
      </div>
    </Card>
  )
}

export function VendorsWidget({confirmed, total}: {confirmed: number; total: number}) {
  const pct = Math.round(confirmed/Math.max(total,1)*100)
  return (
    <Card>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
        <SectionTitle>Dienstleister</SectionTitle>
        <Link href="/vendors" style={{color:'var(--text-dim)', display:'flex', alignItems:'center'}}><ChevronRight size={14}/></Link>
      </div>
      <div style={{display:'flex', alignItems:'center', gap:16}}>
        <div style={{width:72, height:72, borderRadius:'50%', flexShrink:0, background:`conic-gradient(var(--gold) 0% ${pct}%, #E8E8E8 ${pct}% 100%)`, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{width:48, height:48, borderRadius:'50%', background:'var(--surface)', display:'flex', alignItems:'center', justifyContent:'center'}}>
            <span style={{fontFamily:"'Playfair Display',serif", fontSize:13, fontWeight:500, color:'var(--gold)'}}>{pct}%</span>
          </div>
        </div>
        <div style={{flex:1}}>
          <p style={{fontSize:22, fontFamily:"'Playfair Display',serif", fontWeight:500, color:'var(--text)', lineHeight:1, marginBottom:4}}>{confirmed}<span style={{fontSize:14, color:'var(--text-dim)'}}> / {total}</span></p>
          <p style={{fontSize:11, color:'var(--text-light)'}}>bestätigt</p>
          <p style={{fontSize:11, color:'var(--text-dim)', marginTop:4}}>{total-confirmed} noch ausstehend</p>
        </div>
      </div>
    </Card>
  )
}

export function RemindersWidget({open, total}: {open: number; total: number}) {
  return (
    <Card>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
        <SectionTitle>Erinnerungen</SectionTitle>
        <Link href="/brautpaar/reminders" style={{color:'var(--text-dim)', display:'flex', alignItems:'center'}}><ChevronRight size={14}/></Link>
      </div>
      <p style={{fontSize:22, fontFamily:"'Playfair Display',serif", fontWeight:500, color:'var(--text)', lineHeight:1, marginBottom:4}}>{open}<span style={{fontSize:14, color:'var(--text-dim)'}}> / {total}</span></p>
      <p style={{fontSize:11, color:'var(--text-light)'}}>ausstehend</p>
    </Card>
  )
}

export function SubEventsWidget({count}: {count: number}) {
  return (
    <Card>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
        <SectionTitle>Sub-Events</SectionTitle>
        <Link href="/brautpaar/sub-events" style={{color:'var(--text-dim)', display:'flex', alignItems:'center'}}><ChevronRight size={14}/></Link>
      </div>
      <p style={{fontSize:22, fontFamily:"'Playfair Display',serif", fontWeight:500, color:'var(--text)', lineHeight:1, marginBottom:4}}>{count}</p>
      <p style={{fontSize:11, color:'var(--text-light)'}}>Events geplant</p>
    </Card>
  )
}

export function ArrivalWidget({arrivalDays, confirmed}: {arrivalDays: Record<string, number>; confirmed: number}) {
  return (
    <Card>
      <div style={{marginBottom:12}}><SectionTitle>Ankunftsverteilung</SectionTitle></div>
      {Object.entries(arrivalDays).sort(([a],[b])=>a.localeCompare(b)).map(([date,count])=>(
        <div key={date} style={{display:'flex', alignItems:'center', gap:10, marginBottom:8}}>
          <span style={{fontSize:11, color:'var(--text-light)', minWidth:80, flexShrink:0}}>{new Date(date).toLocaleDateString('de-DE',{weekday:'short',day:'numeric',month:'short'})}</span>
          <div style={{flex:1, height:6, background:'var(--bg)', borderRadius:3, overflow:'hidden'}}>
            <div style={{height:'100%', width:`${count/Math.max(confirmed,1)*100}%`, background:'var(--gold)', borderRadius:3}}/>
          </div>
          <span style={{fontSize:11, fontWeight:700, color:'var(--text-mid)', minWidth:14, textAlign:'right'}}>{count}</span>
        </div>
      ))}
    </Card>
  )
}

export function TimelineWidget({event, onUpdate}: {event: Event; onUpdate: (e: Event) => void}) {
  return (
    <Card style={{height:'100%', boxSizing:'border-box'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4}}>
        <SectionTitle>Ablauf · {fmtDate(event.date)}</SectionTitle>
      </div>
      <p style={{fontSize:11, color:'var(--text-dim)', marginBottom:18}}>{event.venue} · {event.dresscode}</p>
      <TimelineEditor event={event} onUpdate={onUpdate}/>
    </Card>
  )
}

function TimelineEditor({event, onUpdate}: {event: Event; onUpdate: (e: Event) => void}) {
  const [editing, setEditing] = useState<number|null>(null)
  const [draft, setDraft] = useState({time:'', title:'', location:''})
  const startEdit = (i: number) => { setDraft({...event.timeline[i]}); setEditing(i) }
  const save = (i: number) => { onUpdate({...event, timeline:event.timeline.map((e,idx)=>idx===i?{...draft}:e)}); setEditing(null) }
  const remove = (i: number) => { onUpdate({...event, timeline:event.timeline.filter((_,idx)=>idx!==i)}); setEditing(null) }
  const add = () => { const tl=[...event.timeline,{time:'',title:'Neuer Eintrag',location:''}]; onUpdate({...event,timeline:tl}); setTimeout(()=>startEdit(tl.length-1),50) }
  const iS: React.CSSProperties = {padding:'8px 10px', background:'var(--bg)', border:'1px solid rgba(201,168,76,0.25)', borderRadius:8, fontSize:13, color:'var(--text)', outline:'none', fontFamily:'inherit'}
  return (
    <div>
      <div style={{position:'relative', paddingLeft:22}}>
        <div style={{position:'absolute', left:7, top:6, bottom:6, width:1, background:'var(--border)'}}/>
        {event.timeline.map((entry, i) => (
          <div key={i} style={{position:'relative', marginBottom:16}}>
            <div style={{position:'absolute', left:-19, top:4, width:10, height:10, borderRadius:'50%', background:'var(--surface)', border:`2px solid ${i===0?'var(--gold)':'var(--border)'}`}}/>
            {editing===i ? (
              <div style={{background:'var(--gold-pale)', border:'1px solid rgba(201,168,76,0.2)', borderRadius:10, padding:'12px 14px'}}>
                <div style={{display:'grid', gridTemplateColumns:'72px 1fr', gap:8, marginBottom:8}}>
                  <input value={draft.time} onChange={e=>setDraft(d=>({...d,time:e.target.value}))} placeholder="Zeit" style={iS}/>
                  <input value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))} placeholder="Titel" style={iS}/>
                </div>
                <input value={draft.location} onChange={e=>setDraft(d=>({...d,location:e.target.value}))} placeholder="Ort" style={{...iS, width:'100%', marginBottom:10}}/>
                <div style={{display:'flex', gap:8}}>
                  <button onClick={()=>save(i)} style={{padding:'7px 16px', borderRadius:100, border:'none', background:'var(--gold)', color:'#FFFFFF', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit'}}>Speichern</button>
                  <button onClick={()=>setEditing(null)} style={{padding:'7px 12px', borderRadius:100, border:'1px solid var(--border)', background:'none', fontSize:12, fontWeight:600, color:'var(--text-dim)', cursor:'pointer', fontFamily:'inherit'}}>Abbrechen</button>
                  <button onClick={()=>remove(i)} style={{padding:'7px 12px', borderRadius:100, border:'none', background:'var(--red-pale)', fontSize:12, fontWeight:600, color:'var(--red)', cursor:'pointer', fontFamily:'inherit', marginLeft:'auto'}}>Entfernen</button>
                </div>
              </div>
            ) : (
              <button onClick={()=>startEdit(i)} style={{background:'none', border:'none', cursor:'pointer', textAlign:'left', padding:0, width:'100%', fontFamily:'inherit'}}>
                <div style={{display:'flex', alignItems:'baseline', gap:8, marginBottom:1}}>
                  <span style={{fontFamily:"'Playfair Display',serif", fontSize:13, color:'var(--text-dim)', minWidth:38, flexShrink:0}}>{entry.time}</span>
                  <span style={{fontSize:13, fontWeight:600, color:'var(--text)'}}>{entry.title}</span>
                </div>
                {entry.location&&<p style={{fontSize:11, color:'var(--text-dim)', paddingLeft:46}}>{entry.location}</p>}
              </button>
            )}
          </div>
        ))}
      </div>
      <button onClick={add} style={{marginTop:4, padding:'7px 14px', borderRadius:100, border:'1px dashed var(--border)', background:'none', fontSize:11, fontWeight:600, color:'var(--text-dim)', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6}}>
        <Plus size={12}/> Eintrag hinzufügen
      </button>
    </div>
  )
}

export function ProposalsWidget({ pendingCount }: { pendingCount: number }) {
  return (
    <Card>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
        <SectionTitle>Vorschläge</SectionTitle>
        <Lightbulb size={14} style={{color:'var(--gold)', opacity:0.7}}/>
      </div>
      <div style={{display:'flex', alignItems:'center', gap:14, marginBottom:14}}>
        <div style={{
          width:56, height:56, borderRadius:'50%', flexShrink:0,
          background: pendingCount > 0 ? 'var(--gold-pale)' : 'var(--bg)',
          border: `2px solid ${pendingCount > 0 ? 'var(--gold)' : 'var(--border)'}`,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <span style={{fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:500, color: pendingCount > 0 ? 'var(--gold)' : 'var(--text-dim)', lineHeight:1}}>
            {pendingCount}
          </span>
        </div>
        <div>
          <p style={{fontSize:13, fontWeight:500, color:'var(--text)', lineHeight:1.3, marginBottom:4}}>
            {pendingCount === 0 ? 'Keine offenen Vorschläge' : `${pendingCount} ${pendingCount === 1 ? 'Vorschlag' : 'Vorschläge'} ausstehend`}
          </p>
          <p style={{fontSize:11, color:'var(--text-dim)'}}>von Veranstalter & Dienstleistern</p>
        </div>
      </div>
      <Link href="/brautpaar/vorschlaege" style={{display:'flex', alignItems:'center', justifyContent:'space-between', background:'none', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', padding:'9px 12px', fontSize:12, color:'var(--text)', textDecoration:'none', fontWeight:500}}>
        <span>Alle Vorschläge ansehen</span>
        <ChevronRight size={14} style={{color:'var(--text-dim)'}}/>
      </Link>
    </Card>
  )
}

export function DekoWidget({ event }: { event: Event }) {
  const suggestions = event.organizer?.dekoSuggestions ?? []
  const accepted = suggestions.filter(s => s.status === 'angenommen').length
  const wishes   = (event.dekoWishes ?? []).length

  return (
    <Card>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
        <SectionTitle>Dekoration</SectionTitle>
        <Flower2 size={14} style={{color:'var(--gold)', opacity:0.7}}/>
      </div>
      <div style={{display:'flex', gap:12, marginBottom:14}}>
        <div style={{flex:1, textAlign:'center', background:'var(--bg)', borderRadius:'var(--r-sm)', padding:'12px 8px', border:'1px solid var(--border)'}}>
          <div style={{fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:500, color:'var(--gold)', lineHeight:1}}>{accepted}</div>
          <div style={{fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-dim)', marginTop:5}}>Vorschläge</div>
        </div>
        <div style={{flex:1, textAlign:'center', background:'var(--bg)', borderRadius:'var(--r-sm)', padding:'12px 8px', border:'1px solid var(--border)'}}>
          <div style={{fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:500, color:'var(--text)', lineHeight:1}}>{wishes}</div>
          <div style={{fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-dim)', marginTop:5}}>Wünsche</div>
        </div>
      </div>
      <Link href="/brautpaar/deko" style={{display:'flex', alignItems:'center', justifyContent:'space-between', background:'none', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', padding:'9px 12px', fontSize:12, color:'var(--text)', textDecoration:'none', fontWeight:500}}>
        <span>Zur Deko-Planung</span>
        <ChevronRight size={14} style={{color:'var(--text-dim)'}}/>
      </Link>
    </Card>
  )
}
