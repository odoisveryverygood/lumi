import {Box3} from 'three';
import type {DeviceDocument,DeviceMechanism} from './types';
import {motionContractSchema,type MotionFinding,type MotionResult} from './motion-types';
import {motionAngles,mountedIds,partMatrix,poseMotion} from './motion-pose';
import {boxDistance,partSurfaces,surfaceDistance,transformSurface,type Surface} from './motion-geometry';
import type {GeometryBank} from './render-model';

export const MOTION_LIMITS={poses:25,parts:64,solids:500,triangles:50000,comparisons:2_000_000,findings:200} as const;
const limits=[
 'Finite sampled poses only. Collisions between samples are outside this coverage; no continuous-clearance claim.',
 'Millimetres. Positive clearance may be a conservative AABB lower bound; overlapping broad-phase bounds are tested against actual tessellated solids.',
 'Triangle intersection or containment records zero clearance, not penetration depth. Surface distance tolerance is 0.00001 mm.',
 'Checks cover pairs with relative motion or an editable part/subtree. Fixed internal interfaces are outside this joint study. Only listed contact pairs are exempt.',
 'Open or unsupported meshes, missing joint evidence and exhausted budgets are unverified. Forces, manufacture, electrical operation and physical safety are not assessed.',
];
const pairKey=(a:string,b:string)=>[a,b].sort().join('|');
export function motionPreservationIssues(baseline:DeviceDocument,candidate:DeviceDocument,mechanismId:string):string[]{
 const original=baseline.mechanisms?.find(m=>m.id===mechanismId),next=candidate.mechanisms?.find(m=>m.id===mechanismId),c=original?.verification;
 if(!c||!next?.verification)return ['Missing frozen joint contract.'];
 const issues:string[]=[];
 const metadata=({parts:_parts,review:_review,...d}:DeviceDocument)=>JSON.stringify(d);
 if(metadata(baseline)!==metadata(candidate))issues.push('Document identity, original brief and mechanism requirements must remain unchanged.');
 if(baseline.parts.length!==candidate.parts.length||baseline.parts.some((p,i)=>candidate.parts[i]?.id!==p.id))return [...issues,'Preserve every original component and its stable ID.'];
 const editable=new Map(c.allowedEdits.map(e=>[e.partId,e])),carried=new Set(c.allowedEdits.flatMap(e=>[...mountedIds(baseline,e.partId)]));
 for(const p of baseline.parts){const q=candidate.parts.find(p2=>p2.id===p.id)!;const {position:_p,rotation:_r,attachment:_a,...shape}=p,{position:_p2,rotation:_r2,attachment:_a2,...shape2}=q;
  if(JSON.stringify(shape)!==JSON.stringify(shape2))issues.push(`Original shape/source changed: ${p.id}.`);
  const allowance=editable.get(p.id);
  if(allowance){if(q.position.some((n,i)=>n<allowance.minPosition[i]-1e-6||n>allowance.maxPosition[i]+1e-6)||q.rotation.some((n,i)=>Math.abs(n-p.rotation[i])>1e-6))issues.push(`Repair exceeded the permitted placement of ${p.id}.`);if(q.attachment?.parentId!==p.attachment?.parentId||JSON.stringify(q.attachment?.rotation)!==JSON.stringify(p.attachment?.rotation))issues.push(`Repair changed the mounting interface of ${p.id}.`);}
  else if(!carried.has(p.id)&&JSON.stringify(p)!==JSON.stringify(q))issues.push(`Protected component changed: ${p.id}.`);
  else if(carried.has(p.id)&&JSON.stringify(p.attachment)!==JSON.stringify(q.attachment))issues.push(`Mounted descendant was independently rebound: ${p.id}.`);
 }
 return [...new Set(issues)];
}

export function verifyMotion(document:DeviceDocument,mechanism:DeviceMechanism,signal?:AbortSignal):MotionResult{
 const parsed=motionContractSchema.safeParse(mechanism.verification);
 if(!parsed.success)return {version:1,mechanismId:mechanism.id,status:'unverified',checkedAngles:[],findings:[],limitations:['No supported explicit joint evidence. Playback tracks do not establish a pivot, axis, limits or geometric clearance.'],comparisons:0};
 const contract=parsed.data,result:MotionResult={version:1,mechanismId:mechanism.id,contract,status:'unverified',checkedAngles:[],findings:[],limitations:limits,comparisons:0};
 const budget={comparisons:0,limit:MOTION_LIMITS.comparisons,signal},bank:GeometryBank={shapes:new Map(),edges:new Map()};
 function unknown(detail:string){if(result.findings.length>=MOTION_LIMITS.findings)result.findings.pop();result.findings.push({mechanismId:mechanism.id,angleDeg:0,phase:(0-contract.minDeg)/(contract.maxDeg-contract.minDeg),partIds:[contract.movingRootId,contract.pivotPartId],status:'unverified',requiredMm:contract.clearanceMm,measurement:'unknown',detail,frameRefs:[]});}
 try{
  signal?.throwIfAborted();const ids=new Set(document.parts.map(p=>p.id));
  if(document.source==='import'||document.parts.some(p=>p.assetNode)){unknown('Imported geometry has no established physical units/joint evidence.');return result;}
  if(document.parts.length>MOTION_LIMITS.parts||document.parts.reduce((n,p)=>n+p.solids.length,0)>MOTION_LIMITS.solids)throw new Error('Motion geometry budget exceeded.');
  if(!ids.has(contract.movingRootId)||!ids.has(contract.pivotPartId)||contract.allowedEdits.some(e=>!ids.has(e.partId))||contract.contacts.some(p=>p.partIds.some(id=>!ids.has(id))))throw new Error('The joint references missing components.');
  const moving=mountedIds(document,contract.movingRootId),editable=contract.allowedEdits.map(e=>mountedIds(document,e.partId)),contacts=new Set(contract.contacts.map(p=>pairKey(...p.partIds)));
  if(moving.has(contract.pivotPartId))throw new Error('A joint cannot carry its own fixed pivot.');
  const pairs: [string,string][]=[];
  for(let i=0;i<document.parts.length;i++)for(let j=i+1;j<document.parts.length;j++){const a=document.parts[i].id,b=document.parts[j].id;
   if((moving.has(a)!==moving.has(b)||editable.some(group=>group.has(a)!==group.has(b)))&&!contacts.has(pairKey(a,b)))pairs.push([a,b]);
  }
  if(!pairs.length)throw new Error('No non-contact component pairs can be checked.');
  const local=new Map<string,Surface[]>();let triangles=0;
  for(const p of document.parts){const estimate=p.mesh?p.mesh.indices.length/3:p.solids.reduce((n,s)=>n+({box:12,cylinder:128,sphere:720,torus:1152}[s.kind]),0);if(triangles+estimate>MOTION_LIMITS.triangles)throw new Error('Motion triangle budget exceeded.');const surfaces=partSurfaces(p,bank);triangles+=surfaces.reduce((n,s)=>n+s.triangles,0);if(triangles>MOTION_LIMITS.triangles)throw new Error('Motion triangle budget exceeded.');local.set(p.id,surfaces);}
  let minimum=Infinity;
  for(const angleDeg of motionAngles(contract)){
   signal?.throwIfAborted();const posed=poseMotion(document,mechanism,angleDeg),world=new Map(posed.parts.map(p=>[p.id,local.get(p.id)!.map(s=>transformSurface(s,partMatrix(p)))]));
   let worst:MotionFinding|undefined;
   for(const [a,b] of pairs){
    const aa=world.get(a)!,bb=world.get(b)!,aBox=new Box3(),bBox=new Box3();aa.forEach(s=>aBox.union(s.tree.box));bb.forEach(s=>bBox.union(s.tree.box));
    let distance=boxDistance(aBox,bBox),measurement:MotionFinding['measurement']='aabb-lower-bound',uncertain=false;
    if(distance<=contract.clearanceMm+1e-5){distance=Infinity;measurement='triangle-distance';for(const x of aa)for(const y of bb){const lower=boxDistance(x.tree.box,y.tree.box);if(lower>contract.clearanceMm+1e-5){distance=Math.min(distance,lower);measurement='aabb-lower-bound';continue;}const exact=surfaceDistance(x,y,budget);if(exact===undefined)uncertain=true;else distance=Math.min(distance,exact);}}
    const status=distance<=contract.clearanceMm+1e-5?'fail':uncertain?'unverified':'pass';
    const finding:MotionFinding={mechanismId:mechanism.id,angleDeg,phase:(angleDeg-contract.minDeg)/(contract.maxDeg-contract.minDeg),partIds:[a,b],status,requiredMm:contract.clearanceMm,measurement:status==='fail'?'triangle-distance':uncertain?'unknown':measurement,...(Number.isFinite(distance)?{clearanceMm:distance}:{}),detail:status==='fail'?'Required sampled clearance is not satisfied. Zero means contact or solid overlap.':uncertain?'An open mesh prevents a supported solid-containment verdict.':'Sampled geometric separation exceeds the requested threshold.',frameRefs:[]};
    if(status!=='pass'){if(result.findings.length>=MOTION_LIMITS.findings)throw new Error('Motion finding budget exceeded.');result.findings.push(finding);}
    if(!worst||(finding.clearanceMm??Infinity)<(worst.clearanceMm??Infinity))worst=finding;
    if(Number.isFinite(distance))minimum=Math.min(minimum,distance);
   }
   if(worst?.status==='pass')result.findings.push(worst);
   result.checkedAngles.push(angleDeg);
  }
  if(Number.isFinite(minimum))result.minimumClearanceMm=minimum;
  result.status=result.findings.some(f=>f.status==='fail')?'fail':result.findings.some(f=>f.status==='unverified')?'unverified':'pass';
 }catch(error){if(signal?.aborted)throw error;unknown(error instanceof Error?error.message:'Motion measurement failed.');result.status='unverified';}
 finally{result.comparisons=budget.comparisons;for(const g of bank.shapes.values())g.dispose();for(const g of bank.edges.values())g.dispose();}
 return result;
}
