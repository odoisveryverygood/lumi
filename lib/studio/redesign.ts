import { Box3, Euler, Matrix4, Quaternion, Ray, Triangle, Vector3 } from 'three';
import { z } from 'zod';
import type { SourceCitation } from './knowledge';
import type { DeviceDocument, DevicePart, Solid, Vec3 } from './types';
import { hardwareById } from './hardware-catalog';
import { applyDeviceTransaction } from './interaction';
import { validateDeviceDocument } from './validation';
import {solidDimensions} from './render-model';

const vec = z.tuple([z.number().finite().min(-500),z.number().finite().min(-500),z.number().finite().min(-500)]).refine(v=>v.every(n=>n<=500),'Position exceeds 500 mm');
export const designConstraintsSchema = z.object({
  minChargeMa:z.number().min(0).max(1000).default(100),
  minCapacityMah:z.number().min(0).max(100000).default(150),
  maxBatteryHeight:z.number().positive().max(500).nullable().default(null),
  maxBatteryWidth:z.number().positive().max(500).nullable().default(null),
  maxBatteryDepth:z.number().positive().max(500).nullable().default(null),
  clearance:z.number().min(0).max(20).default(.4),
  keepPad:z.boolean().default(false),
  batterySide:z.enum(['any','left','right']).default('any'),
}).strict();
export type DesignConstraints = z.infer<typeof designConstraintsSchema>;
export const defaultDesignConstraints = designConstraintsSchema.parse({});
const constraintPatch = z.object({key:z.enum(['minChargeMa','minCapacityMah','maxBatteryHeight','maxBatteryWidth','maxBatteryDepth','clearance','keepPad','batterySide']),value:z.union([z.number(),z.boolean(),z.string(),z.null()]),evidence:z.string().trim().min(1).max(400)}).strict();
const placement = z.object({catalogId:z.string().max(60),position:vec,rotationY:z.union([z.literal(0),z.literal(90)])}).strict();
export const redesignPlanSchema = z.object({
  summary:z.string().trim().min(1).max(1800),
  constraintChanges:z.array(constraintPatch).max(10).default([]),
  unsupportedConstraints:z.array(z.string().min(1).max(300)).max(8).default([]),
  battery:placement, radio:placement,
  removePad:z.boolean(),
  chargeCurrentMa:z.number().positive().max(1000).default(100),
  citations:z.array(z.object({sourceId:z.string().max(100),page:z.number().int().min(1).max(80),quote:z.string().min(8).max(900)}).strict()).max(4).default([]),
}).strict();
export type RedesignPlan = z.infer<typeof redesignPlanSchema>;
export interface DesignCheck {
  citations?:SourceCitation[];
  id:string; status:'pass'|'fail'|'unverified'; title:string; detail:string; partIds:string[];
  region?:{position:Vec3;size:Vec3};
  measurement?:{from:Vec3;to:Vec3;label:string;detail?:string;tone:'pass'|'fail'|'info'};
  metrics?:{requiredMm:number;availableMm:number;shortfallMm:number};
}
export interface DesignAttempt {
  number:number; summary:string; checks:DesignCheck[]; plan?:RedesignPlan;
}
export interface RedesignResult {
  document:DeviceDocument; constraints:DesignConstraints; attempts:DesignAttempt[];
  checks:DesignCheck[]; status:'ready'|'blocked'; model:string; summary:string;
  sourceIds:string[]; baseFingerprint:string;
  grounding?:{citations:SourceCitation[];files:number;pages:number;characters:number;visualFiles:number};
}

/** Revision guard only, not a security signature. The server always rechecks geometry. */
export function documentFingerprint(document:DeviceDocument):string {
  const value=JSON.stringify(document);let h=2166136261;
  for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0).toString(16);
}
export function mergeConstraintChanges(previous:DesignConstraints,changes:RedesignPlan['constraintChanges'],request:string):DesignConstraints {
  const next={...previous}; const seen=new Set<string>();
  for(const change of changes){
    if(seen.has(change.key))throw new Error('A constraint can be changed only once per request.');seen.add(change.key);
    if(!request.toLowerCase().includes(change.evidence.toLowerCase()))throw new Error('Constraint changes require an exact quote from the latest request.');
    Object.assign(next,{[change.key]:change.value});
  }
  return designConstraintsSchema.parse(next);
}
export function supportsRedesign(document:DeviceDocument):boolean {
  return document.source!=='import' && !document.parts.some(p=>p.assetNode) && ['keyboard-case-base','keyboard-case-frame','keyboard-pcb','keyboard-controller','keyboard-usb'].every(id=>document.parts.some(p=>p.id===id));
}

function matrix(position:Vec3,rotation:Vec3=[0,0,0]) {
  return new Matrix4().compose(new Vector3(...position),new Quaternion().setFromEuler(new Euler(...rotation.map(n=>n*Math.PI/180) as Vec3)),new Vector3(1,1,1));
}
/** Conservative world-space bounds of actual solids. Hollow enclosures remain hollow.
 * Round solids and rotated solids use enclosing boxes; a reported conflict needs CAD review. */
export function solidWorldBounds(part:DevicePart,solid:Solid):Box3 {
  const half=solidDimensions(solid).multiplyScalar(.5);return new Box3(half.clone().negate(),half).applyMatrix4(matrix(part.position,part.rotation).multiply(matrix(solid.position,solid.rotation)));
}
export function partWorldBounds(part:DevicePart):Box3 {
  if(hardwareIds.includes(part.id)&&part.specs['Catalog reference'])return new Box3(new Vector3(...part.size).multiplyScalar(-.5),new Vector3(...part.size).multiplyScalar(.5)).applyMatrix4(matrix(part.position,part.rotation));
  if(part.mesh){const b=new Box3(),m=matrix(part.position,part.rotation);for(let i=0;i<part.mesh.positions.length;i+=3)b.expandByPoint(new Vector3(...part.mesh.positions.slice(i,i+3) as Vec3).applyMatrix4(m));return b;}
  const bounds=new Box3();for(const solid of part.solids)bounds.union(solidWorldBounds(part,solid));return bounds;
}
export function designCavity(document:DeviceDocument):Box3 {
  if(document.id==='corne-cherry-v4-left')return new Box3(new Vector3(-55,2,-33),new Vector3(55,8.5,7));
  const floor=document.parts.find(p=>p.id==='keyboard-case-base')!,pcb=document.parts.find(p=>p.id==='keyboard-pcb')!;
  const solids=floor.solids.filter(s=>s.kind==='box'&&s.size[0]>300).map(s=>solidWorldBounds(floor,s));
  if(!solids.length)throw new Error('This case needs an interior region before its layout can be checked.');
  const bounds=new Box3();for(const b of solids)bounds.union(b);
  return new Box3(new Vector3(bounds.min.x+9.5,Math.max(...solids.map(b=>b.max.y)),bounds.min.z+9.5),new Vector3(bounds.max.x-9.5,partWorldBounds(pcb).min.y,bounds.max.z-9.5));
}
/** Exact triangle/surface intersection against the tessellated source mesh. No enclosing
 * case box is substituted for its hollow geometry. Ray parity also detects solid containment. */
export function meshBoxConflict(part:DevicePart,box:Box3,allowance=0):Box3|null {
  if(!part.mesh)return null;const transform=matrix(part.position,part.rotation),v=part.mesh.positions,index=part.mesh.indices;
  if(!partWorldBounds(part).expandByScalar(allowance).intersectsBox(box))return null;
  const expanded=box.clone().expandByScalar(Math.max(0,allowance-1e-5)),triangle=new Triangle(),region=new Box3(),a=new Vector3(),b=new Vector3(),c=new Vector3();
  const center=box.getCenter(new Vector3()),ray=new Ray(center,new Vector3(.943,.237,.230).normalize()),point=new Vector3(),hits:number[]=[];
  for(let i=0;i<index.length;i+=3){
    a.fromArray(v,index[i]*3).applyMatrix4(transform);b.fromArray(v,index[i+1]*3).applyMatrix4(transform);c.fromArray(v,index[i+2]*3).applyMatrix4(transform);triangle.set(a,b,c);
    if(expanded.intersectsTriangle(triangle)){const bounds=new Box3().setFromPoints([a,b,c]).intersect(expanded);if(!bounds.isEmpty())region.union(bounds);}
    if(ray.intersectTriangle(a,b,c,false,point))hits.push(point.distanceTo(center));
  }
  if(!region.isEmpty())return region;
  hits.sort((a,b)=>a-b);const unique=hits.filter((n,i)=>!i||Math.abs(n-hits[i-1])>1e-5);
  return unique.length%2===1?box.clone():null;
}
/** Each sample must have an actual source floor below it; the rectangular study region
 * alone cannot describe the curved outline or its openings. */
export function sourceFloorSupports(part:DevicePart,box:Box3,floorY:number):boolean {
  if(!part.mesh)return true;
  const transform=matrix(part.position,part.rotation),vertices=part.mesh.positions,indices=part.mesh.indices,point=new Vector3();
  const xs=[box.min.x,(box.min.x+box.max.x)/2,box.max.x],zs=[box.min.z,(box.min.z+box.max.z)/2,box.max.z];
  return xs.every(x=>zs.every(z=>{const ray=new Ray(new Vector3(x,floorY+.08,z),new Vector3(0,-1,0));for(let i=0;i<indices.length;i+=3){const v=[0,1,2].map(j=>new Vector3().fromArray(vertices,indices[i+j]*3).applyMatrix4(transform)) as [Vector3,Vector3,Vector3];if(ray.intersectTriangle(...v,false,point)&&point.y>=floorY-.15)return true;}return false;}));
}
const hardwareIds=['wireless-battery','wireless-controller'];
export function buildRedesign(document:DeviceDocument,plan:RedesignPlan,baseline:DeviceDocument=document):DeviceDocument {
  if(!supportsRedesign(document))throw new Error('Open the editable mechanical keyboard to use the sourced wireless redesign workflow.');
  const battery=hardwareById(plan.battery.catalogId),radio=hardwareById(plan.radio.catalogId);
  if(battery.kind!=='battery'||radio.kind!=='radio')throw new Error('The chosen component does not match its role.');
  const removing=['wireless-battery','wireless-controller','wireless-power-board','wireless-harness',...(plan.removePad?['keyboard-dampener']:[])].filter(id=>document.parts.some(p=>p.id===id));
  let next=removing.length?applyDeviceTransaction(document,{removePartIds:removing}):structuredClone(document);
  if(!plan.removePad&&!next.parts.some(p=>p.id==='keyboard-dampener')){
    const pad=baseline.parts.find(p=>p.id==='keyboard-dampener');
    if(pad){next.parts.push(structuredClone(pad));const assembly=next.assemblies?.find(a=>a.id===pad.assemblyId);if(assembly)assembly.partIds.push(pad.id);}
  }
  const additions=[['wireless-battery',battery,plan.battery],['wireless-controller',radio,plan.radio]] as const;
  for(const [id,item,pose] of additions){
    const bodyColor=item.kind==='battery'?'#d1c8dc':'#334f62';
    const [w,h,d]=item.size;
    const box=(position:Vec3,size:Vec3,color:string,metalness=.2):Solid=>({kind:'box',position,size,color,metalness,roughness:.48});
    const details:Solid[]=item.kind==='battery'?[box([0,0,0],[w,h,d],bodyColor,.65),box([-w*.38,h/2-.08,0],[w*.1,.16,d*.94],'#dfbc76'),box([0,h/2-.03,0],[w*.65,.06,d*.7],'#f5eced')]:[
      box([0,-h/2+.4,0],[w,.8,d],bodyColor),box([w*.12,-h/2+1.7,0],[w*.42,Math.min(h-.8,2.6),d*.62],'#262631'),box([-w/2+3.5,h/2-1.1,0],[7,2.2,8],'#bdb6c7',.8),
      ...[-1,1].flatMap(sign=>Array.from({length:8},(_,i)=>box([-w*.3+i*w*.085,-h/2+.85,sign*(d/2-.75)],[1.1,.15,1.15],'#dbb87b',.8)))
    ];
    next.parts.push({id,name:item.name,category:item.kind==='battery'?'Sourced battery envelope':'Documented Bluetooth board envelope',description:`Published dimensions: ${item.sourceDimensions}. Simplified envelope, not manufacturer CAD.`,role:item.kind==='battery'?'Stores energy for the proposed wireless conversion. Charge compatibility, swelling allowance, leads and protection require separate verification.':'Proposed BLE keyboard controller and integrated charging. The retained USB port needs an engineered adapter and the key matrix needs compatible firmware.',position:pose.position,rotation:[0,pose.rotationY,0],size:[...item.size],explode:item.kind==='battery'?[-35,-70,45]:[40,-45,-25],color:bodyColor,solids:details,specs:{Legend:item.kind==='battery'?`${item.capacityMah} mAh`:'BLE',Manufacturer:item.manufacturer,'Catalog reference':item.id,...(item.kind==='radio'?{'Proposed charge current (mA)':String(plan.chargeCurrentMa)}:{}),'Envelope dimensions':item.sourceDimensions,'Geometry basis':item.geometryNote||'Manufacturer envelope; illustrative solid','Hardware status':'Not physically verified',...(item.capacityMah?{'Capacity (mAh)':String(item.capacityMah)}:{'Charging':'Integrated LiPo charging; electrical integration unverified'})},connections:[],sourceUrl:item.sourceUrl,assemblyId:'assembly-wireless'});
  }
  next.parts=next.parts.map(p=>{
    if(p.id==='keyboard-usb'){
      const role='Retained USB receptacle, proposed charging input. Adapter wiring to the selected BLE board remains unverified.';
      return {...p,description:role,role,specs:{...p.specs,Mode:'Proposed charging input; keyboard reports use BLE','USB data':'Bypassed in this concept'},connections:[...p.connections.filter(c=>c.partId!=='keyboard-controller'),{partId:'wireless-controller',label:'Proposed USB charge input; adapter unverified'}]};
    }
    if(p.id==='keyboard-controller'){
      const role='Existing matrix scanner retained; interface, regulated supply and firmware to the BLE controller require engineering.';
      return {...p,name:p.name==='Matrix scan & USB controller'?'Matrix scan controller':p.name,description:role,role,specs:{...Object.fromEntries(Object.entries(p.specs).filter(([key])=>key!=='Wired mode')),'Interface mode':'Proposed matrix scanner → BLE controller','USB data path':'Bypassed in this concept'},connections:[...p.connections.filter(c=>c.partId!=='keyboard-usb'),{partId:'wireless-controller',label:'Proposed matrix data and regulated power; unverified'}]};
    }
    if(p.id==='keyboard-wired-cable'){
      const role='Retained cable for the proposed USB charging input. Keyboard reports follow the proposed BLE path; adapter wiring and hardware operation are unverified.';
      return {...p,name:p.name==='USB data & power cable'?'USB charging cable':p.name,description:role,role,specs:{...p.specs,Mode:'Proposed USB charging cable'}};
    }
    return p;
  });
  next.parts.find(p=>p.id==='wireless-battery')!.connections=[{partId:'wireless-controller',label:'Proposed LiPo power and charge path'}];
  next.assemblies=(next.assemblies||[]).filter(a=>a.id!=='assembly-wireless');
  next.assemblies.push({id:'assembly-wireless',name:'Sourced wireless design study',partIds:hardwareIds});
  next.relationships=(next.relationships||[]).filter(r=>!(r.type==='data'&&(r.from==='keyboard-usb'||r.to==='keyboard-usb')));
  next.relationships.push({id:'design-charge',from:'keyboard-usb',to:'wireless-controller',type:'electrical',description:'Proposed retained USB-to-integrated-charger path; adapter and electrical compatibility unverified.'},{id:'design-power',from:'wireless-battery',to:'wireless-controller',type:'electrical',description:'Proposed battery-to-radio power path; wiring and charging not verified.'},{id:'design-key-data',from:'keyboard-controller',to:'wireless-controller',type:'data',description:'Proposed key-state interface requiring firmware.'});
  next.relationships.push({id:'design-scan-power',from:'wireless-controller',to:'keyboard-controller',type:'electrical',description:'Proposed regulated matrix supply; power-tree compatibility requires engineering.'},...hardwareIds.map(id=>({id:`design-contains-${id}`,from:'keyboard-case-base',to:id,type:'contains' as const,description:'Proposed lower-enclosure placement; only listed model checks are performed.'})));
  next.capabilities=[...new Set([...(next.capabilities||[]).filter(c=>c!=='wired-keyboard'),'wireless-keyboard','constraint-redesign'])];
  next.provenance=`${document.provenance.split(' Sourced redesign:')[0].slice(0,3000)} Sourced redesign: documented component envelopes, checked against ${document.id==='corne-cherry-v4-left'?'source CAD and labeled reconstructed geometry':'illustrative keyboard solids'}. Bounds checks do not establish actual fit, firmware, charging, RF or physical performance.`;
  next.steps=[...next.steps.filter(s=>!s.title.startsWith('Sourced redesign:')&&!['Inspect the wireless power architecture','Review wireless firmware and clearance'].includes(s.title)).map(s=>s.title==='Review the wired interface'?{...s,title:'Review the proposed charging and BLE interface',description:'The retained USB receptacle is proposed for charging through the BLE board’s integrated charger. The matrix scanner sends key states to the BLE board. Adapter wiring, regulated supply, firmware, radio behavior and actual hardware remain unverified.'}:s),{title:'Sourced redesign: review the integration',description:'Inspect manufacturer dimensions and the geometry report. The keyboard is a concept model. Matrix firmware, retained USB adapter, charging compatibility, mounting and real hardware remain unverified.',partIds:['wireless-battery','wireless-controller','keyboard-usb','keyboard-controller']}];
  return validateDeviceDocument(next);
}

export function checkRedesign(baseline:DeviceDocument,candidate:DeviceDocument,constraints:DesignConstraints,unsupported:string[]=[]):DesignCheck[] {
  const checks:DesignCheck[]=[];
  const add=(id:string,pass:boolean,title:string,detail:string,partIds:string[]=[])=>checks.push({id,status:pass?'pass':'fail',title,detail,partIds});
  // Preserve every original rigid part, not just the case. The acoustic pad is the only removable original.
  const original=baseline.parts.filter(p=>!p.id.startsWith('wireless-')&&p.id!=='keyboard-dampener');
  const geometry=(p:DevicePart)=>JSON.stringify([p.position,p.rotation,p.size,p.mesh||null,p.solids.map(s=>[s.kind,s.position,s.size,s.rotation||[0,0,0],s.color||null,s.metalness??null,s.roughness??null])]);
  const changed=original.filter(p=>{const q=candidate.parts.find(q=>q.id===p.id);return !q||geometry(p)!==geometry(q);});
  add('preserve',!changed.length,'Original case, PCB and keys preserved',changed.length?`Changed protected geometry: ${changed.map(p=>p.name).join(', ')}.`:'Every original rigid component retains its geometry and assembled placement.',changed.map(p=>p.id));
  const battery=candidate.parts.find(p=>p.id==='wireless-battery'),radio=candidate.parts.find(p=>p.id==='wireless-controller');
  if(!battery||!radio){add('components',false,'Wireless components present','A sourced battery and Bluetooth board are required.');return checks;}
  const batteryRef=hardwareById(battery.specs['Catalog reference']);
  const radioRef=hardwareById(radio.specs['Catalog reference']);if(radioRef.geometryNote)checks.push({id:'radio-dimensions',status:'unverified',title:'Radio footprint source',detail:radioRef.geometryNote,partIds:[radio.id]});
  add('capacity',(batteryRef.capacityMah||0)>=constraints.minCapacityMah,'Battery capacity',`${batteryRef.capacityMah} mAh stated capacity; minimum ${constraints.minCapacityMah} mAh. Runtime is not calculated.`,[battery.id]);
  for(const [key,axis,title] of [['maxBatteryWidth',0,'Battery width'],['maxBatteryHeight',1,'Battery height'],['maxBatteryDepth',2,'Battery depth']] as const){
    const maximum=constraints[key];if(maximum!==null)add(key,battery.size[axis]<=maximum+.0001,title,`${battery.size[axis]} mm component dimension; maximum ${maximum} mm.`,[battery.id]);
  }
  add('side',constraints.batterySide==='any'||(constraints.batterySide==='left'?partWorldBounds(battery).max.x<=0:partWorldBounds(battery).min.x>=0),'Battery placement',constraints.batterySide==='any'?'No side restriction.':`The complete battery envelope must be on the ${constraints.batterySide} half.`,[battery.id]);
  add('pad',!constraints.keepPad||candidate.parts.some(p=>p.id==='keyboard-dampener'),'Acoustic pad constraint',constraints.keepPad?'The original acoustic pad must remain.':candidate.parts.some(p=>p.id==='keyboard-dampener')?'The pad is retained.':'Pad removal is proposed to create vertical space.',['keyboard-dampener'].filter(id=>candidate.parts.some(p=>p.id===id)));
  const charger=(candidate.relationships||[]).some(r=>r.from==='keyboard-usb'&&r.to===radio.id&&r.type==='electrical');
  add('usb',charger,'USB charging architecture',charger?'Retained USB receptacle is linked to the board’s integrated charger in the object graph. Adapter wiring is unverified.':'The proposed USB charging connection is missing.',['keyboard-usb',radio.id]);
  // Conservative interior region for this concept case. Recompute vertical ceiling from PCB solids.
  let cavity:Box3;try{cavity=designCavity(candidate);}catch(error){add('case-region',false,'Case region unavailable',error instanceof Error?error.message:'No interior region.',['keyboard-case-base']);return checks;}
  const floorTop=cavity.min.y,ceiling=cavity.max.y;
  for(const part of [battery,radio]){
    const bounds=partWorldBounds(part),inside=cavity.clone().expandByScalar(-constraints.clearance).containsBox(bounds);
    add(`cavity-${part.id}`,inside,`${part.name}: case interior`,inside?`Envelope remains inside the conservative lower-case region with ${constraints.clearance} mm boundary allowance.`:`Envelope exceeds the lower-case region. Allowed X ${(cavity.min.x+constraints.clearance).toFixed(2)}–${(cavity.max.x-constraints.clearance).toFixed(2)}, Z ${(cavity.min.z+constraints.clearance).toFixed(2)}–${(cavity.max.z-constraints.clearance).toFixed(2)}, Y ${(floorTop+constraints.clearance).toFixed(2)}–${(ceiling-constraints.clearance).toFixed(2)} mm.`,[part.id,'keyboard-case-base','keyboard-pcb']);
    const shell=candidate.parts.find(p=>p.id==='keyboard-case-base');
    if(shell?.mesh)add(`floor-${part.id}`,sourceFloorSupports(shell,bounds,floorTop),`${part.name}: source floor coverage`,'The component footprint is sampled at corners, edge midpoints and center against the original CAD floor. Tolerance and mounting remain unverified.',[part.id,shell.id]);
    const collisions:DesignCheck[]=[];
    for(const obstacle of candidate.parts){
      if(obstacle.id===part.id||obstacle.id==='keyboard-wired-cable')continue;
      if(obstacle.mesh){
        const conflict=meshBoxConflict(obstacle,bounds,constraints.clearance);
        if(conflict){const center=conflict.getCenter(new Vector3()),extent=conflict.getSize(new Vector3());collisions.push({id:`collision-${part.id}-${obstacle.id}`,status:'fail',title:`${part.name} / ${obstacle.name}`,detail:`The component or its ${constraints.clearance} mm allowance intersects the source mesh. Inspect the highlighted region; source registration and manufacturing tolerances remain unverified.`,partIds:[part.id,obstacle.id],region:{position:center.toArray() as Vec3,size:extent.toArray() as Vec3}});}
        continue;
      }
      // Candidate envelopes against actual solids, including the other new component.
      for(const ob of hardwareIds.includes(obstacle.id)?[partWorldBounds(obstacle)]:obstacle.solids.map(s=>solidWorldBounds(obstacle,s))){
        const expanded=ob.clone().expandByScalar(constraints.clearance);
        const intersection=bounds.clone().intersect(expanded);const size=intersection.getSize(new Vector3());
        if(intersection.isEmpty()||Math.min(size.x,size.y,size.z)<.0001)continue;
        const actual=bounds.clone().intersect(ob),overlap=!actual.isEmpty()&&Math.min(...actual.getSize(new Vector3()).toArray())>.0001;
        const region=(overlap?actual:intersection),center=region.getCenter(new Vector3()),extent=region.getSize(new Vector3());
        collisions.push({id:`collision-${part.id}-${obstacle.id}`,status:'fail',title:`${part.name} / ${obstacle.name}`,detail:overlap?`Envelope overlap ${extent.toArray().map(n=>n.toFixed(2)).join(' × ')} mm. Relocate the component or remove an unlocked obstacle.`:`Less than ${constraints.clearance} mm envelope clearance. Relocate the component.`,partIds:[part.id,obstacle.id],region:{position:center.toArray() as Vec3,size:extent.toArray() as Vec3}});
        break;
      }
    }
    if(collisions.length)checks.push(...collisions.slice(0,12));
    else add(`clearance-${part.id}`,true,`${part.name}: envelope clearance`,`No overlap with modeled rigid solids at ${constraints.clearance} mm allowance. Round and rotated solids use conservative world-space bounds.`,[part.id]);
    // Measure the largest vertical free interval at this component's X/Z footprint.
    let windows:{low:number;high:number;limits:string[]}[]=[{low:floorTop+constraints.clearance,high:ceiling-constraints.clearance,limits:['keyboard-case-base','keyboard-pcb']}];
    for(const obstacle of candidate.parts){
      if(obstacle.id===part.id||obstacle.mesh||obstacle.id==='keyboard-wired-cable')continue;
      for(const ob of hardwareIds.includes(obstacle.id)?[partWorldBounds(obstacle)]:obstacle.solids.map(s=>solidWorldBounds(obstacle,s))){if(ob.max.x+constraints.clearance<=bounds.min.x||ob.min.x-constraints.clearance>=bounds.max.x||ob.max.z+constraints.clearance<=bounds.min.z||ob.min.z-constraints.clearance>=bounds.max.z)continue;
        const lo=ob.min.y-constraints.clearance,hi=ob.max.y+constraints.clearance;
        windows=windows.flatMap(w=>hi<=w.low||lo>=w.high?[w]:[{low:w.low,high:Math.min(w.high,lo),limits:[...w.limits,obstacle.id]},{low:Math.max(w.low,hi),high:w.high,limits:[...w.limits,obstacle.id]}].filter(w=>w.high>w.low));
      }
    }
    const best=windows.sort((a,b)=>(b.high-b.low)-(a.high-a.low))[0]||{low:floorTop+constraints.clearance,high:floorTop+constraints.clearance,limits:[]};
    const available=Math.round(Math.max(0,best.high-best.low)*1e5)/1e5,required=Math.round((bounds.max.y-bounds.min.y)*1e5)/1e5,pass=required<=available+.0001,x=bounds.max.x+4,z=(bounds.min.z+bounds.max.z)/2;
    checks.push({id:`space-${part.id}`,status:pass?'pass':'fail',title:`${part.name}: vertical room`,detail:`At this footprint, the largest modeled vertical gap is ${(Math.round(available*100)/100).toFixed(2)} mm; the component needs ${required.toFixed(2)} mm. Allowance is already included.`,partIds:[part.id,...new Set(best.limits)],metrics:{requiredMm:required,availableMm:available,shortfallMm:Math.max(0,required-available)},measurement:{from:[x,best.low,z],to:[x,best.high,z],label:`${(Math.round(available*100)/100).toFixed(2)} mm available`,detail:`${required.toFixed(2)} mm required`,tone:pass?'pass':'fail'}});
  }
  for(const [index,detail] of unsupported.entries())add(`unsupported-${index}`,false,'Unresolved requirement',detail);
  checks.push({id:'physical',status:'unverified',title:'Physical and electrical verification',detail:(candidate.id==='corne-cherry-v4-left'?'Original enclosure/plate geometry with registered assembly and labeled reconstructed details. ':'Case geometry is illustrative. ')+'Tolerances, mounting, battery swelling, leads, antenna clearance, firmware, charge current, adapter wiring and real-world operation have not been verified.',partIds:hardwareIds});
  return checks;
}
