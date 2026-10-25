import {Box3,Euler,Matrix4,Quaternion,Vector3} from 'three';
import type {DeviceDocument,DevicePart,Vec3} from './types';
import type {MeasuredCheck} from './quality-types';
import {designContractSchema,designGoalPlanSchema,type DesignContract,type DesignGoalPlan} from './constraint-types';
import {catalogJsonReplacer} from './catalog';
import {localPartBounds} from './render-model';
import {meshBoxConflict,solidWorldBounds,sourceFloorSupports} from './redesign';
import {qualityFingerprint,sha256} from './quality-fingerprint';
const axisIndex={x:0,y:1,z:2};
export const partTransform=(part:DevicePart)=>new Matrix4().compose(new Vector3(...part.position),new Quaternion().setFromEuler(new Euler(...part.rotation.map(n=>n*Math.PI/180) as Vec3)),new Vector3(1,1,1));
function boundsIn(part:DevicePart,space=new Matrix4()){
 const matrix=space.clone().multiply(partTransform(part));
 if(part.mesh){const box=new Box3();for(let i=0;i<part.mesh.positions.length;i+=3)box.expandByPoint(new Vector3().fromArray(part.mesh.positions,i).applyMatrix4(matrix));return box;}
 return localPartBounds(part).applyMatrix4(matrix);
}
function compact(value:unknown){return JSON.stringify(value,catalogJsonReplacer);}
function protectedGeometry(part:DevicePart,shapeOnly=false){const {id,position,rotation,size,solids,mesh,catalogRef,assetNode,attachment}=part;return compact({id,...(!shapeOnly?{position,rotation,attachment}:{}),size,solids:solids.map(({color:_color,metalness:_metal,roughness:_rough,...s})=>s),...(mesh?{mesh}:{}),...(catalogRef?{catalogRef}:{}),assetNode});}
function amounts(text:string){return [...text.matchAll(/(\d+(?:\.\d+)?)\s*(mm|millimet(?:er|re)s?|cm|centimet(?:er|re)s?)(?!\w)/gi)].map(m=>Number(m[1])*(m[2].toLowerCase().startsWith('c')?10:1));}
function assertPlan(plan:DesignGoalPlan,request:string,baseline:DeviceDocument,candidate:DeviceDocument){
 if(baseline.id!==candidate.id)throw new Error('The design baseline must belong to the same object.');
 const known=new Set([...baseline.parts,...candidate.parts].map(p=>p.id));
 for(const item of [...plan.goals,...plan.unverified,...(plan.releaseContainment??[])])if(!request.toLowerCase().includes(item.evidence.toLowerCase()))throw new Error('Every design check needs an exact quote from the original request.');
 for(const release of plan.releaseContainment??[])if(!known.has(release.partId)||!known.has(release.containerId)||!/\b(?:outside|out of|remove|detach|extract)\b/i.test(release.evidence))throw new Error('Releasing an established interior placement needs an explicit outside/removal request with existing component IDs.');
 const signatures=new Set<string>();for(const goal of plan.goals){
  const refs=goal.kind==='preserve'?goal.partIds:goal.kind==='inside'?[goal.partId,goal.containerId]:goal.kind==='separate'?[goal.partId,goal.otherId]:[goal.partId];
  if(refs.some(id=>!known.has(id)))throw new Error('A design check referenced an unknown component.');
  if(goal.kind==='preserve'&&refs.some(id=>!baseline.parts.some(p=>p.id===id)))throw new Error('Only original components can be protected.');
  if((goal.kind==='inside'||goal.kind==='separate')&&refs[0]===refs[1])throw new Error('A spatial check needs two different components.');
  const requested=goal.kind==='dimension'?goal.maximumMm:goal.kind==='inside'||goal.kind==='separate'?goal.clearanceMm:goal.kind==='access'?goal.distanceMm:undefined;
  if(requested!==undefined&&requested!==0&&!amounts(goal.evidence).some(n=>Math.abs(n-requested)<1e-6))throw new Error('Numerical design limits must match millimetres or centimetres quoted from the request.');
  if(goal.kind==='inside'||goal.kind==='separate'){
   const explicit=goal.evidence.match(/(\d+(?:\.\d+)?)\s*(mm|cm)\s*(?:of\s+)?(?:clearance|gap|apart|separation)/i)||goal.evidence.match(/(?:clearance|gap|separation)\s*(?:of|at least|minimum|:)??\s*(\d+(?:\.\d+)?)\s*(mm|cm)/i);
   if(explicit&&Math.abs(goal.clearanceMm-Number(explicit[1])*(explicit[2].toLowerCase()==='cm'?10:1))>1e-6)throw new Error('Do not weaken an explicitly requested clearance.');
  }
  if(goal.kind==='access'&&amounts(goal.evidence).length&&goal.distanceMm===undefined)throw new Error('An explicitly requested access distance must be retained.');
  if(goal.kind==='dimension'&&!/\b(?:maximum|max|at most|under|below|less than|no more than|limit)\b/i.test(goal.evidence))throw new Error('A dimension limit needs an explicit maximum-size request, not an unrelated number.');
  const signature=JSON.stringify({...goal,evidence:''});if(signatures.has(signature))throw new Error('Do not repeat design checks.');signatures.add(signature);
 }
 // Basic coverage prevents an empty or visual-only plan from silently dropping recognizable
 // engineering clauses. Mapping words to component IDs is still an AI interpretation.
 const intents:[RegExp,DesignGoalPlan['goals'][number]['kind']][]=[[/\b(?:inside|within|enclos(?:e|ed)|interior)\b/i,'inside'],[/\b(?:unchanged|preserve|retain|keep)\b/i,'preserve'],[/\b(?:access|accessible|unblocked|clear\s+(?:space|path))\b/i,'access'],[/\b(?:separate|separation|apart|nonoverlap|non-overlap)\b/i,'separate'],[/(?:\b(?:maximum|max|at most|less than|no more than)\b[^;\n]*\d+(?:\.\d+)?\s*(?:mm|cm)\b|\b(?:under|below)\s*\d+(?:\.\d+)?\s*(?:mm|cm)\b)/i,'dimension']];
 const overlaps=(a:string,b:string)=>{a=a.toLowerCase().trim().replace(/[.!?]+$/,'');b=b.toLowerCase().trim().replace(/[.!?]+$/,'');return a.includes(b)||b.includes(a);};
 for(const sentence of request.split(/[;\n]+|\.(?=\s|$)/).filter(Boolean))for(const [pattern,kind] of intents)if(pattern.test(sentence)&&!plan.goals.some(g=>g.kind===kind&&pattern.test(g.evidence)&&overlaps(sentence,g.evidence))&&!plan.unverified.some(u=>pattern.test(u.evidence)&&overlaps(sentence,u.evidence)))throw new Error(`A requested ${kind} constraint was omitted. Include a supported check or explicit unverified evidence.`);
}
export async function compileDesignContract(raw:unknown,request:string,baseline:DeviceDocument,candidate:DeviceDocument,model:string,retainPlacements=true):Promise<DesignContract>{
 const plan=designGoalPlanSchema.parse(raw);assertPlan(plan,request,baseline,candidate);
 const moveQuote=request.split(/[;\n]+|\.(?=\s|$)/).map(s=>s.trim()).find(s=>/\b(?:move|reposition|rotate)\b/i.test(s));
 if(moveQuote&&moveQuote.length<=600&&!/\b(?:resize|reduce|increase|shrink|enlarge|reshape|replace)\b/i.test(request)&&!plan.goals.some(g=>g.kind==='dimension')){
  const covered=new Set(plan.goals.flatMap(g=>g.kind==='preserve'?g.partIds:[])),moving=baseline.parts.filter(p=>!covered.has(p.id)).map(p=>p.id);
  if(moving.length)plan.goals.push({kind:'preserve',partIds:moving,scope:'shape',evidence:moveQuote});
 }
 const normalized=designGoalPlanSchema.parse(plan);
 const retained:{partId:string;containerId:string}[]=[];
 if(retainPlacements)for(const container of baseline.parts){const cavity=measuredCavity(container,baseline.id);if(!cavity)continue;const inverse=partTransform(container).invert();for(const part of baseline.parts){if(part.id===container.id||part.assetNode||!cavity.box.containsBox(boundsIn(part,inverse))||normalized.releaseContainment?.some(r=>r.partId===part.id&&r.containerId===container.id))continue;const probe={...normalized,version:1 as const,request,baselineHash:'0'.repeat(64),hash:'0'.repeat(64),model,goals:[{kind:'inside' as const,partId:part.id,containerId:container.id,clearanceMm:0,evidence:request.slice(0,600)}],unverified:[]};if(evaluateDesignContract(probe,baseline,baseline)[0].status==='pass')retained.push({partId:part.id,containerId:container.id});}}
 const value={...normalized,version:1 as const,request,baselineHash:await qualityFingerprint(baseline),model,...(retainPlacements?{retainedPlacements:retained}:{})};
 return designContractSchema.parse({...value,hash:await sha256(new TextEncoder().encode(compact(value)))});
}
export async function validateDesignContract(raw:unknown,request:string,baseline:DeviceDocument,candidate:DeviceDocument){
 const contract=designContractSchema.parse(raw),compiled=await compileDesignContract({goals:contract.goals,unverified:contract.unverified,...(contract.releaseContainment?{releaseContainment:contract.releaseContainment}:{})},request,baseline,candidate,contract.model,contract.retainedPlacements!==undefined);
 const {hash,...body}=contract;
 if(contract.request!==request||contract.hash!==await sha256(new TextEncoder().encode(compact(body)))||contract.hash!==compiled.hash||contract.baselineHash!==compiled.baselineHash)throw new Error('The design checks or their original baseline changed. Prepare a new review.');return contract;
}

/** A cavity is inferred only from five actual axis-aligned box surfaces, never the outer
 * bounding box of an arbitrary object. Unknown, curved or incomplete shells remain unverified. */
export function measuredCavity(container:DevicePart,documentId?:string):{box:Box3;basis:string}|null{
 if(container.assetNode)return null;
 if(container.mesh){
  if(documentId!=='corne-cherry-v4-left'||container.id!=='keyboard-case-base')return null;
  return {box:new Box3(new Vector3(-55,-3.55,-33),new Vector3(55,2.95,7)),basis:'Registered Corne design region; actual source case triangles and nine floor samples are checked separately.'};
 }
 const boxes=container.solids.filter(s=>s.kind==='box'&&(!s.rotation||s.rotation.every(n=>Math.abs(n%180)<1e-7))).map(s=>new Box3(new Vector3(...s.position).sub(new Vector3(...s.size).multiplyScalar(.5)),new Vector3(...s.position).add(new Vector3(...s.size).multiplyScalar(.5))));
 const floors=boxes.filter(b=>{const s=b.getSize(new Vector3());return s.y<=Math.min(s.x,s.z)*.3;}).sort((a,b)=>{const x=a.getSize(new Vector3()),y=b.getSize(new Vector3());return y.x*y.z-x.x*x.z;});
 for(const floor of floors){
  const f=floor.getSize(new Vector3()),center=floor.getCenter(new Vector3()),walls=boxes.filter(b=>b!==floor&&b.min.y<=floor.max.y+.1&&b.max.y>floor.max.y+.5);
  const left=walls.filter(b=>b.min.x<=floor.min.x+.1&&b.max.x<center.x&&b.getSize(new Vector3()).x<f.x*.3&&b.min.z<=floor.min.z+.1&&b.max.z>=floor.max.z-.1).sort((a,b)=>b.max.x-a.max.x)[0];
  const right=walls.filter(b=>b.max.x>=floor.max.x-.1&&b.min.x>center.x&&b.getSize(new Vector3()).x<f.x*.3&&b.min.z<=floor.min.z+.1&&b.max.z>=floor.max.z-.1).sort((a,b)=>a.min.x-b.min.x)[0];
  if(!left||!right)continue;
  const back=walls.filter(b=>b.min.z<=floor.min.z+.1&&b.max.z<center.z&&b.getSize(new Vector3()).z<f.z*.3&&b.min.x<=left.max.x+.1&&b.max.x>=right.min.x-.1).sort((a,b)=>b.max.z-a.max.z)[0];
  const front=walls.filter(b=>b.max.z>=floor.max.z-.1&&b.min.z>center.z&&b.getSize(new Vector3()).z<f.z*.3&&b.min.x<=left.max.x+.1&&b.max.x>=right.min.x-.1).sort((a,b)=>a.min.z-b.min.z)[0];
  if(!back||!front)continue;
  const box=new Box3(new Vector3(left.max.x,floor.max.y,back.max.z),new Vector3(right.min.x,Math.min(left.max.y,right.max.y,back.max.y,front.max.y),front.min.z));
  if(box.getSize(new Vector3()).toArray().every(n=>n>.1))return {box,basis:'Interior from the actual box floor and four wall faces. Component envelopes are conservative; physical tolerances are unverified.'};
 }return null;
}
const rounded=(value:number)=>Math.round(value*1000)/1000;
function envelopeGap(a:Box3,b:Box3){
 const gaps=[a.min.x-b.max.x,b.min.x-a.max.x,a.min.y-b.max.y,b.min.y-a.max.y,a.min.z-b.max.z,b.min.z-a.max.z];
 const positive=[0,1,2].map(axis=>Math.max(0,gaps[axis*2],gaps[axis*2+1]));
 if(positive.some(n=>n>0))return Math.hypot(...positive);
 return -Math.min(a.max.x-b.min.x,b.max.x-a.min.x,a.max.y-b.min.y,b.max.y-a.min.y,a.max.z-b.min.z,b.max.z-a.min.z);
}
function obstacleConflict(part:DevicePart,worldBox:Box3){
 if(part.assetNode)return null;
 if(part.mesh)return meshBoxConflict(part,worldBox);
 return part.solids.some(s=>{const b=solidWorldBounds(part,s);return envelopeGap(b,worldBox)<-1e-5;});
}
/** Checks evaluate geometry, not model opinions. Unsupported evidence is explicit. */
export function evaluateDesignContract(contract:DesignContract,baseline:DeviceDocument,candidate:DeviceDocument):MeasuredCheck[]{
 const checks:MeasuredCheck[]=[],parts=new Map(candidate.parts.map(p=>[p.id,p])),original=new Map(baseline.parts.map(p=>[p.id,p]));
 const protectedIds=new Set(contract.goals.flatMap(g=>g.kind==='preserve'&&g.scope!=='shape'?g.partIds:[]));
 const add=(index:number,title:string,status:MeasuredCheck['status'],detail:string,partIds:string[],extra:Partial<MeasuredCheck>={})=>checks.push({id:`design-${index+1}`,category:'design',required:true,title,status,detail,partIds,evidence:contract.goals[index].evidence,repairPartIds:partIds.filter(id=>!protectedIds.has(id)),...extra});
 contract.goals.forEach((goal,index)=>{
  if(goal.kind==='preserve'){
   const changed=goal.partIds.filter(id=>!parts.has(id)||protectedGeometry(parts.get(id)!,goal.scope==='shape')!==protectedGeometry(original.get(id)!,goal.scope==='shape'));
   add(index,'Original geometry preserved',changed.length?'fail':'pass',changed.length?`Protected components changed: ${changed.map(id=>original.get(id)!.name).join(', ')}.`:`${goal.partIds.length} original components keep their actual geometry${goal.scope==='shape'?'; movement is permitted': ' and placement'}.`,goal.partIds,{value:changed.length,unit:'changed',limit:0,repairPartIds:changed});return;
  }
  const part=parts.get(goal.partId);if(!part){add(index,'Required component present','fail','The requested component is absent.',[goal.partId]);return;}
  if(part.assetNode){add(index,'Geometry measurement','info','This imported component has no independently available geometry in the server document.',[part.id]);return;}
  const box=boundsIn(part);
  if(goal.kind==='dimension'){
   const value=localPartBounds(part).getSize(new Vector3()).getComponent(axisIndex[goal.axis]);add(index,`${part.name}: local ${goal.axis.toUpperCase()} size`,value<=goal.maximumMm+1e-5?'pass':'fail',`Actual local geometry envelope ${rounded(value)} mm; maximum ${goal.maximumMm} mm.`,[part.id],{value:rounded(value),unit:'mm',limit:goal.maximumMm});return;
  }
  if(goal.kind==='inside'){
   const container=parts.get(goal.containerId),cavity=container&&measuredCavity(container,candidate.id);
   if(!container||!cavity){add(index,`${part.name}: enclosure clearance`,'info','No supported interior can be established from this enclosure. Its outer bounding box is not treated as usable space.',[part.id,goal.containerId],{repairPartIds:[part.id]});return;}
   const inverse=partTransform(container).invert(),local=boundsIn(part,inverse),c=cavity.box;
   let value=Math.min(local.min.x-c.min.x,c.max.x-local.max.x,local.min.y-c.min.y,c.max.y-local.max.y,local.min.z-c.min.z,c.max.z-local.max.z);
   let sourceNote='';if(container.mesh){const source={...container,position:[0,0,0] as Vec3,rotation:[0,0,0] as Vec3};const conflict=meshBoxConflict(source,local,goal.clearanceMm);const floor=sourceFloorSupports(source,local,c.min.y);if(conflict||!floor){value=Math.min(value,-.001);sourceNote=conflict?' The component envelope also intersects source-case triangles.':' Source floor coverage failed a footprint sample.';}}
   else if(obstacleConflict({...container,position:[0,0,0],rotation:[0,0,0]},local.clone().expandByScalar(goal.clearanceMm))){value=Math.min(value,-.001);sourceNote=' A conservative envelope also conflicts with actual enclosure solids, including internal structures.';}
   add(index,`${part.name}: enclosure clearance`,value+1e-5>=goal.clearanceMm?'pass':'fail',`Minimum envelope-to-interior margin ${rounded(value)} mm; required ${goal.clearanceMm} mm. ${cavity.basis}${sourceNote}`,[part.id,container.id],{value:rounded(value),unit:'mm',limit:goal.clearanceMm,repairPartIds:[part.id]});return;
  }
  if(goal.kind==='separate'){
   const other=parts.get(goal.otherId);if(!other||other.assetNode){add(index,'Component envelope separation','info','Both components need independently available geometry.',[part.id,goal.otherId]);return;}
   const value=envelopeGap(box,boundsIn(other));add(index,`${part.name}: envelope separation`,value+1e-5>=goal.clearanceMm?'pass':'fail',`Conservative world envelope gap ${rounded(value)} mm; required ${goal.clearanceMm} mm. Negative values indicate envelope overlap, not necessarily surface collision.`,[part.id,other.id],{value:rounded(value),unit:'mm',limit:goal.clearanceMm});return;
  }
  const targetLocal=localPartBounds(part),axis=axisIndex[goal.axis],allLocal=new Box3(),inverse=partTransform(part).invert();candidate.parts.filter(p=>!p.assetNode).forEach(p=>allLocal.union(boundsIn(p,inverse)));
  const face=(goal.direction===1?targetLocal.max:targetLocal.min).getComponent(axis),distance=goal.distanceMm??Math.abs((goal.direction===1?allLocal.max:allLocal.min).getComponent(axis)-face)+1;
  const corridor=targetLocal.clone();corridor.min.setComponent(axis,goal.direction===1?face+.001:face-distance);corridor.max.setComponent(axis,goal.direction===1?face+distance:face-.001);corridor.applyMatrix4(partTransform(part));
  const others=candidate.parts.filter(p=>p.id!==part.id),unknown=others.filter(p=>p.assetNode),blocked=others.filter(p=>obstacleConflict(p,corridor));
  add(index,`${part.name}: straight access ${goal.direction===1?'+':'−'}${goal.axis.toUpperCase()}`,blocked.length?'fail':unknown.length?'info':'pass',blocked.length?`The conservative straight access corridor is obstructed by ${blocked.map(p=>p.name).join(', ')}. It uses the component face footprint, not a cable or hand simulation.`:unknown.length?'Imported obstacles prevent a complete access check.':`The ${rounded(distance)} mm straight corridor from the component's local face is clear of available obstacle geometry. This does not verify connector position, cable bend radius or ergonomics.`,[part.id,...blocked.map(p=>p.id)],{value:blocked.length,unit:'obstructions',limit:0,repairPartIds:[part.id,...blocked.map(p=>p.id)].filter(id=>!protectedIds.has(id))});
 });
 for(const [index,item] of contract.unverified.entries())checks.push({id:`design-unverified-${index+1}`,category:'design',required:true,title:'More evidence required',status:'info',detail:item.reason,evidence:item.evidence,partIds:[],repairPartIds:[]});
 if(contract.retainedPlacements?.length){const failed=contract.retainedPlacements.map(pair=>({pair,check:evaluateDesignContract({...contract,goals:[{kind:'inside',...pair,clearanceMm:0,evidence:contract.request.slice(0,600)}],unverified:[],retainedPlacements:undefined},baseline,candidate)[0]})).filter(({check})=>check.status!=='pass'),unknown=failed.some(({check})=>check.status==='info');checks.push({id:'design-retained-containment',category:'design',required:true,title:'Existing interior placements retained',status:unknown?'info':failed.length?'fail':'pass',detail:failed.length?`An original valid interior placement no longer holds: ${failed.map(({pair,check})=>`${parts.get(pair.partId)?.name??pair.partId}: ${check.detail}`).join(' ').slice(0,1000)}`:`${contract.retainedPlacements.length} previously valid interior placements remain supported. This is derived from the baseline geometry, not a physical-fit certificate.`,partIds:failed.length?failed.map(f=>f.pair.partId):contract.retainedPlacements.map(p=>p.partId),value:failed.length,unit:'placements lost',limit:0,repairPartIds:failed.map(f=>f.pair.partId).filter(id=>!protectedIds.has(id))});}
 return checks;
}
