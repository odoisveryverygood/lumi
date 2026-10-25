import type {MotionResult} from './motion-types';
import type {DeviceDocument} from './types';
import type {QualityInput,QualityResponse} from './quality-engine';
import {qualityReportSchema,qualityRoundSchema,requirementsFromRequest,type MotionFrame,type QualityReport,type QualityRound,type ReviewFrame} from './quality-types';
import {qualityFingerprint,sha256,stableEvidenceJson} from './quality-fingerprint';
import {validateDeviceDocument} from './validation';
import {catalogJsonReplacer} from './catalog';
import {motionPreservationIssues,verifyMotion} from './motion-verification';
import type {QualityProgress} from './quality-client';
import type {captureMotionViews} from './motion-capture';

type Dependencies={localOnly?:boolean;capture:(document:DeviceDocument,signal:AbortSignal,scene?:unknown,reference?:ReviewFrame[])=>Promise<ReviewFrame[]>;captureMotion?:typeof captureMotionViews;review:(input:QualityInput,signal:AbortSignal)=>Promise<QualityResponse>};
const failures=(round:QualityRound)=>new Set([
 ...round.observations.filter(o=>o.status!=='met').map(o=>`request:${o.requirementId}`),
 ...round.checks.filter(c=>c.status==='fail'||c.required&&c.status!=='pass').map(c=>c.id),
 ...(round.motion?.result.findings.filter(f=>f.status!=='pass').map(f=>f.partIds.slice().sort().join('|'))??[]),
]);
export async function improveMotionReview(initial:DeviceDocument,request:string,signal:AbortSignal,onProgress:((p:QualityProgress)=>void)|undefined,dependencies:Dependencies,baselineDocument=initial):Promise<{document:DeviceDocument;report:QualityReport}>{
 const {review:_old,...clean}=validateDeviceDocument(initial),{review:_base,...baseline}=validateDeviceDocument(baselineDocument),mechanism=clean.mechanisms?.find(m=>m.verification);
 if(!mechanism)throw new Error('No explicit supported joint is available.');
 if(baseline.designBrief&&request.trim()!==baseline.designBrief.trim())throw new Error('This motion study uses its frozen design brief. Changing the brief requires a newly agreed joint contract.');
 const preservation=motionPreservationIssues(baseline,clean,mechanism.id);if(preservation.length)throw new Error(preservation.join(' '));
 const operation=AbortSignal.any([signal,AbortSignal.timeout(180000)]),captureMotion=dependencies.captureMotion??(await import('./motion-capture')).captureMotionViews;
 const started=Date.now(),initialHash=await qualityFingerprint(clean),requirements=requirementsFromRequest(request),rounds:QualityRound[]=[];
 let current=clean,retained=clean,status:QualityReport['status']='needs-attention',error:string|undefined,reference:ReviewFrame[]|undefined,motionReference:MotionFrame[]|undefined,pending:QualityRound|undefined,unverifiedMotion:MotionResult|undefined;
 const emit=(stage:QualityProgress['stage'],message:string)=>onProgress?.({stage,message,document:current,rounds:[...rounds]});
 try{for(let number=0;number<=2;number++){
  operation.throwIfAborted();emit('rendering','Measuring the frozen tilt poses and capturing the actual conflict witness…');
  // Yield before bounded CPU work so cancellation/progress can paint in the browser.
  await new Promise<void>(resolve=>setTimeout(resolve,0));operation.throwIfAborted();
  const joint=current.mechanisms!.find(m=>m.id===mechanism.id)!,result=verifyMotion(current,joint,operation),hash=await qualityFingerprint(current);
  if(result.status==='unverified'&&!result.checkedAngles.length){unverifiedMotion=result;throw new Error(result.findings.find(f=>f.status==='unverified')?.detail??result.limitations[0]??'Motion evidence is insufficient.');}
  const frames=await dependencies.capture(current,operation,undefined,reference);reference??=frames;
  const motionFrames=await captureMotion(current,joint,result,operation,motionReference);motionReference??=motionFrames;
  if(reference.some((f,i)=>JSON.stringify(f.framing)!==JSON.stringify(frames[i]?.framing))||motionReference.some((f,i)=>f.angleDeg!==motionFrames[i]?.angleDeg||JSON.stringify(f.framing)!==JSON.stringify(motionFrames[i]?.framing)))throw new Error('The comparison pose or framing changed.');
  const imageHash=async(f:ReviewFrame)=>sha256(Uint8Array.from(atob(f.data),c=>c.charCodeAt(0)));
  for(const finding of result.findings)finding.frameRefs=motionFrames.filter(f=>f.angleDeg===finding.angleDeg).map(f=>f.frameId);
  pending={number,motionProject:JSON.stringify(current,catalogJsonReplacer),documentHash:hash,model:'not-requested',summary:'Local measured evidence; provider review has not completed.',observations:requirements.map(r=>({requirementId:r.id,status:'unverifiable',partIds:[],view:'assembled',detail:'Provider review did not complete.'})),checks:[],frames:await Promise.all(frames.map(async f=>({...f,imageHash:await imageHash(f)}))),changedPartIds:[],motion:{result,frames:await Promise.all(motionFrames.map(async f=>({...f,imageHash:await imageHash(f)})))}};
  if(dependencies.localOnly){pending.model='local-geometry';pending.observations.forEach(o=>o.detail='Local measurement only; model review was not requested.');pending.summary='Local sampled geometry measurement only. No model request was made.';rounds.push(pending);pending=undefined;break;}
  emit('reviewing','Argon is reviewing the rendered poses, measured conflicts and permitted correction…');
  const response=await dependencies.review({request,requirements,document:current,baseline,frames,motionMechanismId:mechanism.id,motionFrames,round:number,allowRepair:number<2&&result.status==='fail',previous:rounds.map(({summary,observations})=>({summary,observations}))},operation);operation.throwIfAborted();
  const round=qualityRoundSchema.parse(response.round);
  if(round.number!==number||round.documentHash!==hash||stableEvidenceJson(round.motion)!==stableEvidenceJson(pending.motion)||stableEvidenceJson(round.frames)!==stableEvidenceJson(pending.frames)||round.observations.length!==requirements.length||new Set(round.observations.map(o=>o.requirementId)).size!==requirements.length||round.observations.some(o=>!requirements.some(r=>r.id===o.requirementId)))throw new Error('The server review did not match the frozen motion measurements and recorded images.');
  rounds.push(round);pending=undefined;
  const initialIssues=rounds[0]&&failures(rounds[0]),issues=failures(round);
  if(number&&[...issues].some(id=>!initialIssues.has(id))){round.rejected=true;round.repairNote='Rejected: this candidate introduced a new failed or unknown requirement/pair. The original is retained.';break;}
  if(result.status==='pass'&&issues.size===0){retained=current;status='reviewed';break;}
  if(!response.nextDocument||number===2||result.status!=='fail')break;
  const next=validateDeviceDocument(response.nextDocument),violations=motionPreservationIssues(baseline,next,mechanism.id),nextHash=await qualityFingerprint(next);
  if(violations.length)throw new Error(violations.join(' '));if(!response.nextHash||nextHash!==response.nextHash||nextHash===hash)throw new Error('The proposed motion correction has no matching changed document.');
  current=next;emit('repairing','Preparing a scoped transform correction; acceptance requires another measured review.');
 }}catch(e){if(signal.aborted)throw e;error=operation.aborted?'The bounded motion review timed out. The original is retained.':e instanceof Error?e.message:'Motion review failed.';error=error.slice(0,1500);status='incomplete';if(pending){pending.summary='Measured/rendered attempt retained; provider review failed.';pending.repairNote=error;rounds.push(pending);}}
 const finalHash=await qualityFingerprint(retained),report=qualityReportSchema.parse({version:1,request,requirements,status,initialHash,finalHash,rounds,createdAt:new Date().toISOString(),durationMs:Date.now()-started,motionMechanismId:mechanism.id,...(unverifiedMotion?{unverifiedMotion}:{}),baselineProject:JSON.stringify(baseline,catalogJsonReplacer),limitations:['Only the recorded finite tilt poses were measured. Clearance between samples remains unverified.','Original geometry, source identities, protected placements and the requested movement limits are preserved.','A candidate is retained only after geometry checks and provider review pass; errors or unknown checks preserve the original.'],...(error?{error}:{})});
 const document=validateDeviceDocument({...retained,review:report});onProgress?.({stage:'complete',message:status==='reviewed'?'Sampled motion review passed. Inspect evidence before applying.':'Original retained. Inspect failed or unverified evidence.',document,rounds});return {document,report};
}

export async function measureMotionLocally(document:DeviceDocument,request:string,signal:AbortSignal,onProgress?:(p:QualityProgress)=>void){return improveMotionReview(document,request,signal,onProgress,{localOnly:true,capture:(await import('./review-renderer')).captureReviewViews,review:async()=>{throw new Error('Local measurement does not call a provider.');}});}
