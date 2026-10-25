'use client';
import {Focus} from 'lucide-react';
import type {MeasuredCheck,QualityRound} from '@/lib/studio/quality-types';
import type {DesignContract} from '@/lib/studio/constraint-types';
const value=(check?:MeasuredCheck)=>!check?'—':check.value!==undefined?`${check.value}${check.unit==='mm'?' mm':check.unit?` ${check.unit}`:''}`:check.status==='pass'?'Pass':check.status==='fail'?'Fail':'Unverified';
export default function MeasuredDesignChecks({contract,baseline,first,current,onFocus}:{contract?:DesignContract;baseline?:MeasuredCheck[];first?:QualityRound;current?:QualityRound;onFocus:(ids:string[])=>void}){
 if(!contract)return null;
 const checks=current?.checks.filter(c=>c.category==='design')??baseline??[];
 return <section className="lumi-design-checks" aria-label="Measured design checks"><header><span>MEASURED DESIGN CHECKS</span><small>{checks.filter(c=>c.status==='pass').length}/{checks.length} supported</small></header><p>Argon interprets your request. Geometry checks compute the results below. The requirements stay fixed across revisions.</p>{!checks.length&&<p>No supported numerical design constraint was specified. The rendered views are reviewed separately.</p>}
  {checks.map(check=><article key={check.id} data-status={check.status}><div><strong>{check.title}</strong><span>{check.status==='pass'?'Passed':check.status==='fail'?'Needs correction':'Unverified'}</span>{!!check.partIds.length&&<button aria-label={`Show measured check: ${check.title}`} onClick={()=>onFocus(check.partIds)}><Focus size={13}/></button>}</div><dl>{[['Original',baseline?.find(c=>c.id===check.id)],['First attempt',first?.checks.find(c=>c.id===check.id)],['Retained',check]].map(([label,c])=><div key={label as string}><dt>{label as string}</dt><dd>{value(c as MeasuredCheck|undefined)}</dd></div>)}</dl><details><summary>Why this result?</summary>{check.evidence?<blockquote>“{check.evidence}”</blockquote>:<p>Derived from valid placements in the original geometry.</p>}<p>{check.detail}</p>{check.limit!==undefined&&<p>Requested limit: {check.limit} {check.unit==='mm'?'mm':check.unit==='changed'?'changed components':check.unit==='obstructions'?'obstructions':check.unit}.</p>}</details></article>)}
 </section>;
}
