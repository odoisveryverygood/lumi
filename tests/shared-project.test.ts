import {describe,it,expect} from 'vitest';
import {createMotionFan} from '../lib/studio/motion-fan';
import {STUDIO_KEY,HISTORY_KEY,HISTORY_LIMIT,readStudioRecord,writeStudioDocument,recordChange,undoShared,redoShared,readHistory,withOverlay,overlayOf} from '../lib/studio/shared-project';
import {projectFromDocument} from '../lib/studio/circuit-derive';
import {catalogJsonReplacer} from '../lib/studio/catalog';
function memoryStorage():Storage{const m=new Map<string,string>();return {get length(){return m.size;},clear:()=>m.clear(),getItem:k=>m.get(k)??null,key:i=>[...m.keys()][i]??null,removeItem:k=>{m.delete(k);},setItem:(k,v)=>{m.set(k,String(v));}};}
describe('Studio and Circuits share one project and one history',()=>{
 it('Circuits reads the exact object Studio saved, not an example',()=>{
  const storage=memoryStorage(),doc=createMotionFan();
  storage.setItem(STUDIO_KEY,JSON.stringify({document:doc,conversation:[]},catalogJsonReplacer));
  const record=readStudioRecord(storage)!;
  expect(record.document.id).toBe(doc.id);expect(record.document.name).toBe('Adjustable fan · seeded tilt study');
  const project=projectFromDocument(record.document)!.project;
  expect(project.name).toBe(doc.name);expect(project.id).toBe(doc.id);
  expect(project.parts.some(p=>p.id==='control-pcb')).toBe(true);
 });
 it('a write from Circuits is what Studio reads back, and the conversation is kept',()=>{
  const storage=memoryStorage(),doc=createMotionFan();
  storage.setItem(STUDIO_KEY,JSON.stringify({document:doc,conversation:[{role:'user',text:'hi'}]},catalogJsonReplacer));
  const renamed={...doc,parts:doc.parts.map(p=>p.id==='speed-knob'?{...p,name:'Big speed knob'}:p)};
  writeStudioDocument(renamed,storage);
  const record=readStudioRecord(storage)!;
  expect(record.document.parts.find(p=>p.id==='speed-knob')!.name).toBe('Big speed knob');
  expect(record.conversation).toEqual([{role:'user',text:'hi'}]);
 });
 it('undo and redo walk one shared history regardless of which tab recorded the change',()=>{
  const storage=memoryStorage(),a=createMotionFan(),b={...a,name:'Fan v2'},c={...a,name:'Fan v3'};
  recordChange(a,storage);recordChange(b,storage);
  expect(readHistory(storage).past).toHaveLength(2);
  const undone=undoShared(c,storage)!;expect(undone.name).toBe('Fan v2');
  const again=undoShared(undone,storage)!;expect(again.name).toBe(a.name);
  expect(undoShared(again,storage)).toBeNull();
  expect(redoShared(again,storage)!.name).toBe('Fan v2');
  expect(redoShared(undone,storage)!.name).toBe('Fan v3');
  expect(readHistory(storage).future).toEqual([]);
 });
 it('bounds the history and never records imported scenes',()=>{
  const storage=memoryStorage(),doc=createMotionFan();
  for(let i=0;i<HISTORY_LIMIT+5;i++)recordChange({...doc,name:`v${i}`},storage);
  expect(readHistory(storage).past).toHaveLength(HISTORY_LIMIT);
  recordChange({...doc,source:'import'},storage);
  expect(JSON.parse(storage.getItem(HISTORY_KEY)!).past.at(-1)).toContain(`v${HISTORY_LIMIT+4}`);
 });
 it('keeps Circuits wire edits on the document as an overlay',()=>{
  const doc=createMotionFan(),overlay={version:1 as const,code:{filename:'fan.ino',source:'void setup(){} void loop(){}',libraries:[]}};
  const next=withOverlay(doc,overlay);expect(overlayOf(next)).toEqual(overlay);
  expect(overlayOf(withOverlay(next,undefined))).toBeUndefined();
  expect(projectFromDocument(next)!.project.code.source).toBe('void setup(){} void loop(){}');
 });
});
