'use client';
import { ArrowUpRight, Focus, MessageCircle, SlidersHorizontal, X } from 'lucide-react';
import type { DevicePart } from '@/lib/studio/types';
import PartThumbnail from './PartThumbnail';

export default function ComponentSpotlight({ part, connectionCount=part.connections.length, scene, isolated, busy, onClose, onExplain, onEdit, onIsolate, onFocus }: {
  part: DevicePart; connectionCount?:number; scene?: unknown; isolated: boolean; busy: boolean;
  onClose: () => void; onExplain: () => void; onEdit: () => void; onIsolate: () => void; onFocus: () => void;
}) {
  return <section className="fx-spotlight" aria-label={`Selected component: ${part.name}`}>
    <div className="fx-spotlight-top"><span><i/>IN FOCUS / {part.category}</span><button aria-label="Deselect component" onClick={onClose}><X size={15}/></button></div>
    <div className="fx-spotlight-object"><PartThumbnail part={part} large scene={scene}/><button aria-label={`Bring ${part.name} closer`} onClick={onFocus}><ArrowUpRight size={16}/></button></div>
    <h2>{part.name}</h2><p>{part.role}</p>
    <div className="fx-spotlight-actions"><button disabled={busy} onClick={onExplain}><MessageCircle size={14}/>Explain</button><button aria-pressed={isolated} onClick={onIsolate}><Focus size={14}/>{isolated ? 'Show all' : 'Isolate'}</button><button onClick={onEdit}><SlidersHorizontal size={14}/>Edit part</button></div>
    {part.catalogRef&&<a className="lumi-catalog-citation" href={part.sourceUrl} target="_blank" rel="noreferrer">Sourced CAD · {part.specs['Catalog source']}<ArrowUpRight size={12}/></a>}
    <small>Part {part.id} · {connectionCount} connection{connectionCount === 1 ? '' : 's'}</small>
  </section>;
}
