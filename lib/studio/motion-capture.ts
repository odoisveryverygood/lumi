import {Box3,Vector3} from 'three';
import type {DeviceDocument,DeviceMechanism,Vec3} from './types';
import type {MotionResult} from './motion-types';
import type {MotionFrame,ReviewFrame} from './quality-types';
import {qualityFingerprint} from './quality-fingerprint';
import {localPartBounds} from './render-model';
import {motionAngles,partMatrix,poseMotion} from './motion-pose';
import {captureReviewViews} from './review-renderer';

export function representativeAngles(result:MotionResult):number[]{
 const witness=result.findings.find(f=>f.status==='fail')??result.findings.find(f=>f.status==='unverified');
 return [...new Set([witness?.angleDeg??0,result.contract!.minDeg,result.contract!.maxDeg,0])].slice(0,3);
}
export function motionFraming(document:DeviceDocument,mechanism:DeviceMechanism):NonNullable<ReviewFrame['framing']>{
 const box=new Box3();for(const angle of motionAngles(mechanism.verification!))for(const p of poseMotion(document,mechanism,angle).parts)box.union(localPartBounds(p).applyMatrix4(partMatrix(p)));
 // Includes all permitted yoke translations so a correction cannot leave the comparison frame.
 const pad=mechanism.verification!.allowedEdits.reduce((max,e)=>Math.max(max,new Vector3(...e.maxPosition).distanceTo(new Vector3(...e.minPosition))),0);
 return {center:box.getCenter(new Vector3()).toArray() as Vec3,radius:Math.max(1,box.getSize(new Vector3()).length()/2+pad)};
}
export async function captureMotionViews(document:DeviceDocument,mechanism:DeviceMechanism,result:MotionResult,signal:AbortSignal,reference?:MotionFrame[]):Promise<MotionFrame[]>{
 const framing=reference?.[0]?.framing??motionFraming(document,mechanism),angles=reference?.map(f=>f.angleDeg)??representativeAngles(result),frames:MotionFrame[]=[],candidateHash=await qualityFingerprint(document);
 // Keep the original witness pose in every comparison, even after it is repaired.
 for(const angleDeg of angles){signal.throwIfAborted();const posed=poseMotion(document,mechanism,angleDeg),[frame]=await captureReviewViews(posed,signal,undefined,[{view:'assembled',framing} as ReviewFrame],['assembled']);frames.push({...frame,mechanismId:mechanism.id,angleDeg,frameId:`${mechanism.id}:${angleDeg}`,candidateHash});}
 return frames;
}
