'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Cpu, LoaderCircle, Play, Plus, Sparkles, Upload } from 'lucide-react';
import type { DeviceDocument } from '@/lib/studio/types';
import { desktopComputer } from '@/lib/studio/desktop';
import ObjectPreview from './ObjectPreview';

interface Props {
  document: DeviceDocument; prompt: string; model: string | null; available: boolean;
  partNames: string[]; busy: boolean; progress: string; elapsed: number; error: string;
  onPrompt: (value: string) => void; onGenerate: () => void; onCancel: () => void;
  onContinue: () => void; onKeyboard: (explain?: boolean) => void;
  onDesktop: () => void; onImport: () => void; onBoard: () => void; onLibrary:()=>void;
}

export default function ObjectGallery(props: Props) {
  const [keyboard, setKeyboard] = useState<DeviceDocument | null>(null);
  useEffect(() => { let alive = true; import('@/lib/studio/corne').then(module=>module.loadCorneReference()).then(reference=>{if(alive)setKeyboard(reference);}).catch(()=>{}); return () => { alive = false; }; }, []);
  return <section className="fx-gallery" aria-label="Explore objects">
    <div className="fx-gallery-copy">
      <span className="fx-overline"><i/>MEET MORF. MAKE SENSE OF THINGS.</span>
      <h1>See what’s inside.<br/><em>Shape what’s next.</em></h1>
      <p>Explore every part. Understand every connection.<br/>Describe a change. See a new possibility.</p>
      <form className="fx-create-form" onSubmit={event => { event.preventDefault(); props.onGenerate(); }}>
        <label htmlFor="fx-object-prompt"><Sparkles size={15}/>What shall we explore?</label>
        <textarea id="fx-object-prompt" aria-label="Describe a new device" placeholder="A camera. A coffee grinder. Your next idea…" value={props.prompt} onChange={event => props.onPrompt(event.target.value)} disabled={props.busy}/>
        <div><span><i/>{props.available ? props.model || 'Gemini' : 'AI unavailable'}</span><button type="submit" disabled={props.busy || !props.prompt.trim()} aria-label="Create device">{props.busy ? <LoaderCircle className="ds-spin" size={15}/> : <ArrowRight size={18}/>}</button></div>
      </form>
      {props.busy && <div className="fx-generation" role="status"><LoaderCircle className="ds-spin" size={15}/><span>{props.progress}<small>{props.elapsed}s · Building an editable object</small></span><button onClick={props.onCancel}>Cancel</button></div>}
      {props.busy && !!props.partNames.length && <div className="fx-generation-parts" aria-label="Components received from Gemini"><span>{props.partNames.length} CUSTOM {props.partNames.length===1?'COMPONENT':'COMPONENTS'} RECEIVED</span><div>{props.partNames.slice(-6).map((name,index)=><small key={`${index}-${name}`}><i/>{name}</small>)}</div><p>The complete assembly is checked before it opens.</p></div>}
      {props.error && !props.busy && <p className="fx-generation-error" role="alert">{props.error}</p>}
      <button className="fx-continue" disabled={props.busy} onClick={props.onContinue}>Explore {props.document.name}<ArrowUpRight size={15}/></button>
      <button className="morf-gallery-library" disabled={props.busy} onClick={props.onLibrary}><span><Cpu size={18}/></span><span><strong>Start with real parts.</strong><small>Browse sourced CAD components and 3D reference models</small></span><ArrowUpRight size={17}/></button>
    </div>
    <button className="fx-hero-caption" disabled={props.busy} onClick={props.onContinue}><span><i/>{props.busy?(props.partNames.length?'YOUR CUSTOM ASSEMBLY · IN PROGRESS':'YOUR CURRENT ASSEMBLY'):'LIVE, EXPLORABLE ASSEMBLY'}</span><strong>{props.document.name}<ArrowUpRight size={18}/></strong><small>{props.busy&&props.partNames.length?`${props.partNames.length} ${props.partNames.length===1?'component':'components'} received · final checks pending`:`${props.document.parts.length} individual components · ${props.busy?'your saved object':'drag to look around'}`}</small></button>
    <div className="fx-gallery-collection">
      <div className="fx-collection-heading"><span>GOOD PLACES TO START</span><span>01 — 03</span></div>
      <div className="fx-reference-grid">
        <article className="fx-reference fx-keyboard-reference"><button className="fx-reference-main" disabled={props.busy} onClick={() => props.onKeyboard()}><span className="fx-reference-image">{keyboard && <ObjectPreview document={keyboard}/>}</span><span><small>01 / GROUNDED DESIGN</small><strong>Same case.<br/>New possibility.</strong><span>Corne · source CAD<ArrowUpRight size={13}/></span></span></button><button className="fx-reference-story" disabled={props.busy} onClick={() => props.onKeyboard()}><Play size={12}/>Open the design study<ArrowRight size={13}/></button></article>
        <article className="fx-reference"><button className="fx-reference-main" disabled={props.busy} onClick={props.onDesktop}><span className="fx-reference-image"><ObjectPreview document={desktopComputer}/></span><span><small>02 / SYSTEMS</small><strong>A whole world.<br/>Inside the case.</strong><span>Desktop computer<ArrowUpRight size={13}/></span></span></button><button className="fx-reference-story" disabled={props.busy} onClick={props.onBoard}><Cpu size={12}/>Explore a real KiCad board<ArrowRight size={13}/></button></article>
        <article className="fx-reference fx-import-reference"><button className="fx-reference-main" disabled={props.busy} onClick={props.onImport}><span className="fx-import-orbit"><Upload size={27}/><i/><b/></span><span><small>03 / YOUR CURIOSITY</small><strong>Bring something<br/>of your own.</strong><span>Import a GLB or saved project<ArrowUpRight size={13}/></span></span></button><button className="fx-reference-story" disabled={props.busy} onClick={props.onImport}><Upload size={12}/>Open your model or saved project<ArrowRight size={13}/></button></article>
      </div>
    </div>
  </section>;
}
