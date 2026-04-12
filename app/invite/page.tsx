'use client'
import React, { useState, useEffect } from 'react'
import { type Event, type Guest } from '@/lib/store'
import { useEvent } from '@/lib/event-context'
import { PageShell, Card, SectionTitle, Toast, Button, Input } from '@/components/ui'
import { Mail, FileText, Phone, Copy, Check } from 'lucide-react'
import { useFeatureEnabled, FeatureDisabledScreen } from '@/components/FeatureGate'

export default function InvitePage() {
  const enabled = useFeatureEnabled('invite')
  const { event, updateEvent } = useEvent()
  const [mode,setMode]     = useState<'choose'|'letter'|'email'>('choose')
  const [selected,setSel]  = useState<Guest|null>(null)
  const [customMsg,setMsg] = useState('')
  const [toast,setToast]   = useState<string|null>(null)
  const [copied,setCopied] = useState(false)

  if(!event) return null
  if(!enabled) return <PageShell title="Einladen" back="/dashboard"><FeatureDisabledScreen /></PageShell>

  const base   = typeof window!=='undefined'?window.location.origin:'https://velvet.app'
  const rsvpUrl = (t:string) => `${base}/rsvp/${t}`
  const phone   = '1234 567 78910'

  const mailText = (g:Guest) =>
`Liebe/r ${g.name.split(' ')[0]},

wir laden dich herzlich zur Hochzeit von ${event.coupleName} ein!

Datum: ${new Date(event.date).toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
Ort: ${event.venue}, ${event.venueAddress}
Dresscode: ${event.dresscode}

Bitte melde dich über deinen persönlichen Link an:
${rsvpUrl(g.token)}

Dort kannst du Menü wählen, Allergien angeben und ein Hotelzimmer buchen.

Alternativ erreichst du uns telefonisch unter:
${phone}
${customMsg?`\n${customMsg}`:''}
Wir freuen uns sehr!
Herzliche Grüße,
${event.coupleName}`

  const copy = async (txt:string) => {
    try { await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(()=>setCopied(false),2000); setToast('Kopiert') } catch {}
  }

  const markAsInvited = (guestId: string) => {
    updateEvent({...event, guests: event.guests.map(g =>
      g.id === guestId && g.status === 'angelegt' ? {...g, status: 'eingeladen' as const} : g
    )})
  }

  const invitable = event.guests.filter(g => g.status === 'angelegt' || g.status === 'eingeladen')

  return (
    <PageShell title="Einladen" back="/dashboard">
      {mode==='choose'&&(
        <div style={{display:'flex',flexDirection:'column',gap:12,animation:'fadeUp 0.35s ease'}}>
          <div style={{marginBottom:4}}>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:400,color:'var(--text)',marginBottom:6}}>Gäste einladen</h2>
            <p style={{fontSize:13,color:'var(--text-dim)'}}>Wähle, wie du deine Gäste erreichen möchtest.</p>
          </div>

          <button onClick={()=>setMode('email')} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',padding:'18px',display:'flex',alignItems:'flex-start',gap:14,cursor:'pointer',textAlign:'left',fontFamily:'inherit',transition:'border-color 0.15s'}}>
            <div style={{width:40,height:40,borderRadius:10,background:'var(--gold-pale)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Mail size={18} color="var(--gold)"/></div>
            <div>
              <p style={{fontSize:14,fontWeight:600,color:'var(--text)',marginBottom:4}}>Per E-Mail einladen</p>
              <p style={{fontSize:12,color:'var(--text-dim)',lineHeight:1.55}}>Personalisierter Einladungstext mit RSVP-Link — direkt in Mail-App öffnen oder kopieren.</p>
            </div>
          </button>

          <button onClick={()=>setMode('letter')} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',padding:'18px',display:'flex',alignItems:'flex-start',gap:14,cursor:'pointer',textAlign:'left',fontFamily:'inherit'}}>
            <div style={{width:40,height:40,borderRadius:10,background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><FileText size={18} color="var(--text-light)"/></div>
            <div>
              <p style={{fontSize:14,fontWeight:600,color:'var(--text)',marginBottom:4}}>Brief / Druckvorlage</p>
              <p style={{fontSize:12,color:'var(--text-dim)',lineHeight:1.55}}>Elegante Briefvorlage mit RSVP-Link und Telefonnummer für persönliche Einladungen.</p>
            </div>
          </button>

          <Card>
            <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
              <div style={{width:38,height:38,borderRadius:10,background:'var(--gold-pale)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Phone size={16} color="var(--gold)"/></div>
              <div>
                <p style={{fontSize:13,fontWeight:600,color:'var(--text)',marginBottom:5}}>Telefonische Antwort</p>
                <p style={{fontSize:12,color:'var(--text-dim)',lineHeight:1.6,marginBottom:8}}>Ältere Gäste können auch telefonisch zu- oder absagen. Diese Nummer ist in jedem Einladungstext enthalten.</p>
                <p style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:500,color:'var(--gold)'}}>{phone}</p>
                <p style={{fontSize:10,color:'var(--text-dim)',marginTop:4}}>Dahinter wird eine KI gebaut, die Antworten automatisch entgegennimmt.</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {mode==='email'&&(
        <div style={{animation:'fadeUp 0.35s ease'}}>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:400,color:'var(--text)',marginBottom:6}}>E-Mail-Einladung</h2>
          <p style={{fontSize:12,color:'var(--text-dim)',marginBottom:20}}>Wähle einen Gast — der Text wird personalisiert.</p>

          <Card style={{marginBottom:12}}>
            <SectionTitle>Gast auswählen</SectionTitle>
            <div style={{display:'flex',flexDirection:'column',gap:7}}>
              {invitable.map(g=>(
                <button key={g.id} onClick={()=>setSel(g)} data-sel={selected?.id===g.id?'':undefined} style={{padding:'11px 14px',borderRadius:10,fontFamily:'inherit',border:`1.5px solid ${selected?.id===g.id?'var(--gold)':'var(--border)'}`,background:selected?.id===g.id?'var(--gold-pale)':'var(--bg)',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',transition:'all 0.15s'}}>
                  <div style={{textAlign:'left'}}>
                    <p style={{fontSize:13,fontWeight:600,color:selected?.id===g.id?'var(--gold)':'var(--white)'}}>{g.name}</p>
                    <p style={{fontSize:11,color:'var(--text-dim)'}}>{g.email||'Keine E-Mail'}</p>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                    {g.status==='eingeladen'&&<span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:100,background:'var(--green-pale)',color:'var(--green)'}}>Eingeladen</span>}
                    {selected?.id===g.id&&<Check size={15} color="var(--gold)"/>}
                  </div>
                </button>
              ))}
              {invitable.length===0&&<p style={{fontSize:13,color:'var(--text-dim)',fontStyle:'italic'}}>Keine neuen Gäste zum Einladen.</p>}
            </div>
          </Card>

          <Input label="Persönliche Ergänzung (optional)" value={customMsg} onChange={setMsg} placeholder="z.B. Wir freuen uns besonders auf dich!"/>

          {selected&&(
            <Card style={{marginBottom:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <SectionTitle>Vorschau</SectionTitle>
                <button onClick={()=>copy(mailText(selected))} style={{display:'flex',alignItems:'center',gap:5,background:'none',border:'1px solid var(--border)',borderRadius:100,padding:'4px 11px',fontSize:10,fontWeight:600,color:'var(--text-light)',cursor:'pointer',fontFamily:'inherit'}}>
                  {copied?<Check size={11}/>:<Copy size={11}/>}{copied?'Kopiert':'Kopieren'}
                </button>
              </div>
              <pre style={{fontFamily:'inherit',fontSize:11,color:'var(--text-light)',whiteSpace:'pre-wrap',lineHeight:1.7,background:'var(--bg)',borderRadius:8,padding:'14px',maxHeight:280,overflowY:'auto'}}>
                {mailText(selected)}
              </pre>
            </Card>
          )}

          {selected&&(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <a href={`mailto:${selected.email}?subject=${encodeURIComponent(`Einladung zur Hochzeit von ${event.coupleName}`)}&body=${encodeURIComponent(mailText(selected))}`} style={{textDecoration:'none'}} onClick={()=>markAsInvited(selected.id)}>
                <Button fullWidth size="lg" variant="gold"><Mail size={15}/> In Mail-App öffnen</Button>
              </a>
              <Button fullWidth variant="secondary" onClick={()=>{copy(mailText(selected));markAsInvited(selected.id)}}><Copy size={13}/> Text kopieren</Button>
            </div>
          )}
        </div>
      )}

      {mode==='letter'&&(
        <div style={{animation:'fadeUp 0.35s ease'}}>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:400,color:'var(--text)',marginBottom:6}}>Briefvorlage</h2>
          <p style={{fontSize:12,color:'var(--text-dim)',marginBottom:20}}>Wähle einen Gast für die personalisierte Vorlage.</p>
          <Card style={{marginBottom:12}}>
            <SectionTitle>Gast auswählen</SectionTitle>
            <div style={{display:'flex',flexDirection:'column',gap:7}}>
              {invitable.map(g=>(
                <button key={g.id} onClick={()=>setSel(g)} style={{padding:'11px 14px',borderRadius:10,fontFamily:'inherit',border:`1.5px solid ${selected?.id===g.id?'var(--gold)':'var(--border)'}`,background:selected?.id===g.id?'var(--gold-pale)':'var(--bg)',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}}>
                  <p style={{fontSize:13,fontWeight:600,color:selected?.id===g.id?'var(--gold)':'var(--white)'}}>{g.name}</p>
                  <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                    {g.status==='eingeladen'&&<span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:100,background:'var(--green-pale)',color:'var(--green)'}}>Eingeladen</span>}
                    {selected?.id===g.id&&<Check size={15} color="var(--gold)"/>}
                  </div>
                </button>
              ))}
              {invitable.length===0&&<p style={{fontSize:13,color:'var(--text-dim)',fontStyle:'italic'}}>Keine neuen Gäste zum Einladen.</p>}
            </div>
          </Card>

          {selected&&(
            <>
              {/* Letter preview - white on dark */}
              <div style={{background:'var(--white)',borderRadius:'var(--r-lg)',padding:'32px 28px',marginBottom:14}}>
                <div style={{textAlign:'center',borderBottom:'1px solid #E8E8E8',paddingBottom:20,marginBottom:24}}>
                  <p style={{fontSize:10,fontWeight:700,letterSpacing:'0.2em',textTransform:'uppercase',color:'#C9A84C',marginBottom:6}}>Velvet</p>
                  <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:400,color:'#0A0A0A',marginBottom:4}}>{event.coupleName}</h2>
                  <p style={{fontSize:12,color:'#6B6B6B'}}>{new Date(event.date).toLocaleDateString('de-DE',{day:'numeric',month:'long',year:'numeric'})}</p>
                </div>
                <p style={{fontFamily:"'Playfair Display',serif",fontSize:14,color:'#1C1C1C',marginBottom:14}}>Liebe/r {selected.name.split(' ')[0]},</p>
                <p style={{fontSize:13,color:'#3D3D4E',lineHeight:1.75,marginBottom:16}}>wir freuen uns von Herzen, dich zu unserem Hochzeitsfest einzuladen.</p>
                <div style={{background:'#F7F3EE',borderRadius:10,padding:'14px 16px',marginBottom:18}}>
                  {[['Datum',new Date(event.date).toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'})],['Ort',`${event.venue}, ${event.venueAddress}`],['Dresscode',event.dresscode],['Hotel',`${event.hotelName}`]].map(([k,v])=>(
                    <div key={k} style={{display:'flex',gap:10,marginBottom:8}}>
                      <span style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'#9A9A9A',minWidth:72,paddingTop:2}}>{k}</span>
                      <span style={{fontSize:12,color:'#3D3D4E'}}>{v}</span>
                    </div>
                  ))}
                </div>
                <p style={{fontSize:13,color:'#3D3D4E',lineHeight:1.7,marginBottom:14}}>Bitte melde dich über deinen persönlichen Link an:</p>
                <div style={{background:'#EAF2EE',borderRadius:10,padding:'12px 14px',marginBottom:18}}>
                  <p style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'#7C9E8A',marginBottom:5}}>Dein Link</p>
                  <p style={{fontSize:12,color:'#7C9E8A',wordBreak:'break-all'}}>{rsvpUrl(selected.token)}</p>
                </div>
                <div style={{borderTop:'1px solid #E8E8E8',paddingTop:14}}>
                  <p style={{fontSize:12,color:'#6B6B6B',lineHeight:1.7}}>Oder ruf uns an — wir nehmen deine Antwort gerne persönlich entgegen:</p>
                  <p style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:500,color:'#C9A84C',marginTop:6}}>{phone}</p>
                </div>
                <p style={{fontFamily:"'Playfair Display',serif",fontSize:14,color:'#1C1C1C',marginTop:24}}>Wir freuen uns auf dich!<br/><em>{event.coupleName}</em></p>
              </div>
              <Button fullWidth size="lg" variant="gold" onClick={()=>{window.print();markAsInvited(selected.id)}}><FileText size={15}/> Brief drucken</Button>
              <p style={{fontSize:10,color:'var(--text-dim)',textAlign:'center',marginTop:8}}>Öffnet den Druckdialog deines Browsers</p>
            </>
          )}
        </div>
      )}

      {toast&&<Toast message={toast} onClose={()=>setToast(null)}/>}
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes slideUp{from{transform:translate(-50%,16px);opacity:0}to{transform:translate(-50%,0);opacity:1}}`}</style>
    </PageShell>
  )
}
