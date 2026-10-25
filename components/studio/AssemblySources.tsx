'use client';
import {useEffect,useMemo,useRef} from 'react';
import {ArrowUpRight,BookOpen,ShieldCheck,X} from 'lucide-react';
import type {DeviceDocument} from '@/lib/studio/types';

export default function AssemblySources({document,onClose}:{document:DeviceDocument;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const sources=useMemo(()=>{
  const rows=new Map<string,string[]>();
  for(const part of document.parts)if(part.sourceUrl&&/^https:\/\//.test(part.sourceUrl))rows.set(part.sourceUrl,[...(rows.get(part.sourceUrl)||[]),part.name]);
  return [...rows].map(([url,names])=>({url,names}));
 },[document]);
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
 return <dialog ref={dialog} className="morf-assembly-sources" aria-labelledby="assembly-sources-title" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
  <header><div><span><BookOpen size={14}/>ASSEMBLY SOURCES</span><h2 id="assembly-sources-title">What this object is based on.</h2><p>{document.name}</p></div><button autoFocus aria-label="Close assembly sources" onClick={onClose}><X size={18}/></button></header>
  <div className="morf-source-content"><section><h3>Assembly provenance</h3><p>{document.provenance||document.description}</p></section><section><h3>Component references <small>{sources.length}</small></h3>{sources.length?sources.map(({url,names})=><a key={url} href={url} target="_blank" rel="noreferrer"><ShieldCheck size={17}/><span><strong>{names.join(' · ')}</strong><small>{new URL(url).hostname}</small></span><ArrowUpRight size={15}/></a>):<p>No external component references are attached to this assembly.</p>}</section><p className="morf-source-limit">Source references identify the geometry or documentation used. Fit, electrical compatibility and physical operation need their own checks.</p></div>
 </dialog>;
}
