import { PART_MAP } from './library';
import type { Connection, PartInstance, Project, Vec3 } from './types';

type Endpoint=Connection['from'];
type PartPatch=Partial<Pick<PartInstance,'label'|'role'|'assembledPosition'|'rotation'|'explodeDirection'|'explodeDistance'|'layer'>>;
type ConnectionPatch=Partial<Pick<Connection,'from'|'to'|'purpose'|'wireColor'|'kind'|'signalDirection'>>;
const KINDS:Connection['kind'][]=['power','ground','signal','data'];
const COLORS:Connection['wireColor'][]=['red','black','yellow','blue','green','white','orange'];
const DIRECTIONS:Connection['signalDirection'][]=['from-to','to-from','both'];

function requirePart(project:Project,id:string):PartInstance {
  const matches=project.parts.filter(part=>part.id===id);
  if(!matches.length)throw new Error(`Part ${id} does not exist in this project.`);
  if(matches.length!==1)throw new Error(`Part id ${id} is not unique in this project.`);
  return matches[0];
}
function requireConnection(project:Project,id:string):Connection {
  const matches=project.connections.filter(connection=>connection.id===id);
  if(!matches.length)throw new Error(`Connection ${id} does not exist in this project.`);
  if(matches.length!==1)throw new Error(`Connection id ${id} is not unique in this project.`);
  return matches[0];
}
function requireEndpoint(project:Project,endpoint:Endpoint):Endpoint {
  if(!endpoint||typeof endpoint.partId!=='string'||typeof endpoint.pin!=='string')throw new Error('Choose a component and an exact pin name for each endpoint.');
  const part=requirePart(project,endpoint.partId);
  const library=PART_MAP[part.libraryId];
  if(!library)throw new Error(`Part ${part.id} uses an unknown component library entry.`);
  if(!library.pins.some(pin=>pin.name===endpoint.pin))throw new Error(`Pin ${endpoint.pin} does not exist on ${library.name}.`);
  return {partId:endpoint.partId,pin:endpoint.pin};
}
function requireVector(value:Vec3,name:string,bounded=false):Vec3 {
  if(!Array.isArray(value)||value.length!==3||![0,1,2].every(i=>typeof value[i]==='number'&&Number.isFinite(value[i])))throw new Error(`${name} must contain three finite numbers.`);
  if(bounded&&value.some(n=>Math.abs(n)>1000))throw new Error(`${name} must stay within −1000 to 1000 mm on every axis.`);
  return [value[0],value[1],value[2]];
}
function requireText(value:string,name:string,max:number):string {
  if(typeof value!=='string')throw new Error(`${name} must be text.`);
  const text=value.trim();
  if(!text||text.length>max)throw new Error(`${name} must contain 1 to ${max} characters.`);
  return text;
}
function requireEnum<T extends string>(value:T,choices:readonly T[],name:string):T {
  if(!choices.includes(value))throw new Error(`${name} is not supported.`);
  return value;
}
function equalEndpoint(a:Endpoint,b:Endpoint){return a.partId===b.partId&&a.pin===b.pin;}
function requireUniqueWire(project:Project,from:Endpoint,to:Endpoint,exceptId?:string) {
  if(equalEndpoint(from,to))throw new Error('A connection must join two different pin endpoints.');
  if(project.connections.some(connection=>connection.id!==exceptId&&(equalEndpoint(connection.from,from)&&equalEndpoint(connection.to,to)||equalEndpoint(connection.from,to)&&equalEndpoint(connection.to,from))))throw new Error('These two pins already have a connection.');
}

/** Returns independent project data; draft edits are not blocked by whole-circuit validation. */
export function updatePart(project:Project,id:string,patch:PartPatch):Project {
  requirePart(project,id);
  const next=structuredClone(project),part=next.parts.find(item=>item.id===id)!;
  if(patch.label!==undefined)part.label=requireText(patch.label,'Part label',40);
  if(patch.role!==undefined)part.role=requireText(patch.role,'Part role',2000);
  if(patch.assembledPosition!==undefined)part.assembledPosition=requireVector(patch.assembledPosition,'Part position',true);
  if(patch.rotation!==undefined)part.rotation=requireVector(patch.rotation,'Part rotation').map(n=>((n%360+540)%360)-180) as Vec3;
  if(patch.explodeDirection!==undefined) {
    const direction=requireVector(patch.explodeDirection,'Explode direction');
    const scale=Math.max(...direction.map(Math.abs));
    const scaled=scale?direction.map(n=>n/scale):direction;
    const length=Math.hypot(...scaled);
    part.explodeDirection=(length?scaled.map(n=>n/length):[0,0,0]) as Vec3;
  }
  if(patch.explodeDistance!==undefined) {
    if(typeof patch.explodeDistance!=='number'||!Number.isFinite(patch.explodeDistance)||patch.explodeDistance<0||patch.explodeDistance>2000)throw new Error('Explode distance must be a finite number from 0 to 2000 mm.');
    part.explodeDistance=patch.explodeDistance;
  }
  if(patch.layer!==undefined) {
    if(!Number.isInteger(patch.layer)||patch.layer<0||patch.layer>20)throw new Error('Explode layer must be a whole number from 0 to 20.');
    part.layer=patch.layer;
  }
  return next;
}

export function updateConnection(project:Project,id:string,patch:ConnectionPatch):Project {
  const existing=requireConnection(project,id);
  const from=requireEndpoint(project,patch.from??existing.from),to=requireEndpoint(project,patch.to??existing.to);
  requireUniqueWire(project,from,to,id);
  const next=structuredClone(project),connection=next.connections.find(item=>item.id===id)!;
  connection.from=from;connection.to=to;
  if(patch.purpose!==undefined)connection.purpose=requireText(patch.purpose,'Connection purpose',2000);
  if(patch.kind!==undefined)connection.kind=requireEnum(patch.kind,KINDS,'Connection kind');
  if(patch.wireColor!==undefined)connection.wireColor=requireEnum(patch.wireColor,COLORS,'Wire colour');
  if(patch.signalDirection!==undefined)connection.signalDirection=requireEnum(patch.signalDirection,DIRECTIONS,'Signal direction');
  return next;
}

function inferredKind(project:Project,from:Endpoint,to:Endpoint):Connection['kind'] {
  const pins=[from,to].map(endpoint=>PART_MAP[requirePart(project,endpoint.partId).libraryId].pins.find(pin=>pin.name===endpoint.pin)!);
  if(pins.some(pin=>pin.type==='ground'))return 'ground';
  if(pins.some(pin=>pin.type==='power'))return 'power';
  if(pins.every(pin=>pin.type==='i2c-sda')||pins.every(pin=>pin.type==='i2c-scl'))return 'data';
  return 'signal';
}
function touchesSource(project:Project,connection:Connection) {
  return [connection.from,connection.to].some(endpoint=>PART_MAP[project.parts.find(part=>part.id===endpoint.partId)?.libraryId??'']?.category==='power');
}
/** Place new wire references in an existing relevant step, without inventing physical instructions. */
function assignWireToStep(project:Project,connection:Connection) {
  const steps=project.buildSteps;
  if(!steps.length)return;
  const placement=Math.max(...[connection.from,connection.to].map(endpoint=>{
    const index=steps.findIndex(step=>step.partIds.includes(endpoint.partId));
    return index<0?0:index;
  }));
  const eligible=steps.map((step,i)=>({step,i})).filter(({step,i})=>i>=placement&&i<steps.length-1&&!step.partIds.some(id=>['enclosure-top','screw-m3'].includes(project.parts.find(p=>p.id===id)?.libraryId??'')));
  const isSource=touchesSource(project,connection);
  const reference=(id:string)=>project.connections.find(wire=>wire.id===id);
  const matching=eligible.find(({step})=>step.connectionIds.some(id=>{
    const wire=reference(id);return !!wire&&touchesSource(project,wire)===isSource&&(isSource||wire.kind===connection.kind);
  }));
  const latestSource=eligible.findLast(({step})=>step.connectionIds.some(id=>{const wire=reference(id);return !!wire&&touchesSource(project,wire);}));
  const fallback=isSource?latestSource??eligible.at(-1):eligible.find(({step})=>!step.connectionIds.some(id=>{const wire=reference(id);return !!wire&&touchesSource(project,wire);}));
  const destination=matching??fallback;
  if(destination)destination.step.connectionIds.push(connection.id);
}

export function addConnection(project:Project,fromInput:Endpoint,toInput:Endpoint,kind?:Connection['kind'],wireColor?:Connection['wireColor']):Project {
  const from=requireEndpoint(project,fromInput),to=requireEndpoint(project,toInput);
  requireUniqueWire(project,from,to);
  const next=structuredClone(project),chosenKind=kind===undefined?inferredKind(project,from,to):requireEnum(kind,KINDS,'Connection kind');
  const color=wireColor===undefined?chosenKind==='ground'?'black':chosenKind==='power'?'red':chosenKind==='data'?'blue':'yellow':requireEnum(wireColor,COLORS,'Wire colour');
  const used=new Set(project.connections.map(connection=>connection.id));
  let index=1;while(used.has(`wire-${index}`))index++;
  const source=requirePart(project,from.partId),target=requirePart(project,to.partId);
  const connection:Connection={id:`wire-${index}`,from,to,kind:chosenKind,wireColor:color,purpose:`Connect ${source.label||source.id} ${from.pin} to ${target.label||target.id} ${to.pin}.`,signalDirection:chosenKind==='data'?'both':'from-to'};
  next.connections.push(connection);
  assignWireToStep(next,connection);
  return next;
}

export function removeConnection(project:Project,id:string):Project {
  requireConnection(project,id);
  const next=structuredClone(project);
  next.connections=next.connections.filter(connection=>connection.id!==id);
  next.buildSteps.forEach(step=>{step.connectionIds=step.connectionIds.filter(connectionId=>connectionId!==id);});
  return next;
}

export function removePart(project:Project,id:string):Project {
  requirePart(project,id);
  if(project.parts.length<=1)throw new Error('The final component cannot be removed from a project.');
  const next=structuredClone(project),removed=new Set(next.connections.filter(connection=>connection.from.partId===id||connection.to.partId===id).map(connection=>connection.id));
  next.parts=next.parts.filter(part=>part.id!==id);
  next.connections=next.connections.filter(connection=>!removed.has(connection.id));
  next.buildSteps.forEach(step=>{
    step.partIds=step.partIds.filter(partId=>partId!==id);
    step.connectionIds=step.connectionIds.filter(connectionId=>!removed.has(connectionId));
  });
  return next;
}

/** Assembled world position in mm, using Three.js Euler XYZ (rotation values are degrees). */
export function getPartPinWorldPosition(project:Project,endpointInput:Endpoint):Vec3 {
  const endpoint=requireEndpoint(project,endpointInput),part=requirePart(project,endpoint.partId);
  const pin=PART_MAP[part.libraryId].pins.find(item=>item.name===endpoint.pin)!;
  const position=requireVector(part.assembledPosition,'Part position',true),rotation=requireVector(part.rotation,'Part rotation');
  const [x,y,z]=pin.position;
  const [rx,ry,rz]=rotation.map(n=>(n%360)*Math.PI/180);
  const cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz);
  // Intrinsic XYZ has the matrix Rx*Ry*Rz; applying it to a vector starts with Z.
  const zx=cz*x-sz*y,zy=sz*x+cz*y;
  const yx=cy*zx+sy*z,yz=-sy*zx+cy*z;
  return [position[0]+yx,position[1]+cx*zy-sx*yz,position[2]+sx*zy+cx*yz];
}
