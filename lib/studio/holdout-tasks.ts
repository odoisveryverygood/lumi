import {Vector3,Euler,Quaternion,Matrix4,Box3} from 'three';
import type {DeviceDocument,DevicePart,Vec3} from './types';
import {hydrateCatalogPart} from './catalog';
import {validateDeviceDocument} from './validation';
import {localPartBounds} from './render-model';
/**
 * Held-out evaluation tasks owned by the independent evaluator (teammate 3).
 *
 * These are unseen variations of the controlled desk-controller fixture: new
 * clearance values, a rotated sourced module, a wall (not floor) intersection,
 * a separation defect on a different axis, compound requirements and three
 * requests that must stay blocked. They were not used while implementing the
 * repair loop. Generation, planning and review code must never import this
 * module; a regression test enforces that.
 *
 * Dataset version 1 is frozen. Changing any request, geometry or oracle rule
 * requires a new version and keeps the earlier run's artifact.
 */
export const HOLDOUT_DATASET_VERSION=1;
export type HoldoutRequirement=
 |{kind:'inside';partId:string;clearance:number}
 |{kind:'separation';pairs:{a:string;b:string;minimum:number}[]}
 |{kind:'corridor';portId:string;length:number}
 |{kind:'max-height';partId:string;maximum:number}
 |{kind:'impossible-clearance';partId:string;clearance:number}
 |{kind:'contradiction'}
 |{kind:'unsupported-interior'};
export type HoldoutTask={id:string;name:string;group:'seeded-repair'|'fresh-edit'|'expected-refusal';expected:'satisfy'|'blocked';request:string;
 /** Parts whose placement may change. Shape changes are allowed only for a max-height target. */
 movable:string[];
 requirement:HoldoutRequirement;
 /** How the fixture is authored for this task. Seeded defects are by construction. */
 seed:{radio?:{sourceId?:string;position:Vec3;rotation?:Vec3};battery?:Vec3;bracket?:Vec3;housing?:'complete'|'no-floor'};
 note:string};
/** Known authored interior: inner faces X ±33, Z ±23, floor Y 0, ceiling Y 24. */
export const HOLDOUT_INTERIOR={minX:-33,maxX:33,minY:0,maxY:24,minZ:-23,maxZ:23};
export const holdoutTasks:HoldoutTask[]=[
 {id:'h1-rotated-module-outside',name:'Rotated sourced module outside the housing',group:'seeded-repair',expected:'satisfy',movable:['radio'],requirement:{kind:'inside',partId:'radio',clearance:1.5},seed:{radio:{position:[70,7,0],rotation:[0,90,0]}},request:'Place the ESP32-C3 module inside the housing with 1.5 mm clearance. Keep its rotation, the housing, the carrier board and the button unchanged.',note:'Unseen: a 90° rotated module and a 1.5 mm clearance value. A correct move keeps the rotation.'},
 {id:'h2-module-through-wall',name:'Larger module intersects a side wall',group:'seeded-repair',expected:'satisfy',movable:['radio'],requirement:{kind:'inside',partId:'radio',clearance:2},seed:{radio:{sourceId:'esp32-wroom-32e',position:[0,7,22]}},request:'Move the ESP32-WROOM module inside the housing with 2 mm clearance. Keep the housing, carrier board and button unchanged.',note:'Unseen: the defect is a +Z wall intersection rather than a floor or outside placement.'},
 {id:'h3-battery-overlap-z',name:'Battery overlaps the sourced module along Z',group:'seeded-repair',expected:'satisfy',movable:['battery'],requirement:{kind:'separation',pairs:[{a:'battery',b:'radio',minimum:2.5}]},seed:{battery:[0,7,10]},request:'Move the battery to leave 2.5 mm separation from the ESP32-C3 module. Keep the housing, carrier board, ESP32-C3 module and button unchanged.',note:'Unseen: overlap along the Z axis and a 2.5 mm separation value.'},
 {id:'h4-bracket-adjacent-port',name:'Bracket directly in front of the charging port',group:'seeded-repair',expected:'satisfy',movable:['bracket'],requirement:{kind:'corridor',portId:'charging-port',length:10},seed:{bracket:[0,12,30]},request:'Move the bracket so the charging port has 10 mm of clear space in front along its local +Z direction. Keep the charging port, housing and ESP32-C3 module unchanged.',note:'Unseen: the bracket sits 1 mm from the port face and the corridor length is 10 mm.'},
 {id:'h5-battery-height-5',name:'Fresh edit to a 5 mm battery envelope',group:'fresh-edit',expected:'satisfy',movable:['battery'],requirement:{kind:'max-height',partId:'battery',maximum:5},seed:{},request:'Reduce the illustrative battery height to a maximum of 5 mm by changing its actual geometry. Keep the housing and ESP32-C3 module unchanged.',note:'Unseen value. The one-pass candidate is a real model output on an unbroken fixture.'},
 {id:'h6-battery-height-2p5',name:'Fresh edit to a 2.5 mm battery envelope',group:'fresh-edit',expected:'satisfy',movable:['battery'],requirement:{kind:'max-height',partId:'battery',maximum:2.5},seed:{},request:'Reduce the illustrative battery height to a maximum of 2.5 mm by changing its actual geometry. Keep the housing and ESP32-C3 module unchanged.',note:'Unseen, tighter value than any implementation case.'},
 {id:'h7-compound-separation',name:'Fresh compound separation request',group:'fresh-edit',expected:'satisfy',movable:['battery'],requirement:{kind:'separation',pairs:[{a:'battery',b:'radio',minimum:4},{a:'battery',b:'carrier',minimum:2}]},seed:{},request:'Move the battery so it keeps at least 4 mm separation from the ESP32-C3 module and at least 2 mm separation from the carrier board. Keep every other component unchanged.',note:'Unseen: two separation clauses in one request. The standard layout fails the first clause (3.4 mm) without any seeded damage.'},
 {id:'h8-impossible-clearance',name:'Clearance larger than the interior',group:'expected-refusal',expected:'blocked',movable:[],requirement:{kind:'impossible-clearance',partId:'radio',clearance:12},seed:{},request:'Place the ESP32-C3 module inside the housing with 12 mm clearance on every side. Keep the housing unchanged.',note:'The interior is 24 mm tall; 12 mm above and below leaves no room for any module. Correct behavior is a blocked or unverified draft with the original geometry intact.'},
 {id:'h9-contradictory-request',name:'Contradictory preservation request',group:'expected-refusal',expected:'blocked',movable:[],requirement:{kind:'contradiction'},seed:{battery:[0,7,10]},request:'Keep every component exactly where it is and do not change any shape, but make the battery stop overlapping the ESP32-C3 module.',note:'No change can satisfy both clauses. Correct behavior is no accepted change and the seeded overlap still visible as a failed check.'},
 {id:'h10-missing-floor',name:'Housing without a floor',group:'expected-refusal',expected:'blocked',movable:[],requirement:{kind:'unsupported-interior'},seed:{radio:{position:[68,7,0]},housing:'no-floor'},request:'Place the ESP32-C3 module inside the housing with 1 mm clearance. Keep the incomplete housing unchanged.',note:'Unseen: the floor, not a wall, is missing. A bounding-box pass is unacceptable.'},
];
function authored(id:string,name:string,position:Vec3,size:Vec3,color:string):DevicePart{return {id,name,category:'Evaluation study',description:'Authored held-out evaluation geometry; not manufacturer CAD or an AI-generated customer result.',role:'Explicit controlled design-study component.',position,rotation:[0,0,0],size,explode:[0,25,0],color,solids:[{kind:'box',position:[0,0,0],size}],specs:{'Hardware status':'Illustrative evaluation envelope; operation unverified'},connections:[]};}
export function holdoutAssembly(task:HoldoutTask):DeviceDocument{
 const housing=authored('housing','Housing',[0,0,0],[70,26,50],'#e6c49c');
 const floor={kind:'box' as const,position:[0,-1,0] as Vec3,size:[70,2,50] as Vec3};
 housing.solids=[...(task.seed.housing==='no-floor'?[]:[floor]),...[-1,1].map(n=>({kind:'box' as const,position:[n*34,12,0] as Vec3,size:[2,24,50] as Vec3})),...[-1,1].map(n=>({kind:'box' as const,position:[0,12,n*24] as Vec3,size:[66,24,2] as Vec3}))];
 housing.specs={'Geometry basis':task.seed.housing==='no-floor'?'Authored enclosure with no floor; interior cannot be established':'Explicit five-surface evaluation enclosure','Source status':'Authored fixture, not manufacturer CAD'};
 const radioSeed=task.seed.radio,radio=hydrateCatalogPart(radioSeed?.sourceId??'esp32-c3-mini-1',{id:'radio',name:radioSeed?.sourceId?'ESP32-WROOM module':'ESP32-C3 module',position:radioSeed?.position??[0,7,0],rotation:radioSeed?.rotation??[0,0,0]});
 const doc:DeviceDocument={version:1,id:`holdout-${task.id}`,name:'Desk controller · held-out design study',description:'A sourced radio module and authored enclosure, battery, board and interface envelopes for an independent held-out evaluation.',provenance:'Held-out evaluation fixture. Only the radio is manufacturer-sourced CAD. Other components are authored geometric studies. This fixture is never served as a generation fallback.',source:'curated',
  parts:[housing,authored('carrier','Carrier board',[0,3,0],[54,1.6,32],'#4f756b'),radio,authored('battery','Illustrative battery',task.seed.battery??[19,12,-5],[18,8,26],'#9eb3ad'),authored('button','Button',[22,12,24],[8,8,6],'#dc9d64'),authored('charging-port','Charging port',[0,12,24],[12,7,6],'#7d878c'),authored('bracket','Bracket',task.seed.bracket??[22,12,32],[14,10,4],'#9ca4a4')],
  steps:[{title:'Inspect the design study',description:'These controlled fixtures test software constraints. They are not physical-build instructions.',partIds:['housing','carrier','radio','battery','button','charging-port','bracket']}],designBrief:task.request};
 return validateDeviceDocument(doc);
}
export type HoldoutCheck={name:string;passed:boolean;detail:string};
export type HoldoutVerdict={passed:boolean;checks:HoldoutCheck[]};
const worldBounds=(p:DevicePart)=>localPartBounds(p).applyMatrix4(new Matrix4().compose(new Vector3(...p.position),new Quaternion().setFromEuler(new Euler(...p.rotation.map(n=>n*Math.PI/180) as Vec3)),new Vector3(1,1,1)));
const shapeKey=(p:DevicePart)=>JSON.stringify({size:p.size,solids:p.solids.map(({color:_c,metalness:_m,roughness:_r,...s})=>s),mesh:p.mesh,catalogRef:p.catalogRef});
const poseKey=(p:DevicePart)=>JSON.stringify([p.position,p.rotation]);
export function boxGap(a:Box3,b:Box3){const axes=['x','y','z'] as const;return Math.hypot(...axes.map(k=>Math.max(0,a.min[k]-b.max[k],b.min[k]-a.max[k])));}
export function interiorMargin(b:Box3){const I=HOLDOUT_INTERIOR;return Math.min(b.min.x-I.minX,I.maxX-b.max.x,b.min.y-I.minY,I.maxY-b.max.y,b.min.z-I.minZ,I.maxZ-b.max.z);}
/**
 * Independent held-out oracle. It reads geometry only: never model prose, planned
 * contracts, computed design checks or the review status. For an expected refusal
 * `passed` means the correct blocked behavior was observed (nothing changed and the
 * impossible requirement was not manufactured), not that the request succeeded.
 */
export function holdoutOracle(task:HoldoutTask,baseline:DeviceDocument,candidate:DeviceDocument):HoldoutVerdict{
 const checks:HoldoutCheck[]=[],record=(name:string,passed:boolean,detail:string)=>checks.push({name,passed,detail});
 const before=new Map(baseline.parts.map(p=>[p.id,p])),after=new Map(candidate.parts.map(p=>[p.id,p]));
 const sameShape=(id:string)=>!!before.get(id)&&!!after.get(id)&&shapeKey(before.get(id)!)===shapeKey(after.get(id)!);
 const samePose=(id:string)=>!!before.get(id)&&!!after.get(id)&&poseKey(before.get(id)!)===poseKey(after.get(id)!);
 const eps=1e-5,r=(n:number)=>Math.round(n*1000)/1000;
 record('Original component identities',baseline.parts.every(p=>after.has(p.id))&&candidate.parts.length>=baseline.parts.length,`${baseline.parts.length} original IDs must remain.`);
 const frozen=baseline.parts.filter(p=>!task.movable.includes(p.id));
 record('Unrelated shape and placement',frozen.every(p=>sameShape(p.id)&&samePose(p.id)),`${frozen.length} components outside the requested edit keep their shape and pose.`);
 const shapeChangeAllowed=task.requirement.kind==='max-height'?task.requirement.partId:null;
 record('Moved components keep their shape',task.movable.filter(id=>id!==shapeChangeAllowed).every(sameShape),'A move request cannot shrink or replace a part to manufacture a pass.');
 record('Source CAD canonical',sameShape('radio'),'The sourced module keeps its mesh, size and catalog reference.');
 if(task.requirement.kind!=='unsupported-interior'){
  const originallyInside=baseline.parts.filter(p=>p.id!=='housing'&&interiorMargin(worldBounds(p))>=-eps);
  record('Originally contained components stay inside',originallyInside.every(p=>after.has(p.id)&&interiorMargin(worldBounds(after.get(p.id)!))>=-eps),`${originallyInside.length} components inside the known interior at the start must still be inside.`);
 }
 const req=task.requirement;
 if(req.kind==='inside'){const p=after.get(req.partId);const margin=p?interiorMargin(worldBounds(p)):-Infinity;record('Known interior clearance',margin>=req.clearance-eps,`Margin to the known inner faces ${r(margin)} mm; required ${req.clearance} mm.`);if(before.get(req.partId)?.rotation.some(n=>n))record('Requested rotation retained',!!p&&JSON.stringify(p.rotation)===JSON.stringify(before.get(req.partId)!.rotation),'The request keeps the module rotation.');}
 else if(req.kind==='separation'){for(const pair of req.pairs){const a=after.get(pair.a),b=after.get(pair.b);const gap=a&&b?boxGap(worldBounds(a),worldBounds(b)):-Infinity;record(`Envelope separation ${pair.a}–${pair.b}`,gap>=pair.minimum-eps,`Conservative envelope gap ${r(gap)} mm; minimum ${pair.minimum} mm.`);}}
 else if(req.kind==='corridor'){const port=after.get(req.portId),portBox=port?worldBounds(port):null;let clear=false;if(portBox){const corridor=new Box3(new Vector3(portBox.min.x,portBox.min.y,portBox.max.z),new Vector3(portBox.max.x,portBox.max.y,portBox.max.z+req.length));clear=candidate.parts.filter(p=>p.id!==req.portId&&p.id!=='housing').every(p=>boxGap(worldBounds(p),corridor)>eps||!worldBounds(p).intersectsBox(corridor));}
  record('Straight +Z corridor clear',clear,`A ${req.length} mm straight corridor in front of the port face must contain no component envelope.`);}
 else if(req.kind==='max-height'){const p=after.get(req.partId);const h=p?localPartBounds(p).getSize(new Vector3()).y:Infinity;record('Actual geometry height',h<=req.maximum+eps,`Actual solid height ${r(h)} mm; maximum ${req.maximum} mm.`);record('Resized part has real geometry',!!p&&p.solids.length>0&&!p.mesh,'Size metadata alone cannot pass; the rendered solids must change.');}
 else if(req.kind==='impossible-clearance'){const p=after.get(req.partId);const margin=p?interiorMargin(worldBounds(p)):-Infinity;record('Impossible clearance was not manufactured',margin<req.clearance-eps,`A ${req.clearance} mm clearance cannot exist in a 24 mm interior; measured margin ${r(margin)} mm. Correct behavior is a blocked draft.`);record('Nothing changed',baseline.parts.every(p=>sameShape(p.id)&&samePose(p.id)),'An expected refusal must not alter the saved object.');}
 else if(req.kind==='contradiction'){record('Nothing changed',baseline.parts.every(p=>sameShape(p.id)&&samePose(p.id)),'Both clauses cannot hold; the correct outcome leaves the object unchanged.');const a=after.get('battery'),b=after.get('radio');const gap=a&&b?boxGap(worldBounds(a),worldBounds(b)):-Infinity;record('Seeded overlap still measurable',gap<=eps,`Envelope gap ${r(gap)} mm; the overlap must remain visible as a failed check rather than hidden.`);}
 else if(req.kind==='unsupported-interior'){record('Interior cannot be established',false,'The authored enclosure has no floor. A bounding-box pass is unacceptable; correct behavior is an explicit unverified draft with the original geometry intact.');record('Nothing changed',baseline.parts.every(p=>sameShape(p.id)&&samePose(p.id)),'An unverified outcome must not alter the saved object.');}
 const positive=checks.filter(c=>!['Impossible clearance was not manufactured','Interior cannot be established'].includes(c.name));
 const passed=task.expected==='satisfy'?checks.every(c=>c.passed):positive.every(c=>c.passed)&&checks.some(c=>c.name==='Nothing changed'&&c.passed);
 return {passed,checks};
}
