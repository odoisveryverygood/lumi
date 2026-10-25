import {readFileSync} from 'node:fs';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {expandGeneratedPart} from '../lib/studio/generated-part';
import {appendGenerationParts,completedParts,createGenerationProgress} from '../lib/studio/generation-progress';
import {generationRepairContext,preserveGeneratedGeometry,applyGenerationRepair} from '../lib/studio/generation-repair';
import {generateCustomDevice} from '../lib/studio/device-generation';
import {generateText} from '../lib/ai';
import type {DevicePart} from '../lib/studio/types';
import {createGeometryRenderer} from '../lib/studio/review-renderer';
import {POST} from '../app/api/device/route';
import {readDeviceResponse} from '../lib/studio/response';
import type {DeviceDocument} from '../lib/studio/types';
vi.mock('../lib/ai',async original=>({...await original<typeof import('../lib/ai')>(),generateText:vi.fn()}));
const generate=vi.mocked(generateText);
const real=JSON.parse(readFileSync('docs/sponsor-sprint/2026-10-25-generation-reliability/robot-dog-document.json','utf8'));
// Encode only byte-identical local geometry from a real retained object. No
// silhouette, component, transform, graph, material or mechanism is simplified.
function compactDog(){
 const doc=structuredClone(real),seen=new Map<string,string>();
 for(const part of doc.parts){
  const key=JSON.stringify([part.solids,part.size]),source=seen.get(key);
  if(source){part.geometryFrom=source;delete part.solids;}else seen.set(key,part.id);
 }
 return {document:doc,answer:'Explore this conceptual robot dog.',actions:[]};
}
beforeEach(()=>generate.mockReset());

describe('lossless selectable component instances',()=>{
 it('preserves the real robot dog: all 18 parts, 234 solids, transforms, finishes and mechanisms',async()=>{
  const compact=compactDog(),literal={...compact,document:real};
  generate.mockResolvedValueOnce({text:JSON.stringify(literal),model:'gemini-4-argon'});
  const before=await generateCustomDevice('a robot dog',new AbortController().signal);
  generate.mockResolvedValueOnce({text:JSON.stringify(compact),model:'gemini-4-argon'});
  const after=await generateCustomDevice('a robot dog',new AbortController().signal);
  expect(after.document).toEqual(before.document);
  expect(after.generation).toMatchObject({geometryReferences:5,expandedSolids:234,modelCalls:1});
  expect(after.generation!.wireCharacters).toBeLessThan(before.generation!.wireCharacters*.9);
  expect(JSON.stringify(after.document)).not.toContain('geometryFrom');
  const originalRenderer=createGeometryRenderer(before.document!),sharedRenderer=createGeometryRenderer(after.document!);
  try{for(const view of ['assembled','top','exploded'] as const){
   const originalImage=originalRenderer.render({width:180,height:140,view}),sharedImage=sharedRenderer.render({width:180,height:140,view});
   expect(sharedImage.triangles).toBe(originalImage.triangles);
   expect(Buffer.from(sharedImage.rgba).equals(Buffer.from(originalImage.rgba))).toBe(true);
   expect(sharedImage.visiblePartIds).toEqual(originalImage.visiblePartIds);
  }}finally{originalRenderer.dispose();sharedRenderer.dispose();}
 });
 it.each([1,37,301])('streams the same complete geometry with %s-character chunks',chunk=>{
  const text=JSON.stringify(compactDog()),reader=createGenerationProgress();let result;
  for(let end=chunk;end<text.length;end+=chunk)result=reader.read(text.slice(0,end));
  result=reader.read(text);
  expect(result.partsComplete).toBe(true);expect(result.parts).toEqual(completedParts(JSON.stringify({document:real})));
 });
 it('creates independently mutable solids and preserves each instance placement',()=>{
  const parts=completedParts(JSON.stringify(compactDog())),source=parts.find(p=>p.id==='shank-fl')!,copy=parts.find(p=>p.id==='shank-fr')!;
  expect(copy.solids).toEqual(source.solids);expect(copy.position).not.toEqual(source.position);
  const x=source.solids[0].position[0];copy.solids[0].position[0]+=100;
  expect(source.solids[0].position[0]).toBe(x);
 });
 it('rejects missing, forward, self and mixed geometry references without invented placeholders',()=>{
  const prototype=real.parts[0],sources=new Map<string,DevicePart>([[prototype.id,prototype]]);
  for(const geometryFrom of ['missing','copy',42])expect(()=>expandGeneratedPart({...prototype,id:'copy',solids:undefined,geometryFrom},sources)).toThrow();
  const {solids,...metadata}=prototype;
  for(const extra of [{geometryFrom:'missing'},{geometryFrom:'copy'},{geometryFrom:42},{geometryFrom:prototype.id,solids}])expect(()=>expandGeneratedPart({...metadata,id:'copy',...extra},sources)).toThrow();
  expect(completedParts(JSON.stringify({parts:[{...metadata,id:'forward',geometryFrom:prototype.id},prototype]})).map(p=>p.id)).toEqual([prototype.id]);
 });
 it('keeps the 2000-solid assembly bound even when references multiply a tiny wire payload',()=>{
  const prototype={...real.parts[0],solids:[['repeat',128,0,0,0,['box',0,0,0,1,1,1]]]};
  const {solids,...metadata}=prototype;
  const copies=Array.from({length:20},(_,i)=>({...metadata,id:`copy-${i}`,geometryFrom:prototype.id}));
  const parts=completedParts(JSON.stringify({parts:[prototype,...copies]}));
  expect(parts.reduce((sum,p)=>sum+p.solids.length,0)).toBeLessThanOrEqual(2000);
 });
 it('streams expanded, editable instances through the real API response reader and transient preview',async()=>{
  const text=JSON.stringify(compactDog());
  generate.mockImplementationOnce(async(_system,_user,options)=>{options?.onPartial?.(text);return {text,model:'gemini-4-argon'};});
  const response=await POST(new Request('http://127.0.0.1:3004/api/device',{method:'POST',headers:{'content-type':'application/json',accept:'application/x-ndjson'},body:JSON.stringify({action:'generate',prompt:'a robot dog'})}));
  let preview:DeviceDocument|null=null;
  const result=await readDeviceResponse(response,event=>{if(event.newParts)preview=appendGenerationParts(preview,event.newParts);});
  expect((preview as DeviceDocument|null)?.parts).toHaveLength(18);
  expect(result.document?.parts).toHaveLength(18);expect(result.document?.mechanisms).toEqual(real.mechanisms);
  expect(result.generation).toMatchObject({geometryReferences:5,expandedSolids:234,modelCalls:1});
  expect(JSON.stringify(result)).not.toContain('geometryFrom');
 });
});

describe('small, geometry-preserving repair requests',()=>{
 it('omits unrelated geometry while retaining indexes and the actual broken part',()=>{
  const original={document:real},issues=[{path:['document','parts',3,'solids'],message:'Invalid solid'}];
  const context=generationRepairContext(original,issues) as typeof original;
  expect(context.document.parts[3]).toEqual(real.parts[3]);
  expect(context.document.parts[0].solids).toBeUndefined();
  expect(context.document.parts.map((p:DevicePart)=>p.id)).toEqual(real.parts.map((p:DevicePart)=>p.id));
  expect(JSON.stringify(context).length).toBeLessThan(JSON.stringify(original).length*.65);
  expect(original.document.parts[0].solids).toBeDefined();
 });
 it('rejects hidden simplification or moving a valid component in a graph repair',()=>{
  const original=compactDog();
  for(const patch of [{path:['document','parts',0,'solids'],value:[['box',0,0,0,1,1,1]]},{path:['document','parts',0,'position'],value:[0,0,0]}]){
   const next=applyGenerationRepair(original,{repairs:[patch]});
   expect(()=>preserveGeneratedGeometry(original,next)).toThrow('valid geometry');
  }
 });
 it('allows fixing genuinely invalid geometry without changing other components',()=>{
  const original=compactDog();original.document.parts[0].solids=[['box',0,0,0,-1,2,3]];
  const next=applyGenerationRepair(original,{repairs:[{path:['document','parts',0,'solids'],value:real.parts[0].solids}]});
  expect(()=>preserveGeneratedGeometry(original,next)).not.toThrow();
 });
 it('fails closed when the model tries to rewrite good geometry while repairing a bad reference',async()=>{
  const original=compactDog();original.document.steps[0].partIds=['missing'];
  generate.mockResolvedValueOnce({text:JSON.stringify(original),model:'gemini-4-argon'}).mockResolvedValueOnce({text:JSON.stringify({repairs:[{path:['document','steps',0,'partIds'],value:[real.parts[0].id]},{path:['document','parts',0,'solids'],value:[['box',0,0,0,1,1,1]]}]}),model:'gemini-4-argon'});
  await expect(generateCustomDevice('a robot dog',new AbortController().signal,undefined,{maxAttempts:2})).rejects.toThrow('unresolved validation');
 });
});
