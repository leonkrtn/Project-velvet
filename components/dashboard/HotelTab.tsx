'use client'
import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Avatar, Badge, Card, SectionTitle, ProgressBar } from '@/components/ui'
import { getStats, saveEvent, type Event, type Hotel, type HotelRoom } from '@/lib/store'
import { useEvent } from '@/lib/event-context'
import { v4 as uuid } from 'uuid'

type Stats = ReturnType<typeof getStats>


export function HotelTabContent({event, stats}: {event: Event; stats: Stats}) {
  return (
    <div style={{animation:'fadeUp 0.3s ease'}}>
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
