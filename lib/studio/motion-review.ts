import type {DeviceDocument} from './types';
import type {MotionFrame,QualityRound} from './quality-types';
import {qualityFingerprint,sha256} from './quality-fingerprint';
import {verifyMotion,motionPreservationIssues} from './motion-verification';
import {poseMotion} from './motion-pose';
import {deviceTransactionSchema} from './interaction';
import {RequestError} from '../ai';

/** Server recomputes all measurements; client verdicts and model prose are never an oracle. */
export async function prepareMotionReview(document:DeviceDocument,baseline:DeviceDocument,id:string,frames:MotionFrame[],signal:AbortSignal,dimensions:(bytes:Uint8Array)=>{width:number;height:number}):Promise<NonNullable<QualityRound['motion']>>{
 const issues=motionPreservationIssues(baseline,document,id);if(issues.length)throw new RequestError(400,issues.join(' '));
 const mechanism=document.mechanisms?.find(m=>m.id===id);if(!mechanism?.verification)throw new RequestError(400,'Explicit motion evidence is missing.');
 const result=verifyMotion(document,mechanism,signal),candidateHash=await qualityFingerprint(document);
 if(!frames.length||frames.length>3||new Set(frames.map(f=>f.angleDeg)).size!==frames.length)throw new RequestError(400,'Provide one to three distinct rendered motion poses.');
 const validated=await Promise.all(frames.map(async f=>{const posed=poseMotion(document,mechanism,f.angleDeg),hash=await qualityFingerprint(posed),bytes=Buffer.from(f.data,'base64'),size=dimensions(bytes);
  if(f.mechanismId!==id||f.candidateHash!==candidateHash||f.documentHash!==hash||f.view!=='assembled'||!f.framing||f.width!==size.width||f.height!==size.height||bytes.length>450000||f.visiblePartIds.some(id=>!document.parts.some(p=>p.id===id)))throw new RequestError(400,'Motion image metadata does not match the actual requested pose.');
  return {...f,imageHash:await sha256(bytes)};
 }));
 const witness=result.findings.find(f=>f.status==='fail');
 // Later rounds retain the original witness camera/angle; initial round must include its own witness.
 if(await qualityFingerprint(baseline)===candidateHash&&witness&&!frames.some(f=>f.angleDeg===witness.angleDeg))throw new RequestError(400,'Render the first measured conflict witness.');
 for(const finding of result.findings)finding.frameRefs=frames.filter(f=>f.angleDeg===finding.angleDeg).map(f=>f.frameId);
 return {result,frames:validated};
}
export function guardMotionTransaction(value:unknown,document:DeviceDocument,motion:NonNullable<QualityRound['motion']>){
 const t=deviceTransactionSchema.parse(value),allowed=new Set(motion.result.contract!.allowedEdits.map(e=>e.partId));
 if(t.addParts.length||t.removePartIds.length||t.mounts.length||Object.keys(t).some(k=>!['updates','addParts','removePartIds','mounts'].includes(k)))throw new Error('Motion repairs only move existing permitted parts; preserve every component, mount and joint.');
 if(motion.result.status!=='fail')throw new Error('No repair is allowed without a measured motion conflict.');
 for(const u of t.updates){if(!allowed.has(u.partId)||Object.keys(u.patch).some(k=>!['position','rotation'].includes(k)))throw new Error('Motion repairs preserve every shape and only change permitted transforms.');
  const related=motion.result.findings.some(f=>f.status==='fail'&&f.partIds.some(id=>{let part=document.parts.find(p=>p.id===id);const seen=new Set<string>();while(part&&!seen.has(part.id)){if(part.id===u.partId)return true;seen.add(part.id);part=document.parts.find(p=>p.id===part?.attachment?.parentId);}return false;}));
  if(!related)throw new Error('Motion repair is not linked to a measured issue.');
 }
}
