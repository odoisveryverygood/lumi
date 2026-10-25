'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import type {Project} from '@/lib/types';
import {getDemoProject} from '@/lib/projects';
import {editableProjectSchema, validateProject} from '@/lib/validation';
import {PART_MAP} from '@/lib/library';
import {readShare} from '@/lib/client';

export type Snapshot = {project:Project; colors:Record<string,string>; source:string};
export type Message = {role:'user'|'assistant';text:string;source?:string};
const initial = ():Snapshot => ({project:getDemoProject('weather station','beginner'),colors:{},source:'Example project'});
function parseDraft(input:unknown):Project {
  const project=editableProjectSchema.parse(input);
  if(project.parts.some(part=>!Object.hasOwn(PART_MAP,part.libraryId)))throw Error('The project contains an unknown component.');
  const ids=new Set(project.parts.map(p=>p.id));
  if(ids.size!==project.parts.length)throw Error('Component identifiers must be unique.');
  for(const wire of project.connections)for(const endpoint of [wire.from,wire.to]){
    const part=project.parts.find(p=>p.id===endpoint.partId);
    if(!part||!PART_MAP[part.libraryId].pins.some(pin=>pin.name===endpoint.pin))throw Error('A wire references an unknown component or pin.');
  }
  return project;
}
function parseColors(input:unknown):Record<string,string>{return Object.fromEntries(Object.entries(input&&typeof input==='object'?input:{}).filter((entry):entry is [string,string]=>typeof entry[1]==='string'&&/^#[0-9a-f]{6}$/i.test(entry[1])));}

export function useEditor() {
  const [snapshot,setSnapshot] = useState<Snapshot>(initial);
  const [legacyProject,setLegacyProject] = useState<Project|null>(null);
  const [past,setPast] = useState<Snapshot[]>([]);
  const [future,setFuture] = useState<Snapshot[]>([]);
  const [ready,setReady] = useState(false);
  const [readOnly,setReadOnly] = useState(false);
  const [busy,setBusy] = useState(false);
  const [asking,setAsking] = useState(false);
  const [stage,setStage] = useState({index:0,message:'Reading your brief',parts:[] as string[]});
  const [messages,setMessages] = useState<Message[]>([]);
  const [toast,setToast] = useState('');
  const [notice,setNotice] = useState('');
  const [status,setStatus] = useState<{configured:boolean;available?:boolean;model?:string;message?:string}>({configured:false});
  const abort = useRef<AbortController|null>(null);
  const current = useRef(snapshot); current.current=snapshot;
  const generationRunning = useRef(false);
  const messageEnd = useRef<HTMLDivElement>(null);
  const tell = useCallback((text:string)=>setToast(text),[]);

  useEffect(()=>{
    fetch('/api/status').then(r=>r.json()).then(setStatus).catch(()=>{});
    try {
      const raw=localStorage.getItem('partexplode-editor-v2');
      const old=localStorage.getItem('partexplode-project');
      if(old)try{const previous=JSON.parse(old);setLegacyProject(parseDraft(previous.project||previous));}catch{}
      if(raw){const value=JSON.parse(raw);setSnapshot({project:parseDraft(value.project),colors:parseColors(value.colors),source:typeof value.source==='string'?value.source:'Local project'});}
    }catch{}
    if(location.hash.startsWith('#shared=')){readShare(location.hash).then(project=>{
      const checked=validateProject(project);if(!checked.valid)throw Error('This shared project has invalid hardware data.');
      setSnapshot({project:checked.project||project,colors:{},source:'Shared project'});setReadOnly(true);
      setNotice('Shared project. Make a copy to edit.');
    }).catch(e=>tell(e.message)).finally(()=>setReady(true));}else setReady(true);
    return()=>abort.current?.abort();
  },[tell]);
  useEffect(()=>{if(!ready||readOnly)return;try{localStorage.setItem('partexplode-editor-v2',JSON.stringify(snapshot));}catch{setNotice('Browser storage is full. Export the project to keep a copy.');}},[snapshot,ready,readOnly]);
  useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(''),6000);return()=>clearTimeout(id);},[toast]);
  useEffect(()=>{messageEnd.current?.scrollIntoView({block:'nearest',behavior:'smooth'});},[messages,asking,busy]);

  const commit=useCallback((project:Project,colors?:Record<string,string>,source?:string)=>{
    if(generationRunning.current)return;
    const previous=current.current;
    if(JSON.stringify(project)===JSON.stringify(previous.project)&&(!colors||JSON.stringify(colors)===JSON.stringify(previous.colors)))return;
    setPast(p=>[...p.slice(-39),previous]);setFuture([]);
    const next={project,colors:colors??previous.colors,source:source??previous.source};
    current.current=next;setSnapshot(next);
  },[]);
  function mutate(edit:(project:Project)=>Project){if(readOnly||busy)return;try{const before=current.current.project;const next=edit(before);if(JSON.stringify(before.connections)!==JSON.stringify(next.connections))setNotice('Wiring changed. Update wiring and code with the Assistant before building.');commit(next);}catch(e){tell(e instanceof Error?e.message:'The edit could not be applied.');}}
  function undo(){if(!past.length||busy||readOnly)return;const previous=past[past.length-1];setFuture(f=>[current.current,...f]);setPast(p=>p.slice(0,-1));current.current=previous;setSnapshot(previous);}
  function redo(){if(!future.length||busy||readOnly)return;const next=future[0];setPast(p=>[...p,current.current]);setFuture(f=>f.slice(1));current.current=next;setSnapshot(next);}
  function open(project:Project,source='Example project',colors:Record<string,string>={}){
    if(busy)return;setPast([]);setFuture([]);setReadOnly(false);setMessages([]);setNotice('');
    const next={project:structuredClone(project),colors,source};current.current=next;setSnapshot(next);
  }
  async function importFile(file:File){try{if(file.size>500_000)throw Error('Project files must be under 500 KB.');const data=JSON.parse(await file.text());open(parseDraft(data.project||data),'Imported project',parseColors(data.colors));tell('Project imported.');}catch{tell('The file contains invalid project data, component references or pin names.');}}
  async function generate(text:string,editing:boolean,skill:'beginner'|'intermediate'='beginner'){
    if(!text.trim()||generationRunning.current||readOnly)return false;
    const previous=current.current;
    generationRunning.current=true;setBusy(true);setStage({index:0,message:editing?'Updating your design':'Reading your brief',parts:[]});
    setMessages(m=>[...m,{role:'user',text}]);
    abort.current=new AbortController();let result=false;
    try {
      const res=await fetch('/api/project',{method:'POST',headers:{'Content-Type':'application/json'},signal:abort.current.signal,body:JSON.stringify(editing?{action:'edit',prompt:previous.project.prompt,project:previous.project,request:text,skillLevel:previous.project.skillLevel}:{action:'generate',prompt:text,skillLevel:skill})});
      if(!res.ok){const data=await res.json();throw Error(data.message||data.error||'Gemini could not complete the request.');}
      if(!res.body)throw Error('No response received.');
      const reader=res.body.getReader(),decoder=new TextDecoder();let pending='';
      const handle=(line:string)=>{
        if(!line.trim())return;const event=JSON.parse(line);
        if(event.type==='stage')setStage(s=>({index:event.stage,message:event.message,parts:event.parts||s.parts}));
        if(event.type==='error')throw Error(event.message);
        if(event.type==='complete'){
          const checked=validateProject(event.project);if(!checked.valid)throw Error('The design did not pass circuit validation. '+checked.errors.slice(0,2).join(' '));
          const next:Snapshot={project:checked.project||event.project,colors:editing?previous.colors:{},source:event.source==='gemini'?event.model||'Gemini':'Example fallback'};
          setPast(p=>[...p.slice(-39),previous]);setFuture([]);current.current=next;setSnapshot(next);
          setNotice(event.message||(event.warnings||[]).join(' '));
          setMessages(m=>[...m,{role:'assistant',text:event.message||(editing?'Updated the parts, wiring, assembly steps and firmware.':'Your design is ready. Select any part to inspect or modify it.'),source:next.source}]);result=true;
        }
      };
      while(true){const {done,value}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});const lines=pending.split('\n');pending=lines.pop()||'';lines.forEach(handle);}
      pending+=decoder.decode();if(pending.trim())handle(pending);if(!result)throw Error('Generation ended before a complete design was received.');
      tell(editing?'Design updated.':'Your new design is ready.');
    }catch(e){const err=e as Error;if(err.name!=='AbortError'){tell(err.message);setMessages(m=>[...m,{role:'assistant',text:err.message}]);}else tell('Generation cancelled.');}
    finally{generationRunning.current=false;setBusy(false);abort.current=null;}
    return result;
  }
  async function ask(text:string,partId?:string,stepIndex?:number){
    if(!text.trim()||asking||busy)return;setAsking(true);setMessages(m=>[...m,{role:'user',text}]);
    try{const res=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project:current.current.project,question:text,partId,stepIndex})});const data=await res.json();if(!res.ok)throw Error(data.message||data.error||'Could not answer right now.');setMessages(m=>[...m,{role:'assistant',text:data.answer,source:data.model||data.source}]);}catch(e){setMessages(m=>[...m,{role:'assistant',text:(e as Error).message}]);}finally{setAsking(false);}
  }
  return {...snapshot,legacyProject,ready,readOnly,busy,asking,stage,messages,messageEnd,toast,notice,status,tell,setNotice,commit,mutate,undo,redo,canUndo:past.length>0,canRedo:future.length>0,open,importFile,generate,ask,cancel:()=>abort.current?.abort(),makeCopy:()=>{setReadOnly(false);setNotice('');commit({...current.current.project,id:'copy-'+Date.now(),name:current.current.project.name+' copy'});}};
}
