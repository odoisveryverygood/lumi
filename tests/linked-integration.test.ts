import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import MorfFace from '../components/studio/MorfFace';
import {applyProjectToDocument} from '../components/useLinkedEditor';
import {desktopComputer} from '../lib/studio/desktop';
import {createMotionFan} from '../lib/studio/motion-fan';
import {projectFromDocument} from '../lib/studio/circuit-derive';
import {validateDeviceDocument} from '../lib/studio/validation';
import {STUDIO_KEY,readStudioRecord,writeStudioDocument} from '../lib/studio/shared-project';

describe('modern Morf with linked circuits',()=>{
 it('keeps unrecognized Studio electronics when Circuits applies an ordinary edit',()=>{
  const original=structuredClone(desktopComputer),derived=projectFromDocument(original)!;
  expect(derived.plan.unresolved.length).toBeGreaterThan(0);
  const changed={...derived.project,name:'My desktop'};
  const result=validateDeviceDocument(applyProjectToDocument(original,derived,changed));
  expect(result.name).toBe('My desktop');expect(result.parts).toEqual(original.parts);
  expect(result.mechanisms).toEqual(original.mechanisms);
 });
 it('changes a circuit placement without rewriting its Studio geometry or other parts',()=>{
  const original=createMotionFan(),derived=projectFromDocument(original)!;
  const changed={...derived.project,parts:derived.project.parts.map(p=>p.id==='speed-knob'?{...p,assembledPosition:[-12,20,15] as [number,number,number]}:p)};
  const result=validateDeviceDocument(applyProjectToDocument(original,derived,changed));
  const target=result.parts.find(p=>p.id==='speed-knob')!;
  expect(target.position).toEqual([-12,20,15]);
  expect(target.solids).toEqual(original.parts.find(p=>p.id==='speed-knob')!.solids);
  expect(result.parts.filter(p=>p.id!=='speed-knob')).toEqual(original.parts.filter(p=>p.id!=='speed-knob'));
 });
 it('keeps firmware edits attached to the same full Studio object',()=>{
  const original=createMotionFan(),derived=projectFromDocument(original)!;
  const code={...derived.project.code,source:'void setup(){} void loop(){}'};
  const result=validateDeviceDocument(applyProjectToDocument(original,derived,{...derived.project,code}));
  expect(result.parts).toEqual(original.parts);expect(result.id).toBe(original.id);
  expect(projectFromDocument(result)!.project.code.source).toBe(code.source);
 });
 it('preserves same-object asset metadata and conversations when Circuits saves',()=>{
  const data=new Map<string,string>(),storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};
  const original=createMotionFan();storage.setItem(STUDIO_KEY,JSON.stringify({document:original,conversation:[{role:'user',text:'Keep this discussion'}],asset:'retained-asset-metadata',customField:{camera:'top'}}));
  writeStudioDocument({...original,name:'Renamed fan'},storage);
  const saved=JSON.parse(storage.getItem(STUDIO_KEY)!);
  expect(saved.asset).toBe('retained-asset-metadata');expect(saved.customField).toEqual({camera:'top'});
  expect(readStudioRecord(storage)!.conversation).toHaveLength(1);
  writeStudioDocument({...original,id:'different-object'},storage);
  const next=JSON.parse(storage.getItem(STUDIO_KEY)!);expect(next.asset).toBeUndefined();expect(next.conversation).toEqual([]);
 });
 it('renders the original mechanical cube in every activity state',()=>{
  for(const mode of ['idle','thinking','scanning','pointing','explaining','success','alert'] as const){
   const html=renderToStaticMarkup(createElement(MorfFace,{mode}));
   expect(html).toContain('morf-cube');expect(html).toContain('morf-optic');
   expect(html.match(/class="morf-plate /g)).toHaveLength(6);expect(html).not.toContain('morf-blob');
  }
 });
});
