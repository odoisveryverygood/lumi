import fs from 'node:fs/promises';
// Paired comparison of "one pass" versus "full render/measure/repair loop" from a
// Lumi design-evaluation export (lumi-design-evaluation v1). Every trial records
// the candidate before any rendered feedback (trial.initial / trial.before) and the
// candidate retained after the bounded loop (trial.final / trial.after), so the two
// conditions share the same model, request, fixture and starting candidate.
// This script reads recorded oracle verdicts only. It makes no provider calls and
// never re-scores from model prose. Token usage is not recorded in the export, so
// cost is reported as review-call counts and elapsed time.
const file=process.argv[2];if(!file)throw new Error('Usage: node scripts/compare-feedback-loop.mjs evidence.json');
const data=JSON.parse(await fs.readFile(file,'utf8'));if(data.kind!=='lumi-design-evaluation'||data.version!==1||!Array.isArray(data.trials))throw new Error('Not a Lumi design evaluation export.');
const rows=data.trials.map(t=>{
 const rounds=t.final?.review?.rounds??[],corrections=rounds.filter(r=>r.number>0).length,rejected=rounds.filter(r=>r.rejected).length;
 return {id:t.id,mode:t.mode,expected:t.expected,status:t.status,error:t.error??null,onePassOraclePass:t.before?.passed??null,fullLoopOraclePass:t.after?.passed??null,reviewCalls:rounds.length,correctionsApplied:corrections,correctionsRejected:rejected,reviewStatus:t.final?.review?.status??null,elapsedSeconds:Number.isFinite(t.elapsedMs)?Math.round(t.elapsedMs/100)/10:null,extraCallsBeyondOnePass:rounds.length?rounds.length+(t.final?.review?.contract?1:0):0};
});
function summarize(mode){
 const group=rows.filter(r=>r.mode===mode),scored=group.filter(r=>r.onePassOraclePass!==null&&r.fullLoopOraclePass!==null);
 const count=f=>scored.filter(f).length;
 return {trials:group.length,withBothConditionsRecorded:scored.length,onePassPasses:count(r=>r.onePassOraclePass),fullLoopPasses:count(r=>r.fullLoopOraclePass),improvedFailToPass:count(r=>!r.onePassOraclePass&&r.fullLoopOraclePass),regressedPassToFail:count(r=>r.onePassOraclePass&&!r.fullLoopOraclePass),unchanged:count(r=>r.onePassOraclePass===r.fullLoopOraclePass),notScored:group.length-scored.length,totalReviewCalls:group.reduce((n,r)=>n+r.reviewCalls,0),totalCorrectionsApplied:group.reduce((n,r)=>n+r.correctionsApplied,0),totalElapsedSeconds:Math.round(group.reduce((n,r)=>n+(r.elapsedSeconds??0),0)*10)/10};
}
const output={evidenceFile:file,datasetVersion:data.datasetVersion??null,oracleVersion:data.oracleVersion??null,startedAt:data.startedAt,
 conditions:{onePass:'The candidate before any rendered or measured feedback: the seeded fixture itself for seeded repairs, or the single live /api/device edit for fresh edits. Scored by the independent fixture oracle.',fullLoop:'The retained candidate after the bounded render/measure/repair loop (at most two corrections, three reviews). Same request, model, fixture and starting candidate. Scored by the same oracle.',equalCallTextReviewControl:'NOT RUN. No recorded condition gives the same candidate the same extra call budget for text-only self-review. Claims that images specifically caused an improvement are not supported by this export.'},
 byCategory:{seededRepairs:summarize('seeded-repair'),freshLiveEdits:summarize('live-edit'),negativeControls:summarize('negative-control')},
 trials:rows,
 cost:'Token counts are not recorded in this export format. Extra cost of the full loop is shown as review calls (plus one planning call when a contract is recorded) and elapsed seconds per trial, including failed attempts.',
 caveats:['Seeded repairs start from a deliberately broken fixture, so their one-pass failure is by construction and their improvement measures the repair loop only, not a generator error rate.','Fresh live edits are the only category where the one-pass condition is a real model output. Read that row before quoting an improvement.','Negative controls are expected to remain blocked; neither condition should pass the positive oracle, and an unverified draft is the correct outcome.','A trial with an error or incomplete review is retained and counted; a provider failure is neither a successful repair nor a correct refusal.','This export compares two conditions of the same product. It cannot establish that only Argon can perform the task or that another model would do worse.']};
console.log(JSON.stringify(output,null,2));
