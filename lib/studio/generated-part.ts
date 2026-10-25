import {Box3,Euler,Matrix4,Vector3} from 'three';
import {expandSolids} from './geometry-codec';
import {devicePartSchema} from './validation';
import type {Solid} from './types';
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
export function expandGeneratedPart(value:unknown){
  if(!value||typeof value!=='object')throw new Error('A generated part must be an object.');
  if('catalogRef' in value)return devicePartSchema.parse(expandCatalogWire(value));
  const p=value as Record<string,unknown>,solids=expandSolids(p.solids);
  return devicePartSchema.parse({...p,solids,rotation:p.rotation??[0,0,0],size:p.size??envelope(solids),role:p.role??p.description,specs:p.specs??{},connections:p.connections??[]});
}
