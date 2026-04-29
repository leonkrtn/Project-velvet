'use client'
import React, { useRef, useEffect, useCallback, useState } from 'react'
import type { RaumPoint, RaumElement } from './RaumKonfigurator'

const GRID_SIZE = 0.5
const DEFAULT_M2PX = 40
const MIN_ZOOM = 16, MAX_ZOOM = 100

interface Props {
  points: RaumPoint[]
  elements?: RaumElement[]
  showDimensions?: boolean
}

function eKey(x: number, y: number) { return `${Math.round(x*100)}_${Math.round(y*100)}` }

const ELEM_BG: Record<string, string> = {
  strom:'#FFFFFF', wasser:'#EFF6FF', netzwerk:'#FFFFFF', heizung:'#FFFFFF',
  saeule:'#F1F5F9', tuer:'#FFFFFF', fenster:'#FFFFFF', notausgang:'#DCFCE7',
  treppe:'#FFFFFF', buehne:'#FAFAFA', pflanze:'#F0FDF4', baum:'#DCFCE7',
}

export default function RaumViewer({ points, elements = [], showDimensions = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stRef = useRef({ meterToPx: DEFAULT_M2PX, panOffsetX: 0, panOffsetY: 0, isPanning: false, panStartX:0, panStartY:0, panStartOffX:0, panStartOffY:0 })
  const [dimLabel, setDimLabel] = useState('')

  const m2c = useCallback((x: number, y: number) => {
    const s = stRef.current; const canvas = canvasRef.current!
    return { x: canvas.width/2 + s.panOffsetX + x*s.meterToPx, y: canvas.height/2 + s.panOffsetY + y*s.meterToPx }
  }, [])

  const c2m = useCallback((px: number, py: number) => {
    const s = stRef.current; const canvas = canvasRef.current!
    return { x: (px-canvas.width/2-s.panOffsetX)/s.meterToPx, y: (py-canvas.height/2-s.panOffsetY)/s.meterToPx }
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const s = stRef.current

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Grid
    ctx.save(); ctx.strokeStyle='rgba(0,0,0,0.04)'; ctx.lineWidth=1
    const g = GRID_SIZE * s.meterToPx
    const ox=(canvas.width/2+s.panOffsetX)%g, oy=(canvas.height/2+s.panOffsetY)%g
    for (let x=ox; x<canvas.width; x+=g) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke() }
    for (let y=oy; y<canvas.height; y+=g) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke() }
    ctx.restore()

    if (points.length < 3) {
      ctx.save()
      ctx.font='14px -apple-system,Helvetica,sans-serif'
      ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillStyle='#AEAEB2'
      ctx.fillText('Kein Raum konfiguriert', canvas.width/2, canvas.height/2)
      ctx.restore()
      return
    }

    // Room fill
    ctx.beginPath()
    const f = m2c(points[0].x,points[0].y); ctx.moveTo(f.x,f.y)
    for (let i=1; i<points.length; i++) { const p=m2c(points[i].x,points[i].y); ctx.lineTo(p.x,p.y) }
    ctx.closePath()
    ctx.fillStyle='rgba(29,29,31,0.04)'; ctx.fill()
    ctx.strokeStyle='#1D1D1F'; ctx.lineWidth=2; ctx.stroke()

    // Dimensions
    if (showDimensions) {
      ctx.save()
      for (let i=0; i<points.length; i++) {
        const p1=points[i], p2=points[(i+1)%points.length]
        const len=Math.hypot(p2.x-p1.x,p2.y-p1.y).toFixed(2).replace('.',',')
        const mid=m2c((p1.x+p2.x)/2,(p1.y+p2.y)/2)
        ctx.font='600 11px -apple-system,Helvetica,sans-serif'
        const tw=ctx.measureText(`${len} m`).width, pad=6
        ctx.fillStyle='#1D1D1F'
        ctx.beginPath(); ctx.roundRect(mid.x-tw/2-pad,mid.y-9,tw+pad*2,18,4); ctx.fill()
        ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle'
        ctx.fillText(`${len} m`,mid.x,mid.y)
      }
      ctx.restore()
    }

    // Elements
    if (elements.length > 0) {
      const cs = GRID_SIZE * s.meterToPx
      const visited = new Set<string>()
      const posMap: Record<string, RaumElement> = {}
      elements.forEach(e => { posMap[eKey(e.x,e.y)] = e })

      elements.forEach(el => {
        const k = eKey(el.x,el.y); if (visited.has(k)) return
        visited.add(k)
        const bg = ELEM_BG[el.type] ?? '#fff'
        const tl = m2c(el.x, el.y)
        ctx.fillStyle = bg; ctx.fillRect(tl.x, tl.y, cs, cs)
        ctx.strokeStyle='#1D1D1F'; ctx.lineWidth=1.5
        const x=tl.x,y=tl.y
        if (!posMap[eKey(el.x,el.y-GRID_SIZE)]) { ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+cs,y); ctx.stroke() }
        if (!posMap[eKey(el.x+GRID_SIZE,el.y)]) { ctx.beginPath(); ctx.moveTo(x+cs,y); ctx.lineTo(x+cs,y+cs); ctx.stroke() }
        if (!posMap[eKey(el.x,el.y+GRID_SIZE)]) { ctx.beginPath(); ctx.moveTo(x,y+cs); ctx.lineTo(x+cs,y+cs); ctx.stroke() }
        if (!posMap[eKey(el.x-GRID_SIZE,el.y)]) { ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+cs); ctx.stroke() }
      })
    }

    // Dim label
    if (points.length >= 2) {
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity
      points.forEach(p => { minX=Math.min(minX,p.x); maxX=Math.max(maxX,p.x); minY=Math.min(minY,p.y); maxY=Math.max(maxY,p.y) })
      setDimLabel(`${(maxX-minX).toFixed(2).replace('.',',')} m × ${(maxY-minY).toFixed(2).replace('.',',')} m`)
    }
  }, [points, elements, showDimensions, m2c])

  useEffect(() => {
    if (!canvasRef.current) return
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const canvas = canvasRef.current!
    const s = stRef.current

    function mousePos(e: MouseEvent) {
      const r=canvas.getBoundingClientRect()
      return { x:(e.clientX-r.left)*(canvas.width/r.width), y:(e.clientY-r.top)*(canvas.height/r.height) }
    }

    function onDown(e: MouseEvent) {
      if (e.button===1||e.button===0) {
        const {x,y}=mousePos(e)
        s.isPanning=true; s.panStartX=x; s.panStartY=y; s.panStartOffX=s.panOffsetX; s.panStartOffY=s.panOffsetY
        canvas.style.cursor='grabbing'
      }
    }
    function onMove(e: MouseEvent) {
      if (!s.isPanning) return
      const {x,y}=mousePos(e)
      s.panOffsetX=s.panStartOffX+x-s.panStartX; s.panOffsetY=s.panStartOffY+y-s.panStartY
      draw()
    }
    function onUp() { s.isPanning=false; canvas.style.cursor='grab' }
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      s.meterToPx=Math.min(MAX_ZOOM,Math.max(MIN_ZOOM,s.meterToPx+(e.deltaY>0?-3:3)))
      draw()
    }

    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    canvas.addEventListener('wheel', onWheel, {passive:false})
    canvas.addEventListener('contextmenu', e=>e.preventDefault())
    return () => {
      canvas.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [draw])

  useEffect(() => { draw() }, [draw])

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
      {dimLabel && (
        <div style={{ padding:'8px 12px', borderBottom:'1px solid rgba(0,0,0,0.08)', background:'#fff', display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:500, fontFamily:'monospace', color:'#1D1D1F' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 3H3v7h18V3z"/></svg>
          {dimLabel}
        </div>
      )}
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', padding:24, background:'#F5F5F7', borderRadius:'0 0 14px 14px' }}>
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid rgba(0,0,0,0.14)', boxShadow:'0 4px 16px rgba(0,0,0,0.07)', overflow:'hidden' }}>
          <canvas ref={canvasRef} width={720} height={420} style={{ display:'block', cursor:'grab', width:720, height:420 }} />
        </div>
      </div>
    </div>
  )
}
