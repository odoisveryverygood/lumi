import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mechanicalKeyboard } from '../lib/studio/keyboard';
import { buildRedesign, checkRedesign, defaultDesignConstraints, documentFingerprint, mergeConstraintChanges, solidWorldBounds, type RedesignPlan } from '../lib/studio/redesign';
import { runRedesign } from '../lib/studio/redesign-engine';
import { generateText } from '../lib/ai';
import { POST } from '../app/api/redesign/route';
vi.mock('../lib/ai',async original=>({...await original<typeof import('../lib/ai')>(),generateText:vi.fn()}));
const generate=vi.mocked(generateText);
const good:RedesignPlan={chargeCurrentMa:100,citations:[],summary:'Use a sourced 500 mAh cell and BLE board; remove the acoustic pad for board height.',constraintChanges:[],unsupportedConstraints:[],battery:{catalogId:'adafruit-1578',position:[-85,6,28],rotationY:0},radio:{catalogId:'seeed-xiao-sense',position:[50,6,-27],rotationY:0},removePad:true};
const reply=(plan:unknown)=>({text:JSON.stringify(plan),model:'gemini-4-argon'});
beforeEach(()=>generate.mockReset());

describe('sourced constraint-aware redesign',()=>{
  it('fits sourced envelopes in the hollow case without treating the entire enclosure as a solid',()=>{
    const original=structuredClone(mechanicalKeyboard),next=buildRedesign(original,good);
    const checks=checkRedesign(original,next,defaultDesignConstraints);
    expect(checks.filter(c=>c.status==='fail')).toEqual([]);
    expect(checks.find(c=>c.id==='physical')?.status).toBe('unverified');
    expect(next.parts.find(p=>p.id==='wireless-battery')?.sourceUrl).toBe('https://www.adafruit.com/product/1578');
    for(const part of original.parts.filter(p=>p.id!=='keyboard-dampener'))expect(next.parts.find(p=>p.id===part.id)?.solids).toEqual(part.solids);
    expect(original).toEqual(mechanicalKeyboard);
  });
  it('detects actual overlap and returns a numeric region for the scene',()=>{
    const next=buildRedesign(mechanicalKeyboard,{...good,removePad:false,battery:{...good.battery,position:[-85,5,28]}});
    const checks=checkRedesign(mechanicalKeyboard,next,defaultDesignConstraints),collision=checks.find(c=>c.id==='collision-wireless-battery-keyboard-dampener');
    expect(collision?.status).toBe('fail');expect(collision?.region?.size[1]).toBeCloseTo(.975,3);expect(collision?.partIds).toEqual(['wireless-battery','keyboard-dampener']);
  });
  it('honors rotated actual solids and rejects boundary escape or protected geometry changes',()=>{
    const part=structuredClone(mechanicalKeyboard.parts[0]);part.position=[10,20,30];part.rotation=[0,90,0];part.solids=[{kind:'box',position:[0,0,0],size:[10,2,4]}];
    const box=solidWorldBounds(part,part.solids[0]);expect(box.max.x-box.min.x).toBeCloseTo(4);expect(box.max.z-box.min.z).toBeCloseTo(10);
    const next=buildRedesign(mechanicalKeyboard,{...good,battery:{...good.battery,position:[160,6,28]}});next.parts.find(p=>p.id==='keyboard-case-base')!.position[0]+=1;
    const checks=checkRedesign(mechanicalKeyboard,next,defaultDesignConstraints);expect(checks.find(c=>c.id==='preserve')?.status).toBe('fail');expect(checks.find(c=>c.id==='cavity-wireless-battery')?.status).toBe('fail');
  });
  it('carries constraints across revisions and only changes a constraint with evidence from the latest request',()=>{
    const first=mergeConstraintChanges(defaultDesignConstraints,[{key:'maxBatteryHeight',value:4,evidence:'under 4 mm'}],'Battery under 4 mm, please');
    const second=mergeConstraintChanges(first,[{key:'batterySide',value:'right',evidence:'right half'}],'Move it to the right half');
    expect(second.maxBatteryHeight).toBe(4);expect(second.batterySide).toBe('right');
    expect(()=>mergeConstraintChanges(second,[{key:'maxBatteryHeight',value:null,evidence:'forget height'}],'Move it left')).toThrow(/exact quote/);
    expect(()=>mergeConstraintChanges(second,[{key:'keepPad',value:'yes',evidence:'keep pad'}],'keep pad')).toThrow();
  });
  it('rejects unlisted components and restores the original pad when a later proposal needs it',()=>{
    expect(()=>buildRedesign(mechanicalKeyboard,{...good,battery:{...good.battery,catalogId:'invented'}})).toThrow(/catalog/);
    const first=buildRedesign(mechanicalKeyboard,good),next=buildRedesign(first,{...good,removePad:false},mechanicalKeyboard);
    expect(next.parts.find(p=>p.id==='keyboard-dampener')).toEqual(mechanicalKeyboard.parts.find(p=>p.id==='keyboard-dampener'));
    expect(checkRedesign(mechanicalKeyboard,next,{...defaultDesignConstraints,keepPad:true}).some(c=>c.id.startsWith('collision-')&&c.status==='fail')).toBe(true);
  });
  it('keeps revised topology and explanations consistent across repeated sourced conversions',()=>{
    const first=buildRedesign(mechanicalKeyboard,good),second=buildRedesign(first,{...good,battery:{...good.battery,catalogId:'adafruit-1317'}},mechanicalKeyboard);
    expect(new Set(second.relationships?.map(r=>r.id)).size).toBe(second.relationships?.length);
    expect(second.parts.find(p=>p.id==='keyboard-wired-cable')?.specs.Mode).toMatch(/charging/i);
    expect(second.parts.find(p=>p.id==='keyboard-usb')?.specs.Mode).toMatch(/BLE/);
    expect(second.steps.some(s=>s.title==='Review the wired interface')).toBe(false);
    expect(second.relationships?.some(r=>r.id==='design-scan-power')).toBe(true);
    expect(checkRedesign(mechanicalKeyboard,second,{...defaultDesignConstraints,maxBatteryHeight:4}).filter(c=>c.status==='fail')).toEqual([]);
  });
  it('sends failed measurements to Argon, then accepts a corrected revision',async()=>{
    generate.mockResolvedValueOnce(reply({...good,removePad:false})).mockResolvedValueOnce(reply(good));
    const result=await runRedesign({document:mechanicalKeyboard,baseline:mechanicalKeyboard,prompt:'Make it wireless'},new AbortController().signal);
    expect(result.status).toBe('ready');expect(result.attempts).toHaveLength(2);expect(result.attempts[0].checks.some(c=>c.status==='fail')).toBe(true);
    const feedback=JSON.parse(generate.mock.calls[1][1]).feedback;expect(feedback.failedChecks.some((c:{id:string})=>c.id==='collision-wireless-controller-keyboard-dampener')).toBe(true);
    expect(result.baseFingerprint).toBe(documentFingerprint(mechanicalKeyboard));expect(result.model).toBe('gemini-4-argon');
  });
  it('selects a different sourced cell for an unexpected height constraint without losing prior constraints',async()=>{
    const plan={...good,constraintChanges:[{key:'maxBatteryHeight',value:4,evidence:'under 4 mm'}],battery:{...good.battery,catalogId:'adafruit-1317'}};
    generate.mockResolvedValueOnce(reply(plan));
    const result=await runRedesign({document:mechanicalKeyboard,baseline:mechanicalKeyboard,prompt:'Battery must be under 4 mm',constraints:{...defaultDesignConstraints,minCapacityMah:150}},new AbortController().signal);
    expect(result.status).toBe('ready');expect(result.constraints.maxBatteryHeight).toBe(4);expect(result.sourceIds).toContain('adafruit-1317');
  });
  it('fails an infeasible request and refuses to relax frozen constraints during repair',async()=>{
    generate.mockResolvedValueOnce(reply({...good,constraintChanges:[{key:'maxBatteryHeight',value:1,evidence:'under 1 mm'}]})).mockResolvedValueOnce(reply({...good,constraintChanges:[{key:'maxBatteryHeight',value:null,evidence:'under 1 mm'}]})).mockResolvedValueOnce(reply(good));
    const result=await runRedesign({document:mechanicalKeyboard,baseline:mechanicalKeyboard,prompt:'Battery under 1 mm'},new AbortController().signal);
    expect(result.status).toBe('blocked');expect(result.constraints.maxBatteryHeight).toBe(1);expect(result.checks.find(c=>c.id==='maxBatteryHeight')?.status).toBe('fail');expect(result.attempts[1].checks[0].detail).toMatch(/frozen/);
    expect(mechanicalKeyboard.parts.some(p=>p.id==='wireless-battery')).toBe(false);
  });
  it('blocks requirements outside the checkable scope and never substitutes mock success',async()=>{
    generate.mockResolvedValue(reply({...good,unsupportedConstraints:['Actual 30 day runtime requires current measurements and firmware testing.']}));
    const result=await runRedesign({document:mechanicalKeyboard,baseline:mechanicalKeyboard,prompt:'Guarantee 30 day runtime'},new AbortController().signal);
    expect(result.status).toBe('blocked');expect(result.checks.find(c=>c.id==='unsupported-0')?.status).toBe('fail');expect(generate).toHaveBeenCalledTimes(3);
  });
  it('cancels before provider work and forwards the operation signal to in-flight generation',async()=>{
    const stopped=new AbortController();stopped.abort(new DOMException('Cancelled','AbortError'));
    await expect(runRedesign({document:mechanicalKeyboard,baseline:mechanicalKeyboard,prompt:'Make wireless'},stopped.signal)).rejects.toMatchObject({name:'AbortError'});expect(generate).not.toHaveBeenCalled();
    const running=new AbortController();generate.mockImplementationOnce(async(_system,_prompt,options)=>{expect(options?.signal).toBe(running.signal);running.abort(new DOMException('Cancelled','AbortError'));options?.signal?.throwIfAborted();return reply(good);});
    await expect(runRedesign({document:mechanicalKeyboard,baseline:mechanicalKeyboard,prompt:'Make wireless'},running.signal)).rejects.toMatchObject({name:'AbortError'});
  });
  it('repairs malformed plans while preserving the original assembly',async()=>{
    generate.mockResolvedValueOnce({text:'not JSON',model:'gemini-4-argon'}).mockResolvedValueOnce(reply(good));
    const before=JSON.stringify(mechanicalKeyboard),result=await runRedesign({document:mechanicalKeyboard,baseline:mechanicalKeyboard,prompt:'Make wireless'},new AbortController().signal);
    expect(result.status).toBe('ready');expect(result.attempts[0].checks[0].id).toBe('invalid-plan');expect(JSON.stringify(mechanicalKeyboard)).toBe(before);
  });
  it('rejects invalid requests before provider calls and streams real check progress',async()=>{
    const request=(body:unknown,origin='http://localhost:3000')=>new Request('http://localhost:3000/api/redesign',{method:'POST',headers:{'content-type':'application/json',origin,accept:'application/x-ndjson'},body:JSON.stringify(body)});
    expect((await POST(request({prompt:'Make wireless'}))).status).toBe(400);expect((await POST(request({},'https://evil.invalid'))).status).toBe(403);expect(generate).not.toHaveBeenCalled();
    generate.mockResolvedValueOnce(reply(good));const response=await POST(request({document:mechanicalKeyboard,baseline:mechanicalKeyboard,prompt:'Make wireless'}));
    expect(response.status).toBe(200);const events=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));expect(events.some(e=>e.type==='progress'&&e.message.includes('Checking revision'))).toBe(true);expect(events.at(-1).result.status).toBe('ready');
  });
});
