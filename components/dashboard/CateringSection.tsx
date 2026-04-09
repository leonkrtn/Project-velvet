'use client'
import React from 'react'
import { Card, SectionTitle } from '@/components/ui'
import { getStats, type CateringPlan, type Event } from '@/lib/store'

type Stats = ReturnType<typeof getStats>

const MEAL_LABELS: Record<string,string> = { fleisch:'Fleisch', fisch:'Fisch', vegetarisch:'Vegetarisch', vegan:'Vegan' }
const SERVICE_LABELS: Record<string,string> = {
  klassisch:'Klassisches Menü', buffet:'Buffet', family:'Family Style', foodtruck:'Food Trucks', live:'Live-Cooking',
}

function SR({label, value}: {label: string; value: string}) {
  return (
    <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'7px 0', borderBottom:'1px solid var(--border)'}}>
      <span style={{fontSize:11, color:'var(--text-dim)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', flexShrink:0}}>{label}</span>
      <span style={{fontSize:13, color:'var(--text)', textAlign:'right', marginLeft:12}}>{value}</span>
    </div>
  )
}

export function CateringToggle({value, onChange, label}: {value: boolean; onChange: (v: boolean) => void; label: string}) {
  return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border)'}}>
      <span style={{fontSize:13, fontWeight:500, color:'var(--text)'}}>{label}</span>
      <button onClick={()=>onChange(!value)} style={{width:40, height:22, borderRadius:11, border:'none', background:value?'var(--gold)':'var(--border)', position:'relative', cursor:'pointer', flexShrink:0, transition:'background 0.2s'}}>
        <span style={{position:'absolute', top:2, left:value?20:2, width:18, height:18, borderRadius:'50%', background:'var(--surface)', transition:'left 0.2s', boxShadow:'0 1px 2px rgba(0,0,0,0.15)'}}/>
      </button>
    </div>
  )
}

export function CateringForm({catering, onChange}: {catering: CateringPlan; onChange: (p: Partial<CateringPlan>) => void}) {
  const drinkOpts = [['wein','Wein'],['bier','Bier'],['softdrinks','Softdrinks'],['cocktails','Cocktailbar'],['longdrinks','Longdrinks']]
  const equipOpts = [['geschirr','Geschirr & Besteck'],['glaeser','Gläser'],['tischdecken','Tischdecken'],['buffettische','Buffet-Tische'],['deko','Dekoration']]
  const toggleArr = (key: 'drinksSelection'|'equipmentNeeded', val: string) => {
    const arr = catering[key]
    onChange({[key]: arr.includes(val)?arr.filter(x=>x!==val):[...arr,val]})
  }
  return (
    <div style={{display:'flex', flexDirection:'column', gap:10}}>
      <Card>
        <SectionTitle>Art der Verpflegung</SectionTitle>
        <p style={{fontSize:13, fontWeight:500, color:'var(--text)', marginBottom:8}}>Servicestil</p>
        <div style={{display:'flex', flexWrap:'wrap', gap:6, marginBottom:12}}>
          {[['klassisch','Klassisches Menü'],['buffet','Buffet'],['family','Family Style'],['foodtruck','Food Trucks'],['live','Live-Cooking']].map(([v,l])=>(
            <button key={v} onClick={()=>onChange({serviceStyle:v as CateringPlan['serviceStyle']})} style={{padding:'6px 12px', borderRadius:100, border:'1px solid', borderColor:catering.serviceStyle===v?'var(--gold)':'var(--border)', background:catering.serviceStyle===v?'rgba(201,168,76,0.08)':'none', color:catering.serviceStyle===v?'var(--gold)':'var(--text)', fontSize:12, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s'}}>{l}</button>
          ))}
        </div>
        <CateringToggle value={catering.locationHasKitchen} onChange={v=>onChange({locationHasKitchen:v})} label="Location hat eigene Küche"/>
        <CateringToggle value={catering.midnightSnack} onChange={v=>onChange({midnightSnack:v})} label="Mitternachtssnack"/>
        {catering.midnightSnack&&(
          <input value={catering.midnightSnackNote} onChange={e=>onChange({midnightSnackNote:e.target.value})} placeholder="Was soll es geben?" style={{width:'100%', padding:'9px 12px', borderRadius:'var(--r-sm)', border:'1px solid var(--border)', background:'#FFFFFF', fontSize:13, fontFamily:'inherit', color:'var(--text)', outline:'none', boxSizing:'border-box', marginTop:4, marginBottom:6}}/>
        )}
      </Card>

      <Card>
        <SectionTitle>Getränke</SectionTitle>
        <p style={{fontSize:13, fontWeight:500, color:'var(--text)', marginBottom:8}}>Abrechnung</p>
        <div style={{display:'flex', gap:8, marginBottom:12}}>
          {[['pauschale','Pauschale'],['einzeln','Einzeln']].map(([v,l])=>(
            <button key={v} onClick={()=>onChange({drinksBilling:v as 'pauschale'|'einzeln'})} style={{flex:1, padding:'9px', borderRadius:'var(--r-sm)', border:'1px solid', borderColor:catering.drinksBilling===v?'var(--gold)':'var(--border)', background:catering.drinksBilling===v?'rgba(201,168,76,0.08)':'none', color:catering.drinksBilling===v?'var(--gold)':'var(--text)', fontSize:12, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s'}}>{l}</button>
          ))}
        </div>
        <p style={{fontSize:13, fontWeight:500, color:'var(--text)', marginBottom:6}}>Sortiment</p>
        <div style={{display:'flex', flexWrap:'wrap', gap:6, marginBottom:12}}>
          {drinkOpts.map(([v,l])=>{
            const active=catering.drinksSelection.includes(v)
            return <button key={v} onClick={()=>toggleArr('drinksSelection',v)} style={{padding:'6px 12px', borderRadius:100, border:'1px solid', borderColor:active?'var(--gold)':'var(--border)', background:active?'rgba(201,168,76,0.08)':'none', color:active?'var(--gold)':'var(--text)', fontSize:12, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s'}}>{l}</button>
          })}
        </div>
        <CateringToggle value={catering.champagneFingerFood} onChange={v=>onChange({champagneFingerFood:v})} label="Häppchen zum Sektempfang"/>
        {catering.champagneFingerFood&&(
          <input value={catering.champagneFingerFoodNote} onChange={e=>onChange({champagneFingerFoodNote:e.target.value})} placeholder="Welche Häppchen?" style={{width:'100%', padding:'9px 12px', borderRadius:'var(--r-sm)', border:'1px solid var(--border)', background:'#FFFFFF', fontSize:13, fontFamily:'inherit', color:'var(--text)', outline:'none', boxSizing:'border-box', marginTop:4, marginBottom:6}}/>
        )}
      </Card>

      <Card>
        <SectionTitle>Personal & Equipment</SectionTitle>
        <CateringToggle value={catering.serviceStaff} onChange={v=>onChange({serviceStaff:v})} label="Servicepersonal benötigt"/>
        <p style={{fontSize:13, fontWeight:500, color:'var(--text)', marginTop:10, marginBottom:6}}>Equipment vom Caterer</p>
        <div style={{display:'flex', flexWrap:'wrap', gap:6, marginBottom:6}}>
          {equipOpts.map(([v,l])=>{
            const active=catering.equipmentNeeded.includes(v)
            return <button key={v} onClick={()=>toggleArr('equipmentNeeded',v)} style={{padding:'6px 12px', borderRadius:100, border:'1px solid', borderColor:active?'var(--gold)':'var(--border)', background:active?'rgba(201,168,76,0.08)':'none', color:active?'var(--gold)':'var(--text)', fontSize:12, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s'}}>{l}</button>
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle>Budget</SectionTitle>
        <p style={{fontSize:13, fontWeight:500, color:'var(--text)', marginBottom:8}}>Budget pro Person (€)</p>
        <input type="number" min={0} value={catering.budgetPerPerson||''} onChange={e=>onChange({budgetPerPerson:Number(e.target.value)})} placeholder="z.B. 120" style={{width:'100%', padding:'9px 12px', borderRadius:'var(--r-sm)', border:'1px solid var(--border)', background:'#FFFFFF', fontSize:13, fontFamily:'inherit', color:'var(--text)', outline:'none', boxSizing:'border-box', marginBottom:6}}/>
        <CateringToggle value={catering.budgetIncludesDrinks} onChange={v=>onChange({budgetIncludesDrinks:v})} label="Getränke inklusive"/>
        <p style={{fontSize:13, fontWeight:500, color:'var(--text)', marginTop:10, marginBottom:6}}>Notizen für den Caterer</p>
        <textarea value={catering.cateringNotes} onChange={e=>onChange({cateringNotes:e.target.value})} placeholder="Besondere Wünsche, offene Fragen …" rows={3} style={{width:'100%', padding:'9px 12px', borderRadius:'var(--r-sm)', border:'1px solid var(--border)', background:'#FFFFFF', fontSize:13, fontFamily:'inherit', color:'var(--text)', outline:'none', resize:'vertical', boxSizing:'border-box'}}/>
      </Card>
    </div>
  )
}

export function CateringSummary({event, catering, stats}: {event: Event; catering: CateringPlan; stats: Stats}) {
  const sektEntry = event.timeline.find(t=>t.title.toLowerCase().includes('sekt'))
  const menuEntry = event.timeline.find(t=>t.title.toLowerCase().includes('menü')||t.title.toLowerCase().includes('dinner')||t.title.toLowerCase().includes('essen'))
  const totalBudget = catering.budgetPerPerson>0 ? catering.budgetPerPerson*stats.totalAttending : 0
  return (
    <div style={{display:'flex', flexDirection:'column', gap:10}}>
      <Card>
        <SectionTitle>Eckdaten</SectionTitle>
        <SR label="Datum" value={new Date(event.date).toLocaleDateString('de-DE',{day:'2-digit',month:'long',year:'numeric'})}/>
        <SR label="Location" value={event.venue}/>
        {sektEntry&&<SR label="Sektempfang" value={sektEntry.time+' Uhr'}/>}
        {menuEntry&&<SR label="Dinner" value={menuEntry.time+' Uhr'}/>}
        <SR label="Personen" value={`${stats.totalAttending} bestätigt`}/>
        {event.childrenAllowed&&<SR label="Kinder" value={event.childrenNote||'Willkommen'}/>}
      </Card>
      <Card>
        <SectionTitle>Speisenwahl</SectionTitle>
        {(Object.entries(stats.meals) as [string,number][]).filter(([,n])=>n>0).map(([k,n])=>(
          <SR key={k} label={MEAL_LABELS[k]??k} value={`${n}×`}/>
        ))}
        {Object.keys(stats.allergyCounts).length>0&&(
          <div style={{marginTop:8}}>
            <p style={{fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--text-dim)', marginBottom:6}}>Allergien</p>
            <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
              {Object.entries(stats.allergyCounts).map(([t,n])=>(
                <span key={t} style={{fontSize:11, padding:'3px 9px', borderRadius:100, background:'var(--gold-pale)', color:'var(--gold)', border:'1px solid rgba(201,168,76,0.2)'}}>{t} {n}×</span>
              ))}
            </div>
          </div>
        )}
      </Card>
      <Card>
        <SectionTitle>Catering-Details</SectionTitle>
        {catering.serviceStyle&&<SR label="Servicestil" value={SERVICE_LABELS[catering.serviceStyle]??catering.serviceStyle}/>}
        <SR label="Eigene Küche" value={catering.locationHasKitchen?'Ja':'Nein'}/>
        {catering.midnightSnack&&<SR label="Mitternachtssnack" value={catering.midnightSnackNote||'Ja'}/>}
        <SR label="Abrechnung" value={catering.drinksBilling==='pauschale'?'Getränkepauschale':'Einzelabrechnung'}/>
        {catering.drinksSelection.length>0&&<SR label="Getränke" value={catering.drinksSelection.join(', ')}/>}
        {catering.champagneFingerFood&&<SR label="Häppchen" value={catering.champagneFingerFoodNote||'Ja'}/>}
        <SR label="Servicepersonal" value={catering.serviceStaff?'Ja':'Nein'}/>
        {catering.equipmentNeeded.length>0&&<SR label="Equipment" value={catering.equipmentNeeded.join(', ')}/>}
      </Card>
      {catering.budgetPerPerson>0&&(
        <Card>
          <SectionTitle>Budget</SectionTitle>
          <SR label="Pro Person" value={`${catering.budgetPerPerson} €`}/>
          <SR label="Getränke inkl." value={catering.budgetIncludesDrinks?'Ja':'Nein'}/>
          <SR label="Gesamt (ca.)" value={totalBudget.toLocaleString('de-DE')+' €'}/>
        </Card>
      )}
      {catering.cateringNotes&&(
        <Card>
          <SectionTitle>Notizen</SectionTitle>
          <p style={{fontSize:13, color:'var(--text)', fontStyle:'italic'}}>„{catering.cateringNotes}"</p>
        </Card>
      )}
    </div>
  )
}
