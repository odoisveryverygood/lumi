'use client';
import {useMemo} from 'react';
import type {Connection,PartInstance,Project} from '@/lib/types';
import {PART_MAP} from '@/lib/library';
import {wireHex} from './EditorPanels';
/**
 * A 2-D schematic of the circuit: every electrical part as a labelled box with its real pins,
 * every wire as an orthogonal line in its colour. Mechanical parts are left out. Layout is
 * deterministic: sources on the left, controllers and drivers in the middle, peripherals right.
 */
type Box={part:PartInstance;x:number;y:number;w:number;h:number;side:'left'|'right'|'both';pins:{name:string;x:number;y:number;type:string}[]};
const W=210,ROW=16,HEAD=30,GAP=26;
function column(parts:PartInstance[],x:number,side:Box['side'],top=20):Box[]{
 let y=top;return parts.map(part=>{const lib=PART_MAP[part.libraryId];const pins=lib.pins.map((p,i)=>({name:p.name,type:p.type,x:side==='left'?x+W:side==='right'?x:(['power','ground'].includes(p.type)?x:x+W),y:y+HEAD+i*ROW+ROW/2}));const h=HEAD+Math.max(1,lib.pins.length)*ROW+8;const box={part,x,y,w:W,h,side,pins};y+=h+GAP;return box;});
}
export default function Schematic({project,selectedId,highlightedWire,hiddenIds,onSelect,onWire,compact=false}:{project:Project;selectedId:string|null;highlightedWire:string|null;hiddenIds?:string[];onSelect:(id:string|null)=>void;onWire:(id:string)=>void;compact?:boolean}){
 const layout=useMemo(()=>{
  const electrical=project.parts.filter(p=>PART_MAP[p.libraryId]?.pins.length&&!hiddenIds?.includes(p.id));
  const cat=(p:PartInstance)=>PART_MAP[p.libraryId].category;
  const sources=electrical.filter(p=>cat(p)==='power'),centre=electrical.filter(p=>cat(p)==='microcontroller'||p.libraryId==='pwm-motor-driver'||p.libraryId==='relay-module'),rest=electrical.filter(p=>!sources.includes(p)&&!centre.includes(p));
  const half=Math.ceil(rest.length/2),right1=rest.slice(0,half),right2=rest.slice(half);
  const boxes=[...column(sources,30,'left'),...column(centre,330,'both'),...column(right1,660,'right'),...column(right2,930,'right')];
  const height=Math.max(260,...boxes.map(b=>b.y+b.h+30)),width=right2.length?1170:right1.length?900:centre.length?570:270;
  const pinAt=(e:Connection['from'])=>{const b=boxes.find(x=>x.part.id===e.partId);return b?.pins.find(p=>p.name===e.pin)??null;};
  const wires=project.connections.map((c,i)=>{const a=pinAt(c.from),b=pinAt(c.to);if(!a||!b)return null;const lane=((i*37)%11-5)*4;const mid=(a.x+b.x)/2+lane;const d=`M${a.x},${a.y} H${mid} V${b.y} H${b.x}`;return {c,d,a,b};}).filter((w):w is NonNullable<typeof w>=>!!w);
  return {boxes,wires,width,height};
 },[project,hiddenIds]);
 const label=(p:PartInstance)=>PART_MAP[p.libraryId]?.id==='mechanical-part'?p.label:PART_MAP[p.libraryId]?.name??p.label;
 if(!layout.boxes.length)return <div className="schematic-empty">No electrical parts to draw.</div>;
 return <svg className={'schematic'+(compact?' schematic--compact':'')} viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={`Schematic of ${project.name}`} onClick={()=>onSelect(null)}>
  <defs><pattern id="schematic-grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#b28b5433"/></pattern></defs>
  <rect width={layout.width} height={layout.height} fill="url(#schematic-grid)"/>
  {layout.wires.map(({c,d,a,b})=>{const on=highlightedWire===c.id,dim=highlightedWire&&!on;return <g key={c.id} className="schematic-wire" data-on={on} onClick={e=>{e.stopPropagation();onWire(c.id);}}><path d={d} fill="none" stroke={wireHex[c.wireColor]} strokeWidth={on?4:2.2} strokeLinejoin="round" opacity={dim?.3:1}/><path d={d} fill="none" stroke="transparent" strokeWidth="12"/><circle cx={a.x} cy={a.y} r="3" fill={wireHex[c.wireColor]}/><circle cx={b.x} cy={b.y} r="3" fill={wireHex[c.wireColor]}/>{on&&!compact&&<text x={(a.x+b.x)/2} y={Math.min(a.y,b.y)-6} textAnchor="middle" fontSize="10" fill="#6c5436">{c.purpose}</text>}</g>;})}
  {layout.boxes.map(box=>{const sel=selectedId===box.part.id;return <g key={box.part.id} className="schematic-part" data-selected={sel} onClick={e=>{e.stopPropagation();onSelect(box.part.id);}}>
   <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="10" fill={sel?'#ffe5b5':'#fffdf7'} stroke={sel?'#cda66c':'#dcb27f'} strokeWidth={sel?2:1.2}/>
   <text x={box.x+12} y={box.y+13} fontSize="10" fontWeight="600" fill="#58442c">{box.part.label}</text>
   <text x={box.x+12} y={box.y+24} fontSize="8.5" fill="#8a6a49">{label(box.part).slice(0,34)}</text>
   {box.part.id.startsWith('added-')&&<text x={box.x+box.w-12} y={box.y+13} textAnchor="end" fontSize="7" letterSpacing="1" fill="#5f6d3a">ADDED</text>}
   {box.pins.map(pin=>{const left=pin.x===box.x;return <g key={pin.name}><line x1={pin.x} y1={pin.y} x2={left?pin.x-8:pin.x+8} y2={pin.y} stroke="#8f734d" strokeWidth="1.4"/><circle cx={left?pin.x-8:pin.x+8} cy={pin.y} r="2.2" fill="#8f734d"/><text x={left?pin.x+6:pin.x-6} y={pin.y+3.2} fontSize="8.5" textAnchor={left?'start':'end'} fill={pin.type==='power'?'#b25a3c':pin.type==='ground'?'#4b3a29':'#6c5436'} fontFamily="var(--mono)">{pin.name}</text></g>;})}
  </g>;})}
 </svg>;
}
