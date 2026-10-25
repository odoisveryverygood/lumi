import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {designTasks,evaluationAssembly,evaluateTaskOutcome} from '../lib/studio/evaluation-tasks';
import {validateDeviceDocument} from '../lib/studio/validation';
import {qualityFingerprint,sha256} from '../lib/studio/quality-fingerprint';
import {validateDesignContract} from '../lib/studio/design-constraints';
const evidence=process.env.LUMI_DESIGN_EVIDENCE;
describe.skipIf(!evidence)('recompute saved real design-evaluation evidence (no provider calls)',()=>{
 it('recomputes the fixed task acceptance and validates each actual recorded candidate/image association',async()=>{
  const data=JSON.parse(readFileSync(evidence!,'utf8'));expect(data.kind).toBe('lumi-design-evaluation');const definitions=designTasks.filter(t=>data.configuration.selectedTasks.includes(t.id));expect(data.taskDefinitions).toEqual(definitions);expect(data.trials).toHaveLength(definitions.length*data.configuration.repeats);
  for(const trial of data.trials){const task=designTasks.find(t=>t.id===trial.taskId)!;if(trial.baseline){const baseline=validateDeviceDocument(trial.baseline);expect(await qualityFingerprint(baseline)).toBe(await qualityFingerprint(evaluationAssembly(task)));if(trial.initial)expect(evaluateTaskOutcome(task,baseline,validateDeviceDocument(trial.initial),data.oracleVersion??1)).toEqual(trial.before);
   if(trial.final){const final=validateDeviceDocument(trial.final);expect(evaluateTaskOutcome(task,baseline,final,data.oracleVersion??1)).toEqual(trial.after);expect(await qualityFingerprint(final)).toBe(final.review!.finalHash);if(final.review?.baselineProject)expect(await qualityFingerprint(validateDeviceDocument(JSON.parse(final.review.baselineProject)))).toBe(await qualityFingerprint(baseline));if(final.review?.contract)await validateDesignContract(final.review.contract,task.request,baseline,final);for(const round of final.review!.rounds){expect(round.model).toBe('gemini-4-argon');for(const frame of round.frames){expect(await sha256(Buffer.from(frame.data,'base64'))).toBe(frame.imageHash);expect(frame.documentHash).toBe(round.documentHash);}}}
  }expect(trial.humanRating).toBeNull();expect(trial.humanNotes).toBeNull();}
 });
});
