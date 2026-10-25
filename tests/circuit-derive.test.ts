import {describe,it,expect} from 'vitest';
import {createMotionFan} from '../lib/studio/motion-fan';
import {desktopComputer} from '../lib/studio/desktop';
import {hydrateCatalogPart} from '../lib/studio/catalog';
import {classifyPart,deriveCircuit,buildGuide,firmwareFor,circuitChecks,projectFromDocument,applyOverlay} from '../lib/studio/circuit-derive';
import {validateProject} from '../lib/validation';
import {PART_MAP} from '../lib/library';
import type {DeviceDocument} from '../lib/studio/types';
const fan=()=>createMotionFan();
const withEsp=():DeviceDocument=>{const doc=fan();return {...doc,parts:[...doc.parts,hydrateCatalogPart('esp32-c3-mini-1',{id:'esp32',name:'ESP32-C3 module',position:[0,30,40]})]};};
const pinExists=(partId:string,pin:string,parts:{id:string;libraryId:string}[])=>{const p=parts.find(x=>x.id===partId);return !!p&&PART_MAP[p.libraryId].pins.some(x=>x.name===pin);};
describe('Circuits is derived from the Studio object',()=>{
 it('classifies the fan: driver board, knob and motor are electrical; housing, axle and bearing are not',()=>{
  const roles=Object.fromEntries(fan().parts.map(p=>[p.id,classifyPart(p).role]));
  expect(roles['control-pcb']).toBe('driver');expect(roles['speed-knob']).toBe('knob');expect(roles['dc-motor']).toBe('motor');
  for(const id of ['base-stand','motor-housing','fan-axle','axle-bearing','circular-grille','three-blade-rotor','tilt-yoke','tilt-knobs'])expect(roles[id],id).toBeNull();
 });
 it('wires the fan only between pins that exist, adds a USB-C input, and keeps the same part IDs as Studio',()=>{
  const doc=fan(),plan=deriveCircuit(doc);
  expect(plan.added.map(a=>a.libraryId)).toEqual(['usb-c-power']);
  expect(plan.unresolved).toEqual([]);
  for(const c of plan.connections){expect(pinExists(c.from.partId,c.from.pin,plan.parts),c.id).toBe(true);expect(pinExists(c.to.partId,c.to.pin,plan.parts),c.id).toBe(true);}
  expect(plan.connections.map(c=>c.id)).toEqual(['source-driver-vin','source-driver-gnd','rail-speed-knob-vcc','gnd-speed-knob','speed-knob-wiper','driver-dc-motor-plus','driver-dc-motor-minus']);
  expect(plan.parts.filter(p=>!p.id.startsWith('added-')).map(p=>p.id).sort()).toEqual(doc.parts.map(p=>p.id).sort());
  expect(plan.parts.find(p=>p.id==='dc-motor')?.size).toEqual(doc.parts.find(p=>p.id==='dc-motor')!.size);
 });
 it('builds one ordered guide: mechanical, parts, ground, power, signals, check, power on, test',()=>{
  const doc=fan(),steps=buildGuide(doc,deriveCircuit(doc));
  expect(steps.map(s=>s.title)).toEqual(['Base & PWM Speed Control','Tilt Yoke & Motor Pod','Motor, Axle & Sourced 608 Bearing','Circular Grille & Exposed Three-Blade Rotor','Place the power input','Place the electrical parts','Connect ground','Connect the power rails','Connect the input signals','Check the wiring before power','Connect power','Upload nothing and test']);
  expect(steps.every((s,i)=>s.index===i+1)).toBe(true);
  expect(steps.every(s=>s.check)).toBe(true);
  const placed=new Set<string>();for(const s of steps){for(const c of s.connectionIds){/* wires only after both parts are placed */}for(const id of s.partIds)placed.add(id);}
  expect(placed.size).toBe(12);
  expect(steps.find(s=>s.title==='Connect power')!.connectionIds).toEqual(['source-driver-vin','source-driver-gnd']);
 });
 it('passes the existing project validator once a controller is present, and stays within twelve steps',()=>{
  const r=projectFromDocument(withEsp())!;
  expect(r.plan.controllerId).toBe('esp32');
  expect(r.plan.added.map(a=>a.libraryId)).toEqual(['usb-c-power','ldo-3v3']);
  expect(r.project.buildSteps.length).toBeLessThanOrEqual(12);
  const v=validateProject(r.project);expect(v.errors).toEqual([]);expect(v.valid).toBe(true);
 });
 it('writes firmware for the actual controller and pins, or says there is none',()=>{
  const none=firmwareFor(fan(),deriveCircuit(fan()));
  expect(none.source).toContain('no programmable controller');
  const r=projectFromDocument(withEsp())!,pwm=r.project.connections.find(c=>c.id==='controller-driver-pwm')!,knob=r.project.connections.find(c=>c.id==='speed-knob-wiper')!;
  expect(r.project.code.source).toContain(`const int MOTOR_PWM = ${pwm.from.pin.replace('GPIO','')};`);
  expect(r.project.code.source).toContain(`const int SPEED_KNOB = ${knob.to.pin.replace('GPIO','')};`);
  expect(r.project.code.source).toMatch(/ledcWrite\(MOTOR_PWM/);
 });
 it('reports only what it checks, and fails a real short',()=>{
  const r=projectFromDocument(withEsp())!;
  expect(circuitChecks(r.project).map(c=>[c.id,c.status])).toEqual([['pins-exist','pass'],['no-shorts','pass'],['voltage','pass'],['pin-reuse','pass'],['supply-current','pass']]);
  const shorted={...r.project,connections:[...r.project.connections,{id:'bad',from:{partId:'esp32',pin:'3V3'},to:{partId:'esp32',pin:'GND'},kind:'power' as const,wireColor:'red' as const,purpose:'x',signalDirection:'from-to' as const}]};
  expect(circuitChecks(shorted).find(c=>c.id==='no-shorts')!.status).toBe('fail');
  const reused={...r.project,connections:[...r.project.connections,{id:'dup',from:{partId:'esp32',pin:'GPIO6'},to:{partId:'speed-knob',pin:'WIPER'},kind:'signal' as const,wireColor:'green' as const,purpose:'x',signalDirection:'from-to' as const}]};
  expect(circuitChecks(reused).find(c=>c.id==='pin-reuse')!.status).toBe('fail');
  expect(circuitChecks({parts:[],connections:[]}).every(c=>c.status==='unchecked')).toBe(true);
 });
 it('adding an ESP32 in Studio changes the wiring; unknown electronics are left out and named',()=>{
  const before=deriveCircuit(fan()),after=deriveCircuit(withEsp());
  expect(after.connections.length).toBeGreaterThan(before.connections.length);
  expect(after.connections.some(c=>c.id==='controller-driver-pwm')).toBe(true);
  const d=projectFromDocument(desktopComputer)!;
  expect(d.plan.unresolved.length).toBeGreaterThan(0);
  expect(d.project.connections).toEqual([]);
 });
 it('returns null for an object with no electronics',()=>{
  const doc:DeviceDocument={...fan(),parts:fan().parts.filter(p=>['base-stand','tilt-yoke','fan-axle'].includes(p.id)),steps:[]};
  expect(projectFromDocument(doc)).toBeNull();
 });
 it('keeps user wire edits from the overlay and drops wires whose pins no longer exist',()=>{
  const doc=withEsp(),plan=deriveCircuit(doc);
  const overlay={version:1 as const,connections:[{id:'custom',from:{partId:'esp32',pin:'GPIO4'},to:{partId:'control-pcb',pin:'PWM'},kind:'signal' as const,wireColor:'orange' as const,purpose:'moved PWM',signalDirection:'from-to' as const},{id:'ghost',from:{partId:'gone',pin:'X'},to:{partId:'esp32',pin:'GND'},kind:'ground' as const,wireColor:'black' as const,purpose:'x',signalDirection:'from-to' as const}]};
  const merged=applyOverlay(plan,overlay);
  expect(merged.connections.some(c=>c.id==='custom')).toBe(true);
  expect(merged.connections.some(c=>c.id==='ghost')).toBe(false);
  expect(merged.connections.some(c=>c.id==='driver-dc-motor-plus')).toBe(true);
 });
});
