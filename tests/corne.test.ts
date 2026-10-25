import {readFileSync} from 'node:fs';
import {describe,it,expect,vi,beforeEach} from 'vitest';
import {Box3,BoxGeometry,Vector3} from 'three';
import {enrichCorneReference} from '../lib/studio/corne';
import {buildRedesign,checkRedesign,defaultDesignConstraints,meshBoxConflict,partWorldBounds,type RedesignPlan} from '../lib/studio/redesign';
import {runObjectConversation} from '../lib/studio/redesign-engine';
import {generateText} from '../lib/ai';
import {validateDeviceDocument} from '../lib/studio/validation';
vi.mock('../lib/ai',async original=>({...await original<typeof import('../lib/ai')>(),generateText:vi.fn()}));
const generate=vi.mocked(generateText),doc=enrichCorneReference(JSON.parse(readFileSync('public/assemblies/corne/document.json','utf8')));
const plan:RedesignPlan={chargeCurrentMa:100,citations:[],summary:'Use a sourced compact BLE board and 150 mAh battery, removing the optional acoustic insert.',constraintChanges:[],unsupportedConstraints:[],battery:{catalogId:'adafruit-1317',position:[-25,4.3,-12],rotationY:0},radio:{catalogId:'nice-nano',position:[25,4,-12],rotationY:0},removePad:true};
const reply=(value:unknown)=>({text:JSON.stringify(value),model:'gemini-4-argon'});
beforeEach(()=>generate.mockReset());
describe('source Corne geometry and object conversation',()=>{
 it('retains source dimensions, separate apertured meshes and valid mechanism references',()=>{
  const source=doc.parts.find(p=>p.id==='keyboard-case-base')!;const size=partWorldBounds(source).getSize(new Vector3());
  expect(size.x).toBeCloseTo(138.35,2);expect(size.y).toBeCloseTo(11.1,2);expect(size.z).toBeCloseTo(97.62,2);
  expect(doc.parts.find(p=>p.id==='keyboard-case-frame')?.mesh?.indices.length).toBeGreaterThan(100);
  expect(doc.parts.filter(p=>p.id.startsWith('key-'))).toHaveLength(21);expect(doc.mechanisms?.[0].id).toBe('corne-keypress');expect(validateDeviceDocument(doc)).toEqual(doc);
 });
 it('fits sourced smaller hardware in the source enclosure without replacing its shape',()=>{
  const next=buildRedesign(doc,plan),checks=checkRedesign(doc,next,defaultDesignConstraints);
  expect(checks.filter(c=>c.status==='fail')).toEqual([]);expect(next.parts.find(p=>p.id==='keyboard-case-base')?.mesh).toEqual(doc.parts.find(p=>p.id==='keyboard-case-base')?.mesh);
  expect(checks.find(c=>c.id==='physical')?.status).toBe('unverified');
 });
 it('measures a retained insert conflict and reports actual shortfall and a scene witness',()=>{
  const next=buildRedesign(doc,{...plan,removePad:false});const checks=checkRedesign(doc,next,{...defaultDesignConstraints,keepPad:true}),room=checks.find(c=>c.id==='space-wireless-controller');
  expect(room?.status).toBe('fail');expect(room?.metrics?.availableMm).toBeCloseTo(2.675,3);expect(room?.metrics?.requiredMm).toBeCloseTo(3.2,3);expect(room?.metrics?.shortfallMm).toBeCloseTo(.525,3);expect(room?.measurement?.tone).toBe('fail');
  expect(checks.some(c=>c.status==='fail'&&c.region)).toBe(true);
 });
 it('tests mesh surfaces and contained solids instead of falsely filling a hollow enclosure',()=>{
  const base=structuredClone(doc.parts[0]),g=new BoxGeometry(20,2,20);base.position=[0,0,0];base.rotation=[0,0,0];base.mesh={positions:Array.from(g.attributes.position.array),indices:Array.from(g.index!.array)};g.dispose();
  expect(meshBoxConflict(base,new Box3(new Vector3(-1,3,-1),new Vector3(1,5,1)))).toBeNull();
  expect(meshBoxConflict(base,new Box3(new Vector3(-1,-.5,-1),new Vector3(1,.5,1)))).not.toBeNull();
  expect(meshBoxConflict(base,new Box3(new Vector3(-1,.8,-1),new Vector3(1,2,1)))).not.toBeNull();
 });
 it('answers a measured why question without editing or calling the redesign loop',async()=>{
  const candidate=buildRedesign(doc,{...plan,removePad:false});generate.mockResolvedValueOnce(reply({intent:'explain',answer:'The board needs 3.20 mm; this footprint has 2.67 mm above the insert.',actions:[{type:'focus',partIds:['wireless-controller','keyboard-dampener']}],suggestions:['Remove the acoustic insert.'],checkId:'space-wireless-controller'}));
  const before=JSON.stringify(candidate),answer=await runObjectConversation({document:candidate,baseline:doc,prompt:'Why does that not fit?',constraints:{...defaultDesignConstraints,keepPad:true}},new AbortController().signal);
  expect(answer.kind).toBe('explanation');expect(JSON.stringify(candidate)).toBe(before);expect(generate).toHaveBeenCalledTimes(1);expect(generate.mock.calls[0][1]).toContain('2.68 mm');
 });
 it('reuses the initial Argon plan and streams checked candidates before accepting a redesign',async()=>{
  generate.mockResolvedValueOnce(reply({intent:'redesign',...plan}));const progress:unknown[]=[];
  const answer=await runObjectConversation({document:doc,baseline:doc,prompt:'Make it wireless'},new AbortController().signal,p=>progress.push(p));
  expect(answer.kind).toBe('redesign');if(answer.kind==='redesign')expect(answer.status).toBe('ready');expect(generate).toHaveBeenCalledTimes(1);expect(progress.some(p=>!!(p as {attempt?:unknown}).attempt)).toBe(true);
 });
 it('validates object action references rather than accepting invented components',async()=>{
  generate.mockResolvedValue(reply({intent:'explain',answer:'Here.',actions:[{type:'focus',partIds:['invented']}],suggestions:[]}));
  await expect(runObjectConversation({document:doc,baseline:doc,prompt:'Explain'},new AbortController().signal)).rejects.toThrow();expect(generate).toHaveBeenCalledTimes(2);
 });
});

describe('source geometry request boundaries',()=>{
 it('accepts the real source document pair and keeps mesh arrays out of Argon context',async()=>{
  const {POST}=await import('../app/api/redesign/route');generate.mockResolvedValueOnce(reply({intent:'redesign',...plan}));
  const response=await POST(new Request('http://localhost:3000/api/redesign',{method:'POST',headers:{origin:'http://localhost:3000','content-type':'application/json',accept:'application/x-ndjson'},body:JSON.stringify({document:doc,baseline:doc,prompt:'Make it wireless',conversation:true})}));
  expect(response.status).toBe(200);const events=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));
  expect(events.at(-1)?.result.status).toBe('ready');expect(events.some(e=>e.attempt?.plan&&e.constraints?.clearance===.4)).toBe(true);expect(generate.mock.calls[0][1]).not.toContain('"indices"');expect(generate.mock.calls[0][1]).not.toContain('"positions"');
 });
 it('uses the complete catalog envelope even when illustrative board details occupy less volume',()=>{
  const candidate=buildRedesign(doc,plan),radio=candidate.parts.find(p=>p.id==='wireless-controller')!;
  expect(radio.solids.length).toBeGreaterThan(10);const size=partWorldBounds(radio).getSize(new Vector3()).toArray();[33.52,3.2,18].forEach((n,i)=>expect(size[i]).toBeCloseTo(n,5));
  expect(checkRedesign(doc,candidate,defaultDesignConstraints).find(c=>c.id==='radio-dimensions')?.status).toBe('unverified');
 });
 it('does not accept an AI-invented source mesh or overwrite an existing mesh in a transaction',async()=>{
  const {deviceTransactionSchema}=await import('../lib/studio/interaction');const {generatedDeviceSchema}=await import('../lib/studio/validation');
  expect(deviceTransactionSchema.safeParse({updates:[{partId:'keyboard-case-base',patch:{mesh:doc.parts[0].mesh}}]}).success).toBe(false);
  expect(generatedDeviceSchema.safeParse({...doc,source:'gemini',parts:doc.parts.slice(0,3)}).success).toBe(false);
 });
});
