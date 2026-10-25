'use client';
import {useState} from 'react';
import type {QualityReport,QualityRound} from '@/lib/studio/quality-types';
import type {MotionFinding} from '@/lib/studio/motion-types';

export default function MotionReviewEvidence({rounds,report,onPose}:{rounds:QualityRound[];report?:QualityReport;onPose?:(finding:MotionFinding,round:number)=>void}){
 const [attempt,setAttempt]=useState<number|null>(null),available=rounds.filter(r=>r.motion),retained=available.findLast(r=>r.documentHash===report?.finalHash),round=(attempt===null?retained:available.find(r=>r.number===attempt))??available.at(-1);
 if(!round?.motion?.result.contract)return report?.unverifiedMotion?<section className="morf-motion-evidence" aria-label="Sampled motion evidence"><h3>Sampled motion · unverified</h3><p>No rendered clearance claim was made.</p>{report.unverifiedMotion.findings.map((f,i)=><p key={i}>{f.detail}</p>)}{report.unverifiedMotion.limitations.map(t=><p key={t}>{t}</p>)}</section>:null;
 const {result,frames}=round.motion,first=available[0],findings=result.findings.filter(f=>f.status!=='pass'),shown=findings.length?findings:result.findings.slice(0,1);
 return <section className="morf-motion-evidence" aria-label="Sampled motion evidence">
  <h3>Sampled motion · {result.status}</h3>
  <p>{result.contract!.minDeg}° to {result.contract!.maxDeg}° relative to rest · required clearance {result.contract!.clearanceMm} mm</p>
  <p>{result.checkedAngles.length} checked poses: {result.checkedAngles.join('°, ')}°. Between-sample motion remains unverified.</p>
  <label>Inspect attempt <select aria-label="Motion evidence attempt" value={round.number} onChange={e=>setAttempt(Number(e.target.value))}>{available.map(r=><option key={r.number} value={r.number}>{r.number===0?'Original':`Correction ${r.number}`}{r.rejected?' · rejected':''}{r===retained?' · retained':''}</option>)}</select></label>
  <p>Minimum sampled clearance bound: {result.minimumClearanceMm===undefined?'unknown':`${result.minimumClearanceMm.toFixed(3)} mm`}. Zero records contact/overlap, not penetration depth.</p>
  {shown.slice(0,12).map((f,i)=><article key={i} data-status={f.status}><strong>{f.status} at {f.angleDeg}°</strong><p>{f.partIds.join(' / ')} · {f.clearanceMm===undefined?'unknown':`${f.clearanceMm.toFixed(3)} mm`} · {f.measurement}</p><p>{f.detail}</p><button className="ds-btn" onClick={()=>onPose?.(f,round.number)}>Show this pose</button></article>)}
  {findings.length>12&&<p>{findings.length-12} additional findings are retained in the exported report.</p>}
  <div className="morf-quality-images">{frames.map(frame=><figure key={frame.frameId}><img src={`data:image/jpeg;base64,${frame.data}`} alt={`Actual motion geometry at ${frame.angleDeg} degrees, attempt ${round.number}`}/><figcaption>{frame.angleDeg}° · {frame.renderer}</figcaption></figure>)}</div>
  {first&&retained&&first!==retained&&<details><summary>Original / retained witness</summary><div className="morf-quality-images">{[first,retained].map(r=><figure key={r.number}><img src={`data:image/jpeg;base64,${r.motion!.frames[0].data}`} alt={`${r===first?'Original':'Retained'} motion witness`}/><figcaption>{r===first?'Original':'Retained'} · {r.motion!.frames[0].angleDeg}°</figcaption></figure>)}</div></details>}
  <details><summary>Frozen joint, allowed edits and contact exclusions</summary><p>{result.contract!.provenance}</p><p>Pivot in {result.contract!.pivotPartId}: {result.contract!.pivot.join(', ')} mm; axis {result.contract!.axis.join(', ')}. Moving subtree: {result.contract!.movingRootId}.</p>{result.contract!.allowedEdits.map(e=><p key={e.partId}>{e.partId}: position [{e.minPosition.join(', ')}] to [{e.maxPosition.join(', ')}] mm. Original rotation and shapes preserved.</p>)}{result.contract!.contacts.map((c,i)=><p key={i}>Excluded pair: {c.partIds.join(' / ')}. {c.reason}</p>)}{result.limitations.map(t=><p key={t}>{t}</p>)}</details>
 </section>;
}
