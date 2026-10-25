import {Euler,Matrix4,Quaternion,Vector3} from 'three';
import type {DeviceDocument,DevicePart,Vec3} from './types';
import {localPartBounds} from './render-model';
const radians=(v:Vec3)=>v.map(n=>n*Math.PI/180) as Vec3;
const quaternion=(v:Vec3)=>new Quaternion().setFromEuler(new Euler(...radians(v),'XYZ'));
const rotation=(q:Quaternion)=>{const e=new Euler().setFromQuaternion(q,'XYZ');return [e.x,e.y,e.z].map(n=>Object.is(n,-0)?0:n*180/Math.PI) as Vec3;};
const matrix=(p:DevicePart)=>new Matrix4().compose(new Vector3(...p.position),quaternion(p.rotation),new Vector3(1,1,1));
export type Mount={partId:string;parentId:string|null};

/** Store a normalized anchor so a parent's resize preserves the child's relative placement. */
function binding(child:DevicePart,parent:DevicePart):NonNullable<DevicePart['attachment']>{
 const bounds=localPartBounds(parent),size=bounds.getSize(new Vector3()),local=new Vector3(...child.position).applyMatrix4(matrix(parent).invert());
 const anchor=local.sub(bounds.min).toArray().map((n,i)=>n/Math.max(.001,size.getComponent(i))) as Vec3;
 if(anchor.some(n=>!Number.isFinite(n)||Math.abs(n)>20))throw new Error('The mount is too far from its parent. Move the component closer first.');
 return {parentId:parent.id,anchor,rotation:rotation(quaternion(parent.rotation).invert().multiply(quaternion(child.rotation)))};
}
export function attachedPose(child:DevicePart,parent:DevicePart){
 const a=child.attachment! ,bounds=localPartBounds(parent),size=bounds.getSize(new Vector3()),point=new Vector3(...a.anchor).multiply(size).add(bounds.min).applyMatrix4(matrix(parent));
 return {position:point.toArray() as Vec3,rotation:rotation(quaternion(parent.rotation).multiply(quaternion(a.rotation)))};
}
export function attachmentIssues(document:DeviceDocument):string[]{
 const parts=new Map(document.parts.map(p=>[p.id,p])),issues:string[]=[],state=new Map<string,number>();
 function visit(part:DevicePart){if(state.get(part.id)===1){issues.push('Mounts must not form a cycle.');return;}if(state.get(part.id)===2)return;state.set(part.id,1);const parent=part.attachment&&parts.get(part.attachment.parentId);if(part.attachment){if(!parent||parent.id===part.id)issues.push('Each mount needs a distinct existing parent.');else{visit(parent);const pose=attachedPose(part,parent);if(new Vector3(...pose.position).distanceTo(new Vector3(...part.position))>.05||quaternion(pose.rotation).angleTo(quaternion(part.rotation))>.001)issues.push(`The mount for ${part.name} does not match its placement.`);}}state.set(part.id,2);}
 for(const part of document.parts)visit(part);return [...new Set(issues)];
}
/** Explicit child transforms rebind its anchor; otherwise parent transforms carry descendants. */
export function resolveAttachments(previous:DeviceDocument,next:DeviceDocument,explicitIds:Iterable<string>=[],mounts:Mount[]=[]):DeviceDocument{
 const output=structuredClone(next),parts=new Map(output.parts.map(p=>[p.id,p])),explicit=new Set(explicitIds),before=new Set(previous.parts.map(p=>p.id));
 const bound=new Set<string>();for(const m of mounts){if(bound.has(m.partId))throw new Error('Mount each component at most once per change.');bound.add(m.partId);const child=parts.get(m.partId),parent=m.parentId?parts.get(m.parentId):null;if(!child||m.parentId&&!parent||child.id===parent?.id)throw new Error('A mount must reference two distinct existing components.');if(parent)child.attachment=binding(child,parent);else delete child.attachment;explicit.add(child.id);}
 for(const part of output.parts)if(part.attachment&&!parts.has(part.attachment.parentId)){if(!before.has(part.attachment.parentId))throw new Error('Unknown mount parent.');delete part.attachment;}
 const state=new Map<string,number>();
 const visit=(part:DevicePart)=>{if(state.get(part.id)===1)throw new Error('Mounts must not form a cycle.');if(state.get(part.id)===2)return;state.set(part.id,1);if(part.attachment){const parent=parts.get(part.attachment.parentId)!;visit(parent);if(explicit.has(part.id))part.attachment=binding(part,parent);else Object.assign(part,attachedPose(part,parent));}state.set(part.id,2);};
 output.parts.forEach(visit);return output;
}
export function mountParts(document:DeviceDocument,mounts:Mount[]){return resolveAttachments(document,document,[],mounts);}
