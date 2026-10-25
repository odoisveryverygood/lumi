import { solidSchema } from './validation';
import type { Solid } from './types';

/** Lossless wire notation for custom geometry, not a library of preset shapes. */
export function expandSolid(value: unknown): Solid {
  if (!Array.isArray(value)) return solidSchema.parse(value);
  if (value.length !== 7 && (value.length < 10 || value.length > 13)) throw new Error('A compact solid needs 7 or 10–13 entries.');
  const [kind,x,y,z,width,height,depth,rx,ry,rz,color,metalness,roughness]=value;
  return solidSchema.parse({kind,position:[x,y,z],size:[width,height,depth],...(value.length>=10?{rotation:[rx,ry,rz]}:{}),...(color!=null?{color}:{}),...(metalness!=null?{metalness}:{}),...(roughness!=null?{roughness}:{})});
}

export function compactSolid(solid: Solid): unknown[] {
  const value: unknown[]=[solid.kind,...solid.position,...solid.size];
  if(solid.rotation||solid.color!==undefined||solid.metalness!==undefined||solid.roughness!==undefined)value.push(...(solid.rotation||[0,0,0]));
  if(solid.color!==undefined||solid.metalness!==undefined||solid.roughness!==undefined)value.push(solid.color??null);
  if(solid.metalness!==undefined||solid.roughness!==undefined)value.push(solid.metalness??null);
  if(solid.roughness!==undefined)value.push(solid.roughness);
  return value;
}

export function expandGeometry<T>(value: T): T {
  if(!value||typeof value!=='object')return value;
  const raw=value as Record<string,unknown>;
  if(!Array.isArray(raw.parts))return value;
  return {...raw,parts:raw.parts.map(part=>{
    if(!part||typeof part!=='object')return part;
    const p=part as Record<string,unknown>;
    return Array.isArray(p.solids)?{...p,solids:expandSolids(p.solids)}:p;
  })} as T;
}

/** A repeat is a data recipe, never executable code or a preset object. */
export function expandSolids(values:unknown):Solid[]{
  if(!Array.isArray(values))throw new Error('Solids must be an array.');
  const output:Solid[]=[];
  function append(value:unknown,offset:[number,number,number],depth:number){
    if(depth>4)throw new Error('Geometry repeat nesting exceeds four levels.');
    if(Array.isArray(value)&&value[0]==='repeat'){
      const [,count,dx,dy,dz,solid]=value;
      if(value.length!==6||!Number.isInteger(count)||count<1||count>128||![dx,dy,dz].every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=5000))throw new Error('A repeat needs count 1..128, three finite offsets, and one solid.');
      for(let i=0;i<count;i++)append(solid,[offset[0]+dx*i,offset[1]+dy*i,offset[2]+dz*i],depth+1);
      return;
    }
    if(output.length>=2000)throw new Error('Expanded geometry exceeds 2000 solids.');
    const solid=expandSolid(value);
    output.push(solidSchema.parse({...solid,position:solid.position.map((v,i)=>v+offset[i])}));
  }
  for(const value of values)append(value,[0,0,0],0);
  return output;
}
