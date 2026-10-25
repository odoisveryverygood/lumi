import {beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {Vector3} from 'three';
import type {DeviceDocument,DevicePart} from '../lib/studio/types';
import {mountParts,resolveAttachments} from '../lib/studio/attachments';
import {applyDeviceTransaction,conversationPlanSchema} from '../lib/studio/interaction';
import {catalogDocument,catalogJsonReplacer,hydrateCatalogPart} from '../lib/studio/catalog';
import {validateDeviceDocument} from '../lib/studio/validation';
import {createGeometryRenderer} from '../lib/studio/review-renderer';
import {applyQualityRepair,jpegDimensions,measuredQualityChecks,runQualityReview} from '../lib/studio/quality-engine';
import {improveWithVisualReview,requiresVisualReview} from '../lib/studio/quality-client';
import {requirementsFromRequest,type QualityRound,type ReviewFrame} from '../lib/studio/quality-types';
import {qualityFingerprint,sha256} from '../lib/studio/quality-fingerprint';
import {generateText} from '../lib/ai';
import {POST} from '../app/api/review/route';
import briefCases from './fixtures/quality-briefs.json';
vi.mock('../lib/ai',async original=>({...await original<typeof import('../lib/ai')>(),generateText:vi.fn()}));
const generate=vi.mocked(generateText);
function part(id:string,position:[number,number,number]=[0,0,0],size:[number,number,number]=[100,20,60]):DevicePart{return {id,name:id,category:'Test fixture',description:'Authored regression geometry; not a generated customer result.',role:'Regression fixture',position,rotation:[0,0,0],size,explode:[0,15,0],color:'#c98b46',solids:[{kind:'box',position:[0,0,0],size}],specs:{},connections:[]};}
function fixture():DeviceDocument{return {version:1,id:'fixture',name:'Mount regression fixture',description:'Authored unit-test fixture.',provenance:'Synthetic test scene, never an AI generation fallback.',source:'gemini',parts:[part('frame'),part('tray',[40,15,0],[10,5,20]),part('radio',[40,20,0],[8,2,8])],steps:[]};}
const request='A desk sensor with an orange bracket.';
const jpeg=Buffer.from([255,216,255,192,0,17,8,1,184,2,128,3,1,17,0,2,17,0,3,17,0,255,217]);
async function frames(document:DeviceDocument):Promise<ReviewFrame[]>{const documentHash=await qualityFingerprint(document);return (['assembled','top','exploded'] as const).map(view=>({view,renderer:'software',mimeType:'image/jpeg',data:jpeg.toString('base64'),documentHash,visiblePartIds:document.parts.map(p=>p.id),width:640,height:440}));}
async function round(document:DeviceDocument,number:number,issues:string[]=[]):Promise<QualityRound>{const f=await frames(document);return {number,documentHash:await qualityFingerprint(document),model:'gemini-4-argon',summary:'Mock findings for control-flow testing, not live evidence.',observations:requirementsFromRequest(request).map(r=>({requirementId:r.id,status:issues.includes(r.id)?'issue':'met',partIds:['radio'],view:'assembled',detail:'Mock observation.'})),checks:measuredQualityChecks(document),frames:await Promise.all(f.map(async image=>({...image,imageHash:await sha256(jpeg)}))),changedPartIds:[]};}
beforeEach(()=>generate.mockReset());

describe('real mounting behavior',()=>{
 it('carries nested parts when a parent translates and rotates without changing child geometry',()=>{
  const original=mountParts(fixture(),[{partId:'tray',parentId:'frame'},{partId:'radio',parentId:'tray'}]);const moved=applyDeviceTransaction(original,{updates:[{partId:'frame',patch:{position:[100,0,0],rotation:[0,90,0]}}]});
  expect(new Vector3(...moved.parts[1].position).distanceTo(new Vector3(100,15,-40))).toBeLessThan(.001);expect(new Vector3(...moved.parts[2].position).distanceTo(new Vector3(100,20,-40))).toBeLessThan(.001);expect(moved.parts[2].solids).toEqual(original.parts[2].solids);expect(original.parts[0].position).toEqual([0,0,0]);
 });
 it('preserves normalized anchors on a real parent resize and rebinds an explicitly moved child',()=>{
  const original=mountParts(fixture(),[{partId:'tray',parentId:'frame'}]),resized=applyDeviceTransaction(original,{updates:[{partId:'frame',patch:{size:[200,20,60],solids:[{kind:'box',position:[0,0,0],size:[200,20,60]}]}}]});expect(resized.parts[1].position[0]).toBeCloseTo(80);expect(resized.parts[1].size).toEqual([10,5,20]);
  const edited=applyDeviceTransaction(resized,{updates:[{partId:'tray',patch:{position:[20,20,0]}}]}),moved=applyDeviceTransaction(edited,{updates:[{partId:'frame',patch:{position:[30,0,0]}}]});expect(moved.parts[1].position).toEqual([50,20,0]);
 });
 it('rejects cycles and unknown parents, and detaches deleted parents without teleporting children',()=>{
  const original=fixture();expect(()=>mountParts(original,[{partId:'tray',parentId:'unknown'}])).toThrow();expect(()=>mountParts(original,[{partId:'tray',parentId:'frame'},{partId:'frame',parentId:'tray'}])).toThrow('cycle');
  const mounted=mountParts(original,[{partId:'tray',parentId:'frame'}]),removed=applyDeviceTransaction(mounted,{removePartIds:['frame']});expect(removed.parts[0].position).toEqual([40,15,0]);expect(removed.parts[0].attachment).toBeUndefined();
 });
 it('keeps mounts and canonical geometry across compact catalog export and pre-parsed AI transactions',()=>{
  const doc=fixture();doc.parts.push(hydrateCatalogPart('m3-nut',{id:'nut',position:[0,15,0]}));const mounted=mountParts(doc,[{partId:'nut',parentId:'tray'}]);expect(validateDeviceDocument(JSON.parse(JSON.stringify(mounted,catalogJsonReplacer)))).toEqual(mounted);
  const plan=conversationPlanSchema.parse({intent:'edit',answer:'Add sourced hardware',actions:[],operation:'patch',transaction:{addParts:[{catalogRef:{id:'bearing-608'},id:'bearing'}]}});expect(applyDeviceTransaction(doc,plan.transaction).parts.at(-1)?.catalogRef?.id).toBe('bearing-608');
 });
 it('limits selected-part edits while still carrying attached descendants',()=>{
  const document=mountParts(fixture(),[{partId:'radio',parentId:'tray'}]);expect(()=>applyDeviceTransaction(document,{updates:[{partId:'frame',patch:{color:'#123456'}}]},{selectedPartId:'tray',restrictToSelected:true})).toThrow('unrelated');const changed=applyDeviceTransaction(document,{updates:[{partId:'tray',patch:{position:[50,15,0]}}]},{selectedPartId:'tray',restrictToSelected:true});expect(changed.parts[2].position).toEqual([50,20,0]);expect(changed.parts[0]).toEqual(document.parts[0]);
 });
});
describe('actual geometry renderer',()=>{
 it('renders every box triangle with depth-correct picking and hides only requested components',()=>{
  const document=fixture();document.parts=[{...part('back',[0,0,-30],[50,50,10]),color:'#ff0000'},{...part('front',[0,0,30],[50,50,10]),color:'#0000ff'}];const renderer=createGeometryRenderer(document);
  try{const image=renderer.render({width:160,height:160,yaw:0,pitch:0});expect(image.triangles).toBe(24);expect(image.partIndices[80*160+80]).toBe(1);expect(image.rgba[(80*160+80)*4+2]).toBeGreaterThan(image.rgba[(80*160+80)*4]);expect(renderer.render({width:160,height:160,yaw:0,pitch:0,hiddenIds:['front']}).visiblePartIds).toEqual(['back']);}finally{renderer.dispose();}
 });
 it('renders the sourced CAD vertices rather than substituting a box',()=>{
  const document=catalogDocument('gear-20'),renderer=createGeometryRenderer(document);try{const image=renderer.render({width:180,height:180,view:'top'});expect(image.triangles).toBe(document.parts[0].mesh!.indices.length/3);expect(image.visiblePartIds).toEqual(['gear-20']);expect(image.partIndices.some(n=>n===0)).toBe(true);}finally{renderer.dispose();}
 });
 it.each(['docs/sponsor-sprint/2026-10-23-catalog/generated-sensor.part.json','docs/sponsor-sprint/2026-10-23-catalog/sofa-catalog-export.part.json'])('opens and renders the real saved regression object %s',path=>{
  const document=validateDeviceDocument(JSON.parse(readFileSync(path,'utf8')).document),renderer=createGeometryRenderer(document);try{for(const view of ['assembled','top','exploded'] as const){const image=renderer.render({width:240,height:160,view});expect(image.visiblePartIds.length).toBeGreaterThan(1);expect(image.triangles).toBeGreaterThan(100);}}finally{renderer.dispose();}
 });
});
describe('evidence and scoped repairs',()=>{
 it('keeps every named feature in the evaluation briefs without serving them as object templates',()=>{
  expect(briefCases.cases).toHaveLength(12);for(const entry of briefCases.cases){const clauses=requirementsFromRequest(entry.brief).map(r=>r.text.toLowerCase()).join(' ');for(const feature of entry.features)expect(clauses).toContain(feature.toLowerCase());}
 });
 it('restores the real recorded two-review project with its exact source mounts and six image hashes',async()=>{
  const raw=JSON.parse(readFileSync('docs/sponsor-sprint/2026-10-24-quality/reviewed-sensor.part.json','utf8')),document=validateDeviceDocument(raw.document);expect(document.review?.rounds).toHaveLength(2);expect(document.parts.find(p=>p.id==='esp32-c3-module')?.attachment?.parentId).toBe('carrier-board');
  for(const recorded of document.review!.rounds)for(const frame of recorded.frames)expect(await sha256(Buffer.from(frame.data,'base64'))).toBe(frame.imageHash);expect(await qualityFingerprint(document)).toBe(document.review!.finalHash);
 });
 it('keeps exact requirement clauses and fingerprints survive compact source round trips',async()=>{
  expect(requirementsFromRequest('A sofa with an iron base and ESP32.').map(r=>r.text)).toEqual(['A sofa','an iron base','ESP32']);const d=catalogDocument('m3-nut');expect(await qualityFingerprint(d)).toBe(await qualityFingerprint(validateDeviceDocument(JSON.parse(JSON.stringify(d,catalogJsonReplacer)))));
 });
 it('rejects unrelated edits, deletion, identity changes and fake source resizing',()=>{
  const d=fixture(),observation=[{requirementId:'requirement-1',status:'issue' as const,partIds:['radio'],view:'assembled' as const,detail:'Floating module.'}];
  for(const repair of [{updates:[{partId:'frame',patch:{color:'#112233'}}]},{removePartIds:['radio']},{updates:[{partId:'radio',patch:{name:'different'}}]}])expect(()=>applyQualityRepair(d,repair,observation)).toThrow();
  const n=catalogDocument('m3-nut');expect(()=>applyQualityRepair(n,{updates:[{partId:'m3-nut',patch:{size:[100,100,100]}}]},[{...observation[0],partIds:['m3-nut']}])).toThrow();
  expect(applyQualityRepair(d,{updates:[{partId:'radio',patch:{position:[0,12,0]}}]},observation).parts[2].position).toEqual([0,12,0]);
 });
 it('corrects inaccurate envelope metadata only to the measured geometry without redesigning the part',()=>{
  const document=fixture();document.parts[0].size=[10,10,10];expect(measuredQualityChecks(document).find(c=>c.id==='envelopes')?.status).toBe('fail');const corrected=applyQualityRepair(document,{updates:[{partId:'frame',patch:{size:[100,20,60]}}]},[{requirementId:'requirement-1',status:'issue',partIds:['frame'],view:'assembled',detail:'Declared envelope is inconsistent.'}]);expect(corrected.parts[0].solids).toEqual(document.parts[0].solids);expect(measuredQualityChecks(corrected).find(c=>c.id==='envelopes')?.status).toBe('pass');
 });
 it('checks decoded image dimensions and rejects old snapshots before a provider call',async()=>{
  expect(jpegDimensions(jpeg)).toEqual({width:640,height:440});const huge=new Uint8Array(jpeg);huge[9]=100;expect(()=>jpegDimensions(huge)).toThrow('pixel budget');
  const d=fixture(),input={request,requirements:requirementsFromRequest(request),document:d,frames:await frames(d),round:0,allowRepair:true,previous:[]};input.frames[0].documentHash='0'.repeat(64);await expect(runQualityReview(input,new AbortController().signal)).rejects.toThrow('do not match');expect(generate).not.toHaveBeenCalled();
 });
 it('sends the real three images and rejects omitted requirements and forged part references',async()=>{
  const d=fixture(),input={request,requirements:requirementsFromRequest(request),document:d,frames:await frames(d),round:0,allowRepair:true,previous:[]},r=await round(d,0);generate.mockResolvedValueOnce({text:JSON.stringify({summary:'Review',observations:r.observations}),model:'gemini-4-argon'});
  const result=await runQualityReview(input,new AbortController().signal);expect(generate.mock.calls[0][2]?.attachments).toHaveLength(3);expect(result.round.frames[0].imageHash).toBe(await sha256(jpeg));
  generate.mockResolvedValueOnce({text:JSON.stringify({summary:'Omitted',observations:r.observations.slice(0,1)}),model:'gemini-4-argon'});await expect(runQualityReview(input,new AbortController().signal)).rejects.toThrow('omitted');
 });
 it('rejects cross-origin and malformed requests before calling the model',async()=>{
  const response=await POST(new Request('http://localhost/api/review',{method:'POST',headers:{origin:'https://evil.invalid','content-type':'application/json'},body:'{}'}));expect(response.status).toBe(403);expect(generate).not.toHaveBeenCalled();
 });
});
describe('closed-loop quality control',()=>{
 it('renders and reinspects a correction before accepting it, retaining IDs and the fixed brief',async()=>{
  const original=fixture(),next=applyDeviceTransaction(original,{updates:[{partId:'radio',patch:{position:[0,12,0]}}]}),capture=vi.fn(frames),review=vi.fn().mockResolvedValueOnce({round:{...await round(original,0,['requirement-1']),changedPartIds:['radio']},nextDocument:next,nextHash:await qualityFingerprint(next)}).mockResolvedValueOnce({round:await round(next,1)});
  const result=await improveWithVisualReview(original,request,new AbortController().signal,undefined,undefined,{capture,review});expect(result.report.status).toBe('reviewed');expect(capture).toHaveBeenCalledTimes(2);expect(review.mock.calls[0][0].requirements).toEqual(review.mock.calls[1][0].requirements);expect(result.document.parts[2].position).toEqual([0,12,0]);expect(original.parts[2].position).toEqual([40,20,0]);
 });
 it('retains the better earlier candidate when a revision adds a new issue',async()=>{
  const original=fixture(),next=applyDeviceTransaction(original,{updates:[{partId:'radio',patch:{position:[0,12,0]}}]}),review=vi.fn().mockResolvedValueOnce({round:{...await round(original,0,['requirement-1']),changedPartIds:['radio']},nextDocument:next,nextHash:await qualityFingerprint(next)}).mockResolvedValueOnce({round:await round(next,1,['requirement-2'])});
  const result=await improveWithVisualReview(original,request,new AbortController().signal,undefined,undefined,{capture:frames,review});expect(result.report.status).toBe('needs-attention');expect(result.report.rounds[1].rejected).toBe(true);expect(result.document.parts).toEqual(original.parts);
 });
 it('never returns an unreviewed patch after a provider error and stops at two repairs',async()=>{
  const original=fixture(),next=applyDeviceTransaction(original,{updates:[{partId:'radio',patch:{position:[0,12,0]}}]}),review=vi.fn().mockResolvedValueOnce({round:{...await round(original,0,['requirement-1']),changedPartIds:['radio']},nextDocument:next,nextHash:await qualityFingerprint(next)}).mockRejectedValueOnce(new Error('provider unavailable'));
  const result=await improveWithVisualReview(original,request,new AbortController().signal,undefined,undefined,{capture:frames,review});expect(result.report.status).toBe('incomplete');expect(result.document.parts).toEqual(original.parts);
  const repeat=vi.fn(async(input)=>{const changed=applyDeviceTransaction(input.document,{updates:[{partId:'radio',patch:{position:[input.round+1,12,0]}}]});return {round:{...await round(input.document,input.round,['requirement-1']),changedPartIds:['radio']},nextDocument:changed,nextHash:await qualityFingerprint(changed)};});
  await improveWithVisualReview(original,request,new AbortController().signal,undefined,undefined,{capture:frames,review:repeat});expect(repeat).toHaveBeenCalledTimes(3);expect(repeat.mock.calls[2][0].allowRepair).toBe(false);
 });
 it('cancels without producing a replacement and keeps recolor/name edits fast',async()=>{
  const controller=new AbortController();controller.abort();await expect(improveWithVisualReview(fixture(),request,controller.signal,undefined,undefined,{capture:frames,review:vi.fn()})).rejects.toThrow();const d=fixture();expect(requiresVisualReview(d,{...d,parts:d.parts.map(p=>({...p,name:'new',color:'#111111'}))})).toBe(false);expect(requiresVisualReview(d,applyDeviceTransaction(d,{updates:[{partId:'radio',patch:{position:[1,2,3]}}]}))).toBe(true);
 });
});
