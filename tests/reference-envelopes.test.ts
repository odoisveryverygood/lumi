import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {validateDeviceDocument} from '../lib/studio/validation';
import {measuredQualityChecks} from '../lib/studio/quality-engine';
describe('bundled source-study data consistency',()=>{
 it('opens the Corne source reference with procedural envelopes consistent with its rendered geometry',()=>{
  const document=validateDeviceDocument(JSON.parse(readFileSync('public/assemblies/corne/document.json','utf8')));
  expect(measuredQualityChecks(document).filter(check=>check.status==='fail')).toEqual([]);
  expect(document.parts.find(p=>p.id==='keyboard-case-base')!.size).toEqual([138.34996,11.1,97.62154]);
 });
});
