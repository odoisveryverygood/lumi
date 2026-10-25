import {describe,it,expect} from 'vitest';
import {readFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {Vector3} from 'three';
import {HOLDOUT_DATASET_VERSION,holdoutTasks,holdoutAssembly,holdoutOracle,interiorMargin,boxGap,HOLDOUT_INTERIOR} from '../lib/studio/holdout-tasks';
import {localPartBounds} from '../lib/studio/render-model';
import type {DeviceDocument,DevicePart} from '../lib/studio/types';
import type {HoldoutTask} from '../lib/studio/holdout-tasks';
const task=(id:string)=>holdoutTasks.find(t=>t.id===id)!;
const edit=(doc:DeviceDocument,id:string,patch:Partial<DevicePart>):DeviceDocument=>({...doc,parts:doc.parts.map(p=>p.id===id?{...p,...patch}:p)});
const failing=(doc:DeviceDocument,t=holdoutTasks[0])=>holdoutOracle(t,doc,doc).checks.filter(c=>!c.passed).map(c=>c.name);
const rejected=(t:HoldoutTask,baseline:DeviceDocument,candidate:DeviceDocument)=>holdoutOracle(t,baseline,candidate).checks.filter(c=>!c.passed).map(c=>c.name);
describe('held-out evaluation dataset (teammate 3, version 1)',()=>{
 it('is frozen: the packet copy matches the module and the pinned fingerprint',()=>{
  const serialized=JSON.stringify({version:HOLDOUT_DATASET_VERSION,interior:HOLDOUT_INTERIOR,tasks:holdoutTasks});
  const hash=createHash('sha256').update(serialized).digest('hex');
  expect(HOLDOUT_DATASET_VERSION).toBe(1);
  expect(hash).toBe('e4cd5a49846b24b061915573cf652c786903ab90a6858f455dbc2453ee2c62b5');
  const packet='docs/sponsor-sprint/2026-10-25-independent-evidence/holdout-tasks.v1.json';
  expect(existsSync(packet)).toBe(true);
  expect(JSON.parse(readFileSync(packet,'utf8'))).toEqual(JSON.parse(serialized));
 });
 it('keeps three separate groups with unique IDs and explicit expectations',()=>{
  expect(new Set(holdoutTasks.map(t=>t.id)).size).toBe(holdoutTasks.length);
  expect(holdoutTasks.filter(t=>t.group==='seeded-repair')).toHaveLength(4);
  expect(holdoutTasks.filter(t=>t.group==='fresh-edit')).toHaveLength(3);
  expect(holdoutTasks.filter(t=>t.group==='expected-refusal')).toHaveLength(3);
  for(const t of holdoutTasks)expect(t.expected).toBe(t.group==='expected-refusal'?'blocked':'satisfy');
 });
 it('is never imported by generation, planning, review or prompt code',()=>{
  const files:string[]=[];const walk=(dir:string)=>{for(const name of readdirSync(dir)){const p=join(dir,name);if(statSync(p).isDirectory())walk(p);else if(/\.(ts|tsx|mjs)$/.test(name))files.push(p);}};
  walk('lib');walk('app');walk('components');
  const importers=files.filter(f=>readFileSync(f,'utf8').includes('holdout-tasks')&&!f.endsWith('holdout-tasks.ts'));
  expect(importers).toEqual([]);
 });
 it('every seeded fixture fails only its requirement, with protected parts intact',()=>{
  for(const t of holdoutTasks.filter(t=>t.group==='seeded-repair')){
   const names=failing(holdoutAssembly(t),t);
   expect(names.length,t.id).toBeGreaterThan(0);
   expect(names,t.id).not.toContain('Unrelated shape and placement');
   expect(names,t.id).not.toContain('Source CAD canonical');
  }
 });
 it('fresh-edit fixtures are unbroken except for the new requirement',()=>{
  expect(failing(holdoutAssembly(task('h5-battery-height-5')),task('h5-battery-height-5'))).toEqual(['Actual geometry height']);
  expect(failing(holdoutAssembly(task('h6-battery-height-2p5')),task('h6-battery-height-2p5'))).toEqual(['Actual geometry height']);
  const h7=task('h7-compound-separation'),doc=holdoutAssembly(h7);
  expect(failing(doc,h7)).toEqual(['Envelope separation battery–radio']);
  const gap=boxGap(localPartBounds(doc.parts[3]).translate(new Vector3(...doc.parts[3].position)),localPartBounds(doc.parts[2]).translate(new Vector3(...doc.parts[2].position)));
  expect(gap).toBeCloseTo(3.4,1);
 });
 it('accepts a genuine correction for each positive task',()=>{
  const h1=task('h1-rotated-module-outside'),b1=holdoutAssembly(h1);
  expect(holdoutOracle(h1,b1,edit(b1,'radio',{position:[0,7,0]})).passed).toBe(true);
  const h2=task('h2-module-through-wall'),b2=holdoutAssembly(h2);
  expect(holdoutOracle(h2,b2,edit(b2,'radio',{position:[0,7,0]})).passed).toBe(true);
  const h3=task('h3-battery-overlap-z'),b3=holdoutAssembly(h3);
  expect(holdoutOracle(h3,b3,edit(b3,'battery',{position:[19,12,-5]})).passed).toBe(true);
  const h4=task('h4-bracket-adjacent-port'),b4=holdoutAssembly(h4);
  expect(holdoutOracle(h4,b4,edit(b4,'bracket',{position:[22,12,32]})).passed).toBe(true);
  const h5=task('h5-battery-height-5'),b5=holdoutAssembly(h5);
  expect(holdoutOracle(h5,b5,edit(b5,'battery',{size:[18,5,26],solids:[{kind:'box',position:[0,0,0],size:[18,5,26]}]})).passed).toBe(true);
  const h7=task('h7-compound-separation'),b7=holdoutAssembly(h7);
  expect(holdoutOracle(h7,b7,edit(b7,'battery',{position:[22,12,-5]})).passed).toBe(true);
 });
 it('rejects corrections that cheat',()=>{
  const h1=task('h1-rotated-module-outside'),b1=holdoutAssembly(h1);
  expect(rejected(h1,b1,edit(b1,'radio',{position:[0,7,0],rotation:[0,0,0]}))).toContain('Requested rotation retained');
  expect(rejected(h1,b1,edit(edit(b1,'radio',{position:[0,7,0]}),'housing',{position:[70,0,0]}))).toContain('Unrelated shape and placement');
  expect(rejected(h1,b1,{...edit(b1,'radio',{position:[0,7,0]}),parts:edit(b1,'radio',{position:[0,7,0]}).parts.filter(p=>p.id!=='button')})).toContain('Original component identities');
  const h3=task('h3-battery-overlap-z'),b3=holdoutAssembly(h3);
  expect(rejected(h3,b3,edit(b3,'battery',{size:[2,2,2],solids:[{kind:'box',position:[0,0,0],size:[2,2,2]}],position:[25,12,-15]}))).toContain('Moved components keep their shape');
  expect(rejected(h3,b3,edit(b3,'battery',{position:[0,7,80]}))).toContain('Originally contained components stay inside');
  const h5=task('h5-battery-height-5'),b5=holdoutAssembly(h5);
  expect(rejected(h5,b5,edit(b5,'battery',{size:[18,5,26]}))).toContain('Actual geometry height');
  const h2=task('h2-module-through-wall'),b2=holdoutAssembly(h2);
  expect(rejected(h2,b2,edit(b2,'radio',{position:[0,7,0],mesh:{positions:[0,0,0,1,0,0,0,1,0],indices:[0,1,2]}}))).toContain('Source CAD canonical');
 });
 it('treats a sampled correction between the known faces conservatively',()=>{
  const h1=task('h1-rotated-module-outside'),b1=holdoutAssembly(h1);
  const radio=b1.parts.find(p=>p.id==='radio')!,height=localPartBounds(radio).getSize(new Vector3()).y;
  const nearCeiling=edit(b1,'radio',{position:[0,24-height/2-1,0]});
  expect(failing(nearCeiling,h1)).toContain('Known interior clearance');
  expect(interiorMargin(localPartBounds(nearCeiling.parts[2]).translate(new Vector3(...nearCeiling.parts[2].position)))).toBeCloseTo(1,5);
 });
 it('scores expected refusals as correct only when nothing changed and nothing was faked',()=>{
  const h8=task('h8-impossible-clearance'),b8=holdoutAssembly(h8);
  expect(holdoutOracle(h8,b8,b8).passed).toBe(true);
  expect(holdoutOracle(h8,b8,edit(b8,'radio',{position:[0,12,0]})).passed).toBe(false);
  const h9=task('h9-contradictory-request'),b9=holdoutAssembly(h9);
  expect(holdoutOracle(h9,b9,b9).passed).toBe(true);
  expect(holdoutOracle(h9,b9,edit(b9,'battery',{position:[19,12,-5]})).passed).toBe(false);
  const h10=task('h10-missing-floor'),b10=holdoutAssembly(h10);
  expect(b10.parts[0].solids).toHaveLength(4);
  const verdict=holdoutOracle(h10,b10,b10);
  expect(verdict.passed).toBe(true);
  expect(verdict.checks.find(c=>c.name==='Interior cannot be established')!.passed).toBe(false);
  expect(holdoutOracle(h10,b10,edit(b10,'radio',{position:[0,7,0]})).passed).toBe(false);
 });
});
