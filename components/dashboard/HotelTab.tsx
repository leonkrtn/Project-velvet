'use client'
import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Avatar, Badge, Card, SectionTitle, ProgressBar } from '@/components/ui'
import { getStats, saveEvent, type Event, type Hotel, type HotelRoom } from '@/lib/store'
import type { OrganizerSuggestionStatus } from '@/lib/store'
import { useEvent } from '@/lib/event-context'
import { v4 as uuid } from 'uuid'

type Stats = ReturnType<typeof getStats>

function HotelSuggestions() {
  const { event, updateEvent } = useEvent()
  if (!event) return null
  const suggestions = event.organizer?.hotelSuggestions ?? []
  const pending = suggestions.filter(s => s.status === 'vorschlag')
  if (pending.length === 0) return null

  const accept = (id: string) => {
    const suggestion = (event.organizer?.hotelSuggestions ?? []).find(h => h.id === id)
    if (!suggestion) return

    // Neues Hotel-Objekt aus Suggestion erstellen
    const newHotel: Hotel = {
      id: uuid(),
      name: suggestion.name,
      address: suggestion.address,
      rooms: [{
        id: uuid(),
        type: 'Standard',
        totalRooms: suggestion.totalRooms,
        bookedRooms: 0,
        pricePerNight: suggestion.pricePerNight,
      } as HotelRoom],
    }

    const updatedSuggestions = (event.organizer?.hotelSuggestions ?? []).map(h =>
      h.id === id ? { ...h, status: 'angenommen' as OrganizerSuggestionStatus } : h
    )
    const updated = {
      ...event,
      hotels: [...(event.hotels ?? []), newHotel],
      organizer: { ...event.organizer!, hotelSuggestions: updatedSuggestions },
    }
    updateEvent(updated); saveEvent(updated)
  }

  const dismiss = (id: string) => {
    const updatedSuggestions = (event.organizer?.hotelSuggestions ?? []).map(h =>
      h.id === id ? { ...h, status: 'abgelehnt' as OrganizerSuggestionStatus } : h
    )
    const updated = { ...event, organizer: { ...event.organizer!, hotelSuggestions: updatedSuggestions } }
    updateEvent(updated); saveEvent(updated)
  }

  return (
    <Card style={{ marginBottom: 12 }}>
      <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--gold)', marginBottom: 12 }}>
        Hotel-Vorschläge vom Veranstalter
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pending.map(h => (
          <div key={h.id} style={{ background: 'var(--gold-pale)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 10, padding: '13px 14px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{h.name}</p>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
              {h.distanceKm} km · € {h.pricePerNight}/Nacht · {h.totalRooms} Zimmer
            </p>
            {h.address && <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{h.address}</p>}
            {h.description && <p style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: 8 }}>{h.description}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => accept(h.id)} style={{ padding: '6px 13px', borderRadius: 100, border: 'none', background: 'var(--gold)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Übernehmen</button>
              <button onClick={() => dismiss(h.id)} style={{ padding: '6px 13px', borderRadius: 100, border: '1px solid var(--border)', background: 'none', fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'inherit' }}>Ablehnen</button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function HotelTabContent({event, stats}: {event: Event; stats: Stats}) {
  return (
    <div style={{animation:'fadeUp 0.3s ease'}}>
      <HotelSuggestions />
      <div className="dash-grid">
        <Card>
          {(event.hotels??[]).map(hotel=>(
            <div key={hotel.id} style={{marginBottom:20}}>
              <p style={{fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:500, color:'var(--text)', marginBottom:3}}>{hotel.name}</p>
              <p style={{fontSize:12, color:'var(--text-dim)', marginBottom:14}}>{hotel.address}</p>
              {hotel.rooms.map((room,i)=>(
                <div key={room.id} style={{background:'var(--bg)', borderRadius:10, padding:'14px 16px', marginBottom:i<hotel.rooms.length-1?10:0}}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:10}}>
                    <div>
                      <p style={{fontSize:13, fontWeight:600, color:'var(--text)'}}>{room.type}</p>
                      <p style={{fontSize:11, color:'var(--text-dim)'}}>€ {room.pricePerNight} / Nacht</p>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <p style={{fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:500, lineHeight:1, color:room.bookedRooms>=room.totalRooms?'var(--red)':'var(--gold)'}}>{room.bookedRooms}/{room.totalRooms}</p>
                      <p style={{fontSize:10, color:'var(--text-dim)', marginTop:2}}>gebucht</p>
                    </div>
                  </div>
                  <ProgressBar value={room.bookedRooms} max={room.totalRooms} color={room.bookedRooms>=room.totalRooms*0.9?'var(--red)':'var(--gold)'}/>
                  {room.bookedRooms>=room.totalRooms*0.9&&<p style={{fontSize:11, color:'var(--red)', marginTop:8, display:'flex', alignItems:'center', gap:5}}><AlertTriangle size={11}/> Fast ausgebucht</p>}
                </div>
              ))}
            </div>
          ))}
        </Card>
        <Card>
          <SectionTitle>Gäste mit Zimmer ({stats.hotelBooked})</SectionTitle>
          {event.guests.filter(g=>g.hotelRoomId&&g.hotelRoomId!=='none').map((g,i,arr)=>{
            const room=(event.hotels??[]).flatMap(h=>h.rooms).find(r=>r.id===g.hotelRoomId)
            return (
              <div key={g.id} style={{display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:i<arr.length-1?'1px solid var(--border)':'none'}}>
                <Avatar name={g.name} size={28}/>
                <div style={{flex:1}}>
                  <p style={{fontSize:13, fontWeight:500, color:'var(--text)'}}>{g.name}</p>
                  <p style={{fontSize:11, color:'var(--text-dim)'}}>{room?.type??'—'}</p>
                </div>
                <Badge variant="gold" label="Gebucht"/>
              </div>
            )
          })}
          {stats.hotelBooked===0&&<p style={{fontSize:13, color:'var(--text-dim)', fontStyle:'italic'}}>Noch keine Buchungen</p>}
        </Card>
      </div>
    </div>
  )
}
