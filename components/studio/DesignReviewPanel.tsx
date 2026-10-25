'use client';
import SourceNotebook from './SourceNotebook';
import { builtinSources, citationSchema, designSourceSchema, resolveSources, sourceStats, sourceRequirements, documentSourceRequirements, type DesignSource, type SourceCitation } from '@/lib/studio/knowledge';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Eye, Check, CheckCircle2, ChevronDown, CircleAlert, Download, FlaskConical, History, LoaderCircle, RotateCcw, Send, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { DeviceDocument, SceneAction } from '@/lib/studio/types';
import { buildRedesign, checkRedesign, defaultDesignConstraints, designConstraintsSchema, documentFingerprint, redesignPlanSchema, supportsRedesign, type DesignAttempt, type DesignCheck, type DesignConstraints, type RedesignResult } from '@/lib/studio/redesign';
import type { ObjectConversationResult } from '@/lib/studio/redesign-engine';
import { hardwareCatalog } from '@/lib/studio/hardware-catalog';
import { validateDeviceDocument } from '@/lib/studio/validation';
import { readDeviceResponse } from '@/lib/studio/response';
import { download } from '@/lib/studio/storage';

export interface DesignPreview { document:DeviceDocument; checks:DesignCheck[]; emphasize:boolean; pending?:boolean; measurement?:DesignCheck['measurement']; }
type Entry={role:'user'|'assistant';text:string;citations?:SourceCitation[];model?:string};
type LiveAttempt={document:DeviceDocument;attempt:DesignAttempt;constraints:DesignConstraints};
type Props={notebookRequest?:number;onNotebookChange?:(open:boolean)=>void;onAgent?:(agent:{ask:(text:string)=>void;cancel:()=>void}|null)=>void;onReply?:(text:string)=>void;onProgress?:(text:string)=>void;document:DeviceDocument;visible:boolean;available:boolean|null;selectedPartId?:string|null;onPreview:(value:DesignPreview|null)=>void;onApply:(document:DeviceDocument)=>void;onInspect:(check:DesignCheck)=>void;onActions:(actions:SceneAction[])=>void;onBusy:(busy:boolean)=>void;onComposerHeight:(height:number)=>void;onKeyboard:()=>void;onClose:()=>void;onEvidence:(open:boolean)=>void;onUndo:()=>void;canUndo:boolean};

export default function DesignReviewPanel({notebookRequest=0,onNotebookChange,onAgent,onReply,onProgress,document,visible,available,selectedPartId,onPreview,onApply,onInspect,onActions,onBusy,onComposerHeight,onKeyboard,onClose,onEvidence,onUndo,canUndo}:Props){
  const lastNotebookRequest=useRef(0);
  const [sources,setSources]=useState<DesignSource[]>(builtinSources),[notebook,setNotebook]=useState(false),[sourceCitation,setSourceCitation]=useState<SourceCitation|undefined>();
  useEffect(()=>{if(notebookRequest!==lastNotebookRequest.current){lastNotebookRequest.current=notebookRequest;setNotebook(true);}},[notebookRequest]);
  useEffect(()=>{onNotebookChange?.(visible&&notebook);},[visible,notebook,onNotebookChange]);
  const [answerCitations,setAnswerCitations]=useState<SourceCitation[]>([]),[visualNotes,setVisualNotes]=useState<string[]>([]),[reviewedView,setReviewedView]=useState('');
  const [visualReviews,setVisualReviews]=useState<{model:string;imageSha256:string;receivedAt:string;observations:string[];image:string;documentFingerprint:string}[]>([]);
  const [hydrationKey,setHydrationKey]=useState<string|null>(null);
  const [notebookWarning,setNotebookWarning]=useState('');
  const [brief,setBrief]=useState(''),[constraints,setConstraints]=useState<DesignConstraints>(defaultDesignConstraints);
  const [result,setResult]=useState<RedesignResult|null>(null),[live,setLive]=useState<LiveAttempt|null>(null);
  const [entries,setEntries]=useState<Entry[]>([]),[answer,setAnswer]=useState(''),[suggestions,setSuggestions]=useState<string[]>([]);
  const [busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[elapsed,setElapsed]=useState(0),[error,setError]=useState('');
  const [revision,setRevision]=useState(0),[comparison,setComparison]=useState<'before'|'proposal'>('proposal'),[applied,setApplied]=useState(false),[checkId,setCheckId]=useState('');
  const [inspectCommitted,setInspectCommitted]=useState(false);
  const [evidence,setEvidence]=useState(false),[historyOpen,setHistoryOpen]=useState(false),[model,setModel]=useState('');
  const [trace,setTrace]=useState<{request:string;result:Omit<RedesignResult,'document'>}[]>([]);
  const composer=useRef<HTMLElement>(null);
  const baseline=useRef(document),submitted=useRef(document),request=useRef<AbortController|null>(null),hydrated=useRef(false),input=useRef<HTMLTextAreaElement>(null),busyRef=useRef(false);
  const fingerprint=useMemo(()=>documentFingerprint(document),[document]),key=`flare-redesign-v1:${document.id}`,supported=supportsRedesign(document),source=document.capabilities?.includes('source-corne-v4');
  useLayoutEffect(()=>{const node=composer.current;if(!visible||!node)return;const measure=()=>onComposerHeight(Math.ceil(node.getBoundingClientRect().height));measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();},[visible,supported,onComposerHeight]);
  useEffect(()=>{if(!busy)return;const started=Date.now();setElapsed(0);const timer=setInterval(()=>setElapsed(Math.floor((Date.now()-started)/1000)),1000);return()=>clearInterval(timer);},[busy]);
  useEffect(()=>{
    request.current?.abort();baseline.current=document;submitted.current=document;hydrated.current=false;setHydrationKey(null);setResult(null);setLive(null);setTrace([]);setEntries([]);setInspectCommitted(false);setAnswer('');setApplied(false);setError('');setBrief('');setCheckId('');
    let restored=defaultDesignConstraints;
    try{const raw=JSON.parse(localStorage.getItem(key)||'null');if(raw){const original=validateDeviceDocument(raw.baseline);if(original.id===document.id&&supportsRedesign(original)){baseline.current=original;restored=designConstraintsSchema.parse(raw.constraints);}}}catch{}
    try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(Array.isArray(saved?.conversation)){const history:Entry[]=saved.conversation.filter((e:Entry)=>['user','assistant'].includes(e.role)&&typeof e.text==='string').slice(-16).map((e:Entry)=>({role:e.role,text:e.text.slice(0,2500),citations:(Array.isArray(e.citations)?e.citations:[]).slice(0,4).flatMap(c=>{const parsed=citationSchema.safeParse(c);return parsed.success?[parsed.data]:[];}),...(typeof e.model==='string'?{model:e.model.slice(0,100)}:{})}));setEntries(history);}}catch{}
    try{const saved=JSON.parse(localStorage.getItem(`flare-notebook-v1:${document.id}`)||'null');setSources(saved?resolveSources(saved.map((s:unknown)=>designSourceSchema.parse(s))):builtinSources);}catch{setSources(builtinSources);}
    setAnswerCitations([]);setVisualNotes([]);setVisualReviews([]);setReviewedView('');setConstraints(restored);hydrated.current=true;setHydrationKey(key);return()=>request.current?.abort();
    // Study identity changes only when a different assembly is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key]);
  useEffect(()=>{if(hydrationKey===key&&supported)try{localStorage.setItem(key,JSON.stringify({baseline:baseline.current,constraints,conversation:entries.slice(-16)}));}catch{}},[key,constraints,supported,entries,hydrationKey]);
  useEffect(()=>{if(hydrationKey!==key)return;try{localStorage.setItem(`flare-notebook-v1:${document.id}`,JSON.stringify(sources.filter(s=>s.origin==='upload')));setNotebookWarning('');}catch{setNotebookWarning('Notebook storage is full. Export the notebook to retain your files.');}},[sources,document.id,key,hydrationKey]);
  const updateSources=(next:DesignSource[])=>{setSources(next);setResult(null);setLive(null);setAnswerCitations([]);setInspectCommitted(false);setAnswer('The notebook changed. Ask again to check the updated source material.');onPreview(null);};
  const openCitation=(citation:SourceCitation)=>{setSourceCitation(citation);setNotebook(true);setEvidence(false);};
  const closeNotebook=useCallback(()=>setNotebook(false),[]);
  useEffect(()=>{if(applied&&result&&fingerprint!==documentFingerprint(result.document)){setApplied(false);setResult(null);setAnswer('The assembly changed. Your constraints are still here.');onPreview(null);}},[fingerprint,applied,result,onPreview]);
  useEffect(()=>{onEvidence(visible&&evidence);return()=>onEvidence(false);},[visible,evidence,onEvidence]);
  useEffect(()=>{if(!evidence&&!historyOpen)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape'){setEvidence(false);setHistoryOpen(false);}};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[evidence,historyOpen]);
  const stale=!!result&&!applied&&fingerprint!==result.baseFingerprint,selectedAttempt=result?.attempts[revision];
  const proposal=useMemo(()=>{
    if(live)return live.document;
    if(selectedAttempt?.plan)try{return buildRedesign(submitted.current,selectedAttempt.plan,baseline.current);}catch{}
    return result?.document||document;
  },[live,result,selectedAttempt,document]);
  const currentDocument=result&&!applied&&!stale?proposal:document;
  const existingChecks=useMemo(()=>{
    if(!supported||!document.parts.some(p=>p.id==='wireless-battery'))return [];
    try{return [...checkRedesign(baseline.current,document,constraints),...documentSourceRequirements(document,constraints,sources)];}catch{return [];}
  },[document,constraints,supported,sources]);
  const checks=live?.attempt.checks||selectedAttempt?.checks||existingChecks;
  const chosenCheck=checks.find(c=>c.id===checkId)||checks.find(c=>c.status==='fail'&&c.metrics)||checks.find(c=>c.status==='fail'&&c.region)||checks.find(c=>c.status==='fail'&&c.id.startsWith('source-'))||checks.find(c=>c.id==='space-wireless-controller');
  const hasHardware=document.parts.some(p=>p.id==='wireless-controller');
  const previewDocument=comparison==='before'?submitted.current:proposal;
  const previewActive=visible&&!applied&&!stale&&!!(result||live);
  useEffect(()=>{
    const inspectCurrent=visible&&inspectCommitted&&hasHardware&&!previewActive;
    onPreview(previewActive||inspectCurrent?{document:inspectCurrent?document:previewDocument,checks:inspectCurrent||comparison==='proposal'?checks:[],emphasize:inspectCurrent||comparison==='proposal',pending:!inspectCurrent,measurement:inspectCurrent||comparison==='proposal'?chosenCheck?.measurement:undefined}:null);
    return()=>onPreview(null);
  },[previewActive,previewDocument,checks,chosenCheck,comparison,onPreview,inspectCommitted,visible,hasHardware,document]);
  const selected=currentDocument.parts.find(p=>p.id===selectedPartId),failed=checks.filter(c=>c.status==='fail');
  const reset=()=>{if(busyRef.current)return;baseline.current=document;submitted.current=document;setConstraints({...defaultDesignConstraints});setResult(null);setLive(null);setTrace([]);setEntries([]);setInspectCommitted(false);setAnswer('');setApplied(false);setCheckId('');setError('');onPreview(null);};
  const inspect=(check=chosenCheck)=>{if(!check)return;if(hasHardware)setInspectCommitted(true);setCheckId(check.id);setComparison('proposal');onInspect(check);};
  async function run(event?:FormEvent,text=brief,view?:{mimeType:'image/jpeg';data:string}){
    event?.preventDefault();if(busyRef.current||!text.trim()||!supported)return;
    busyRef.current=true;setBusy(true);onBusy(true);setError('');setProgress('Looking at the current object…');setBrief('');setHistoryOpen(false);setAnswerCitations([]);setVisualNotes([]);if(!view)setReviewedView('');
    const controller=new AbortController();request.current=controller;const deadline=setTimeout(()=>controller.abort(new DOMException('Request timed out','TimeoutError')),285000);
    const current=result&&!applied&&!stale&&result.status==='ready'?result.document:live?.document||currentDocument;
    const previousInput=submitted.current;
    setEntries(old=>[...old.slice(-15),{role:'user',text}]);
    // Existing measured evidence can be revealed immediately, while Argon interprets the question.
    if(/why|fit|room|space|clearance/i.test(text)&&chosenCheck)inspect(chosenCheck);
    try{
      const payload=JSON.stringify({sources:sources.filter(s=>s.origin==='upload'),...(view?{view}:{}),document:current,baseline:baseline.current,prompt:text,constraints,conversation:true,...(selected?{partId:selected.id}:{}),history:entries.slice(-8).map(e=>({role:e.role,text:e.text.slice(0,2500)}))});if(new TextEncoder().encode(payload).byteLength>4000000)throw new Error('This request exceeds the 4 MB design budget. Remove a large visual attachment or use its text version.');
      const response=await fetch('/api/redesign',{method:'POST',headers:{'content-type':'application/json',accept:'application/x-ndjson'},body:payload,signal:controller.signal});
      const value=await readDeviceResponse<ObjectConversationResult>(response,update=>{
        setProgress(update.message);onProgress?.(update.message);if(update.model)setModel(update.model);
        if(update.attempt?.plan&&update.constraints){
          try{const plan=redesignPlanSchema.parse(update.attempt.plan),limits=designConstraintsSchema.parse(update.constraints),doc=buildRedesign(current,plan,baseline.current),localChecks=[...checkRedesign(baseline.current,doc,limits,plan.unsupportedConstraints),...sourceRequirements(plan,limits,sources)];submitted.current=current;setLive({document:doc,constraints:limits,attempt:{...update.attempt,plan,checks:localChecks}});setComparison('proposal');setApplied(false);setCheckId('');}catch{}
        }
      });controller.signal.throwIfAborted();setModel(value.model);setAnswerCitations(value.grounding?.citations||[]);
      if(value.kind==='explanation'){
        setLive(null);submitted.current=previousInput;setAnswer(value.answer);onReply?.(value.answer);setVisualNotes(value.visualInput?value.visualNotes||[]:[]);if(value.visualReview&&view)setVisualReviews(old=>[...old.slice(-3),{...value.visualReview!,image:`data:image/jpeg;base64,${view.data}`,documentFingerprint:documentFingerprint(current)}]);setSuggestions(value.suggestions);
        setEntries(old=>[...old,{role:'assistant',text:value.answer,citations:value.grounding?.citations||[],model:value.model}]);
        if(value.actions.length)onActions(value.actions);
        if(value.checkId){if(hasHardware)setInspectCommitted(true);setCheckId(value.checkId);const check=checks.find(c=>c.id===value.checkId);if(check)onInspect(check);}
      }else{
        value.document=validateDeviceDocument(value.document);value.constraints=designConstraintsSchema.parse(value.constraints);
        const finalPlan=value.attempts.at(-1)?.plan;const verified=[...checkRedesign(baseline.current,value.document,value.constraints,value.checks.filter(c=>c.id.startsWith('unsupported-')).map(c=>c.detail)),...(finalPlan?sourceRequirements(finalPlan,value.constraints,sources):[])];
        if(value.status==='ready'&&verified.some(c=>c.status==='fail'))throw new Error('The returned layout did not pass the local check. Your assembly is unchanged.');
        value.baseFingerprint=fingerprint;submitted.current=current;setLive(null);setResult(value);setInspectCommitted(false);setConstraints(value.constraints);setRevision(value.attempts.length-1);setComparison('proposal');setApplied(false);setCheckId('');
        const {document:_geometry,...audit}=value;setTrace(old=>[...old.slice(-7),{request:text,result:audit}]);
        const line=value.attempts.at(-1)?.summary||value.summary;setAnswer(line);onReply?.(line);setSuggestions(value.status==='blocked'?['Explain the conflict using the documents.','Use normal 100 mA charging. Keep the other constraints.']:['Use at least 500 mA charging. Keep the same case.','Show the charging connection.','Which source supports this?']);
        setEntries(old=>[...old,{role:'assistant',text:line,citations:value.grounding?.citations||[],model:value.model}]);
      }
    }catch(error){setLive(null);submitted.current=previousInput;const message=controller.signal.aborted?controller.signal.reason?.name==='TimeoutError'?'That request timed out. Your assembly is unchanged.':'Cancelled. Your assembly is unchanged.':error instanceof Error?error.message:'The object could not answer that request.';setError(message);onReply?.(message);}
    finally{clearTimeout(deadline);request.current=null;busyRef.current=false;setBusy(false);onBusy(false);}
  }
  const agentRun=useRef(run);agentRun.current=run;
  useEffect(()=>{if(!visible)return;onAgent?.({ask:text=>{void agentRun.current(undefined,text);},cancel:()=>request.current?.abort()});return()=>onAgent?.(null);},[visible,onAgent]);
  async function reviewView(){
    const canvas=window.document.querySelector<HTMLCanvasElement>('.ds-scene canvas');if(!canvas){setError('The 3D view is not ready.');return;}
    try{await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));const target=window.document.createElement('canvas');const scale=Math.min(1,1200/canvas.width);target.width=Math.round(canvas.width*scale);target.height=Math.round(canvas.height*scale);const context=target.getContext('2d');if(!context)throw new Error('Could not capture the scene.');context.fillStyle='#f8f1ee';context.fillRect(0,0,target.width,target.height);context.drawImage(canvas,0,0,target.width,target.height);const url=target.toDataURL('image/jpeg',.78);if(url.length>800000)throw new Error('This view is too large. Try a smaller window.');setReviewedView(url);await run(undefined,'Inspect this actual canvas view against the design documents. Describe what is visible, what is obscured, and what this image cannot verify.',{mimeType:'image/jpeg',data:url.split(',')[1]});}catch(error){setError(error instanceof Error?error.message:'This view could not be captured.');}
  }
  const apply=()=>{
    if(!result||result.status!=='ready'||stale||busy||applied||comparison!=='proposal'||revision!==result.attempts.length-1)return;
    const plan=result.attempts.at(-1)?.plan;if(!plan)return;const verified=[...checkRedesign(baseline.current,result.document,constraints,result.checks.filter(c=>c.id.startsWith('unsupported-')).map(c=>c.detail)),...sourceRequirements(plan,constraints,sources)];
    if(verified.some(c=>c.status==='fail')){setError('This layout no longer passes its constraints. Ask for a new revision.');return;}
    onPreview(null);onApply(result.document);setApplied(true);setAnswer('Applied to your assembly. You can undo the complete change.');
  };
  const exportReport=useCallback(()=>{download('Morf-conversation-review.json',JSON.stringify({format:'flare-grounded-design-v1',designSources:sources,visualReviews,createdAt:new Date().toISOString(),baseline:baseline.current,input:submitted.current,document,result,constraints,conversation:entries,revisions:trace,hardwareSources:hardwareCatalog,scope:'Source CAD plus labeled reconstructed details; model checks do not establish physical or electrical operation.'},null,2));},[document,result,constraints,entries,trace,sources,visualReviews]);
  if(!visible)return null;
  if(!supported)return <div className="fx-dialogue-welcome"><span><Sparkles size={14}/>A CONVERSATION WITH AN OBJECT</span><h2>Start with something<br/>you can look inside.</h2><p>Open the documented Corne keyboard. Ask how a key works, then give it a new possibility.</p><button onClick={onKeyboard}>Open the source keyboard<ArrowRight size={15}/></button><button className="fx-dialogue-dismiss" onClick={onClose}>Back to this object</button></div>;
  const stats=sourceStats(sources);
  const metrics=chosenCheck?.metrics;
  const sourceFailure=checks.find(c=>c.status==='fail'&&c.id==='source-charge-limit');
  const headline=stale?'Your assembly changed. Let’s check it again.':live?'A revision is taking shape.':result?.status==='blocked'&&sourceFailure?'The fit is only half the story.':result?.status==='blocked'&&metrics?`${(Math.round(metrics.availableMm*100)/100).toFixed(2)} mm here. ${metrics.requiredMm.toFixed(2)} mm needed.`:result?.status==='blocked'?'These requirements conflict.':applied?'Your idea is now in the assembly.':result?'A new layout, inside the same case.':hasHardware?'Look inside the current layout.':'An idea is only the beginning.';
  const activeConstraints=live?.constraints||constraints;
  return <>
    <section className="fx-object-story" aria-label="Object conversation result">
      <div className="fx-story-top"><button className="fx-source-pill" onClick={()=>setEvidence(true)}><ShieldCheck size={12}/>{source?'CORNE · SOURCE CAD':'ILLUSTRATIVE STUDY'}<ArrowUpRight size={11}/></button><button aria-label="Close object conversation" onClick={onClose} disabled={busy}><X size={14}/></button></div>
      <span className="fx-story-kicker">{live?'CHECKING A REVISION':applied?'APPLIED':result?.status==='blocked'?'THE TRADEOFF':result?'YOUR IDEA, MADE VISIBLE':hasHardware?'YOUR CURRENT ASSEMBLY':'FOLLOW YOUR CURIOSITY'}</span>
      <h2>{headline}</h2>
      <p>{result?.status==='blocked'?sourceFailure?'The proposed charging current exceeds the cell’s documented limit. Open the source, or ask for a different charging rate.':'These requirements conflict. Open the evidence to see the measured or documented limit.':result?'Look through the original enclosure to see the proposed parts. The outlines show the complete checked envelopes. Details inside them are illustrative.':'For makers adapting existing hardware. Keep your case, change the design, and find the conflict before you build.'}</p>
      {!!chosenCheck&&<button className="fx-story-show" onClick={()=>inspect()}>{metrics?'Show this space':chosenCheck.id.startsWith('source-')?'Show the charging pair':chosenCheck.status==='fail'?'Show the obstruction':chosenCheck.id==='usb'?'Show the connection':'Show in the object'}<ArrowRight size={13}/></button>}
      <button className="fn-notebook-open" aria-expanded={notebook} onClick={()=>{setNotebook(true);setSourceCitation(undefined);setEvidence(false);}}><BookOpen size={15}/><span>Design notebook<small>{stats.files} sources · {Math.round(stats.characters/1000)}k characters</small></span><ArrowUpRight size={13}/></button>
      <button className="fn-view-review" disabled={busy||available!==true} onClick={()=>void reviewView()}><Eye size={13}/>Inspect this view with Gemini<ArrowUpRight size={12}/></button>
      <button className="fx-evidence-link" aria-expanded={evidence} onClick={()=>setEvidence(!evidence)}>Show evidence<ArrowUpRight size={12}/></button>
    </section>
    <section ref={composer} className="fx-object-composer" aria-label="Conversation with the object">
      <div className="fx-dialogue-constraints" aria-label="Active design constraints"><span><Check size={10}/>Same case + PCB</span><span><Check size={10}/>USB charging ≥ {activeConstraints.minChargeMa} mA</span>{activeConstraints.maxBatteryHeight!==null&&<span>Battery ≤ {activeConstraints.maxBatteryHeight} mm</span>}{activeConstraints.keepPad&&<span>Keep acoustic insert</span>}{activeConstraints.batterySide!=='any'&&<span>Battery on {activeConstraints.batterySide}</span>}</div>
      {(answer||busy||error)&&<div className={`fx-object-answer ${error?'has-error':''}`} role={error?'alert':'status'}>{busy?<><LoaderCircle size={15} className="ds-spin"/><span>{progress}<small>{elapsed}s · {model||'Gemini'}</small></span></>:<><span className="fx-answer-dot"/><p>{error||answer}</p></>}</div>}
      {!!answerCitations.length&&!busy&&<div className="fn-answer-citations">{answerCitations.filter((citation,index,list)=>list.findIndex(c=>c.sourceId===citation.sourceId&&c.page===citation.page)===index).map((citation,index)=><button key={`${citation.sourceId}-${index}`} onClick={()=>openCitation(citation)}><FileSourceIcon/><span>{sources.find(s=>s.id===citation.sourceId)?.name||citation.sourceId}</span><small>{sources.find(s=>s.id===citation.sourceId)?.kind==='pdf'?'p.':'§'}{citation.page}</small><ArrowUpRight size={10}/></button>)}</div>}
      {!!visualNotes.length&&!busy&&<details className="fn-visual-result"><summary><Eye size={12}/>Gemini inspected this rendered view · {visualNotes.length} observations</summary><div>{reviewedView&&<img src={reviewedView} alt="Canvas image sent to Gemini for this visual review"/>}<ul>{visualNotes.map((note,index)=><li key={index}>{note}</li>)}</ul></div></details>}
      {notebookWarning&&<small className="fn-storage-warning">{notebookWarning}</small>}
      {previewActive&&!busy&&<div className="fx-object-review"><div className="fx-view-compare" aria-label="Compare design"><button aria-pressed={comparison==='before'} onClick={()=>setComparison('before')}>Before</button><button aria-pressed={comparison==='proposal'} onClick={()=>setComparison('proposal')}>Proposed</button></div><div className="fx-revision-dots" aria-label="Design revisions">{result?.attempts.map((attempt,index)=><button key={attempt.number} aria-label={`Inspect revision ${attempt.number}`} aria-pressed={revision===index} onClick={()=>{setRevision(index);setComparison('proposal');setCheckId('');}}>{attempt.checks.some(c=>c.status==='fail')?<CircleAlert size={12}/>:<CheckCircle2 size={12}/>}R{attempt.number}</button>)}</div><span>{failed.length?`${failed.length} unresolved`:'Listed checks passed'}</span><button className="fx-apply-inline" disabled={result?.status!=='ready'||comparison!=='proposal'||revision!==result.attempts.length-1||stale} onClick={apply}>Apply proposal<ArrowRight size={12}/></button></div>}
      <form onSubmit={event=>void run(event)}>
        <Sparkles size={18}/><textarea ref={input} aria-label="Ask or change this object" rows={1} value={brief} onChange={event=>setBrief(event.target.value)} maxLength={4000} placeholder={selected?`Ask about ${selected.name.toLowerCase()}…`:'Ask why. Ask how. Ask “what if”…'} disabled={busy} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();void run();}}}/>
        {selected&&<span className="fx-context-part">{selected.name}</span>}
        {busy?<button type="button" className="fx-cancel-dialogue" onClick={()=>request.current?.abort()}>Cancel</button>:<button type="submit" aria-label="Send to object" disabled={!brief.trim()||available!==true}><Send size={16}/></button>}
      </form>
      <div className="fx-dialogue-bottom"><div className="fx-dialogue-prompts">{(!result&&!answer?['Make it wireless, keep the case and USB charging.','Could this cell use 500 mA charging?','Show how a key works.']:suggestions).slice(0,3).map(text=><button key={text} disabled={busy} onClick={()=>{setBrief(text);input.current?.focus();}}>{text.replace(/\.$/,'')}<ArrowUpRight size={10}/></button>)}</div><button className="fn-mobile-view" aria-label="Inspect this view with Gemini" title="Inspect this view with Gemini" disabled={busy||available!==true} onClick={()=>void reviewView()}><Eye size={14}/></button><button aria-label="Conversation history" aria-expanded={historyOpen} onClick={()=>setHistoryOpen(!historyOpen)}><History size={14}/><span>{entries.length||''}</span></button>{applied&&canUndo&&<button onClick={onUndo}><RotateCcw size={12}/>Undo</button>}</div>
      {available===null&&<small className="fx-dialogue-connection">Checking the Gemini connection…</small>}{available===false&&<small className="fx-dialogue-connection">Gemini is unavailable. Your object remains explorable.</small>}
      {historyOpen&&<div className="fx-dialogue-history" aria-label="Conversation history">{entries.length?entries.map((entry,index)=><p key={index} className={entry.role}><strong>{entry.role==='user'?'YOU':'MORF'}</strong>{entry.text}{!!entry.citations?.length&&<span className="fn-history-cites">{entry.citations.filter(c=>sources.some(s=>s.id===c.sourceId)).map((citation,i)=><button key={i} onClick={()=>openCitation(citation)}><BookOpen size={10}/>Source {i+1} · {citation.page}</button>)}</span>}</p>):<p>Your conversation will stay here while you explore.</p>}</div>}
    </section>
    {notebook&&<SourceNotebook sources={sources} onChange={updateSources} onClose={closeNotebook} citation={sourceCitation} disabled={busy}/>}
    {evidence&&<aside className="fx-object-evidence" aria-label="Design evidence"><header><span><FlaskConical size={14}/>BEHIND THE ANSWER</span><button aria-label="Close evidence" onClick={()=>setEvidence(false)}><X size={16}/></button></header><div className="fx-evidence-scroll"><h2>What we know.<br/>What we checked.</h2><p>{document.provenance}</p><h3>Geometry + document checks <small>{checks.filter(c=>c.status==='pass').length} passed · {failed.length} unresolved</small></h3>{checks.length?checks.map(check=><details key={check.id} className={`fx-check ${check.status}`} open={check.status==='fail'}><summary>{check.status==='pass'?<CheckCircle2 size={13}/>:<CircleAlert size={13}/>}<span>{check.title}</span><small>{check.status==='unverified'?'UNVERIFIED':check.status.toUpperCase()}</small></summary><p>{check.detail}</p>{check.citations?.map((citation,index)=><button key={index} onClick={()=>openCitation(citation)}><BookOpen size={11}/>Read the source excerpt<ArrowUpRight size={11}/></button>)}{check.title==='Battery charge-current limit'&&<small>Comparison of documented values; no bench test.</small>}{!!check.partIds.length&&<button onClick={()=>inspect(check)}>Show in the object<ArrowUpRight size={11}/></button>}</details>):<p>Ask for a design change to check a proposed layout.</p>}<h3>Source geometry</h3>{source&&<a href="/assemblies/corne/sources.json" target="_blank" rel="noreferrer"><span><strong>Source manifest and registration</strong><small>File hashes, conversion settings, attribution</small></span><ArrowUpRight size={13}/></a>}{document.parts.filter(p=>['keyboard-case-base','keyboard-case-frame','keyboard-pcb'].includes(p.id)&&p.sourceUrl).map(p=><a key={p.id} href={p.sourceUrl} target="_blank" rel="noreferrer"><span><strong>{p.name}</strong><small>{p.specs['Geometry basis']||p.specs['Geometry source']||'Source reference'}</small></span><ArrowUpRight size={13}/></a>)}<h3>Component dimensions</h3>{hardwareCatalog.filter(item=>!result||result.sourceIds.includes(item.id)).map(item=><a key={item.id} href={item.sourceUrl} target="_blank" rel="noreferrer"><span><strong>{item.name}</strong><small>{item.sourceDimensions}{item.geometryNote?` · ${item.geometryNote}`:''}</small></span><ArrowUpRight size={13}/></a>)}{hardwareCatalog.filter(item=>item.extraSourceUrl&&(!result||result.sourceIds.includes(item.id))).map(item=><a key={`${item.id}-drawing`} href={item.extraSourceUrl} target="_blank" rel="noreferrer"><span><strong>{item.name} · community footprint</strong><small>Separate provenance for horizontal dimensions</small></span><ArrowUpRight size={13}/></a>)}<p>Case registration, manufacturing tolerances, wiring, leads, battery swelling, mounting, RF, charging and firmware require engineering verification. A model check is not a working hardware claim.</p><button className="fx-evidence-export" onClick={exportReport}><Download size={13}/>Export the conversation and evidence</button><button className="fx-evidence-reset" disabled={busy} onClick={reset}><RotateCcw size={13}/>Start a new study</button></div></aside>}
  </>;
}

function FileSourceIcon(){return <BookOpen size={11}/>;}
