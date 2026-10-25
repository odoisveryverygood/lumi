import { describe,it,expect,vi,beforeEach } from 'vitest';
import { builtinSources, resolveSources, sourceRequirements, validateCitation, validateSourceFact, type DesignSource } from '../lib/studio/knowledge';
import { defaultDesignConstraints, redesignPlanSchema } from '../lib/studio/redesign';
import { runObjectConversation, runRedesign } from '../lib/studio/redesign-engine';
import { mechanicalKeyboard } from '../lib/studio/keyboard';
import { generateText } from '../lib/ai';
import { POST } from '../app/api/design-sources/route';
vi.mock('../lib/ai',async original=>({...await original<typeof import('../lib/ai')>(),generateText:vi.fn()}));
const generate=vi.mocked(generateText);
const plan=redesignPlanSchema.parse({summary:'A checked candidate',battery:{catalogId:'adafruit-1317',position:[-85,6,28],rotationY:0},radio:{catalogId:'seeed-xiao-sense',position:[50,6,-27],rotationY:0},removePad:true});
const reply=(value:unknown)=>({text:JSON.stringify(value),model:'gemini-4-argon'});
beforeEach(()=>generate.mockReset());
describe('document-grounded hardware reasoning',()=>{
 it('accepts the actual reference excerpts and rejects invented text or page numbers',()=>{
  expect(()=>resolveSources()).not.toThrow();const cite=builtinSources[0].facts[0].citation;
  expect(validateCitation(cite,builtinSources)).toEqual(cite);
  expect(()=>validateCitation({...cite,page:2},builtinSources)).toThrow(/not present/);
  expect(()=>validateCitation({...cite,quote:'this product supports a nuclear reactor'},builtinSources)).toThrow(/not present/);
 });
 it('does not confuse capacity in mAh with current in mA',()=>{
  const source:DesignSource={id:'test-cell',name:'Cell',kind:'text',origin:'upload',partId:'adafruit-1317',pages:[{number:1,text:'Capacity 150 mAh. Maximum charging current 80 mA.'}],facts:[]};
  expect(()=>validateSourceFact({property:'maxChargeMa',value:150,reviewed:true,citation:{sourceId:source.id,page:1,quote:'Capacity 150 mAh.'}},source)).toThrow(/value and unit/);
  expect(validateSourceFact({property:'maxChargeMa',value:80,reviewed:false,citation:{sourceId:source.id,page:1,quote:'Maximum charging current 80 mA.'}},source).value).toBe(80);
 });
 it('blocks charging that fits geometrically but exceeds the stated cell limit',()=>{
  const fast={...plan,radio:{...plan.radio,catalogId:'nice-nano'},chargeCurrentMa:500};const checks=sourceRequirements(fast,{...defaultDesignConstraints,minChargeMa:500},builtinSources);
  expect(checks.find(c=>c.id==='source-charge-mode')?.status).toBe('pass');
  expect(checks.find(c=>c.id==='source-charge-limit')).toMatchObject({status:'fail',citations:expect.arrayContaining([builtinSources[0].facts[0].citation])});
  expect(checks.find(c=>c.id==='source-charge-request')?.status).toBe('pass');
 });
 it('blocks made-up settings and missing current limits',()=>{
  expect(sourceRequirements({...plan,chargeCurrentMa:125},defaultDesignConstraints,builtinSources).find(c=>c.id==='source-charge-mode')?.status).toBe('fail');
  expect(sourceRequirements(plan,defaultDesignConstraints,builtinSources.filter(s=>s.partId!=='adafruit-1317')).find(c=>c.id==='source-charge-limit')?.status).toBe('fail');
 });
 it('keeps a conservative manufacturer bound when a reviewed upload claims a higher limit',()=>{
  const source:DesignSource={id:'custom-cell',name:'A different cell revision',kind:'text',origin:'upload',partId:'adafruit-1317',pages:[{number:1,text:'Maximum charge current 250 mA.'}],facts:[{property:'maxChargeMa',value:250,reviewed:true,citation:{sourceId:'custom-cell',page:1,quote:'Maximum charge current 250 mA.'}}]};
  const checks=sourceRequirements({...plan,chargeCurrentMa:200},defaultDesignConstraints,resolveSources([source]));expect(checks.find(c=>c.id==='source-charge-limit')?.status).toBe('fail');
 });
 it('does not use unreviewed extractions, but uses a reviewed stricter uploaded requirement',()=>{
  const source:DesignSource={id:'custom-cell',name:'Cell specification',kind:'text',origin:'upload',partId:'adafruit-1317',pages:[{number:1,text:'Maximum charge current 80 mA.'}],facts:[{property:'maxChargeMa',value:80,reviewed:false,citation:{sourceId:'custom-cell',page:1,quote:'Maximum charge current 80 mA.'}}]};
  expect(sourceRequirements(plan,defaultDesignConstraints,resolveSources([source])).find(c=>c.id==='source-charge-limit')?.status).toBe('pass');source.facts[0].reviewed=true;
  expect(sourceRequirements(plan,defaultDesignConstraints,resolveSources([source])).find(c=>c.id==='source-charge-limit')?.status).toBe('fail');
 });
 it('freezes the requested minimum and gives the real source failure to the repair loop',async()=>{
  generate.mockResolvedValueOnce(reply({...plan,chargeCurrentMa:500,radio:{...plan.radio,catalogId:'nice-nano'},constraintChanges:[{key:'minChargeMa',value:500,evidence:'at least 500 mA'}]})).mockResolvedValue(reply({...plan,chargeCurrentMa:100}));
  const result=await runRedesign({document:mechanicalKeyboard,baseline:mechanicalKeyboard,prompt:'Use at least 500 mA charging.'},new AbortController().signal);
  expect(result.status).toBe('blocked');expect(result.constraints.minChargeMa).toBe(500);expect(result.attempts[0].checks.find(c=>c.id==='source-charge-limit')?.status).toBe('fail');expect(result.checks.find(c=>c.id==='source-charge-request')?.status).toBe('fail');
  expect(JSON.parse(generate.mock.calls[1][1]).feedback.failedChecks.some((c:{id:string})=>c.id==='source-charge-limit')).toBe(true);
 });
 it('does not label PDF interpretation as a review of an unsubmitted canvas image',async()=>{
  generate.mockResolvedValue(reply({intent:'explain',answer:'The document specifies a charging voltage.',actions:[],suggestions:[],visualNotes:['A document diagram is visible.']}));
  const result=await runObjectConversation({document:mechanicalKeyboard,baseline:mechanicalKeyboard,prompt:'What voltage is specified?'},new AbortController().signal);
  if(result.kind!=='explanation')throw new Error('Expected an explanation');expect(result.visualInput).toBe(false);expect(result.visualNotes).toEqual([]);expect(result.visualReview).toBeUndefined();
 });
 it('repairs fabricated citations and attaches actual images to the provider call',async()=>{
  const citation=builtinSources[0].facts[0].citation;
  generate.mockResolvedValueOnce(reply({intent:'explain',answer:'Unsupported citation',actions:[],suggestions:[],citations:[{...citation,quote:'An invented quote about 500 mA.'}]})).mockResolvedValueOnce(reply({intent:'explain',answer:'The stated battery limit is 150 mA.',actions:[],suggestions:[],citations:[citation],visualNotes:['The case obscures the battery.']}));
  const view={mimeType:'image/jpeg' as const,data:'/9j/2Q=='};const result=await runObjectConversation({document:mechanicalKeyboard,baseline:mechanicalKeyboard,prompt:'Inspect this view',view},new AbortController().signal);
  expect(result.kind).toBe('explanation');expect(result.grounding?.citations).toEqual([citation]);expect(generate.mock.calls[0][2]?.attachments).toContainEqual(view);expect(JSON.parse(generate.mock.calls[0][1]).context.designSources.length).toBe(builtinSources.length);
 });
});
const request=(body:unknown,origin='http://127.0.0.1:3001')=>new Request('http://127.0.0.1:3001/api/design-sources',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});
describe('design-file import boundary',()=>{
 it('imports real general UTF-8 files offline without pretending to call Gemini',async()=>{
  const response=await POST(request({name:'requirements.md',mimeType:'text/plain',data:Buffer.from('Preserve the enclosure. Keep the USB port.').toString('base64')}));const body=await response.json();expect(response.status).toBe(200);expect(body.source.pages[0].text).toContain('Preserve the enclosure');expect(body.model).toBeUndefined();expect(body.source.sha256).toMatch(/^[a-f0-9]{64}$/);expect(generate).not.toHaveBeenCalled();
 });
 it('rejects cross-origin uploads, fake PDFs and oversized documents before any provider call',async()=>{
  expect((await POST(request({},'https://evil.invalid'))).status).toBe(403);
  expect((await POST(request({name:'fake.pdf',mimeType:'application/pdf',data:Buffer.from('not a PDF').toString('base64')}))).status).toBe(400);
  expect((await POST(request({name:'huge.md',mimeType:'text/plain',data:Buffer.from('x'.repeat(150001)).toString('base64')}))).status).toBe(413);expect(generate).not.toHaveBeenCalled();
 });
 it('keeps images as visual evidence rather than accepting a hallucinated transcription as source text',async()=>{
  const data='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6E1sAAAAASUVORK5CYII=';
  const response=await POST(request({name:'diagram.png',mimeType:'image/png',partId:'adafruit-1317',data}));const body=await response.json();expect(response.status).toBe(200);expect(body.source.pages).toEqual([]);expect(body.source.facts).toEqual([]);expect(body.source.attachment.data).toBe(data);expect(body.warnings[0]).toContain('no verified text layer');expect(generate).not.toHaveBeenCalled();
 });
 it('extracts only quote-matched numerical facts and leaves them for user review',async()=>{
  const text='This test cell has a maximum charge current of 80 mA.';const crypto=await import('node:crypto');const id=`file-${crypto.createHash('sha256').update(text).digest('hex').slice(0,20)}`;
  generate.mockResolvedValue(reply({facts:[{property:'maxChargeMa',value:80,citation:{sourceId:id,page:1,quote:'maximum charge current of 80 mA.'}},{property:'maxChargeMa',value:500,citation:{sourceId:id,page:1,quote:'maximum charge current of 500 mA.'}}]}));
  const response=await POST(request({name:'test-cell.txt',partId:'adafruit-1317',mimeType:'text/plain',data:Buffer.from(text).toString('base64')}));const body=await response.json();expect(body.source.facts).toHaveLength(1);expect(body.source.facts[0]).toMatchObject({value:80,reviewed:false});expect(body.warnings).toHaveLength(1);
 });
});
