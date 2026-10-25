import {beforeEach,describe,expect,it,vi} from 'vitest';
import {expandSolids,expandSolid} from '../lib/studio/geometry-codec';
import {expandGeneratedPart} from '../lib/studio/generated-part';
import {applyGenerationRepair} from '../lib/studio/generation-repair';
import {completedParts} from '../lib/studio/generation-progress';
import {generateCustomDevice} from '../lib/studio/device-generation';
import {connectedPartIds} from '../lib/studio/relationships';
import {generateText} from '../lib/ai';
vi.mock('../lib/ai',async original=>({...await original<typeof import('../lib/ai')>(),generateText:vi.fn()}));
const generate=vi.mocked(generateText);
const base={id:'iron-base',name:'Iron frame',category:'Structure',description:'Custom iron rails.',position:[0,100,0],explode:[0,-200,0],color:'#343537',solids:[['repeat',4,400,0,0,['box',-600,0,0,30,40,800,0,0,0,null,.9,.3]]]};
const board={id:'esp32',name:'ESP32 controller',category:'Control',description:'Illustrative ESP32 electronics.',position:[0,140,100],explode:[200,200,0],color:'#284533',solids:[['box',0,0,0,28,2,52],['repeat',2,24,0,0,['repeat',15,0,0,2.54,['box',-12,2,-18,1,2,1]]]]};
const wire=()=>({document:{id:'smart-sofa',name:'Iron-frame smart sofa',description:'Custom smart furniture concept.',parts:[structuredClone(base),structuredClone(board)],relationships:[{id:'mounted',from:'esp32',to:'iron-base',type:'mechanical',description:'Illustrative insulated mounting.'}],steps:[{title:'Explore',description:'Inspect the frame and controller.',partIds:['iron-base','esp32']}]},answer:'A custom smart sofa concept.',actions:[]});
beforeEach(()=>generate.mockReset());

describe('bounded procedural geometry recipes',()=>{
 it('preserves exact repeated positions, rotations and finishes without listing identical solids',()=>{
  const recipe=['repeat',4,400,0,0,['box',-600,0,0,30,40,800,0,0,0,null,.9,.3]];
  const expanded=expandSolids([recipe]);expect(expanded).toHaveLength(4);
  expect(expanded.map(s=>s.position)).toEqual([[-600,0,0],[-200,0,0],[200,0,0],[600,0,0]]);
  for(const solid of expanded){expect(solid.size).toEqual([30,40,800]);expect(solid.metalness).toBe(.9);expect(solid.roughness).toBe(.3);}
  expect(JSON.stringify(recipe).length).toBeLessThan(JSON.stringify(expanded).length/2);
 });
 it('supports nested custom pin rows and derives bounds from geometry including rotation',()=>{
  const p=expandGeneratedPart(board);expect(p.solids).toHaveLength(31);expect(p.rotation).toEqual([0,0,0]);expect(p.role).toBe(board.description);expect(p.connections).toEqual([]);
  const rotated=expandGeneratedPart({...base,solids:[['box',0,0,0,20,10,30,0,0,90]]});expect(rotated.size).toEqual([10,20,30]);
  const preserved=expandGeneratedPart({...base,size:[1400,60,900],rotation:[0,10,0],role:'Frame support.'});expect(preserved.size).toEqual([1400,60,900]);expect(preserved.rotation).toEqual([0,10,0]);expect(preserved.role).toBe('Frame support.');
 });
 it.each([['repeat',0,1,0,0,['box',0,0,0,1,1,1]],['repeat',129,1,0,0,['box',0,0,0,1,1,1]],['repeat',2,Infinity,0,0,['box',0,0,0,1,1,1]],['repeat',2,5000,0,0,['box',1000,0,0,1,1,1]],['repeat',128,0,0,0,['repeat',128,0,0,0,['box',0,0,0,1,1,1]]]].map(recipe=>[recipe]))('rejects invalid counts, coordinates and expansion bombs',recipe=>expect(()=>expandSolids([recipe])).toThrow());
 it('keeps ordinary solid and full document formats backwards compatible',()=>{
  const s=expandSolid(['box',1,2,3,4,5,6]);expect(expandSolids([s])).toEqual([s]);
  const partial=JSON.stringify({document:{parts:[base,board]}});expect(completedParts(partial).map(p=>p.id)).toEqual(['iron-base','esp32']);expect(completedParts(partial)[1].solids).toHaveLength(31);
 });
});
describe('targeted validation correction',()=>{
 it('changes one invalid graph field without rewriting geometry or mutating the candidate',()=>{
  const original=wire(),before=structuredClone(original);original.document.relationships[0].to='missing';
  const corrected=applyGenerationRepair(original,{repairs:[{path:['document','relationships',0,'to'],value:'iron-base'}]}) as typeof original;
  expect(corrected.document.parts).toEqual(before.document.parts);expect(corrected.document.relationships[0].to).toBe('iron-base');expect(original.document.relationships[0].to).toBe('missing');
 });
 it('rejects whole-scene replacement, prototype paths and nonexistent parent paths',()=>{
  for(const path of [['document'],['document','parts'],['document','__proto__','x'],['document','parts',800,'name'],['document','constructor','prototype','x']])expect(()=>applyGenerationRepair(wire(),{repairs:[{path,value:[]}]})).toThrow();
  expect(({} as {polluted?:boolean}).polluted).toBeUndefined();
 });
 it('makes one streamed generation and a small correction instead of a full regeneration',async()=>{
  const invalid=wire();invalid.document.relationships[0].to='missing';
  generate.mockImplementationOnce(async(_s,_u,options)=>{options?.onPartial?.(JSON.stringify(invalid));return {text:JSON.stringify(invalid),model:'gemini-4-argon'};});
  generate.mockResolvedValueOnce({text:JSON.stringify({repairs:[{path:['document','relationships',0,'to'],value:'iron-base'}]}),model:'gemini-4-argon'});
  const progress=vi.fn(),result=await generateCustomDevice('Smart sofa with iron base and ESP32',new AbortController().signal,progress);
  expect(result.document?.parts[0].solids).toHaveLength(4);expect(result.document?.parts[1].solids).toHaveLength(31);expect(result.document?.relationships?.[0].to).toBe('iron-base');expect(generate).toHaveBeenCalledTimes(2);
  expect(generate.mock.calls[1][2]?.maxTokens).toBe(6000);expect(generate.mock.calls[1][2]?.timeoutMs).toBe(35000);
  const context=JSON.parse(generate.mock.calls[1][1]).original;
  expect(context.document.relationships).toEqual(invalid.document.relationships);
  expect(context.document.parts.map((p:{id:string})=>p.id)).toEqual(invalid.document.parts.map(p=>p.id));
  expect(context.document.parts.every((p:{solids?:unknown;geometryOmitted?:boolean})=>p.solids===undefined&&p.geometryOmitted)).toBe(true);
  expect(result.generation?.modelCalls).toBe(2);expect(progress.mock.calls.filter(([p])=>p.resetGeneration)).toHaveLength(1);
 });
 it('fails closed on malformed complete JSON and exhausted correction without a template',async()=>{
  generate.mockResolvedValueOnce({text:'{"document":',model:'gemini-4-argon'});await expect(generateCustomDevice('sofa',new AbortController().signal,undefined,{maxAttempts:1})).rejects.toThrow();expect(generate).toHaveBeenCalledTimes(1);
  generate.mockReset();const invalid=wire();invalid.document.relationships[0].to='missing';generate.mockResolvedValue({text:JSON.stringify(invalid),model:'gemini-4-argon'});
  await expect(generateCustomDevice('sofa',new AbortController().signal)).rejects.toThrow('unresolved validation');expect(generate).toHaveBeenCalledTimes(3);
 });
});

describe('compact relationship graph in the part inspector',()=>{
 it('shows actual neighbors when omitted duplicate per-part links decode to an empty array',()=>{
  const document={version:1 as const,id:'sofa',name:'Smart sofa',description:'Concept.',provenance:'Concept.',source:'gemini' as const,parts:[expandGeneratedPart(base),expandGeneratedPart(board)],relationships:wire().document.relationships as import('../lib/studio/types').DeviceDocument['relationships'],steps:[]};
  expect(document.parts[1].connections).toEqual([]);expect(connectedPartIds(document,'esp32')).toEqual(['iron-base']);expect(connectedPartIds(document,'iron-base')).toEqual(['esp32']);
  document.parts[1].connections=[{partId:'iron-base',label:'Mount'}];expect(connectedPartIds(document,'esp32')).toEqual(['iron-base']);expect(connectedPartIds(document,'missing')).toEqual([]);
 });
});
