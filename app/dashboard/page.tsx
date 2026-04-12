'use client'
import React, { useState, useEffect, useRef } from 'react'
import { DndContext, DragOverlay, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { Users, Hotel, Utensils, LayoutDashboard, RefreshCw, FileText, Download, X } from 'lucide-react'
import { getStats, DEFAULT_FEATURE_TOGGLES, type Event, type CateringPlan, type FeatureKey } from '@/lib/store'
import { useEvent } from '@/lib/event-context'
import { Toast } from '@/components/ui'
import { SortableWidget, type WidgetId } from '@/components/dashboard/SortableWidget'
import { CountdownWidget, RsvpWidget, BudgetWidget, TasksWidget, SeatingWidget, VendorsWidget, RemindersWidget, SubEventsWidget, ArrivalWidget, TimelineWidget, DekoWidget } from '@/components/dashboard/DashboardWidgets'
import { GuestTabContent } from '@/components/dashboard/GuestTab'
import { HotelTabContent } from '@/components/dashboard/HotelTab'
import { CateringForm, CateringSummary } from '@/components/dashboard/CateringSection'

const DEFAULT_CATERING: CateringPlan = {
  serviceStyle:'', locationHasKitchen:false,
  midnightSnack:false, midnightSnackNote:'',
  drinksBilling:'pauschale', drinksSelection:[],
  champagneFingerFood:false, champagneFingerFoodNote:'',
  serviceStaff:false, equipmentNeeded:[],
  budgetPerPerson:0, budgetIncludesDrinks:false, cateringNotes:'',
}

function daysUntil(d: string) { return Math.ceil((new Date(d).getTime()-new Date().setHours(0,0,0,0))/86400000) }

type Tab = 'overview'|'guests'|'hotel'|'catering'
const PINNED_WIDGETS: WidgetId[] = ['countdown','rsvp','tasks']
const DEFAULT_WIDGET_ORDER: WidgetId[] = ['budget','seating','vendors','reminders','sub-events','arrival','deko','timeline']

export default function DashboardPage() {
  const { event, updateEvent } = useEvent()
  const [toast, setToast]   = useState<string|null>(null)
  const [del, setDel]       = useState<string|null>(null)
  const [tab, setTab]       = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const t = sessionStorage.getItem('velvet_dashboard_tab') as Tab | null
      if (t && ['overview','guests','hotel','catering'].includes(t)) return t
    }
    return 'overview'
  })
  const [search, setSearch] = useState('')
  const [catering, setCatering]       = useState<CateringPlan>(DEFAULT_CATERING)
  const [showSummary, setShowSummary] = useState(false)
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(() => {
    try {
      const s = typeof window!=='undefined'&&localStorage.getItem('velvet-widget-order')
      if(s) {
        const saved: WidgetId[] = JSON.parse(s)
        const filtered = saved.filter(id => !(PINNED_WIDGETS as string[]).includes(id))
        const missing = DEFAULT_WIDGET_ORDER.filter(id=>!filtered.includes(id))
        return [...filtered, ...missing]
      }
    } catch {}
    return DEFAULT_WIDGET_ORDER
  })
  const [activeWidget, setActiveWidget] = useState<WidgetId|null>(null)
  const [dragHeight, setDragHeight] = useState<number|undefined>()
  const [dragWidth, setDragWidth]   = useState<number|undefined>()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  const cateringInit = useRef(false)
  useEffect(()=>{
    if(event && !cateringInit.current) { cateringInit.current=true; setCatering(event.catering??DEFAULT_CATERING) }
  },[event])

  // Sync tab with sessionStorage + listen for BottomNav tab switches
  const switchTab = (t: Tab) => {
    setTab(t)
    sessionStorage.setItem('velvet_dashboard_tab', t)
    window.dispatchEvent(new Event('velvet-tab-change'))
  }
  useEffect(() => {
    const handler = () => {
      const t = sessionStorage.getItem('velvet_dashboard_tab') as Tab | null
      if (t && ['overview','guests','hotel','catering'].includes(t)) setTab(t)
    }
    window.addEventListener('velvet-tab-change', handler)
    return () => window.removeEventListener('velvet-tab-change', handler)
  }, [])
  useEffect(()=>{ localStorage.setItem('velvet-widget-order',JSON.stringify(widgetOrder)) },[widgetOrder])

  const deleteGuest = (id: string) => {
    if(!event) return
    updateEvent({...event, guests:event.guests.filter(g=>g.id!==id)})
    setDel(null); setToast('Gast entfernt')
  }

  const addGuest = (data: {name: string; email: string; phone: string}) => {
    if(!event) return
    const newGuest = {
      id: `g-${Date.now()}`,
      name: data.name.trim(),
      email: data.email.trim(),
      phone: data.phone.trim() || undefined,
      token: `tok-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      status: 'angelegt' as const,
      begleitpersonen: [],
      allergies: [],
    }
    updateEvent({...event, guests:[...event.guests, newGuest]})
    setToast(`${newGuest.name} hinzugefügt`)
  }

  const reset = () => {
    const {resetEvent,loadEvent:le}=require('@/lib/store')
    resetEvent(); updateEvent(le()); setToast('Demodaten zurückgesetzt')
  }

  useEffect(()=>{
    if(!cateringInit.current) { cateringInit.current=true; return }
    if(!event) return
    const s = getStats(event)
    const total = catering.budgetPerPerson>0 ? catering.budgetPerPerson*s.totalAttending : 0
    let newBudget = [...event.budget]
    if(total>0){
      const idx=newBudget.findIndex(b=>b.category==='Catering')
      if(idx>=0) newBudget[idx]={...newBudget[idx],planned:total}
      else newBudget.push({id:'catering-auto',category:'Catering',description:'Catering (automatisch berechnet)',planned:total,actual:0,status:'offen'})
    }
    updateEvent({...event,catering,budget:newBudget})
  },[catering])

  // Redirect away from disabled feature tabs
  const cateringEnabled = event?.organizer?.featureToggles?.catering ?? DEFAULT_FEATURE_TOGGLES.catering
  useEffect(() => {
    if (tab === 'catering' && !cateringEnabled) switchTab('overview')
  }, [cateringEnabled, tab])

  if(!event) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100dvh',background:'var(--bg)'}}>
      <span style={{fontFamily:"'DM Serif Display',serif",fontSize:22,color:'var(--gold)'}}>Velvet.</span>
    </div>
  )

  const stats = getStats(event)
  const days  = daysUntil(event.date)

  const ALL_PHASES = ['12+ Monate','6–12 Monate','3–6 Monate','1–3 Monate','Letzte Woche','Hochzeitstag'] as const
  const activePhaseCount = days>365?1:days>182?2:days>91?3:days>30?4:days>7?5:6
  const activePhases = ALL_PHASES.slice(0, activePhaseCount)
  const phaseTasks      = event.tasks.filter(t=>activePhases.includes(t.phase as typeof ALL_PHASES[number]))
  const phaseTasksDone  = phaseTasks.filter(t=>t.done).length
  const phaseTasksTotal = phaseTasks.length
  const taskPct    = phaseTasksTotal>0 ? Math.round(phaseTasksDone/phaseTasksTotal*100) : 0
  const budgetPct  = stats.budgetPlanned>0 ? Math.min(100,Math.round(stats.budgetActual/stats.budgetPlanned*100)) : 0
  const overBudget = stats.budgetActual > stats.budgetPlanned
  const seatedCount = event.seatingTables.reduce((sum,t)=>sum+t.guestIds.filter(id=>id&&!id.startsWith('couple-')).length,0)

  const filteredGuests = event.guests.filter(g=>
    !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.email.toLowerCase().includes(search.toLowerCase())
  )
  const featureToggles = { ...DEFAULT_FEATURE_TOGGLES, ...event.organizer?.featureToggles }
  const WIDGET_FEATURE: Partial<Record<WidgetId, FeatureKey>> = {
    budget: 'budget', vendors: 'vendors', tasks: 'tasks',
    reminders: 'reminders', seating: 'seating', 'sub-events': 'sub-events',
    deko: 'deko',
  }
  const visibleWidgets = widgetOrder.filter(id => {
    const fk = WIDGET_FEATURE[id]
    if (fk && !featureToggles[fk]) return false
    return id === 'timeline' || id !== 'arrival' || Object.keys(stats.arrivalDays).length > 0
  })
  const pinnedWidgets = PINNED_WIDGETS

  const renderWidget = (id: WidgetId) => {
    switch(id) {
      case 'countdown':  return <CountdownWidget days={days} date={event.date}/>
      case 'rsvp':       return <RsvpWidget guestCount={event.guests.length} stats={stats}/>
      case 'budget':     return <BudgetWidget stats={stats} budgetPct={budgetPct} overBudget={overBudget}/>
      case 'tasks':      return <TasksWidget taskPct={taskPct} done={phaseTasksDone} total={phaseTasksTotal}/>
      case 'seating':    return <SeatingWidget seatedCount={seatedCount} confirmed={stats.confirmed}/>
      case 'vendors':    return <VendorsWidget confirmed={event.vendors.filter(v=>v.status==='bestätigt').length} total={event.vendors.length}/>
      case 'reminders':  return <RemindersWidget open={event.reminders.filter(r=>!r.sent).length} total={event.reminders.length}/>
      case 'sub-events': return <SubEventsWidget count={event.subEvents.length}/>
      case 'arrival':    return <ArrivalWidget arrivalDays={stats.arrivalDays} confirmed={stats.confirmed}/>
      case 'timeline':   return <TimelineWidget event={event} onUpdate={updateEvent}/>
      case 'deko':       return <DekoWidget event={event}/>
      default: return null
    }
  }

  return (
    <div style={{background:'var(--bg)', minHeight:'100dvh', paddingBottom:88}}>
      <div style={{padding:'14px 14px 0'}}>

        {tab==='overview'&&(
          <div style={{animation:'fadeUp 0.3s ease'}}>
            {/* Pinned top section — single shared card */}
            <div className="pinned-section" style={{marginBottom:10, background:'var(--surface)', borderRadius:'var(--r-md)', border:'1px solid var(--border)', overflow:'hidden'}}>
              <div className="pinned-inner">
                {pinnedWidgets.map((id, i) => (
                  <div key={id} className="pinned-item">
                    {renderWidget(id)}
                  </div>
                ))}
              </div>
            </div>
            {/* Movable widgets */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={({active}: DragStartEvent)=>{
                setActiveWidget(active.id as WidgetId)
                const el = document.querySelector(`[data-widget-id="${active.id}"]`) as HTMLElement
                if(el) { const r=el.getBoundingClientRect(); setDragHeight(r.height); setDragWidth(r.width) }
              }}
              onDragEnd={({active,over}: DragEndEvent)=>{
                setActiveWidget(null); setDragHeight(undefined); setDragWidth(undefined)
                if(over&&active.id!==over.id){
                  setWidgetOrder(order=>arrayMove(order,order.indexOf(active.id as WidgetId),order.indexOf(over.id as WidgetId)))
                }
              }}
              onDragCancel={()=>{ setActiveWidget(null); setDragHeight(undefined); setDragWidth(undefined) }}
            >
              <SortableContext items={visibleWidgets} strategy={rectSortingStrategy}>
                <div className="widget-grid" style={{display:'grid', gap:10}}>
                  {visibleWidgets.map(id=>(
                    <SortableWidget key={id} id={id}>{renderWidget(id)}</SortableWidget>
                  ))}
                </div>
              </SortableContext>
              <DragOverlay adjustScale={false}>
                {activeWidget&&(
                  <div className="drag-overlay-wrapper" style={{borderRadius:'var(--r-md)', boxShadow:'0 20px 60px rgba(0,0,0,0.18)', opacity:0.95, transform:'scale(1.04)', transformOrigin:'top left', height:dragHeight, width:dragWidth, overflow:'hidden'}}>
                    {renderWidget(activeWidget)}
                  </div>
                )}
              </DragOverlay>
            </DndContext>
            <div style={{display:'flex', justifyContent:'center', marginTop:16}}>
              <button onClick={reset} style={{display:'flex', alignItems:'center', gap:7, padding:'9px 18px', borderRadius:100, border:'1px dashed var(--border)', background:'transparent', color:'var(--text-dim)', fontSize:11, cursor:'pointer', fontFamily:'inherit'}}>
                <RefreshCw size={12}/> Demodaten zurücksetzen
              </button>
            </div>
          </div>
        )}

        {tab==='guests'&&(
          <GuestTabContent event={event} stats={stats} search={search} setSearch={setSearch}
            filteredGuests={filteredGuests} del={del} setDel={setDel} deleteGuest={deleteGuest}/>
        )}

        {tab==='hotel'&&<HotelTabContent event={event} stats={stats}/>}

        {tab==='catering'&&featureToggles.catering&&(
          <div style={{animation:'fadeUp 0.3s ease'}}>
            <div style={{display:'flex', gap:8, marginBottom:14}}>
              <button onClick={()=>setShowSummary(true)} style={{flex:1, padding:'10px', borderRadius:'var(--r-md)', border:'1px solid var(--border)', background:'var(--surface)', fontSize:12, fontWeight:600, color:'var(--text)', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>
                <FileText size={14}/> Zusammenfassung
              </button>
              <button onClick={()=>{}} style={{flex:1, padding:'10px', borderRadius:'var(--r-md)', border:'1px solid var(--border)', background:'var(--surface)', fontSize:12, fontWeight:600, color:'var(--text-dim)', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>
                <Download size={14}/> Excel exportieren
              </button>
            </div>
            <CateringForm catering={catering} onChange={(p)=>setCatering(f=>({...f,...p}))}/>
          </div>
        )}
      </div>

      {/* Bottom nav now global — rendered by ClientLayout/BottomNav */}

      {showSummary&&(
        <>
          <div onClick={()=>setShowSummary(false)} style={{position:'fixed', inset:0, zIndex:60, background:'rgba(0,0,0,0.4)', backdropFilter:'blur(2px)'}}/>
          <div style={{position:'fixed', left:0, right:0, bottom:0, zIndex:61, background:'var(--surface)', borderRadius:'24px 24px 0 0', maxHeight:'85vh', overflowY:'auto', padding:'20px 16px 32px'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18}}>
              <span style={{fontFamily:"'Playfair Display',serif", fontSize:18, color:'var(--text)', fontWeight:500}}>Zusammenfassung</span>
              <button onClick={()=>setShowSummary(false)} style={{background:'none', border:'none', cursor:'pointer', color:'var(--text-dim)', padding:4, display:'flex'}}><X size={18}/></button>
            </div>
            <CateringSummary event={event} catering={catering} stats={stats}/>
            <button onClick={()=>{}} style={{width:'100%', padding:'13px', borderRadius:'var(--r-md)', border:'1px solid var(--border)', background:'none', fontSize:13, fontWeight:600, color:'var(--text-dim)', cursor:'pointer', fontFamily:'inherit', marginTop:20, display:'flex', alignItems:'center', justifyContent:'center', gap:8}}>
              <Download size={15}/> Excel exportieren
            </button>
          </div>
        </>
      )}
      {toast&&<Toast message={toast} onClose={()=>setToast(null)}/>}
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{transform:translate(-50%,16px);opacity:0}to{transform:translate(-50%,0);opacity:1}}
        .dash-grid{display:grid;grid-template-columns:1fr;gap:10px}
        @media(min-width:680px){
          .dash-grid{grid-template-columns:1fr 1fr 1fr}
          .feature-grid{grid-template-columns:repeat(6,1fr)!important}
        }
        .pinned-inner{display:grid;grid-template-columns:1fr}
        .pinned-item{display:flex;flex-direction:column;box-sizing:border-box}
        .pinned-item>div{background:transparent!important;border:none!important;border-radius:0!important;flex:1;box-sizing:border-box}
        .pinned-item:not(:last-child){border-bottom:1px solid var(--border)}
        @media(min-width:720px){
          .pinned-inner{grid-template-columns:repeat(3,1fr)}
          .pinned-item:not(:last-child){border-bottom:none;border-right:1px solid var(--border)}
        }
        .widget-grid{grid-template-columns:1fr;grid-auto-rows:minmax(163px,auto)}
        @media(min-width:420px){.widget-grid{grid-template-columns:1fr 1fr}}
        @media(min-width:880px){.widget-grid{grid-template-columns:repeat(3,1fr)}}
        .widget-card>div:first-child>*{height:100%;box-sizing:border-box}
        .drag-overlay-wrapper>*{height:100%!important;box-sizing:border-box!important}
        .widget-card:hover .widget-drag-handle,.widget-drag-handle:focus{opacity:0.5!important}
        .widget-drag-handle:hover{opacity:0.85!important;background:var(--bg)!important}
        .widget-drag-handle:active{cursor:grabbing!important}
      `}</style>
    </div>
  )
}
