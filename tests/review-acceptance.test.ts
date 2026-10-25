import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {canApplyReviewDraft} from '../lib/studio/review-acceptance';
import {qualityReportSchema} from '../lib/studio/quality-types';
const load=(path:string)=>qualityReportSchema.parse(JSON.parse(readFileSync(path,'utf8')).document.review);
describe('explicit draft acceptance after team integration',()=>{
 it('blocks a provider failure before any review while leaving reviewed static drafts usable',()=>{
  const report=load('docs/sponsor-sprint/2026-10-24-quality/reviewed-sensor.part.json');
  expect(canApplyReviewDraft(report)).toBe(true);
  expect(canApplyReviewDraft({...report,status:'incomplete',rounds:[]})).toBe(false);
  expect(canApplyReviewDraft(undefined)).toBe(false);
 });
 it('accepts the verified motion export but blocks failed or measurement-only attempts',()=>{
  const passed=load('docs/motion/evidence/browser-reviewed.part.json');
  const failed=load('docs/motion/evidence/attempt-2-review-error.part.json');
  expect(canApplyReviewDraft(passed,true)).toBe(true);expect(canApplyReviewDraft(failed,true)).toBe(false);
  expect(canApplyReviewDraft({...passed,status:'needs-attention'},true)).toBe(false);
  expect(canApplyReviewDraft({...passed,rounds:passed.rounds.map(r=>({...r,model:'local-geometry'}))},true)).toBe(false);
 });
});
