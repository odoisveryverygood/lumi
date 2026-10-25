import {Euler,Matrix4,Quaternion,Vector3} from 'three';
import type {DeviceDocument,DeviceMechanism,DevicePart,Vec3} from './types';
import {attachedPose} from './attachments';
import type {MotionContract} from './motion-types';

export const partMatrix=(part:DevicePart)=>new Matrix4().compose(new Vector3(...part.position),new Quaternion().setFromEuler(new Euler(...part.rotation.map(n=>n*Math.PI/180) as Vec3,'XYZ')),new Vector3(1,1,1));
export function motionAngles(contract:MotionContract):number[]{
 const count=Math.ceil((contract.maxDeg-contract.minDeg)/contract.stepDeg);
 return [...new Set([0,...Array.from({length:count+1},(_,i)=>Number((contract.minDeg+(contract.maxDeg-contract.minDeg)*i/count).toFixed(8)))])].sort((a,b)=>a-b);
}
export function mountedIds(document:DeviceDocument,root:string):Set<string>{
 const ids=new Set([root]);let changed=true;
 while(changed){changed=false;for(const p of document.parts)if(p.attachment&&ids.has(p.attachment.parentId)&&!ids.has(p.id)){ids.add(p.id);changed=true;}}
 return ids;
}
/** Explicit joint transform, shared by verification, captured evidence and the viewport. */
export function poseMotion(document:DeviceDocument,mechanism:DeviceMechanism,angleDeg:number):DeviceDocument{
 const c=mechanism.verification;if(!c)throw new Error('This playback has no verified joint contract.');
 if(angleDeg<c.minDeg-1e-6||angleDeg>c.maxDeg+1e-6)throw new Error('Pose is outside the frozen movement range.');
 const pivotPart=document.parts.find(p=>p.id===c.pivotPartId),root=document.parts.find(p=>p.id===c.movingRootId);
 if(!pivotPart||!root||mountedIds(document,root.id).has(pivotPart.id))throw new Error('The joint needs a fixed pivot and a distinct moving subtree.');
 const frame=partMatrix(pivotPart),pivot=new Vector3(...c.pivot).applyMatrix4(frame),axis=new Vector3(...c.axis).transformDirection(frame);
 const spin=new Matrix4().makeTranslation(...pivot.toArray()).multiply(new Matrix4().makeRotationAxis(axis,angleDeg*Math.PI/180)).multiply(new Matrix4().makeTranslation(...pivot.clone().negate().toArray()));
 const parts=document.parts.map(p=>({...p})),map=new Map(parts.map(p=>[p.id,p])),moving=map.get(root.id)!;
 const pos=new Vector3(),rot=new Quaternion(),scale=new Vector3();spin.multiply(partMatrix(root)).decompose(pos,rot,scale);
 const e=new Euler().setFromQuaternion(rot,'XYZ');moving.position=pos.toArray() as Vec3;moving.rotation=[e.x,e.y,e.z].map(n=>n*180/Math.PI) as Vec3;
 const done=new Set([root.id]),active=new Set<string>();
 function visit(p:DevicePart){if(done.has(p.id))return;if(active.has(p.id))throw new Error('Cyclic joint attachment.');active.add(p.id);if(p.attachment){const parent=map.get(p.attachment.parentId);if(!parent)throw new Error('Missing mounted parent.');visit(parent);Object.assign(p,attachedPose(p,parent));}active.delete(p.id);done.add(p.id);}
 parts.forEach(visit);
 // Posed snapshots are render-only; the rest-pose attachment remains in the saved document.
 // Browser/server trig implementations can differ at the last bit. Quantize well below
 // the 0.00001 mm intersection tolerance so evidence hashes remain portable.
 for(const p of parts){p.position=p.position.map(n=>Number(n.toFixed(8))) as Vec3;p.rotation=p.rotation.map(n=>Number(n.toFixed(8))) as Vec3;}
 return {...document,parts};
}
