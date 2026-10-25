import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const file=process.argv[2];if(!file)throw new Error('Usage: node scripts/summarize-design-evaluation.mjs evidence.json');
const data=JSON.parse(await fs.readFile(file,'utf8'));if(data.kind!=='lumi-design-evaluation'||data.version!==1||!Array.isArray(data.trials))throw new Error('Not a Lumi design evaluation export.');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)]));return value;}
function fingerprint(document){const {review,...body}=document;return digest(JSON.stringify(stable(body)));}
const seen=new Set();let reviews=0,images=0,lockedCameraReviews=0;
for(const trial of data.trials){
 if(seen.has(trial.id))throw new Error('Repeated trial ID.');seen.add(trial.id);
 if(!data.taskDefinitions.some(t=>t.id===trial.taskId))throw new Error('Missing frozen task definition.');
 const report=trial.final?.review;if(!report)continue;
 if(fingerprint(trial.final)!==report.finalHash)throw new Error(`Retained document differs from its reviewed fingerprint: ${trial.id}`);
 for(const round of report.rounds){reviews++;
  if(round.frames.every(f=>!!f.framing)){for(const f of round.frames){if(JSON.stringify(f.framing)!==JSON.stringify(report.rounds[0].frames.find(first=>first.view===f.view)?.framing))throw new Error('Comparison camera framing changed.');}lockedCameraReviews++;}
  if(report.contract&&round.contractHash!==report.contract.hash)throw new Error('A review changed its design contract.');
  if(round.frames.length!==3||new Set(round.frames.map(f=>f.view)).size!==3)throw new Error('Three actual views are required.');
  for(const frame of round.frames){if(frame.documentHash!==round.documentHash||digest(Buffer.from(frame.data,'base64'))!==frame.imageHash)throw new Error('Recorded image integrity failed.');images++;}
 }
}
function group(mode){const rows=data.trials.filter(t=>t.mode===mode),completed=rows.filter(t=>['passed','failed'].includes(t.status)),times=completed.map(t=>t.elapsedMs).filter(Number.isFinite).sort((a,b)=>a-b);return {planned:rows.length,completed:completed.length,passed:completed.filter(t=>t.status==='passed').length,failed:completed.filter(t=>t.status==='failed').length,cancelled:rows.filter(t=>t.status==='cancelled').length,unrun:rows.filter(t=>t.status==='queued').length,firstAttemptOraclePasses:completed.filter(t=>t.before?.passed).length,retainedOraclePasses:completed.filter(t=>t.after?.passed).length,medianElapsedSeconds:times.length?Math.round((times[Math.floor((times.length-1)/2)]+times[Math.ceil((times.length-1)/2)])/2/100)/10:null,maximumElapsedSeconds:times.length?Math.round(times.at(-1)/100)/10:null};}
console.log(JSON.stringify({evidenceFile:file,startedAt:data.startedAt,configuredTrials:data.configuration.plannedTrials,recordedReviews:reviews,verifiedImageHashes:images,lockedCameraReviews,seededRepairs:group('seeded-repair'),freshLiveEdits:group('live-edit'),negativeControls:group('negative-control'),failures:data.trials.filter(t=>t.status==='failed').map(t=>({id:t.id,error:t.error,failedOracleChecks:t.after?.checks.filter(c=>!c.passed).map(c=>c.name),reviewStatus:t.final?.review?.status,reviewError:t.final?.review?.error})),humanReviewed:0,scope:'Software evidence on controlled authored assemblies with sourced radio geometry. Seeded faults are not fresh-generation errors. The fixed-task oracle must be recomputed with tests/evaluation-evidence.test.ts. No physical validation, human usefulness result or provider authentication is claimed.'},null,2));
