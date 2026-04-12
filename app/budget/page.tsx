'use client'
import React, { useState, useEffect } from 'react'
import { type Event, type BudgetItem, type BudgetCategory, type PaymentStatus } from "@/lib/store"
import { useEvent } from "@/lib/event-context"
import { PageShell, Card, SectionTitle, ProgressBar, Toast, Button, Select, Input } from '@/components/ui'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useFeatureEnabled, FeatureDisabledScreen } from '@/components/FeatureGate'

function uid() { return Math.random().toString(36).slice(2,9) }
function fmtMoney(n:number) { return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n) }

const CATEGORIES: BudgetCategory[] = ['Location','Catering','Musik','Fotografie','Floristik','Kleidung','Ringe','Transport','Papeterie','Sonstiges']
const STATUS_LABELS: Record<PaymentStatus,string> = { offen:'Offen', anzahlung:'Anzahlung', bezahlt:'Bezahlt' }
const STATUS_COLORS: Record<PaymentStatus,string> = { offen:'var(--text-dim)', anzahlung:'var(--gold)', bezahlt:'#7BC99A' }

export default function BudgetPage() {
  const enabled = useFeatureEnabled('budget')
  const [toast, setToast] = useState<string|null>(null)
  const [expanded, setExpanded] = useState<string|null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Partial<BudgetItem>>({ category:'Sonstiges', status:'offen', planned:0, actual:0 })

  const { event, updateEvent } = useEvent()

  if (!event) return null
  if (!enabled) return <PageShell title="Budget" back="/dashboard"><FeatureDisabledScreen /></PageShell>

  const total    = event.budget.reduce((a,b)=>a+b.planned,0)
  const spent    = event.budget.reduce((a,b)=>a+b.actual,0)
  const remain   = total - spent
  const overBudget = spent > total

  const updateItem = (id:string, changes:Partial<BudgetItem>) => {
    updateEvent({ ...event, budget:event.budget.map(b=>b.id===id?{...b,...changes}:b) })
  }

  const deleteItem = (id:string) => {
    updateEvent({ ...event, budget:event.budget.filter(b=>b.id!==id) })
    setToast('Eintrag entfernt')
  }

  const addItem = () => {
    if (!draft.description) return
    const item: BudgetItem = { id:uid(), category:draft.category??'Sonstiges', description:draft.description??'', planned:draft.planned??0, actual:draft.actual??0, status:draft.status??'offen', notes:draft.notes }
    updateEvent({ ...event, budget:[...event.budget,item] })
    setDraft({ category:'Sonstiges', status:'offen', planned:0, actual:0 })
    setAdding(false)
    setToast('Eintrag hinzugefügt')
  }

  // group by category
  const grouped: Record<string,BudgetItem[]> = {}
  event.budget.forEach(b => { if(!grouped[b.category]) grouped[b.category]=[]; grouped[b.category].push(b) })

  return (
    <PageShell title="Budget" back="/dashboard">
      {/* Summary */}
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'20px',marginBottom:16}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
          <div>
            <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:'var(--text-dim)',marginBottom:5}}>Gesamtbudget</p>
            <p style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:500,color:'var(--text)'}}>{fmtMoney(total)}</p>
          </div>
          <div>
            <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:'var(--text-dim)',marginBottom:5}}>Ausgegeben</p>
            <p style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:500,color:overBudget?'#C97B7B':'var(--gold)'}}>{fmtMoney(spent)}</p>
          </div>
        </div>
        <ProgressBar value={spent} max={total} color={overBudget?'#C97B7B':'var(--gold)'}/>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:8,fontSize:11,color:'var(--text-dim)'}}>
          <span>{Math.round(spent/total*100)} % ausgegeben</span>
          <span style={{color:overBudget?'#C97B7B':'var(--text-light)'}}>{overBudget?'Über Budget: ':''}{fmtMoney(Math.abs(remain))}{overBudget?'':' verbleibend'}</span>
        </div>
      </div>

      {/* Payment status overview */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:16}}>
        {(['offen','anzahlung','bezahlt'] as PaymentStatus[]).map(s=>{
          const items = event.budget.filter(b=>b.status===s)
          const total = items.reduce((a,b)=>a+b.planned,0)
          return (
            <div key={s} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-sm)',padding:'12px 10px',textAlign:'center'}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:STATUS_COLORS[s],margin:'0 auto 8px'}}/>
              <p style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:500,color:'var(--text)',marginBottom:2}}>{fmtMoney(total)}</p>
              <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--text-dim)'}}>{STATUS_LABELS[s]}</p>
            </div>
          )
        })}
      </div>

      {/* Items by category */}
      <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
        {Object.entries(grouped).map(([cat,items])=>{
          const catTotal   = items.reduce((a,b)=>a+b.planned,0)
          const catSpent   = items.reduce((a,b)=>a+b.actual,0)
          const isExpanded = expanded===cat
          const isAutoCat  = cat==='Catering' && !!event.catering?.budgetPerPerson && event.catering.budgetPerPerson>0
          return (
            <Card key={cat}>
              <button onClick={()=>setExpanded(isExpanded?null:cat)} style={{width:'100%',display:'flex',alignItems:'center',gap:12,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',padding:0}}>
                <div style={{flex:1,textAlign:'left'}}>
                  <p style={{fontSize:13,fontWeight:600,color:'var(--text)',marginBottom:2}}>{cat}</p>
                  <p style={{fontSize:11,color:'var(--text-dim)'}}>{fmtMoney(catSpent)} / {fmtMoney(catTotal)}</p>
                </div>
                <div style={{flexShrink:0}}>
                  {isExpanded?<ChevronUp size={16} color="var(--text-dim)"/>:<ChevronDown size={16} color="var(--text-dim)"/>}
                </div>
              </button>

              {isExpanded&&(
                <div style={{marginTop:14,borderTop:'1px solid var(--border)',paddingTop:14}}>
                  {isAutoCat&&(
                    <div style={{background:'rgba(201,168,76,0.07)',border:'1px solid rgba(201,168,76,0.2)',borderRadius:8,padding:'10px 12px',marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:11,color:'var(--gold)',fontWeight:600}}>⊞</span>
                      <p style={{fontSize:12,color:'var(--gold)'}}>Budget automatisch aus Catering-Planung: <strong>{fmtMoney(event.catering!.budgetPerPerson)} € / Person</strong></p>
                    </div>
                  )}
                  {items.map(item=>(
                    <div key={item.id} style={{marginBottom:14,paddingBottom:14,borderBottom:'1px solid var(--border)'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                        <p style={{fontSize:13,fontWeight:500,color:'var(--text-mid)',flex:1}}>{item.description}</p>
                        <button onClick={()=>deleteItem(item.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-dim)',padding:2,display:'flex',flexShrink:0}}><Trash2 size={13}/></button>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                        <div>
                          <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:isAutoCat?'var(--gold)':'var(--text-dim)',marginBottom:4}}>{isAutoCat?'Geplant (auto)':'Geplant'}</p>
                          <input type="number" value={item.planned}
                            onChange={e=>isAutoCat?undefined:updateItem(item.id,{planned:Number(e.target.value)})}
                            style={{width:'100%',padding:'8px 10px',background:isAutoCat?'rgba(201,168,76,0.06)':'var(--bg)',border:'1px solid var(--border)',borderRadius:8,fontSize:13,color:isAutoCat?'var(--gold)':'var(--text)',outline:'none',fontFamily:'inherit'}}/>
                        </div>
                        <div>
                          <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--text-dim)',marginBottom:4}}>Bezahlt</p>
                          <input type="number" value={item.actual} onChange={e=>updateItem(item.id,{actual:Number(e.target.value)})}
                            style={{width:'100%',padding:'8px 10px',background:'#FFFFFF',border:'1px solid var(--border)',borderRadius:8,fontSize:13,color:'var(--gold)',outline:'none',fontFamily:'inherit'}}/>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:6}}>
                        {(['offen','anzahlung','bezahlt'] as PaymentStatus[]).map(s=>(
                          <button key={s} onClick={()=>updateItem(item.id,{status:s})} style={{flex:1,padding:'6px 4px',borderRadius:100,border:`1.5px solid ${item.status===s?STATUS_COLORS[s]:'var(--border)'}`,background:item.status===s?'transparent':'none',color:item.status===s?STATUS_COLORS[s]:'var(--text-dim)',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Add new */}
      {adding?(
        <Card style={{marginBottom:16}}>
          <p style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:500,color:'var(--text)',marginBottom:14}}>Neuer Eintrag</p>
          <Select label="Kategorie" value={draft.category??'Sonstiges'} onChange={v=>setDraft(d=>({...d,category:v as BudgetCategory}))} options={CATEGORIES.map(c=>({value:c,label:c}))}/>
          <Input label="Beschreibung" value={draft.description??''} onChange={v=>setDraft(d=>({...d,description:v}))} placeholder="z.B. DJ für den Abend" required/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <Input label="Geplant (€)" type="number" value={String(draft.planned??0)} onChange={v=>setDraft(d=>({...d,planned:Number(v)}))}/>
            <Input label="Bezahlt (€)" type="number" value={String(draft.actual??0)} onChange={v=>setDraft(d=>({...d,actual:Number(v)}))}/>
          </div>
          <div style={{display:'flex',gap:8}}>
            <Button variant="gold" onClick={addItem}>Hinzufügen</Button>
            <Button variant="ghost" onClick={()=>setAdding(false)}>Abbrechen</Button>
          </div>
        </Card>
      ):(
        <button onClick={()=>setAdding(true)} style={{width:'100%',padding:'13px',borderRadius:'var(--r-md)',border:'1px dashed var(--border)',background:'none',fontSize:13,fontWeight:600,color:'var(--text-dim)',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          <Plus size={15}/> Eintrag hinzufügen
        </button>
      )}

      {toast&&<Toast message={toast} onClose={()=>setToast(null)}/>}
    </PageShell>
  )
}
