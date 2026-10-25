import {Vector3,Euler,Quaternion,Matrix4} from 'three';
import type {DeviceDocument,DevicePart,Vec3} from './types';
import {hydrateCatalogPart} from './catalog';
import {validateDeviceDocument} from './validation';
import {localPartBounds} from './render-model';
export type DesignTask={id:string;name:string;mode:'seeded-repair'|'live-edit'|'negative-control';expected:'satisfy'|'blocked';request:string;scenario:'outside'|'floor'|'height'|'gap'|'access'|'unsupported'|'source-limit';gap?:number;sourceId?:string};
/** Frozen evaluation inputs. Never imported by generation or used as response templates. */
export const designTasks:DesignTask[]=[
 {id:'radio-outside-1',name:'Sourced module outside enclosure',mode:'seeded-repair',expected:'satisfy',scenario:'outside',gap:1,request:'Place the ESP32-C3 module inside the housing with 1 mm clearance. Keep the housing and the button unchanged.'},
 {id:'radio-outside-2',name:'Larger sourced module outside enclosure',mode:'seeded-repair',expected:'satisfy',scenario:'outside',sourceId:'esp32-wroom-32e',gap:2,request:'Move the ESP32-WROOM module inside the housing with 2 mm clearance. Keep the housing, carrier board and button unchanged.'},
 {id:'radio-floor-1',name:'Module intersects enclosure floor',mode:'seeded-repair',expected:'satisfy',scenario:'floor',gap:1,request:'Move the ESP32-C3 module inside the housing with 1 mm clearance. Keep the housing and carrier board unchanged.'},
 {id:'radio-floor-2',name:'Larger module intersects enclosure floor',mode:'seeded-repair',expected:'satisfy',scenario:'floor',sourceId:'esp32-wroom-32e',gap:2,request:'Move the ESP32-WROOM module inside the housing with 2 mm clearance. Keep the housing and carrier board unchanged.'},
 {id:'battery-height-4',name:'Live edit to a 4 mm envelope',mode:'live-edit',expected:'satisfy',scenario:'height',gap:4,request:'Reduce the illustrative battery height to a maximum of 4 mm by changing its actual geometry. Keep the housing and ESP32-C3 module unchanged.'},
 {id:'battery-height-3',name:'Live edit to a 3 mm envelope',mode:'live-edit',expected:'satisfy',scenario:'height',gap:3,request:'Reduce the illustrative battery height to a maximum of 3 mm by changing its actual geometry. Keep the housing and ESP32-C3 module unchanged.'},
 {id:'battery-gap-3',name:'Overlapping battery and sourced radio',mode:'seeded-repair',expected:'satisfy',scenario:'gap',gap:3,request:'Move the battery to leave 3 mm separation from the ESP32-C3 module. Keep the housing, carrier board, ESP32-C3 module and button unchanged.'},
 {id:'battery-gap-5',name:'Wider required separation',mode:'seeded-repair',expected:'satisfy',scenario:'gap',gap:5,request:'Move the battery to leave 5 mm separation from the ESP32-C3 module. Keep the housing, carrier board, ESP32-C3 module and button unchanged.'},
 {id:'port-access-8',name:'Bracket blocks charging access',mode:'seeded-repair',expected:'satisfy',scenario:'access',gap:8,request:'Move the bracket so the charging port has 8 mm of clear space in front along its local +Z direction. Keep the charging port, housing and ESP32-C3 module unchanged.'},
 {id:'port-access-12',name:'Longer charging-access corridor',mode:'seeded-repair',expected:'satisfy',scenario:'access',gap:12,request:'Move the bracket so the charging port has 12 mm of clear space in front along its local +Z direction. Keep the charging port, housing and ESP32-C3 module unchanged.'},
 {id:'source-height-impossible',name:'Impossible source-geometry resize',mode:'negative-control',expected:'blocked',scenario:'source-limit',request:'Make the original sourced ESP32-C3 module have a maximum height of 1 mm. Preserve its original source geometry and keep the housing unchanged.'},
 {id:'unmeasurable-interior',name:'Unsupported enclosure evidence',mode:'negative-control',expected:'blocked',scenario:'unsupported',gap:1,request:'Place the ESP32-C3 module inside the housing with 1 mm clearance. Keep the incomplete housing unchanged.'},
];
function part(id:string,name:string,position:Vec3,size:Vec3,color='#a0a7a0'):DevicePart{return {id,name,category:'Evaluation study',description:'Authored evaluation geometry; not manufacturer CAD or an AI-generated customer result.',role:'Explicit controlled design-study component.',position,rotation:[0,0,0],size,explode:[0,25,0],color,solids:[{kind:'box',position:[0,0,0],size}],specs:{'Hardware status':'Illustrative evaluation envelope; operation unverified'},connections:[]};}
export function evaluationAssembly(task:DesignTask):DeviceDocument{
 const housing=part('housing','Housing',[0,0,0],[70,26,50],'#e6c49c');
 housing.solids=[{kind:'box',position:[0,-1,0],size:[70,2,50]},...[-1,1].map(n=>({kind:'box' as const,position:[n*34,12,0] as Vec3,size:[2,24,50] as Vec3})),...[-1,1].map(n=>({kind:'box' as const,position:[0,12,n*24] as Vec3,size:[66,24,2] as Vec3}))];housing.specs={'Geometry basis':'Explicit five-surface evaluation enclosure','Source status':'Authored fixture, not manufacturer CAD'};
 if(task.scenario==='unsupported')housing.solids.pop();
 const radio=hydrateCatalogPart(task.sourceId??'esp32-c3-mini-1',{id:'radio',name:task.sourceId?'ESP32-WROOM module':'ESP32-C3 module',position:task.scenario==='outside'?[68,7,0]:task.scenario==='floor'?[0,.3,0]:[0,7,0]});
 const battery=part('battery','Illustrative battery',task.scenario==='gap'?[0,7,0]:[19,12,-5],[18,8,26],'#9eb3ad');
 const doc:DeviceDocument={version:1,id:`design-evaluation-${task.id}`,name:'Desk controller · controlled design study',description:'A sourced radio module and authored enclosure, battery, board and interface envelopes for repeatable software evaluation.',provenance:'Controlled evaluation fixture. Only the radio is manufacturer-sourced CAD. Other components are authored geometric studies. This fixture is never served as a generation fallback.',source:'curated',parts:[housing,part('carrier','Carrier board',[0,3,0],[54,1.6,32],'#4f756b'),radio,battery,part('button','Button',[22,12,24],[8,8,6],'#dc9d64'),part('charging-port','Charging port',[0,12,24],[12,7,6],'#7d878c'),part('bracket','Bracket',task.scenario==='access'?[0,12,32]:[22,12,32],[14,10,4],'#9ca4a4')],steps:[{title:'Inspect the design study',description:'These controlled fixtures test software constraints. They are not physical-build instructions.',partIds:['housing','carrier','radio','battery','button','charging-port','bracket']}],designBrief:task.request};
 return validateDeviceDocument(doc);
}
export type OracleResult={passed:boolean;checks:{name:string;passed:boolean;detail:string}[]};
/** Independent fixed-task acceptance. Does not read model findings, planned goals or
 * computed design-check results. The enclosure's authored interior is known a priori. */
export function evaluateTaskOutcome(task:DesignTask,baseline:DeviceDocument,candidate:DeviceDocument,oracleVersion=2):OracleResult{
 const checks:OracleResult['checks']=[],parts=new Map(candidate.parts.map(p=>[p.id,p])),original=new Map(baseline.parts.map(p=>[p.id,p]));
 const record=(name:string,passed:boolean,detail:string)=>checks.push({name,passed,detail});
 const envelope=(p:DevicePart)=>localPartBounds(p).applyMatrix4(new Matrix4().compose(new Vector3(...p.position),new Quaternion().setFromEuler(new Euler(...p.rotation.map(n=>n*Math.PI/180) as Vec3)),new Vector3(1,1,1)));
 const shape=(p:DevicePart)=>JSON.stringify({size:p.size,solids:p.solids.map(({color:_c,metalness:_m,roughness:_r,...s})=>s),mesh:p.mesh,catalogRef:p.catalogRef});
 const frozen=(id:string,placement=true)=>{const a=original.get(id),b=parts.get(id);return !!a&&!!b&&shape(a)===shape(b)&&(!placement||JSON.stringify([a.position,a.rotation])===JSON.stringify([b.position,b.rotation]));};
 record('Original component identities',baseline.parts.every(p=>parts.has(p.id)),`${baseline.parts.length} original IDs must remain.`);
 const movable=task.scenario==='outside'||task.scenario==='floor'?['radio']:task.scenario==='height'||task.scenario==='gap'?['battery']:task.scenario==='access'?['bracket']:[];
 record('Unrelated geometry and placement',baseline.parts.filter(p=>!movable.includes(p.id)).every(p=>frozen(p.id)),'Every component outside the requested edit retains its shape and pose.');
 record('Source CAD unchanged',frozen('radio',!['outside','floor'].includes(task.scenario)),'Radio source mesh and dimensions must remain canonical; only the requested placement may change.');
 record('Housing unchanged',frozen('housing'),'The authored floor/wall geometry and pose must remain.');
 if(oracleVersion>=2&&task.scenario!=='unsupported'){
  const fits=(p:DevicePart)=>{const b=envelope(p);return b.min.x>=-33-1e-5&&b.max.x<=33+1e-5&&b.min.y>=-1e-5&&b.max.y<=24+1e-5&&b.min.z>=-23-1e-5&&b.max.z<=23+1e-5;};
  const originallyInside=baseline.parts.filter(p=>p.id!=='housing'&&fits(p));record('Originally contained components remain inside',originallyInside.every(p=>parts.has(p.id)&&fits(parts.get(p.id)!)),'Known original enclosure placements cannot be sacrificed to fix another constraint.');
 }
 if(task.scenario==='outside'||task.scenario==='floor'){
  const radio=parts.get('radio');let minimum=-Infinity;if(radio&&(oracleVersion>=2||radio.rotation.every(n=>Math.abs(n)<1e-7))){const b=oracleVersion>=2?envelope(radio):localPartBounds(radio).translate(new Vector3(...radio.position));minimum=Math.min(b.min.x+33,33-b.max.x,b.min.y,24-b.max.y,b.min.z+23,23-b.max.z);}
  record('Known enclosure margin',minimum>=task.gap!-1e-5,`Known fixture inner faces X±33, Z±23, Y0..24; margin ${minimum} mm, required ${task.gap} mm.`);record('Protected carrier and button',frozen('carrier')&&frozen('button'),'Unrelated board and button remain unchanged.');
 }else if(task.scenario==='height'){
  const battery=parts.get('battery'),height=battery?localPartBounds(battery).getSize(new Vector3()).y:Infinity;record('Actual battery geometry',height<=task.gap!+1e-5,`Actual solid height ${height} mm; maximum ${task.gap} mm.`);
 }else if(task.scenario==='gap'){
  const a=parts.get('battery'),b=parts.get('radio');let distance=-Infinity;if(a&&b&&(oracleVersion>=2||[...a.rotation,...b.rotation].every(n=>Math.abs(n)<1e-7))){const aa=oracleVersion>=2?envelope(a):localPartBounds(a).translate(new Vector3(...a.position)),bb=oracleVersion>=2?envelope(b):localPartBounds(b).translate(new Vector3(...b.position));const gaps=[Math.max(0,aa.min.x-bb.max.x,bb.min.x-aa.max.x),Math.max(0,aa.min.y-bb.max.y,bb.min.y-aa.max.y),Math.max(0,aa.min.z-bb.max.z,bb.min.z-aa.max.z)];distance=Math.hypot(...gaps);}
  record('Requested envelope separation',distance>=task.gap!-1e-5,`Independent fixture envelope distance ${distance} mm; minimum ${task.gap} mm.`);record('Moved battery shape retained',frozen('battery',false),'A move request must not shrink or replace the illustrative battery.');record('Protected carrier and button',frozen('carrier')&&frozen('button'),'Board and button retain shape and placement.');
 }else if(task.scenario==='access'){
  const bracket=parts.get('bracket');let clear=false;if(bracket&&(oracleVersion>=2||bracket.rotation.every(n=>Math.abs(n)<1e-7))){const b=oracleVersion>=2?envelope(bracket):localPartBounds(bracket).translate(new Vector3(...bracket.position));clear=b.max.x<=-6||b.min.x>=6||b.max.y<=8.5||b.min.y>=15.5||b.max.z<=27||b.min.z>=27+task.gap!;}
  record('Known charging corridor',clear,`Known port face X±6, Y8.5..15.5, Z27; required +Z path ${task.gap} mm.`);record('Port unchanged',frozen('charging-port'),'The connector cannot be moved to bypass the obstruction.');record('Bracket shape retained',frozen('bracket',false),'The requested bracket move must preserve its shape.');
 }else if(task.scenario==='source-limit'){
  const source=parts.get('radio'),height=source?localPartBounds(source).getSize(new Vector3()).y:Infinity;record('Impossible requirement remains unmet',height<=1,'This is an intentionally impossible positive requirement; the correct software behavior is a blocked draft without source corruption.');
 }else record('Interior cannot be established',false,'The authored enclosure is missing a wall. A bounding-box pass is unacceptable; correct behavior is an explicit unverified draft.');
 return {passed:checks.every(c=>c.passed),checks};
}
