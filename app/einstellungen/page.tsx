'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  loadEvent, saveEvent, createEmptyEvent,
  type Event, type Hotel, type HotelRoom, type BudgetItem, type Vendor,
  type TimelineEntry, type MealChoice,
  type VendorCategory, type VendorStatus, type BudgetCategory
} from '@/lib/store'
import { Toast } from '@/components/ui'
import { Plus, Trash2, ChevronRight, ChevronLeft, Check, X } from 'lucide-react'

function uid() { return Math.random().toString(36).slice(2,9) }

const STEPS = [
  {id:1,label:'Basisdaten'},
  {id:2,label:'Ort & Dresscode'},
  {id:3,label:'Kinder & Gäste'},
  {id:4,label:'Hotel'},
  {id:5,label:'Menü'},
  {id:6,label:'Ablauf & Budget'},
  {id:7,label:'Dienstleister'},
]

const MEAL_OPTIONS: {value:MealChoice;label:string}[] = [
  {value:'fleisch',label:'Fleisch'},
  {value:'fisch',label:'Fisch'},
  {value:'vegetarisch',label:'Vegetarisch'},
  {value:'vegan',label:'Vegan'},
]
const VENDOR_CATS: VendorCategory[] = ['Fotograf','Videograf','Catering','Floristik','Musik / Band','DJ','Location','Hochzeitsplaner','Transport','Konditorei','Sonstiges']
const BUDGET_CATS: BudgetCategory[] = ['Location','Catering','Musik','Fotografie','Floristik','Kleidung','Ringe','Transport','Papeterie','Sonstiges']

const IS: React.CSSProperties = {
  padding:'10px 13px',background:'#FFFFFF',border:'1px solid var(--border)',
  borderRadius:10,fontSize:14,color:'var(--text)',outline:'none',fontFamily:'inherit',width:'100%',
}
const focusGold = (e:React.FocusEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => { e.target.style.borderColor='var(--gold)' }
const blurBorder = (e:React.FocusEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => { e.target.style.borderColor='var(--border)' }

function Lbl({children,req}:{children:React.ReactNode;req?:boolean}) {
  return <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--text-dim)',marginBottom:5}}>{children}{req&&<span style={{color:'var(--gold)',marginLeft:2}}>*</span>}</p>
}
function Block({children,mb=16}:{children:React.ReactNode;mb?:number}) {
  return <div style={{background:'var(--surface)',borderRadius:'var(--r-lg)',border:'1px solid var(--border)',padding:'22px',marginBottom:mb}}>{children}</div>
}
function SecTitle({children}:{children:React.ReactNode}) {
  return <p style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:500,color:'var(--text)',marginBottom:4}}>{children}</p>
}
function SecSub({children}:{children:React.ReactNode}) {
  return <p style={{fontSize:12,color:'var(--text-dim)',marginBottom:14,lineHeight:1.5}}>{children}</p>
}

const PETALS = [
  {x:5,dur:3.2,delay:0,emoji:'🌸',size:'18px'},
  {x:12,dur:2.8,delay:0.4,emoji:'❤️',size:'14px'},
  {x:22,dur:3.6,delay:0.1,emoji:'🌸',size:'22px'},
  {x:30,dur:2.5,delay:0.7,emoji:'✨',size:'16px'},
  {x:38,dur:3.1,delay:0.2,emoji:'🌸',size:'12px'},
  {x:45,dur:2.9,delay:0.9,emoji:'❤️',size:'20px'},
  {x:53,dur:3.4,delay:0.3,emoji:'✨',size:'14px'},
  {x:60,dur:2.7,delay:0.6,emoji:'🌸',size:'18px'},
  {x:68,dur:3.0,delay:0.1,emoji:'❤️',size:'12px'},
  {x:75,dur:2.6,delay:0.8,emoji:'🌸',size:'24px'},
  {x:82,dur:3.3,delay:0.4,emoji:'✨',size:'16px'},
  {x:90,dur:2.8,delay:0.2,emoji:'❤️',size:'20px'},
  {x:95,dur:3.5,delay:0.5,emoji:'🌸',size:'14px'},
  {x:8,dur:3.8,delay:1.1,emoji:'✨',size:'18px'},
  {x:48,dur:2.4,delay:1.3,emoji:'🌸',size:'16px'},
  {x:70,dur:3.7,delay:1.0,emoji:'❤️',size:'22px'},
]

export default function EinstellungenPage() {
  const router = useRouter()
  const [step,setStep] = useState(1)
  const [toast,setToast] = useState<string|null>(null)
  const [isEdit,setIsEdit] = useState(false)
  const [showAnimation,setShowAnimation] = useState(false)
  const [animFadeOut,setAnimFadeOut] = useState(false)

  // Step 1
  const [coupleName,setCoupleName] = useState('')
  const [date,setDate] = useState('')
  // Step 2
  const [venue,setVenue] = useState('')
  const [venueAddress,setVenueAddress] = useState('')
  const [dresscode,setDresscode] = useState('')
  // Step 3
  const [childrenAllowed,setChildrenAllowed] = useState<boolean|null>(null)
  const [childrenNote,setChildrenNote] = useState('')
  const [guestList,setGuestList] = useState([{name:'',email:''}])
  // Step 4
  const [hotels,setHotels] = useState<Hotel[]>([{id:uid(),name:'',address:'',rooms:[{id:uid(),type:'Doppelzimmer',totalRooms:10,bookedRooms:0,pricePerNight:120}]}])
  // Step 5
  const [mealOptions,setMealOptions] = useState<MealChoice[]>(['fleisch','fisch','vegetarisch','vegan'])
  // Step 6
  const [timeline,setTimeline] = useState<TimelineEntry[]>([{time:'',title:'',location:''}])
  const [budgetItems,setBudgetItems] = useState<BudgetItem[]>([{id:uid(),category:'Location',description:'',planned:0,actual:0,status:'offen'}])
  // Step 7
  const [vendors,setVendors] = useState<Vendor[]>([{id:uid(),name:'',category:'Fotograf',status:'angefragt',contactName:'',phone:'',email:'',price:undefined}])

  useEffect(() => {
    const ev = loadEvent()
    if (ev.onboardingComplete) {
      setIsEdit(true)
      setCoupleName(ev.coupleName)
      setDate(ev.date)
      setVenue(ev.venue)
      setVenueAddress(ev.venueAddress ?? '')
      setDresscode(ev.dresscode ?? '')
      setChildrenAllowed(ev.childrenAllowed ?? null)
      setChildrenNote(ev.childrenNote ?? '')
      if (ev.hotels?.length) setHotels(ev.hotels)
      if (ev.mealOptions?.length) setMealOptions(ev.mealOptions)
      if (ev.timeline?.length) setTimeline(ev.timeline)
      if (ev.budget?.length) setBudgetItems(ev.budget)
      if (ev.vendors?.length) setVendors(ev.vendors)
    }
  }, [])

  const canNext = () => {
    if(step===1) return coupleName.trim()&&date
    if(step===2) return venue.trim()
    if(step===3) return childrenAllowed!==null
    return true
  }

  const finish = () => {
    const existing = loadEvent()
    const base = existing.onboardingComplete ? existing : createEmptyEvent()
    const ev: Event = {
      ...base,
      coupleName: coupleName.trim(), date, venue: venue.trim(),
      venueAddress: venueAddress.trim(), dresscode: dresscode.trim(),
      childrenAllowed: childrenAllowed??true, childrenNote: childrenNote.trim(),
      hotels: hotels.filter(h=>h.name.trim()).map(h=>({...h,rooms:h.rooms.filter(r=>r.type.trim())})),
      mealOptions,
      timeline: timeline.filter(t=>t.title.trim()),
      budget: budgetItems.filter(b=>b.description.trim()),
      vendors: vendors.filter(v=>v.name.trim()).map(v=>({...v,id:v.id||uid()})),
      // When editing, preserve existing guests; when first setup add new ones
      guests: isEdit
        ? base.guests
        : guestList.filter(g=>g.name.trim()&&g.email.trim()).map(g=>({
            id:uid(), name:g.name.trim(), email:g.email.trim(),
            token:'tok-'+uid(), status:'angelegt' as const,
            begleitpersonen:[], allergies:[],
          })),
      onboardingComplete: true,
    }
    saveEvent(ev)
    if (isEdit) {
      router.push('/dashboard')
    } else {
      setShowAnimation(true)
      setTimeout(() => setAnimFadeOut(true), 3200)
      setTimeout(() => router.push('/dashboard'), 3800)
    }
  }

  const next = () => {
    if(!canNext()){setToast('Bitte alle Pflichtfelder ausfüllen');return}
    if(step===STEPS.length){finish();return}
    setStep(s=>s+1)
  }

  return (
    <div style={{background:'var(--bg)',minHeight:'100dvh',paddingBottom:40}}>
      {/* Header */}
      <div style={{background:'var(--surface)',borderBottom:'1px solid var(--border)',padding:'16px 20px',paddingTop:'calc(16px + env(safe-area-inset-top))',position:'sticky',top:0,zIndex:10}}>
        <div style={{maxWidth:600,margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontFamily:"'DM Serif Display',serif",fontSize:18,color:'var(--gold)'}}>Velvet.</span>
              {isEdit&&(
                <span style={{fontSize:12,color:'var(--text-dim)'}}>Hochzeit bearbeiten</span>
              )}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:11,color:'var(--text-dim)'}}>{step} / {STEPS.length} — {STEPS[step-1].label}</span>
              {isEdit&&(
                <button onClick={()=>router.push('/dashboard')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-dim)',padding:2,display:'flex',alignItems:'center'}}>
                  <X size={16}/>
                </button>
              )}
            </div>
          </div>
          <div style={{display:'flex',gap:5}}>
            {STEPS.map(s=>(
              <div key={s.id} style={{flex:1,height:3,borderRadius:2,background:s.id<=step?'var(--gold)':'var(--border)',transition:'background 0.3s'}}/>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:600,margin:'0 auto',padding:'24px 20px'}}>

        {/* STEP 1 */}
        {step===1&&(
          <div style={{animation:'fadeUp 0.4s ease'}}>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:400,color:'var(--text)',marginBottom:6}}>
              {isEdit ? 'Basisdaten bearbeiten' : 'Willkommen bei Velvet'}
            </h2>
            <p style={{fontSize:14,color:'var(--text-light)',marginBottom:24,lineHeight:1.6}}>
              {isEdit
                ? 'Ändere den Namen des Brautpaars oder das Datum eurer Hochzeit.'
                : 'Lass uns euren großen Tag einrichten. Diese Angaben bilden die Grundlage eurer gesamten Planung.'}
            </p>
            <Block>
              <Lbl req>Name des Brautpaars</Lbl>
              <input value={coupleName} onChange={e=>setCoupleName(e.target.value)} placeholder="z.B. Julia & Thomas" style={{...IS,marginBottom:14}} onFocus={focusGold} onBlur={blurBorder}/>
              <Lbl req>Datum der Hochzeit</Lbl>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={IS} onFocus={focusGold} onBlur={blurBorder}/>
            </Block>
          </div>
        )}

        {/* STEP 2 */}
        {step===2&&(
          <div style={{animation:'fadeUp 0.4s ease'}}>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:400,color:'var(--text)',marginBottom:24}}>Ort & Dresscode</h2>
            <Block>
              <Lbl req>Name der Location</Lbl>
              <input value={venue} onChange={e=>setVenue(e.target.value)} placeholder="z.B. Schloss Neuhof" style={{...IS,marginBottom:14}} onFocus={focusGold} onBlur={blurBorder}/>
              <Lbl>Adresse der Location</Lbl>
              <input value={venueAddress} onChange={e=>setVenueAddress(e.target.value)} placeholder="Straße, PLZ, Ort" style={{...IS,marginBottom:14}} onFocus={focusGold} onBlur={blurBorder}/>
              <Lbl>Dresscode</Lbl>
              <input value={dresscode} onChange={e=>setDresscode(e.target.value)} placeholder="z.B. Festlich · Gartenparty" style={IS} onFocus={focusGold} onBlur={blurBorder}/>
            </Block>
          </div>
        )}

        {/* STEP 3 */}
        {step===3&&(
          <div style={{animation:'fadeUp 0.4s ease'}}>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:400,color:'var(--text)',marginBottom:24}}>Kinder & erste Gäste</h2>
            <Block>
              <SecTitle>Sind Kinder willkommen?</SecTitle>
              <SecSub>Diese Information erscheint auf den Einladungen deiner Gäste.</SecSub>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
                {[{v:true,l:'Ja, Kinder willkommen'},{v:false,l:'Nein, nur Erwachsene'}].map(opt=>(
                  <button key={String(opt.v)} onClick={()=>setChildrenAllowed(opt.v)} data-sel={childrenAllowed===opt.v?'':undefined} style={{padding:'14px 12px',borderRadius:12,fontFamily:'inherit',border:`1.5px solid ${childrenAllowed===opt.v?'var(--gold)':'var(--border)'}`,background:childrenAllowed===opt.v?'var(--gold-pale)':'var(--bg)',color:childrenAllowed===opt.v?'var(--gold)':'var(--text-mid)',fontSize:13,fontWeight:600,cursor:'pointer',textAlign:'left'}}>
                    {opt.l}
                  </button>
                ))}
              </div>
              {childrenAllowed&&(
                <>
                  <Lbl>Hinweis auf der Einladung</Lbl>
                  <input value={childrenNote} onChange={e=>setChildrenNote(e.target.value)} placeholder="z.B. Kinder ab 6 Jahren willkommen" style={IS} onFocus={focusGold} onBlur={blurBorder}/>
                </>
              )}
            </Block>
            {!isEdit&&(
              <Block mb={0}>
                <SecTitle>Erste Gäste einladen</SecTitle>
                <SecSub>Optional — Gäste können auch später im Dashboard hinzugefügt werden.</SecSub>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {guestList.map((g,i)=>(
                    <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:8,alignItems:'center'}}>
                      <input value={g.name} onChange={e=>{const a=[...guestList];a[i]={...a[i],name:e.target.value};setGuestList(a)}} placeholder="Name" style={{...IS,marginBottom:0}} onFocus={focusGold} onBlur={blurBorder}/>
                      <input value={g.email} onChange={e=>{const a=[...guestList];a[i]={...a[i],email:e.target.value};setGuestList(a)}} placeholder="E-Mail" type="email" style={{...IS,marginBottom:0}} onFocus={focusGold} onBlur={blurBorder}/>
                      {guestList.length>1&&<button onClick={()=>setGuestList(guestList.filter((_,j)=>j!==i))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-dim)',padding:4}}><Trash2 size={14}/></button>}
                    </div>
                  ))}
                  <button onClick={()=>setGuestList([...guestList,{name:'',email:''}])} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:100,border:'1px dashed var(--border)',background:'none',fontSize:12,fontWeight:600,color:'var(--text-dim)',cursor:'pointer',fontFamily:'inherit',alignSelf:'flex-start'}}>
                    <Plus size={12}/> Gast hinzufügen
                  </button>
                </div>
              </Block>
            )}
            {isEdit&&(
              <Block mb={0}>
                <SecTitle>Gäste verwalten</SecTitle>
                <SecSub>Gäste können direkt im Dashboard hinzugefügt, bearbeitet und entfernt werden.</SecSub>
              </Block>
            )}
          </div>
        )}

        {/* STEP 4 */}
        {step===4&&(
          <div style={{animation:'fadeUp 0.4s ease'}}>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:400,color:'var(--text)',marginBottom:6}}>Hotels & Zimmerkontingent</h2>
            <p style={{fontSize:13,color:'var(--text-light)',marginBottom:20,lineHeight:1.5}}>Mehrere Hotels möglich — jedes mit eigenem Zimmerkontingent.</p>
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {hotels.map((hotel,hi)=>(
                <Block key={hotel.id} mb={0}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                    <p style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:500,color:'var(--text)'}}>Hotel {hi+1}</p>
                    {hotels.length>1&&<button onClick={()=>setHotels(hotels.filter((_,j)=>j!==hi))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-dim)',display:'flex',gap:4,alignItems:'center',fontSize:11,fontFamily:'inherit'}}><Trash2 size={12}/> Entfernen</button>}
                  </div>
                  <Lbl>Name des Hotels</Lbl>
                  <input value={hotel.name} onChange={e=>{const a=[...hotels];a[hi]={...a[hi],name:e.target.value};setHotels(a)}} placeholder="z.B. Schlosshotel Neuhof" style={{...IS,marginBottom:14}} onFocus={focusGold} onBlur={blurBorder}/>
                  <Lbl>Adresse</Lbl>
                  <input value={hotel.address} onChange={e=>{const a=[...hotels];a[hi]={...a[hi],address:e.target.value};setHotels(a)}} placeholder="Straße, PLZ, Ort" style={{...IS,marginBottom:16}} onFocus={focusGold} onBlur={blurBorder}/>
                  <SecTitle>Zimmerkontingent</SecTitle>
                  <SecSub>Welche Zimmer können Gäste buchen?</SecSub>
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    {hotel.rooms.map((room,ri)=>(
                      <div key={room.id} style={{background:'var(--bg)',borderRadius:12,padding:'14px'}}>
                        <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:10}}>
                          <input value={room.type} onChange={e=>{const a=[...hotels];a[hi]={...a[hi],rooms:a[hi].rooms.map((r,j)=>j===ri?{...r,type:e.target.value}:r)};setHotels(a)}} placeholder="Zimmertyp (z.B. Doppelzimmer)" style={{...IS,marginBottom:0,flex:1}} onFocus={focusGold} onBlur={blurBorder}/>
                          {hotel.rooms.length>1&&<button onClick={()=>{const a=[...hotels];a[hi]={...a[hi],rooms:a[hi].rooms.filter((_,j)=>j!==ri)};setHotels(a)}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-dim)',padding:4}}><Trash2 size={14}/></button>}
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                          <div><Lbl>Anzahl Zimmer</Lbl><input type="number" value={room.totalRooms} onChange={e=>{const a=[...hotels];a[hi]={...a[hi],rooms:a[hi].rooms.map((r,j)=>j===ri?{...r,totalRooms:Number(e.target.value)}:r)};setHotels(a)}} style={{...IS,marginBottom:0}} onFocus={focusGold} onBlur={blurBorder}/></div>
                          <div><Lbl>Preis / Nacht (€)</Lbl><input type="number" value={room.pricePerNight} onChange={e=>{const a=[...hotels];a[hi]={...a[hi],rooms:a[hi].rooms.map((r,j)=>j===ri?{...r,pricePerNight:Number(e.target.value)}:r)};setHotels(a)}} style={{...IS,marginBottom:0}} onFocus={focusGold} onBlur={blurBorder}/></div>
                        </div>
                      </div>
                    ))}
                    <button onClick={()=>{const a=[...hotels];a[hi]={...a[hi],rooms:[...a[hi].rooms,{id:uid(),type:'',totalRooms:0,bookedRooms:0,pricePerNight:0}]};setHotels(a)}} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:100,border:'1px dashed var(--border)',background:'none',fontSize:12,fontWeight:600,color:'var(--text-dim)',cursor:'pointer',fontFamily:'inherit',alignSelf:'flex-start'}}>
                      <Plus size={12}/> Zimmertyp hinzufügen
                    </button>
                  </div>
                </Block>
              ))}
              <button onClick={()=>setHotels([...hotels,{id:uid(),name:'',address:'',rooms:[{id:uid(),type:'',totalRooms:0,bookedRooms:0,pricePerNight:0}]}])} style={{display:'flex',alignItems:'center',gap:6,padding:'10px 18px',borderRadius:100,border:'1px dashed var(--border)',background:'none',fontSize:12,fontWeight:600,color:'var(--text-dim)',cursor:'pointer',fontFamily:'inherit',alignSelf:'flex-start'}}>
                <Plus size={12}/> Hotel hinzufügen
              </button>
            </div>
          </div>
        )}

        {/* STEP 5 */}
        {step===5&&(
          <div style={{animation:'fadeUp 0.4s ease'}}>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:400,color:'var(--text)',marginBottom:24}}>Menüoptionen</h2>
            <Block mb={0}>
              <SecTitle>Welche Optionen bietet ihr an?</SecTitle>
              <SecSub>Gäste können bei ihrem RSVP aus diesen Optionen wählen.</SecSub>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {MEAL_OPTIONS.map(opt=>{
                  const active=mealOptions.includes(opt.value)
                  return (
                    <button key={opt.value} onClick={()=>setMealOptions(active?mealOptions.filter(m=>m!==opt.value):[...mealOptions,opt.value])} style={{padding:'16px 14px',borderRadius:12,fontFamily:'inherit',border:`1.5px solid ${active?'var(--gold)':'var(--border)'}`,background:active?'var(--gold-pale)':'var(--bg)',color:active?'var(--gold)':'var(--text-mid)',fontSize:14,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      {opt.label}
                      {active&&<Check size={16} color="var(--gold)"/>}
                    </button>
                  )
                })}
              </div>
            </Block>
          </div>
        )}

        {/* STEP 6 */}
        {step===6&&(
          <div style={{animation:'fadeUp 0.4s ease'}}>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:400,color:'var(--text)',marginBottom:24}}>Ablauf & Budget</h2>
            <Block>
              <SecTitle>Ablaufplan</SecTitle>
              <SecSub>Zeitplan für euren Hochzeitstag — jederzeit im Dashboard anpassbar.</SecSub>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {timeline.map((entry,i)=>(
                  <div key={i} style={{display:'grid',gridTemplateColumns:'76px 1fr 1fr auto',gap:8,alignItems:'center'}}>
                    <input value={entry.time} onChange={e=>{const a=[...timeline];a[i]={...a[i],time:e.target.value};setTimeline(a)}} placeholder="Zeit" style={{...IS,marginBottom:0}} onFocus={focusGold} onBlur={blurBorder}/>
                    <input value={entry.title} onChange={e=>{const a=[...timeline];a[i]={...a[i],title:e.target.value};setTimeline(a)}} placeholder="Titel" style={{...IS,marginBottom:0}} onFocus={focusGold} onBlur={blurBorder}/>
                    <input value={entry.location} onChange={e=>{const a=[...timeline];a[i]={...a[i],location:e.target.value};setTimeline(a)}} placeholder="Ort" style={{...IS,marginBottom:0}} onFocus={focusGold} onBlur={blurBorder}/>
                    {timeline.length>1&&<button onClick={()=>setTimeline(timeline.filter((_,j)=>j!==i))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-dim)',padding:4}}><Trash2 size={14}/></button>}
                  </div>
                ))}
                <button onClick={()=>setTimeline([...timeline,{time:'',title:'',location:''}])} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:100,border:'1px dashed var(--border)',background:'none',fontSize:12,fontWeight:600,color:'var(--text-dim)',cursor:'pointer',fontFamily:'inherit',alignSelf:'flex-start'}}>
                  <Plus size={12}/> Eintrag hinzufügen
                </button>
              </div>
            </Block>
            <Block mb={0}>
              <SecTitle>Budgetpositionen</SecTitle>
              <SecSub>Plane deine Ausgaben — jederzeit erweiterbar.</SecSub>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {budgetItems.map((item,i)=>(
                  <div key={item.id} style={{background:'var(--bg)',borderRadius:10,padding:'14px'}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                      <div>
                        <Lbl>Kategorie</Lbl>
                        <select value={item.category} onChange={e=>{const a=[...budgetItems];a[i]={...a[i],category:e.target.value as BudgetCategory};setBudgetItems(a)}} style={{...IS,marginBottom:0,appearance:'none'}} onFocus={focusGold} onBlur={blurBorder}>
                          {BUDGET_CATS.map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <Lbl>Betrag geplant (€)</Lbl>
                        <input type="number" value={item.planned||''} onChange={e=>{const a=[...budgetItems];a[i]={...a[i],planned:Number(e.target.value)};setBudgetItems(a)}} placeholder="0" style={{...IS,marginBottom:0}} onFocus={focusGold} onBlur={blurBorder}/>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <input value={item.description} onChange={e=>{const a=[...budgetItems];a[i]={...a[i],description:e.target.value};setBudgetItems(a)}} placeholder="Beschreibung" style={{...IS,marginBottom:0,flex:1}} onFocus={focusGold} onBlur={blurBorder}/>
                      {budgetItems.length>1&&<button onClick={()=>setBudgetItems(budgetItems.filter((_,j)=>j!==i))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-dim)',padding:4}}><Trash2 size={14}/></button>}
                    </div>
                  </div>
                ))}
                <button onClick={()=>setBudgetItems([...budgetItems,{id:uid(),category:'Sonstiges',description:'',planned:0,actual:0,status:'offen'}])} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:100,border:'1px dashed var(--border)',background:'none',fontSize:12,fontWeight:600,color:'var(--text-dim)',cursor:'pointer',fontFamily:'inherit',alignSelf:'flex-start'}}>
                  <Plus size={12}/> Position hinzufügen
                </button>
              </div>
            </Block>
          </div>
        )}

        {/* STEP 7 */}
        {step===7&&(
          <div style={{animation:'fadeUp 0.4s ease'}}>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:400,color:'var(--text)',marginBottom:8}}>Dienstleister</h2>
            <p style={{fontSize:13,color:'var(--text-light)',marginBottom:24}}>Optional — jederzeit im Dashboard erweiterbar und bearbeitbar.</p>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {vendors.map((v,i)=>(
                <Block key={v.id} mb={0}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                    <p style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:500,color:'var(--text)'}}>Dienstleister {i+1}</p>
                    {vendors.length>1&&<button onClick={()=>setVendors(vendors.filter((_,j)=>j!==i))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-dim)',display:'flex',gap:4,alignItems:'center',fontSize:11,fontFamily:'inherit'}}><Trash2 size={12}/> Entfernen</button>}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                    <div><Lbl req>Name</Lbl><input value={v.name} onChange={e=>{const a=[...vendors];a[i]={...a[i],name:e.target.value};setVendors(a)}} placeholder="Firmenname" style={{...IS,marginBottom:0}} onFocus={focusGold} onBlur={blurBorder}/></div>
                    <div><Lbl>Kategorie</Lbl><select value={v.category} onChange={e=>{const a=[...vendors];a[i]={...a[i],category:e.target.value as VendorCategory};setVendors(a)}} style={{...IS,marginBottom:0,appearance:'none'}} onFocus={focusGold} onBlur={blurBorder}>{VENDOR_CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                    <div><Lbl>Ansprechpartner</Lbl><input value={v.contactName??''} onChange={e=>{const a=[...vendors];a[i]={...a[i],contactName:e.target.value};setVendors(a)}} placeholder="Vorname Nachname" style={{...IS,marginBottom:0}} onFocus={focusGold} onBlur={blurBorder}/></div>
                    <div><Lbl>Telefon</Lbl><input value={v.phone??''} onChange={e=>{const a=[...vendors];a[i]={...a[i],phone:e.target.value};setVendors(a)}} placeholder="0171 …" style={{...IS,marginBottom:0}} onFocus={focusGold} onBlur={blurBorder}/></div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                    <div><Lbl>E-Mail</Lbl><input type="email" value={v.email??''} onChange={e=>{const a=[...vendors];a[i]={...a[i],email:e.target.value};setVendors(a)}} placeholder="info@…" style={{...IS,marginBottom:0}} onFocus={focusGold} onBlur={blurBorder}/></div>
                    <div><Lbl>Kosten (€)</Lbl><input type="number" value={v.price??''} onChange={e=>{const a=[...vendors];a[i]={...a[i],price:Number(e.target.value)||undefined};setVendors(a)}} placeholder="0" style={{...IS,marginBottom:0}} onFocus={focusGold} onBlur={blurBorder}/></div>
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    {(['angefragt','bestätigt','abgesagt'] as VendorStatus[]).map(s=>(
                      <button key={s} onClick={()=>{const a=[...vendors];a[i]={...a[i],status:s};setVendors(a)}} data-sel={v.status===s?'':undefined} style={{flex:1,padding:'6px 4px',borderRadius:100,fontFamily:'inherit',border:`1.5px solid ${v.status===s?'var(--gold)':'var(--border)'}`,background:v.status===s?'var(--gold-pale)':'none',color:v.status===s?'var(--gold)':'var(--text-dim)',fontSize:10,fontWeight:700,cursor:'pointer'}}>
                        {s.charAt(0).toUpperCase()+s.slice(1)}
                      </button>
                    ))}
                  </div>
                </Block>
              ))}
              <button onClick={()=>setVendors([...vendors,{id:uid(),name:'',category:'Sonstiges',status:'angefragt',contactName:'',phone:'',email:'',price:undefined}])} style={{display:'flex',alignItems:'center',gap:6,padding:'10px 18px',borderRadius:100,border:'1px dashed var(--border)',background:'none',fontSize:12,fontWeight:600,color:'var(--text-dim)',cursor:'pointer',fontFamily:'inherit',alignSelf:'flex-start'}}>
                <Plus size={12}/> Dienstleister hinzufügen
              </button>
            </div>
          </div>
        )}

        {/* Nav */}
        <div style={{display:'flex',gap:12,marginTop:32,justifyContent:'space-between'}}>
          {step>1?(
            <button onClick={()=>setStep(s=>s-1)} style={{display:'flex',alignItems:'center',gap:6,padding:'12px 20px',borderRadius:100,border:'1px solid var(--border)',background:'none',fontSize:13,fontWeight:600,color:'var(--text-dim)',cursor:'pointer',fontFamily:'inherit'}}>
              <ChevronLeft size={15}/> Zurück
            </button>
          ):<div/>}
          <button onClick={next} style={{display:'flex',alignItems:'center',gap:6,padding:'12px 24px',borderRadius:100,border:'none',background:canNext()?'var(--gold)':'var(--border)',color:canNext()?'#FFFFFF':'var(--text-dim)',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',transition:'background 0.2s'}}>
            {step===STEPS.length
              ? isEdit
                ? (<><Check size={15}/> Speichern</>)
                : (<><Check size={15}/> Starten</>)
              : (<>Weiter <ChevronRight size={15}/></>)
            }
          </button>
        </div>
      </div>

      {toast&&<Toast message={toast} onClose={()=>setToast(null)}/>}

      {showAnimation&&(
        <div
          onAnimationEnd={(e)=>{ if(animFadeOut && e.target===e.currentTarget) setShowAnimation(false) }}
          style={{
            position:'fixed',inset:0,zIndex:9999,
            background:'rgba(8,4,18,0.97)',
            display:'flex',alignItems:'center',justifyContent:'center',
            flexDirection:'column',
            animation:animFadeOut?'overlayFadeOut 0.6s ease forwards':'overlayFadeIn 0.5s ease',
            overflow:'hidden',
            pointerEvents:animFadeOut?'none':'auto',
          }}>
          {PETALS.map((p,i)=>(
            <span key={i} style={{
              position:'absolute',
              left:p.x+'%',
              top:'-30px',
              fontSize:p.size,
              animation:`petalFall ${p.dur}s ${p.delay}s linear infinite`,
              pointerEvents:'none',
              userSelect:'none',
            }}>{p.emoji}</span>
          ))}
          <div style={{
            textAlign:'center',
            animation:'heroIn 0.9s 0.2s cubic-bezier(0.34,1.56,0.64,1) both',
            position:'relative',zIndex:2,
          }}>
            <div style={{fontSize:72,marginBottom:20,lineHeight:1}}>💍</div>
            <div style={{fontFamily:"'DM Serif Display',serif",fontSize:44,color:'var(--gold)',marginBottom:10,letterSpacing:'-0.5px'}}>
              Velvet.
            </div>
            <p style={{fontSize:18,color:'rgba(255,255,255,0.85)',fontWeight:400,letterSpacing:'0.02em'}}>
              Eure Hochzeit ist bereit.
            </p>
            <p style={{fontSize:13,color:'rgba(255,255,255,0.4)',marginTop:8}}>
              Willkommen auf eurem Dashboard
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{transform:translate(-50%,16px);opacity:0}to{transform:translate(-50%,0);opacity:1}}
        @keyframes overlayFadeIn{from{opacity:0}to{opacity:1}}
        @keyframes overlayFadeOut{from{opacity:1}to{opacity:0}}
        @keyframes petalFall{
          0%{transform:translateY(0) rotate(0deg) scale(1);opacity:0.9}
          10%{opacity:1}
          90%{opacity:0.6}
          100%{transform:translateY(110vh) rotate(400deg) scale(0.6);opacity:0}
        }
        @keyframes heroIn{
          from{opacity:0;transform:scale(0.6) translateY(20px)}
          to{opacity:1;transform:scale(1) translateY(0)}
        }
      `}</style>
    </div>
  )
}
