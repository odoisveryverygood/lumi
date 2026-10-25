import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import MotionReviewEvidence from '../components/studio/MotionReviewEvidence';
import {validateDeviceDocument} from '../lib/studio/validation';
import {qualityFingerprint,sha256,stableEvidenceJson} from '../lib/studio/quality-fingerprint';
import {motionPreservationIssues,verifyMotion} from '../lib/studio/motion-verification';
import {canonicalCatalogGeometry} from '../lib/studio/catalog';

const document=validateDeviceDocument(JSON.parse(readFileSync('docs/team-integration/evidence/live-merged-fan.part.json','utf8')).document);
const report=document.review!;
describe('exported live team integration evidence',()=>{
 it('recomputes the retained motion result and verifies image hashes and preserved geometry',async()=>{
  expect(report.status).toBe('reviewed');expect(report.rounds).toHaveLength(2);
  expect(await qualityFingerprint(document)).toBe(report.finalHash);
  const baseline=validateDeviceDocument(JSON.parse(report.baselineProject!));
  expect(baseline.parts.find(p=>p.id==='tilt-yoke')!.position[1]).toBe(48);
  expect(document.parts.find(p=>p.id==='tilt-yoke')!.position[1]).toBe(78);
  expect(motionPreservationIssues(baseline,document,report.motionMechanismId!)).toEqual([]);
  expect(canonicalCatalogGeometry(document.parts.find(p=>p.id==='axle-bearing')!)).toBe(true);
  for(const round of report.rounds){
   expect(round.model).toBe('gemini-4-argon');
   const candidate=validateDeviceDocument(JSON.parse(round.motionProject!));
   expect(await qualityFingerprint(candidate)).toBe(round.documentHash);
   const result=verifyMotion(candidate,candidate.mechanisms!.find(m=>m.id===report.motionMechanismId)!);
   for(const finding of result.findings)finding.frameRefs=round.motion!.frames.filter(f=>f.angleDeg===finding.angleDeg).map(f=>f.frameId);
   expect(stableEvidenceJson(result)).toBe(stableEvidenceJson(round.motion!.result));
   for(const frame of [...round.frames,...round.motion!.frames])expect(await sha256(Buffer.from(frame.data,'base64'))).toBe(frame.imageHash);
  }
  expect(report.rounds[0].motion!.result.status).toBe('fail');
  expect(report.rounds[1].motion!.result.status).toBe('pass');
  expect(report.rounds[1].motion!.result.checkedAngles).toHaveLength(19);
 });
 it('opens the retained correction while keeping the original available for comparison',()=>{
  const html=renderToStaticMarkup(createElement(MotionReviewEvidence,{rounds:report.rounds,report}));
  expect(html).toContain('Sampled motion · pass');
  expect(html).toMatch(/<option value="1" selected="">Correction 1 · retained/);
  expect(html).toContain('<option value="0">Original</option>');
 });
});
