import type {DeviceDocument} from './types';
import {validateDeviceDocument} from './validation';
import {catalogJsonReplacer} from './catalog';
import {qualityFingerprint,sha256} from './quality-fingerprint';
import {qualityReportSchema,qualityRoundSchema,requirementsFromRequest,measuredCheckSchema,type MeasuredCheck,type QualityReport,type QualityRound,type ReviewFrame} from './quality-types';
import {designContractSchema,constraintFailure,type DesignContract} from './constraint-types';
import type {QualityInput,QualityResponse} from './quality-engine';
export type QualityProgress={stage:'planning'|'rendering'|'reviewing'|'repairing'|'complete';message:string;document:DeviceDocument;rounds:QualityRound[];frames?:ReviewFrame[];contract?:DesignContract;baselineChecks?:MeasuredCheck[]};
type Prepared={contract:DesignContract;baselineChecks:MeasuredCheck[]};
type Dependencies={captureMotion?:typeof import('./motion-capture').captureMotionViews;capture?:(document:DeviceDocument,signal:AbortSignal,scene?:unknown,referenceFrames?:ReviewFrame[])=>Promise<ReviewFrame[]>;review?:(input:QualityInput,signal:AbortSignal)=>Promise<QualityResponse>;prepare?:(request:string,baseline:DeviceDocument,candidate:DeviceDocument,signal:AbortSignal)=>Promise<Prepared>};
async function prepare(request:string,baseline:DeviceDocument,candidate:DeviceDocument,signal:AbortSignal):Promise<Prepared>{
 const response=await fetch('/api/constraints',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({request,baseline,candidate},catalogJsonReplacer),signal});const value=await response.json();if(!response.ok)throw new Error(value.error||'The design goals could not be prepared.');return {contract:designContractSchema.parse(value.contract),baselineChecks:value.baselineChecks.map((c:unknown)=>measuredCheckSchema.parse(c))};
}
async function requestReview(input:QualityInput,signal:AbortSignal):Promise<QualityResponse>{
 const response=await fetch('/api/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input,catalogJsonReplacer),signal});let value;try{value=await response.json();}catch{throw new Error('The visual review connection ended unexpectedly. Your saved object is unchanged.');}if(!response.ok)throw new Error(value.error||'The visual review could not finish.');return value;
}
const score=(round:QualityRound)=>round.observations.filter(o=>o.status==='issue').length+round.checks.filter(constraintFailure).length;
const issueIds=(round:QualityRound)=>new Set([...round.observations.filter(o=>o.status==='issue').map(o=>o.requirementId),...round.checks.filter(constraintFailure).map(c=>c.id)]);
/** Review every applied candidate. An unreviewed patch can never be the returned best result. */
export async function improveWithVisualReview(initial:DeviceDocument,request:string,signal:AbortSignal,onProgress?:(progress:QualityProgress)=>void,scene?:unknown,dependencies:Dependencies={},baselineDocument:DeviceDocument=initial):Promise<{document:DeviceDocument;report:QualityReport}>{
 request=request.trim();
 if(initial.mechanisms?.some(m=>m.verification)){const {improveMotionReview}=await import('./motion-client');return improveMotionReview(initial,request,signal,onProgress,{capture:dependencies.capture??(await import('./review-renderer')).captureReviewViews,captureMotion:dependencies.captureMotion,review:dependencies.review??requestReview},baselineDocument);}
 const started=Date.now(),{review:_baselineReview,...baseline}=validateDeviceDocument(baselineDocument);
 const validated=validateDeviceDocument(initial),{review:_previous,...clean}=validated,requirements=requirementsFromRequest(request),initialHash=await qualityFingerprint(clean),rounds:QualityRound[]=[];
 const operation=AbortSignal.any([signal,AbortSignal.timeout(180000)]),capture=dependencies.capture??(await import('./review-renderer')).captureReviewViews,review=dependencies.review??requestReview;
 let current:DeviceDocument=clean,best:DeviceDocument=clean,bestHash=initialHash,bestScore=Infinity,bestRound:QualityRound|undefined,error:string|undefined,status:QualityReport['status']='needs-attention',contract:DesignContract|undefined,baselineChecks:MeasuredCheck[]|undefined,referenceFrames:ReviewFrame[]|undefined;
 const emit=(value:QualityProgress)=>onProgress?.({...value,contract,baselineChecks});
 try{
  // Custom review adapters may opt into their own planning adapter. The app always plans.
  const planner=dependencies.prepare??(!dependencies.review?prepare:undefined);
  if(planner){emit({stage:'planning',message:'Turning your request into fixed, measurable design checks…',document:current,rounds:[]});const prepared=await planner(request,baseline,clean,operation);contract=designContractSchema.parse(prepared.contract);baselineChecks=prepared.baselineChecks.map(c=>measuredCheckSchema.parse(c));if(contract.request!==request||contract.baselineHash!==await qualityFingerprint(baseline))throw new Error('The planned checks do not match this request and its original design.');}
  for(let number=0;number<=2;number++){
  operation.throwIfAborted();emit({stage:'rendering',message:number?`Rendering revision ${number} from its actual geometry…`:'Rendering the assembled, top and exploded views…',document:current,rounds:[...rounds]});
  const frames=await capture(current,operation,scene,referenceFrames),hash=await qualityFingerprint(current);operation.throwIfAborted();
  if(referenceFrames?.some(original=>original.framing&&JSON.stringify(original.framing)!==JSON.stringify(frames.find(f=>f.view===original.view)?.framing)))throw new Error('The comparison camera changed during the review.');referenceFrames??=frames;
  emit({stage:'reviewing',message:number?`Argon is checking revision ${number} against the original request…`:'Argon is inspecting the three rendered views and measured checks…',document:current,rounds:[...rounds],frames});
  const response=await review({request,requirements,document:current,frames,round:number,allowRepair:number<2,previous:rounds.map(({summary,observations})=>({summary,observations})),...(contract?{contract,baseline}:{})},operation);operation.throwIfAborted();
  const round=qualityRoundSchema.parse(response.round);if(round.number!==number||round.documentHash!==hash||round.frames.some(f=>f.documentHash!==hash)||round.observations.length!==requirements.length||new Set(round.observations.map(o=>o.requirementId)).size!==requirements.length||round.observations.some(o=>!requirements.some(r=>r.id===o.requirementId)))throw new Error('The review did not match the rendered candidate and its fixed requirements.');
  if(contract&&(round.contractHash!==contract.hash||[...contract.goals.map((_,i)=>`design-${i+1}`),...contract.unverified.map((_,i)=>`design-unverified-${i+1}`),...(contract.retainedPlacements?.length?['design-retained-containment']:[])].some(id=>!round.checks.some(c=>c.id===id&&c.category==='design'&&c.required))))throw new Error('The review changed or omitted a fixed design check.');
  for(const frame of round.frames){const sent=frames.find(f=>f.view===frame.view);if(!sent||frame.data!==sent.data||frame.imageHash!==await sha256(Uint8Array.from(atob(sent.data),c=>c.charCodeAt(0)))||JSON.stringify(frame.framing)!==JSON.stringify(sent.framing))throw new Error('The recorded review images differ from the renders that were sent.');}
  rounds.push(round);const currentScore=score(round),previousIssues=bestRound&&issueIds(bestRound),newIssues=issueIds(round);
  if(bestRound&&(currentScore>bestScore||[...newIssues].some(id=>!previousIssues!.has(id)))){round.rejected=true;round.repairNote='This revision introduced a new issue or increased the failed checks. The better earlier candidate is retained while any remaining scoped correction is reviewed.';}
  if(!round.rejected&&currentScore<bestScore){best=current;bestHash=hash;bestScore=currentScore;bestRound=round;}
  if(currentScore===0){status='reviewed';break;}
  if(!response.nextDocument||number===2)break;
  const next=validateDeviceDocument(response.nextDocument),nextHash=await qualityFingerprint(next);if(!response.nextHash||nextHash!==response.nextHash||nextHash===hash)break;
  emit({stage:'repairing',message:`Preparing a scoped correction to ${round.changedPartIds.length} ${round.changedPartIds.length===1?'part':'parts'}…`,document:next,rounds:[...rounds]});current=next;
 }}catch(e){if(signal.aborted)throw e;error=operation.aborted?'The visual review reached its time limit. The saved object is unchanged.':e instanceof Error?e.message:'The visual review could not finish.';status='incomplete';}
 const baselineProject=JSON.stringify(baseline,catalogJsonReplacer);
 const report=qualityReportSchema.parse({version:1,request,requirements,status,...(baselineProject.length<=2500000?{baselineProject}:{}),initialHash,finalHash:bestHash,rounds,createdAt:new Date().toISOString(),durationMs:Date.now()-started,...(contract?{contract,baselineChecks}:{}),limitations:['Visual findings are model judgments. Design checks measure supported geometry; request-to-check mapping is an AI interpretation.','Fixed studio cameras show static geometry; software fallback renders omit texture maps, transparency and reflective finishes.','Tolerances, mechanical fastening, loads, wiring, firmware and electrical operation remain unverified.'],...(error?{error}:{})});
 const document=validateDeviceDocument({...best,review:report});emit({stage:'complete',message:status==='reviewed'?'Review complete. Inspect the measured checks and remaining limits.':'A draft is ready to inspect. The saved object is unchanged.',document,rounds:[...rounds]});return {document,report};
}
export function requiresVisualReview(before:DeviceDocument,after:DeviceDocument){
 const geometry=(document:DeviceDocument)=>document.parts.map(p=>({id:p.id,position:p.position,rotation:p.rotation,size:p.size,assetNode:p.assetNode,catalogRef:p.catalogRef,attachment:p.attachment,solids:p.solids.map(({color:_color,metalness:_metal,roughness:_rough,...s})=>s)}));
 return JSON.stringify(geometry(before))!==JSON.stringify(geometry(after));
}
