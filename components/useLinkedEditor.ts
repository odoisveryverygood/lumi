'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {Connection,PartInstance,Project} from '@/lib/types';
import type {DeviceDocument,DevicePart,Vec3} from '@/lib/studio/types';
import {projectFromDocument,circuitChecks,type CircuitPlan,type CircuitOverlay,type CircuitCheck} from '@/lib/studio/circuit-derive';
import {readStudioRecord,writeStudioDocument,recordChange,undoShared,redoShared,readHistory,withOverlay,overlayOf,STUDIO_KEY,HISTORY_KEY} from '@/lib/studio/shared-project';
import {validateDeviceDocument} from '@/lib/studio/validation';
import {resolveAttachments} from '@/lib/studio/attachments';
import {validateProject} from '@/lib/validation';
import {PART_MAP} from '@/lib/library';
import {catalogJsonReplacer} from '@/lib/studio/catalog';
import type {Message} from './useEditor';
import type {useEditor} from './useEditor';
export type EditorApi=ReturnType<typeof useEditor>;
export type LinkedExtras={linked:true;document:DeviceDocument|null;plan:CircuitPlan|null;checks:CircuitCheck[];empty:boolean;projectValid:boolean};
const EMPTY=(document:DeviceDocument|null):Project=>({id:document?.id??'empty',name:document?.name??'No object',prompt:document?.description??'',description:document?.description??'',howItWorks:'',difficulty:1,buildTimeMinutes:5,skillLevel:'beginner',parts:[],connections:[],buildSteps:[],code:{language:'arduino',filename:'empty.ino',source:'// no electronics\nvoid setup(){Serial.begin(115200);}\nvoid loop(){}\n',libraries:[]}});
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function pruneReferences(document:DeviceDocument,removed:Set<string>):DeviceDocument{
 const keep=(id:string)=>!removed.has(id);
 return {...document,parts:document.parts.filter(p=>keep(p.id)).map(p=>({...p,connections:p.connections.filter(c=>keep(c.partId)),...(p.attachment&&removed.has(p.attachment.parentId)?{attachment:undefined}:{})})),steps:document.steps.map(s=>({...s,partIds:s.partIds.filter(keep)})),relationships:document.relationships?.filter(r=>keep(r.from)&&keep(r.to)),assemblies:document.assemblies?.map(a=>({...a,partIds:a.partIds.filter(keep)})),mechanisms:document.mechanisms?.map(m=>({...m,tracks:m.tracks.filter(t=>keep(t.partId)),stages:m.stages.map(s=>({...s,partIds:s.partIds.filter(keep)}))}))};
}
function devicePartFromInstance(instance:PartInstance):DevicePart{
 const lib=PART_MAP[instance.libraryId];const size=(instance.size??lib.size) as Vec3;
 return {id:instance.id,name:lib.name.slice(0,200),category:'Electronics',description:lib.whatItIs,role:instance.role,position:instance.assembledPosition,rotation:instance.rotation,size,explode:[0,25,0],color:/^#[0-9a-fA-F]{6}$/.test(lib.colour)?lib.colour:'#8d9eaf',solids:[{kind:'box',position:[0,0,0],size}],specs:{'Circuits library':instance.libraryId,'Hardware status':'Added in Circuits; placement and operation unverified'},connections:[]};
}
/** Map a Circuits-side project edit back onto the shared Studio object. */
export function applyProjectToDocument(document:DeviceDocument,derived:{project:Project;plan:CircuitPlan},next:Project):DeviceDocument{
 const before=derived.project,studioIds=new Set(document.parts.map(p=>p.id)),nextIds=new Set(next.parts.map(p=>p.id));
 let doc:DeviceDocument=document;
 // Unmapped Studio components are intentionally absent from the circuit plan.
 // Their absence is not a delete command from the user.
 const editableIds=new Set(before.parts.map(p=>p.id));
 const removed=new Set(document.parts.filter(p=>editableIds.has(p.id)&&!nextIds.has(p.id)).map(p=>p.id));
 if(removed.size)doc=pruneReferences(doc,removed);
 const moved:string[]=[];
 doc={...doc,parts:doc.parts.map(p=>{const inst=next.parts.find(x=>x.id===p.id),prev=before.parts.find(x=>x.id===p.id);if(!inst||!prev)return p;let out=p;if(!same(inst.assembledPosition,prev.assembledPosition)||!same(inst.rotation,prev.rotation)){out={...out,position:inst.assembledPosition,rotation:inst.rotation};moved.push(p.id);}if(inst.label!==prev.label&&inst.label.trim())out={...out,name:inst.label.trim()};return out;})};
 if(moved.length)doc=resolveAttachments(document,doc,moved);
 const addedByUser=next.parts.filter(p=>!studioIds.has(p.id)&&!derived.plan.added.some(a=>a.id===p.id)&&PART_MAP[p.libraryId]);
 if(addedByUser.length)doc={...doc,parts:[...doc.parts,...addedByUser.map(devicePartFromInstance)]};
 const overlay:CircuitOverlay={...(overlayOf(document)??{version:1}),version:1};
 if(!same(next.connections,before.connections))overlay.connections=next.connections;
 if(next.code.source!==before.code.source||next.code.filename!==before.code.filename)overlay.code={filename:next.code.filename,source:next.code.source,libraries:next.code.libraries};
 if(next.name!==before.name&&next.name.trim())doc={...doc,name:next.name.trim().slice(0,200)};
 return withOverlay(doc,Object.keys(overlay).length>1?overlay:undefined);
}
/** The Circuits editor for whatever is open in Studio: same project, same saved record, same history. */
export function useLinkedEditor():EditorApi&LinkedExtras{
 const [document,setDocument]=useState<DeviceDocument|null>(null);
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[asking,setAsking]=useState(false);
 const [messages,setMessages]=useState<Message[]>([]),[stage,setStage]=useState({index:0,message:'Updating your design',parts:[] as string[]});
 const [toast,setToast]=useState(''),[notice,setNotice]=useState(''),[colors,setColors]=useState<Record<string,string>>({});
 const [status,setStatus]=useState<{configured:boolean;available?:boolean;model?:string;message?:string}>({configured:false});
 const [historyTick,setHistoryTick]=useState(0);
 const current=useRef<DeviceDocument|null>(null);current.current=document;
 const abort=useRef<AbortController|null>(null),messageEnd=useRef<HTMLDivElement>(null),running=useRef(false);
 const tell=useCallback((text:string)=>setToast(text),[]);
 useEffect(()=>{
  fetch('/api/status').then(r=>r.json()).then(setStatus).catch(()=>{});
  const record=readStudioRecord();setDocument(record?.document??null);setReady(true);
  const onStorage=(event:StorageEvent)=>{if(event.key===STUDIO_KEY||event.key===null){const next=readStudioRecord()?.document??null;if(!same(next,current.current)){current.current=next;setDocument(next);setColors({});}}if(event.key===HISTORY_KEY||event.key===null)setHistoryTick(t=>t+1);};
  window.addEventListener('storage',onStorage);return()=>{window.removeEventListener('storage',onStorage);abort.current?.abort();};
 },[]);
 useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(''),6000);return()=>clearTimeout(id);},[toast]);
 useEffect(()=>{messageEnd.current?.scrollIntoView({block:'nearest',behavior:'smooth'});},[messages,asking,busy]);
 const derived=useMemo(()=>document?projectFromDocument(document):null,[document]);
 const project=derived?.project??EMPTY(document);
 const checks=useMemo(()=>derived?circuitChecks(derived.project):[],[derived]);
 const projectValid=useMemo(()=>!!derived&&validateProject(derived.project).valid,[derived]);
 const history=useMemo(()=>{void historyTick;void document;return typeof localStorage==='undefined'?{version:1 as const,past:[],future:[]}:readHistory();},[historyTick,document]);
 const save=useCallback((next:DeviceDocument,record=true)=>{const prev=current.current;try{next=validateDeviceDocument(next);}catch(error){tell(error instanceof Error?error.message:'The change is invalid.');return false;}if(record&&prev)recordChange(prev);writeStudioDocument(next);current.current=next;setDocument(next);setHistoryTick(t=>t+1);return true;},[tell]);
 const mutate=useCallback((edit:(p:Project)=>Project)=>{const doc=current.current;if(!doc||!derived||busy)return;try{const next=edit(derived.project);if(!same(next.connections,derived.project.connections))setNotice('Wiring changed. Update wiring and code with the Assistant before building.');save(applyProjectToDocument(doc,derived,next));}catch(error){tell(error instanceof Error?error.message:'The edit could not be applied.');}},[derived,busy,save,tell]);
 const commit=useCallback((project:Project,nextColors?:Record<string,string>)=>{const doc=current.current;if(!doc||!derived||busy)return;try{const next=applyProjectToDocument(doc,derived,project);if(nextColors)next.parts=next.parts.map(part=>{const color=nextColors[part.id];return color&&color!==part.color?{...part,color,solids:part.solids.map(solid=>solid.color?.toLowerCase()===part.color.toLowerCase()?{...solid,color}:solid)}:part;});if(save(next)&&nextColors)setColors(nextColors);}catch(error){tell(error instanceof Error?error.message:'The edit could not be applied.');}},[derived,busy,save,tell]);
 const undo=useCallback(()=>{const doc=current.current;if(!doc||busy)return;const prev=undoShared(doc);if(!prev)return;writeStudioDocument(prev);current.current=prev;setDocument(prev);setColors({});setHistoryTick(t=>t+1);},[busy]);
 const redo=useCallback(()=>{const doc=current.current;if(!doc||busy)return;const next=redoShared(doc);if(!next)return;writeStudioDocument(next);current.current=next;setDocument(next);setColors({});setHistoryTick(t=>t+1);},[busy]);
 async function generate(text:string,editing:boolean){
  const doc=current.current;if(!text.trim()||running.current||!doc||!derived)return false;
  if(!editing){tell('New designs start a separate project. Use New design, or change the Studio object instead.');return false;}
  running.current=true;setBusy(true);setStage({index:0,message:'Updating the circuit for this object',parts:[]});setMessages(m=>[...m,{role:'user',text}]);
  abort.current=new AbortController();let result=false;
  try{
   const res=await fetch('/api/project',{method:'POST',headers:{'Content-Type':'application/json'},signal:abort.current.signal,body:JSON.stringify({action:'edit',prompt:derived.project.prompt,project:derived.project,request:text,skillLevel:'beginner'})});
   if(!res.ok){const data=await res.json();throw Error(data.message||data.error||'Gemini could not complete the request.');}
   if(!res.body)throw Error('No response received.');
   const reader=res.body.getReader(),decoder=new TextDecoder();let pending='';
   const handle=(line:string)=>{if(!line.trim())return;const event=JSON.parse(line);if(event.type==='stage')setStage(s=>({index:event.stage,message:event.message,parts:event.parts||s.parts}));if(event.type==='error')throw Error(event.message);if(event.type==='complete'){if(abort.current?.signal.aborted)throw new DOMException('Cancelled','AbortError');if(!same(doc,current.current))throw Error('Studio changed while the circuit was being updated. Your latest object is unchanged; retry the edit.');const checked=validateProject(event.project);if(!checked.valid)throw Error('The edited circuit did not pass validation. '+checked.errors.slice(0,2).join(' '));const next=checked.project||event.project;if(save(applyProjectToDocument(doc,derived,next))){setMessages(m=>[...m,{role:'assistant',text:event.message||'Updated the wiring, firmware and parts on the shared object.',source:event.model||'Gemini'}]);result=true;}}};
   while(true){const {done,value}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});const lines=pending.split('\n');pending=lines.pop()||'';lines.forEach(handle);}
   pending+=decoder.decode();if(pending.trim())handle(pending);if(!result)throw Error('Generation ended before a complete design was received.');
   tell('Circuit updated on the shared object.');
  }catch(error){const err=error as Error;if(err.name!=='AbortError'){tell(err.message);setMessages(m=>[...m,{role:'assistant',text:err.message}]);}else tell('Generation cancelled.');}
  finally{running.current=false;setBusy(false);abort.current=null;}
  return result;
 }
 async function ask(text:string,partId?:string,stepIndex?:number){
  const doc=current.current;if(!text.trim()||asking||busy||!doc)return;setAsking(true);setMessages(m=>[...m,{role:'user',text}]);
  try{
   if(derived&&projectValid){const res=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project:derived.project,question:text,partId,stepIndex})});const data=await res.json();if(!res.ok)throw Error(data.message||data.error||'Could not answer right now.');setMessages(m=>[...m,{role:'assistant',text:data.answer,source:data.model||data.source}]);}
   else{
    const wires=(derived?.project.connections??[]).map(c=>`${c.from.partId}.${c.from.pin} → ${c.to.partId}.${c.to.pin} (${c.kind})`).join('; ');
    const prompt=`${text}\n\nContext from the Circuits tab (derived wiring for this object; pins come from the parts catalog): ${wires||'no wires yet'}.`;
    const res=await fetch('/api/device',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'ask',prompt,document:doc,...(partId&&doc.parts.some(p=>p.id===partId)?{partId}:{})},catalogJsonReplacer)});const data=await res.json();if(!res.ok)throw Error(data.error||'Could not answer right now.');setMessages(m=>[...m,{role:'assistant',text:data.answer,source:data.model}]);
   }
  }catch(error){setMessages(m=>[...m,{role:'assistant',text:(error as Error).message}]);}finally{setAsking(false);}
 }
 return {linked:true as const,document,plan:derived?.plan??null,checks,empty:!derived,projectValid,project,colors,source:document?'Studio object':'No object',legacyProject:null,ready,readOnly:false,busy,asking,stage,messages,messageEnd,toast,notice,status,tell,setNotice,commit,mutate,undo,redo,canUndo:history.past.length>0,canRedo:history.future.length>0,open:()=>{},importFile:async()=>{},generate,ask,cancel:()=>abort.current?.abort(),makeCopy:()=>{}};
}
