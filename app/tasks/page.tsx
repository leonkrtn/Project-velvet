'use client'
import React, { useState, useEffect } from 'react'
import { type Event, type Task, type TaskPhase } from "@/lib/store"
import { useEvent } from "@/lib/event-context"
import { PageShell, Card, SectionTitle, ProgressBar, Toast, Button, Input } from '@/components/ui'
import { Plus, Trash2 } from 'lucide-react'
import { useFeatureEnabled, FeatureDisabledScreen } from '@/components/FeatureGate'

function uid() { return Math.random().toString(36).slice(2,9) }

const PHASES: TaskPhase[] = ['12+ Monate','6–12 Monate','3–6 Monate','1–3 Monate','Letzte Woche','Hochzeitstag']

export default function TasksPage() {
  const enabled = useFeatureEnabled('tasks')
  const [toast,setToast] = useState<string|null>(null)
  const [addingPhase,setAddingPhase] = useState<TaskPhase|null>(null)
  const [newTitle,setNewTitle] = useState('')

  const { event, updateEvent } = useEvent()

  if (!event) return null
  if (!enabled) return <PageShell title="Aufgaben" back="/dashboard"><FeatureDisabledScreen /></PageShell>

  const toggleTask = (id:string) => {
    updateEvent({...event,tasks:event.tasks.map(t=>t.id===id?{...t,done:!t.done}:t)})
  }

  const deleteTask = (id:string) => {
    updateEvent({...event,tasks:event.tasks.filter(t=>t.id!==id)})
  }

  const addTask = (phase:TaskPhase) => {
    if (!newTitle.trim()) return
    const t: Task = { id:uid(), title:newTitle.trim(), phase, done:false }
    updateEvent({...event,tasks:[...event.tasks,t]})
    setNewTitle('')
    setAddingPhase(null)
    setToast('Aufgabe hinzugefügt')
  }

  const done  = event.tasks.filter(t=>t.done).length
  const total = event.tasks.length

  return (
    <PageShell title="Aufgaben" back="/dashboard">
      {/* Overall progress */}
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'18px 20px',marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:10}}>
          <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:'var(--text-dim)'}}>Gesamtfortschritt</p>
          <span style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:500,color:'var(--gold)'}}>{total>0?Math.round(done/total*100):0} %</span>
        </div>
        <ProgressBar value={done} max={total}/>
        <p style={{fontSize:11,color:'var(--text-dim)',marginTop:7}}>{done} von {total} Aufgaben erledigt</p>
      </div>

      {/* Phases */}
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {PHASES.map(phase=>{
          const tasks = event.tasks.filter(t=>t.phase===phase)
          const pDone = tasks.filter(t=>t.done).length
          return (
            <Card key={phase}>
              {/* Phase header */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div>
                  <p style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:500,color:'var(--text)'}}>{phase}</p>
                  <p style={{fontSize:10,color:'var(--text-dim)',marginTop:2}}>{pDone}/{tasks.length} erledigt</p>
                </div>
                {tasks.length>0&&(
                  <div style={{width:48}}>
                    <ProgressBar value={pDone} max={tasks.length}/>
                  </div>
                )}
              </div>

              {/* Tasks */}
              <div style={{display:'flex',flexDirection:'column',gap:1}}>
                {tasks.map(task=>(
                  <div key={task.id} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 0',borderBottom:'1px solid var(--border)'}}>
                    {/* Custom checkbox */}
                    <button onClick={()=>toggleTask(task.id)} data-sel={task.done?'':undefined} style={{width:20,height:20,borderRadius:5,border:`1.5px solid ${task.done?'var(--gold)':'var(--border)'}`,background:task.done?'var(--gold-pale)':'none',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s'}}>
                      {task.done&&<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-5" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </button>
                    <span style={{flex:1,fontSize:13,color:task.done?'var(--text-dim)':'var(--text-mid)',textDecoration:task.done?'line-through':'none',lineHeight:1.4}}>{task.title}</span>
                    <button onClick={()=>deleteTask(task.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-dim)',display:'flex',padding:2,flexShrink:0}}><Trash2 size={13}/></button>
                  </div>
                ))}
                {tasks.length===0&&<p style={{fontSize:12,color:'var(--text-dim)',fontStyle:'italic',padding:'4px 0'}}>Keine Aufgaben in dieser Phase</p>}
              </div>

              {/* Add task to phase */}
              {addingPhase===phase?(
                <div style={{marginTop:12,display:'flex',gap:8}}>
                  <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addTask(phase)}} placeholder="Neue Aufgabe …" autoFocus
                    style={{flex:1,padding:'9px 12px',background:'#FFFFFF',border:'1px solid rgba(201,168,76,0.3)',borderRadius:'var(--r-sm)',fontSize:13,color:'var(--text)',outline:'none',fontFamily:'inherit'}}/>
                  <button onClick={()=>addTask(phase)} style={{padding:'9px 16px',borderRadius:'var(--r-sm)',border:'none',background:'var(--gold)',color:'#FFFFFF',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>+</button>
                  <button onClick={()=>{setAddingPhase(null);setNewTitle('')}} style={{padding:'9px 14px',borderRadius:'var(--r-sm)',border:'1px solid var(--border)',background:'none',fontSize:12,color:'var(--text-dim)',cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>✕</button>
                </div>
              ):(
                <button onClick={()=>{setAddingPhase(phase);setNewTitle('')}} style={{marginTop:10,display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:100,border:'1px dashed var(--border)',background:'none',fontSize:11,fontWeight:600,color:'var(--text-dim)',cursor:'pointer',fontFamily:'inherit'}}>
                  <Plus size={12}/> Aufgabe hinzufügen
                </button>
              )}
            </Card>
          )
        })}
      </div>

      {toast&&<Toast message={toast} onClose={()=>setToast(null)}/>}
    </PageShell>
  )
}
