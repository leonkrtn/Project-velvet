'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { Search, X, ChevronRight, Trash2, Plus } from 'lucide-react'
import { Avatar, Badge, Card } from '@/components/ui'
import { getStats, type Guest, type Event } from '@/lib/store'

type Stats = ReturnType<typeof getStats>

const MEAL_LABELS: Record<string,string> = {
  fleisch:'Fleisch', fisch:'Fisch', vegetarisch:'Vegetarisch', vegan:'Vegan',
}

function Chip({ children, gold, green }: { children: React.ReactNode; gold?: boolean; green?: boolean }) {
  return (
    <span style={{
      fontSize:10, fontWeight:600, padding:'3px 9px', borderRadius:100,
      background: gold ? 'var(--gold-pale)' : green ? 'var(--green-pale)' : 'var(--bg)',
      color: gold ? 'var(--gold)' : green ? 'var(--green)' : 'var(--text-dim)',
    }}>
      {children}
    </span>
  )
}

function GuestRow({ guest, isDeleting, onDeleteStart, onDeleteCancel, onDeleteConfirm }: {
  guest: Guest
  isDeleting: boolean
  onDeleteStart: () => void
  onDeleteCancel: () => void
  onDeleteConfirm: () => void
}) {
  return (
    <Card padding={13}>
      {isDeleting ? (
        <div style={{textAlign:'center'}}>
          <p style={{fontSize:13, color:'var(--text-mid)', marginBottom:12}}>
            <strong>{guest.name}</strong> wirklich entfernen?
          </p>
          <div style={{display:'flex', gap:8, justifyContent:'center'}}>
            <button onClick={onDeleteCancel} style={{padding:'8px 18px', borderRadius:100, border:'1px solid var(--border)', background:'none', fontSize:12, fontWeight:600, color:'var(--text-dim)', cursor:'pointer'}}>Abbrechen</button>
            <button onClick={onDeleteConfirm} style={{padding:'8px 18px', borderRadius:100, border:'none', background:'var(--red-pale)', color:'var(--red)', fontSize:12, fontWeight:600, cursor:'pointer'}}>Entfernen</button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{display:'flex', alignItems:'flex-start', gap:10}}>
            <Avatar name={guest.name}/>
            <div style={{flex:1, minWidth:0}}>
              <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                <span style={{fontSize:13, fontWeight:600, color:'var(--text)'}}>{guest.name}</span>
              </div>
              <p style={{fontSize:11, color:'var(--text-dim)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{guest.email}</p>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:6, flexShrink:0}}>
              <Badge variant={guest.status}/>
              <button onClick={onDeleteStart} style={{background:'none', border:'none', padding:4, cursor:'pointer', color:'var(--text-dim)', display:'flex'}}>
                <Trash2 size={14}/>
              </button>
            </div>
          </div>
          {guest.status === 'zugesagt' && (
            <div style={{display:'flex', flexWrap:'wrap', gap:5, paddingTop:10, marginTop:10, borderTop:'1px solid var(--border)'}}>
              {guest.meal && <Chip>{MEAL_LABELS[guest.meal]}</Chip>}
              {guest.allergies.map(a => <Chip key={a} gold>{a}</Chip>)}
              {guest.hotelRoomId && guest.hotelRoomId !== 'none' && <Chip green>Zimmer</Chip>}
              {guest.arrivalDate && <Chip>{new Date(guest.arrivalDate).toLocaleDateString('de-DE', {day:'numeric', month:'short'})}</Chip>}
            </div>
          )}
          {guest.message && (
            <p style={{fontSize:11, color:'var(--text-dim)', fontStyle:'italic', marginTop:10, paddingTop:10, borderTop:'1px solid var(--border)'}}>
              &bdquo;{guest.message}&ldquo;
            </p>
          )}
          {guest.status === 'angelegt' && (
            <Link href={`/rsvp/${guest.token}`} style={{display:'block', marginTop:10, padding:'7px 12px', background:'var(--gold-pale)', borderRadius:8, fontSize:11, fontWeight:600, color:'var(--gold)', textDecoration:'none', textAlign:'center', border:'1px solid rgba(201,168,76,0.2)'}}>
              RSVP-Link testen
            </Link>
          )}
        </div>
      )}
    </Card>
  )
}

export function GuestTabContent({ event, stats, search, setSearch, filteredGuests, del, setDel, deleteGuest }: {
  event: Event
  stats: Stats
  search: string
  setSearch: (s: string) => void
  filteredGuests: Guest[]
  del: string|null
  setDel: (id: string|null) => void
  deleteGuest: (id: string) => void
}) {
  const newCount = event.guests.filter(g => g.status === 'angelegt').length

  return (
    <div style={{animation:'fadeUp 0.3s ease'}}>
      <div style={{display:'flex', gap:8, marginBottom:12}}>
        <Link href="/rsvp/tok-anna" style={{display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--gold-pale)', borderRadius:'var(--r-md)', padding:'10px 14px', textDecoration:'none', border:'1px solid rgba(201,168,76,0.2)', flexShrink:0}}>
          <p style={{fontSize:11, fontWeight:600, color:'var(--gold)'}}>RSVP testen</p>
          <ChevronRight size={13} color="var(--gold)"/>
        </Link>
        <Link href="/brautpaar/gaeste" style={{marginLeft:'auto', width:40, height:40, borderRadius:'50%', border:'none', background:'var(--gold)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
          <Plus size={18}/>
        </Link>
      </div>

      <div style={{position:'relative', marginBottom:12}}>
        <Search size={14} style={{position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-dim)', pointerEvents:'none'}}/>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Gäste suchen …"
          style={{width:'100%', padding:'10px 36px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', fontSize:13, color:'var(--text)', outline:'none', fontFamily:'inherit', boxSizing:'border-box'}}
          onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-dim)', display:'flex', padding:4}}>
            <X size={14}/>
          </button>
        )}
      </div>

      <div style={{display:'flex', gap:6, marginBottom:12, flexWrap:'wrap'}}>
        {newCount > 0 && (
          <button style={{padding:'5px 12px', borderRadius:100, border:'1px solid rgba(201,168,76,0.4)', background:'var(--gold-pale)', fontSize:11, fontWeight:500, color:'var(--gold)', cursor:'pointer', fontFamily:'inherit'}} onClick={() => setSearch('')}>
            Neu ({newCount})
          </button>
        )}
        <button style={{padding:'5px 12px', borderRadius:100, border:'1px solid var(--border)', background:'var(--surface)', fontSize:11, fontWeight:500, color:'var(--text-mid)', cursor:'pointer', fontFamily:'inherit'}} onClick={() => setSearch('')}>Alle ({event.guests.length})</button>
        <button style={{padding:'5px 12px', borderRadius:100, border:'1px solid var(--border)', background:'var(--surface)', fontSize:11, fontWeight:500, color:'var(--text-mid)', cursor:'pointer', fontFamily:'inherit'}} onClick={() => setSearch('')}>Zugesagt ({stats.confirmed})</button>
        <button style={{padding:'5px 12px', borderRadius:100, border:'1px solid var(--border)', background:'var(--surface)', fontSize:11, fontWeight:500, color:'var(--text-mid)', cursor:'pointer', fontFamily:'inherit'}} onClick={() => setSearch('')}>Ausstehend ({stats.pending})</button>
        <button style={{padding:'5px 12px', borderRadius:100, border:'1px solid var(--border)', background:'var(--surface)', fontSize:11, fontWeight:500, color:'var(--text-mid)', cursor:'pointer', fontFamily:'inherit'}} onClick={() => setSearch('')}>Abgesagt ({stats.declined})</button>
      </div>

      <div className="dash-grid">
        {filteredGuests.map(g => (
          <GuestRow key={g.id} guest={g} isDeleting={del === g.id}
            onDeleteStart={() => setDel(g.id)} onDeleteCancel={() => setDel(null)} onDeleteConfirm={() => deleteGuest(g.id)}/>
        ))}
      </div>
      {filteredGuests.length === 0 && (
        <div style={{textAlign:'center', padding:'40px 0', color:'var(--text-dim)'}}>
          <Search size={24} style={{marginBottom:10, opacity:0.3}}/>
          <p style={{fontSize:13}}>{search ? `Keine Ergebnisse für „${search}"` : 'Keine Gäste'}</p>
        </div>
      )}

    </div>
  )
}
