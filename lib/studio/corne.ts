import type { DeviceDocument, Vec3 } from './types';
import { mechanicalKeyboard } from './keyboard';
import { validateDeviceDocument } from './validation';

/** Source geometry is lazy-loaded. The selected switch's internals remain a labeled illustration. */
export function enrichCorneReference(raw:unknown):DeviceDocument {
  const doc=validateDeviceDocument(raw),key=doc.parts.find(p=>p.id==='key-esc')!;
  const source=mechanicalKeyboard.parts.find(p=>p.id==='switch-lower-housing')!;
  const shift:Vec3=[key.position[0]-source.position[0],key.position[1]-mechanicalKeyboard.parts.find(p=>p.id==='key-esc')!.position[1],key.position[2]-source.position[2]];
  const ids=['switch-lower-housing','switch-upper-housing','switch-stem','switch-spring','switch-contact-fixed','switch-contact-moving'];
  for(const prototype of mechanicalKeyboard.parts.filter(p=>ids.includes(p.id))){
    const part=structuredClone(prototype);part.position=part.position.map((n,i)=>n+shift[i]) as Vec3;part.assemblyId='source-switches';
    part.specs={...part.specs,'Geometry basis':'Educational switch internals; not source Corne CAD'};
    part.connections=part.connections.filter(c=>doc.parts.some(p=>p.id===c.partId)||ids.includes(c.partId));
    doc.parts.push(part);doc.assemblies!.find(a=>a.id==='source-switches')!.partIds.push(part.id);
  }
  const mechanism=structuredClone(mechanicalKeyboard.mechanisms![0]);mechanism.id='corne-keypress';mechanism.name='A key becomes a signal';
  mechanism.description='Source key placement, with an educational illustration of the switch mechanism. Firmware and contact dynamics are not simulated.';
  mechanism.stages=mechanism.stages.map(s=>({...s,title:s.title.replace('Esc','E'),description:s.description.replaceAll('Esc','E')}));
  doc.mechanisms=[mechanism];doc.capabilities=[...(doc.capabilities||[]),'switch-mechanism'];
  doc.relationships!.push({id:'corne-switch-key',from:'switch-stem',to:'key-esc',type:'mechanical',description:'Illustrated stem coupling.'},{id:'corne-switch-matrix',from:'switch-contact-moving',to:'keyboard-pcb',type:'electrical',description:'Illustrated contact closure in the source switch matrix.'});
  return validateDeviceDocument(doc);
}
let cached:Promise<DeviceDocument>|undefined;
export function loadCorneReference():Promise<DeviceDocument>{
  if(!cached)cached=fetch('/assemblies/corne/document.json').then(async response=>{if(!response.ok)throw new Error('The source Corne assembly could not be loaded.');return enrichCorneReference(await response.json());}).catch(error=>{cached=undefined;throw error;});
  return cached.then(value=>structuredClone(value));
}
