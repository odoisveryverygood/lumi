import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {createGenerationProgress,completedParts} from '../lib/studio/generation-progress';
import * as generatedPart from '../lib/studio/generated-part';

const part={id:'frame',name:'Frame "bracket"',description:'Braces } ] and a backslash \\ in text.',category:'Structure',color:'#444444',position:[0,0,0],explode:[0,10,0],solids:[['repeat',4,10,0,0,['box',0,0,0,4,4,4]]]};
const text=JSON.stringify({document:{parts:[part,{...part,id:'board',name:'Board'}],relationships:[],steps:[]}});
afterEach(()=>vi.restoreAllMocks());
describe('incremental component progress',()=>{
 it.each([1,7,193,512])('preserves identical geometry with %s-character stream chunks',chunk=>{
  const reader=createGenerationProgress();let result;
  for(let end=chunk;end<text.length;end+=chunk)result=reader.read(text.slice(0,end));
  result=reader.read(text);expect(result.parts).toEqual(completedParts(text));expect(result.partsComplete).toBe(true);
 });
 it('expands complete components once, retaining their identity as later metadata arrives',()=>{
  const expand=vi.spyOn(generatedPart,'expandGeneratedPart'),reader=createGenerationProgress();
  const prefix=text.slice(0,text.indexOf('"relationships"'));
  const first=reader.read(prefix);expect(first.parts).toHaveLength(2);expect(expand).toHaveBeenCalledTimes(2);
  const final=reader.read(text);reader.read(text);
  expect(expand).toHaveBeenCalledTimes(2);expect(final.parts[0]).toBe(first.parts[0]);
 });
 it('resets correctly for shortened or replaced output',()=>{
  const reader=createGenerationProgress();reader.read(text);
  expect(reader.read('{"document":').parts).toEqual([]);
  expect(reader.read(text.replace('Frame','Other')).parts[0].name).toBe('Other "bracket"');
 });
 it('never exposes an incomplete component, invalid geometry or a duplicate ID',()=>{
  const reader=createGenerationProgress();expect(reader.read('{"document":{"parts":[{"id":"partial"').parts).toEqual([]);
  const result=reader.read(JSON.stringify({parts:[part,part,{...part,id:'bad',solids:[['box',0,0,0,-1,2,3]]}]}));
  expect(result.parts.map(p=>p.id)).toEqual(['frame']);
 });
 it('retains the exact real robot-dog geometry through arbitrary chunk boundaries',()=>{
  const source=readFileSync('docs/sponsor-sprint/2026-10-25-generation-reliability/robot-dog-document.json','utf8'),reader=createGenerationProgress();
  for(let end=137;end<source.length;end+=137)reader.read(source.slice(0,end));
  const result=reader.read(source);expect(result.parts).toEqual(completedParts(source));expect(result.parts).toHaveLength(18);expect(result.parts.reduce((n,p)=>n+p.solids.length,0)).toBe(234);
 });
});
