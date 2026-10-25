import {readFileSync,writeFileSync} from 'node:fs';
import {validateDeviceDocument} from '../../../lib/studio/validation';
import {qualityFingerprint,sha256,stableEvidenceJson} from '../../../lib/studio/quality-fingerprint';
import {verifyMotion,motionPreservationIssues} from '../../../lib/studio/motion-verification';
import {canonicalCatalogGeometry} from '../../../lib/studio/catalog';
const input=process.env.LUMI_REHEARSAL_EXPORT!;
const document=validateDeviceDocument(JSON.parse(readFileSync(input,'utf8')).document),report=document.review!;
function assert(ok:unknown,message:string):asserts ok{if(!ok)throw new Error(message);}
assert(report.status==='reviewed','Review did not pass');
assert(await qualityFingerprint(document)===report.finalHash,'Final document hash differs');
const baseline=validateDeviceDocument(JSON.parse(report.baselineProject!));
assert(motionPreservationIssues(baseline,document,report.motionMechanismId!).length===0,'Protected source geometry changed');
assert(canonicalCatalogGeometry(document.parts.find(p=>p.id==='axle-bearing')!),'Canonical bearing changed');
let images=0;
for(const round of report.rounds){
 assert(round.model==='gemini-4-argon','Unexpected provider model');
 const candidate=validateDeviceDocument(JSON.parse(round.motionProject!));
 assert(await qualityFingerprint(candidate)===round.documentHash,'Candidate fingerprint mismatch');
 const result=verifyMotion(candidate,candidate.mechanisms!.find(m=>m.id===report.motionMechanismId)!);
 for(const finding of result.findings)finding.frameRefs=round.motion!.frames.filter(f=>f.angleDeg===finding.angleDeg).map(f=>f.frameId);
 assert(stableEvidenceJson(result)===stableEvidenceJson(round.motion!.result),'Recorded motion differs from independently recomputed result');
 for(const frame of [...round.frames,...round.motion!.frames]){assert(await sha256(Buffer.from(frame.data,'base64'))===frame.imageHash,'Image hash mismatch');images++;}
}
assert(report.rounds[0].motion!.result.status==='fail','Original did not fail');
const retained=report.rounds.findLast(r=>r.documentHash===report.finalHash)!;
assert(retained.motion!.result.status==='pass','Retained motion did not pass');
const summary={revision:'3f26257be3237356787719b988ef28930ed888b9',status:report.status,createdAt:report.createdAt,durationMs:report.durationMs,rounds:report.rounds.length,models:report.rounds.map(r=>r.model),originalYokeMm:baseline.parts.find(p=>p.id==='tilt-yoke')!.position[1],retainedYokeMm:document.parts.find(p=>p.id==='tilt-yoke')!.position[1],poses:retained.motion!.result.checkedAngles.length,minimumClearanceMm:retained.motion!.result.minimumClearanceMm,shapesAndSourcesPreserved:true,allRoundMeasurementsRecomputed:true,verifiedImageCount:images,initialHash:report.initialHash,finalHash:report.finalHash,retainedRenderer:retained.motion!.frames.map(f=>f.renderer)};
console.log(JSON.stringify(summary,null,2));
writeFileSync(process.env.LUMI_REHEARSAL_SUMMARY!,JSON.stringify(summary,null,2)+'\n');
