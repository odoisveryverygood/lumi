import {describe,it,expect} from 'vitest';
import {morfShape,builtPartIds,morfShapeLabel} from '../lib/studio/morf-shape';
import {desktopComputer} from '../lib/studio/desktop';
import type {DeviceDocument} from '../lib/studio/types';
const doc=desktopComputer as DeviceDocument;
describe('Morf takes the shape of the object on screen',()=>{
 it('is an unformed blob with no object',()=>{
  const shape=morfShape(null);
  expect(shape).toMatchObject({phase:'blob',progress:0,total:0,built:0,cells:[]});
  expect(morfShapeLabel(shape)).toBe('unformed');
 });
 it('forms completely for an opened object, one cell per kept part inside the view box',()=>{
  const shape=morfShape(doc);
  expect(shape.phase).toBe('formed');expect(shape.progress).toBe(1);expect(shape.built).toBe(doc.parts.length);
  expect(shape.cells.length).toBe(Math.min(40,doc.parts.length));
  for(const c of shape.cells){expect(c.x).toBeGreaterThanOrEqual(0);expect(c.y).toBeGreaterThanOrEqual(0);expect(c.x+c.w).toBeLessThanOrEqual(100.1);expect(c.y+c.h).toBeLessThanOrEqual(100.1);expect(c.w).toBeGreaterThan(0);}
  expect(new Set(shape.cells.map(c=>c.id)).size).toBe(shape.cells.length);
  expect(morfShapeLabel(shape)).toBe(`morphed · ${doc.parts.length} parts`);
 });
 it('follows the build guide: nothing before the first step, everything after the last',()=>{
  expect(builtPartIds(doc,{buildStep:0})).toEqual([]);
  const first=builtPartIds(doc,{buildStep:1});
  expect(first.length).toBeGreaterThan(0);expect(first.every(id=>doc.steps[0].partIds.includes(id))).toBe(true);
  const mid=morfShape(doc,{buildStep:Math.ceil(doc.steps.length/2)});
  expect(mid.phase).toBe('forming');expect(mid.progress).toBeGreaterThan(0);expect(mid.progress).toBeLessThan(1);
  expect(morfShape(doc,{buildStep:doc.steps.length}).phase).toBe('formed');
 });
 it('grows while parts stream in during generation and never claims completion before the response ends',()=>{
  const names=doc.parts.slice(0,3).map(p=>p.name);
  const streaming=morfShape(doc,{generatingPartNames:names,busy:true});
  expect(streaming.built).toBe(3);expect(streaming.phase).toBe('forming');expect(streaming.progress).toBeLessThanOrEqual(.92);
  const more=morfShape(doc,{generatingPartNames:doc.parts.slice(0,8).map(p=>p.name),busy:true});
  expect(more.progress).toBeGreaterThan(streaming.progress);
  expect(morfShape(doc,{generatingPartNames:names,busy:false}).phase).toBe('formed');
 });
 it('draws back parts before front parts',()=>{
  const back=morfShape({...doc,parts:[{...doc.parts[0],id:'back',position:[0,0,-50]},{...doc.parts[0],id:'front',position:[0,0,50]}]});
  expect(back.cells.map(c=>c.id)).toEqual(['back','front']);
 });
});
