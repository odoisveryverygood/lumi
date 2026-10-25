import { describe,expect,it } from 'vitest';
import { compactSolid,expandSolid,expandGeometry } from '../lib/studio/geometry-codec';
import { mechanicalKeyboard } from '../lib/studio/keyboard';
import { completedPartNames } from '../lib/studio/generation-progress';

describe('lossless custom geometry transport',()=>{
 it('preserves coordinates, rotation and PBR materials, including zero and omitted values',()=>{
  for(const value of [{kind:'box' as const,position:[1,2,3] as [number,number,number],size:[8,4,3] as [number,number,number]},...mechanicalKeyboard.parts.flatMap(p=>p.solids)]){
   const decoded=expandSolid(compactSolid(value));expect(decoded.position).toEqual(value.position);expect(decoded.size).toEqual(value.size);expect(decoded.rotation||[0,0,0]).toEqual(value.rotation||[0,0,0]);expect(decoded.kind).toBe(value.kind);expect(decoded.color).toBe(value.color);expect(decoded.metalness).toBe(value.metalness);expect(decoded.roughness).toBe(value.roughness);
  }
 });
 it('round-trips every independently editable part without replacing it with a preset',()=>{
  const encoded={...mechanicalKeyboard,parts:mechanicalKeyboard.parts.map(p=>({...p,solids:p.solids.map(compactSolid)}))};
  const decoded=expandGeometry(encoded) as unknown as typeof mechanicalKeyboard;expect(decoded.parts.map(p=>p.id)).toEqual(mechanicalKeyboard.parts.map(p=>p.id));for(const [i,p]of decoded.parts.entries())expect(p.solids.length).toBe(mechanicalKeyboard.parts[i].solids.length);
  expect(JSON.stringify(encoded).length).toBeLessThan(JSON.stringify(mechanicalKeyboard).length);
 });
 it.each([['box',0,0,0,-1,2,3],['unknown',0,0,0,1,2,3],['box',0,0,0,1,2,3,0],['box',0,0,0,1,2,3,0,0,0,'javascript:evil'],['box',0,0,0,1,2,3,0,0,0,null,5]])('rejects malformed or invalid compact geometry %j',(...value)=>expect(()=>expandSolid(value)).toThrow());
 it('reports only real validated compact parts as streaming progress',()=>{
  const part=mechanicalKeyboard.parts[0];const encoded={...part,solids:part.solids.map(compactSolid)};expect(completedPartNames(JSON.stringify({document:{parts:[encoded]}}))).toEqual([part.name]);
 });
});

import { appendGenerationParts } from '../lib/studio/generation-progress';
describe('transient live assembly',()=>{
 it('preserves real generated solids while keeping incomplete references and edits outside the saved assembly',()=>{
  const original=structuredClone(mechanicalKeyboard.parts[0]),before=structuredClone(original);const preview=appendGenerationParts(null,[original]);expect(preview.parts[0].solids).toEqual(original.solids);expect(preview.parts[0].position).toEqual(original.position);expect(preview.parts[0].connections).toEqual([]);expect(preview.parts[0].assemblyId).toBeUndefined();expect(preview.relationships).toEqual([]);expect(original).toEqual(before);
 });
 it('merges newly completed parts without duplicating IDs or mutating earlier previews',()=>{
  const a=structuredClone(mechanicalKeyboard.parts[0]),b=structuredClone(mechanicalKeyboard.parts[1]);const first=appendGenerationParts(null,[a,a]);expect(first.parts).toHaveLength(1);const second=appendGenerationParts(first,[a,b,b]);expect(first.parts).toHaveLength(1);expect(second.parts).toHaveLength(2);
 });
 it('does not accept invented imported meshes or exceed the scene budget',()=>{
  const a=structuredClone(mechanicalKeyboard.parts[0]);expect(appendGenerationParts(null,[{...a,assetNode:'fake-source'}]).parts).toHaveLength(0);expect(()=>appendGenerationParts(null,Array.from({length:61},(_,i)=>({...a,id:`p-${i}`})))).toThrow('generation budget');
 });
});
