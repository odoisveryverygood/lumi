import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {validateDeviceDocument} from '../lib/studio/validation';
import {evaluateDesignContract,validateDesignContract} from '../lib/studio/design-constraints';
import {qualityFingerprint,sha256} from '../lib/studio/quality-fingerprint';
const path=process.env.LUMI_PROJECT_EVIDENCE;
describe.skipIf(!path)('recompute a saved Morf design project (no provider requests)',()=>{
 it('recomputes its recorded geometry checks against the embedded original project',async()=>{
  const raw=JSON.parse(readFileSync(path!,'utf8')),document=validateDeviceDocument(raw.document??raw),report=document.review;
  expect(report?.contract,'This export needs a measured design contract.').toBeTruthy();expect(report?.baselineProject,'This export needs its original baseline snapshot.').toBeTruthy();
  const baseline=validateDeviceDocument(JSON.parse(report!.baselineProject!)),contract=await validateDesignContract(report!.contract,report!.request,baseline,document);
  expect(await qualityFingerprint(baseline)).toBe(contract.baselineHash);expect(await qualityFingerprint(document)).toBe(report!.finalHash);
  const retained=report!.rounds.findLast(round=>round.documentHash===report!.finalHash);expect(retained).toBeTruthy();
  expect(evaluateDesignContract(contract,baseline,document)).toEqual(retained!.checks.filter(c=>c.category==='design'));
  expect(evaluateDesignContract(contract,baseline,baseline)).toEqual(report!.baselineChecks);
  const originalFrames=report!.rounds[0].frames;
  for(const round of report!.rounds){expect(round.contractHash).toBe(contract.hash);for(const frame of round.frames){expect(await sha256(Buffer.from(frame.data,'base64'))).toBe(frame.imageHash);expect(frame.documentHash).toBe(round.documentHash);if(originalFrames.find(f=>f.view===frame.view)?.framing)expect(frame.framing).toEqual(originalFrames.find(f=>f.view===frame.view)!.framing);}}
 });
});
