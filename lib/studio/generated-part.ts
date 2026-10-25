import {Box3,Euler,Matrix4,Vector3} from 'three';
import {expandSolids} from './geometry-codec';
import {devicePartSchema} from './validation';
import type {DevicePart,Solid} from './types';
import {expandCatalogWire} from './catalog';

/** Derive redundant wire fields from the actual geometry. Existing explicit fields stay exact. */
function envelope(solids:Solid[]):[number,number,number]{
  const bounds=new Box3();
  for(const s of solids){
    const size=s.kind==='cylinder'?[Math.max(s.size[0],s.size[2]),s.size[1],Math.max(s.size[0],s.size[2])]:s.kind==='torus'?[2*(s.size[0]+s.size[1]),2*(s.size[0]+s.size[1]),2*s.size[1]]:s.size;
    const half=new Vector3(...size).multiplyScalar(.5),rotation=s.rotation||[0,0,0];
    const transform=new Matrix4().makeRotationFromEuler(new Euler(...rotation.map(v=>v*Math.PI/180) as [number,number,number],'XYZ')).setPosition(...s.position);
    bounds.union(new Box3(half.clone().negate(),half).applyMatrix4(transform));
  }
  const v=bounds.getSize(new Vector3());return [v.x,v.y,v.z].map(n=>Math.max(.001,Math.round(n*1000)/1000)) as [number,number,number];
}
export function expandGeneratedPart(value:unknown,previous:ReadonlyMap<string,DevicePart>=new Map()){
  if(!value||typeof value!=='object')throw new Error('A generated part must be an object.');
  const p=value as Record<string,unknown>;
  if(Object.hasOwn(p,'geometryFrom')){
    if(typeof p.geometryFrom!=='string'||p.geometryFrom===p.id)throw new Error('geometryFrom must identify an earlier component.');
    if(['solids','mesh','assetNode','catalogRef'].some(key=>Object.hasOwn(p,key)))throw new Error('Use geometryFrom alone, without replacement geometry or catalog references.');
    const source=previous.get(p.geometryFrom);
    if(!source||!source.solids.length||source.catalogRef||source.mesh||source.assetNode)throw new Error('geometryFrom requires an earlier valid procedural component; use catalogRef for sourced parts.');
    // Material details and bounds are exact. Each component receives independent
    // geometry arrays so later edits cannot mutate its siblings.
    return devicePartSchema.parse({...p,solids:structuredClone(source.solids),size:p.size??[...source.size],rotation:p.rotation??[0,0,0],role:p.role??p.description,specs:p.specs??{},connections:p.connections??[]});
  }
  if('catalogRef' in value)return devicePartSchema.parse(expandCatalogWire(value));
  const solids=expandSolids(p.solids);
  return devicePartSchema.parse({...p,solids,rotation:p.rotation??[0,0,0],size:p.size??envelope(solids),role:p.role??p.description,specs:p.specs??{},connections:p.connections??[]});
}
