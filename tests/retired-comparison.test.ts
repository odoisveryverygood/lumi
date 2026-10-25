import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {validateDeviceDocument} from '../lib/studio/validation';
import {qualityReportSchema} from '../lib/studio/quality-types';

const document=JSON.parse(readFileSync('docs/sponsor-sprint/2026-10-25-generation-reliability/robot-dog-document.json','utf8'));
const report={version:1,request:'a robot dog',requirements:[{id:'requirement-1',text:'a robot dog'}],status:'needs-attention',initialHash:'a'.repeat(64),finalHash:'a'.repeat(64),rounds:[],createdAt:'2026-10-25',limitations:[]};
describe('projects saved during the retired comparison experiment',()=>{
 it('preserves component geometry and the ordinary review while dropping retired metadata',()=>{
  const input={...document,review:{...report,selection:{candidates:[{id:'candidate-a',selected:true}]}}};
  const restored=validateDeviceDocument(JSON.parse(JSON.stringify(input)));
  expect(restored.parts).toEqual(document.parts);expect(restored.review).toEqual(report);
  expect(input.review.selection.candidates).toHaveLength(1);
 });
 it('continues rejecting other unknown fields and invalid core review data',()=>{
  expect(qualityReportSchema.safeParse({...report,unknownField:true}).success).toBe(false);
  expect(qualityReportSchema.safeParse({...report,status:'invented',selection:{}}).success).toBe(false);
 });
});
