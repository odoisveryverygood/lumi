import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateText } from '../lib/ai';
import { estimateArgonCost, readInteraction, type InferenceMetrics } from '../lib/inference';
import { completedPartNames } from '../lib/studio/generation-progress';
import { mechanicalKeyboard } from '../lib/studio/keyboard';
let counter=0;
beforeEach(()=>{vi.stubEnv('GEMINI_API_KEY',`priority-test-${++counter}`);vi.stubEnv('GEMINI_MODEL','gemini-4-argon');vi.stubEnv('GEMINI_SERVICE_TIER','standard');vi.stubEnv('GEMINI_TRANSPORT','generateContent');});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
const models=()=>Response.json({models:[{name:'models/gemini-4-argon',supportedGenerationMethods:['generateContent']}]});
const usage={total_input_tokens:20000,total_output_tokens:9000,total_thought_tokens:1000,total_cached_tokens:0};
const complete=(text='{"ready":true}',tier='priority')=>({status:'completed',service_tier:tier,steps:[{type:'thought',content:[{type:'text',text:'PRIVATE THOUGHT'}]},{type:'model_output',content:[{type:'text',text}]}],usage});
function sse(events:unknown[],headers:Record<string,string>={}){const bytes=new TextEncoder().encode(events.map(e=>`data: ${JSON.stringify(e)}\r\n\r\n`).join(''));return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=7)c.enqueue(bytes.slice(i,i+7));c.close();}}),{headers:{'content-type':'text/event-stream',...headers}});}
const events=(tier='priority')=>[{event_type:'step.start',index:0,step:{type:'thought'}},{event_type:'step.delta',index:0,delta:{type:'text',text:'PRIVATE THOUGHT'}},{event_type:'step.start',index:1,step:{type:'model_output'}},{event_type:'step.delta',index:1,delta:{type:'text',text:'{"name":"Café'}},{event_type:'step.delta',index:1,delta:{type:'text',text:'"}'}},{event_type:'interaction.completed',interaction:{status:'completed',service_tier:tier,usage}}];

describe('real Interactions protocol boundaries',()=>{
 it('uses the documented Priority endpoint, stateless inputs and preserved PDF/image evidence',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(models()).mockResolvedValueOnce(Response.json(complete()));vi.stubGlobal('fetch',fetcher);
  const report=vi.fn();const result=await generateText('Keep the checks.','Create an object.',{serviceTier:'priority',json:true,onPerformance:report,attachments:[{mimeType:'application/pdf',data:'JVBERi0='},{mimeType:'image/jpeg',data:'/9j/'}]});
  expect(fetcher.mock.calls[1][0]).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');const body=JSON.parse(fetcher.mock.calls[1][1].body);
  expect(body).toMatchObject({model:'gemini-4-argon',store:false,service_tier:'priority',system_instruction:'Keep the checks.',response_format:{type:'text',mime_type:'application/json'}});
  expect(body.input).toEqual([{type:'text',text:'Create an object.'},{type:'document',mime_type:'application/pdf',data:'JVBERi0='},{type:'image',mime_type:'image/jpeg',data:'/9j/'}]);
  expect(body.generation_config).toMatchObject({thinking_level:'medium',max_output_tokens:32768});expect(body.generation_config).not.toHaveProperty('temperature');expect(body.response_format.schema).toEqual({type:'object'});
  expect(result.text).toBe('{"ready":true}');expect(result.performance).toMatchObject({requestedTier:'priority',servedTier:'priority',inputTokens:20000,outputTokens:9000,thinkingTokens:1000});expect(result.performance?.estimatedCostUsd).toBeCloseTo(.252);expect(report).toHaveBeenCalledOnce();expect(JSON.stringify(result)).not.toContain('priority-test');
 });
 it('decodes split UTF-8, excludes thoughts, and observes Google downgrading Priority to Standard',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(models()).mockResolvedValueOnce(sse(events('standard')));vi.stubGlobal('fetch',fetcher);const partial=vi.fn();
  const result=await generateText('System','User',{serviceTier:'priority',onPartial:partial});expect(result.text).toBe('{"name":"Café"}');expect(partial.mock.calls.map(x=>x[0]).join('')).not.toContain('PRIVATE');expect(result.performance).toMatchObject({requestedTier:'priority',servedTier:'standard',estimatedCostUsd:.14,firstTokenMs:expect.any(Number)});
 });
 it('sends explicit low thinking through the SDK for extraction without lowering the Argon output allowance',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(models()).mockResolvedValueOnce(Response.json(complete()));vi.stubGlobal('fetch',fetcher);
  await generateText('Extract a fact','A = 1',{transport:'interactions',thinkingLevel:'low',maxTokens:4000,json:true});
  expect(JSON.parse(fetcher.mock.calls[1][1].body).generation_config).toEqual({thinking_level:'low',max_output_tokens:32768});
 });
 it('supports explicitly requested stored background jobs and retrieves completed output',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(models()).mockResolvedValueOnce(Response.json({...complete(),id:'test-background'}));vi.stubGlobal('fetch',fetcher);
  const result=await generateText('Return JSON','A = 1',{background:true,thinkingLevel:'high',maxTokens:131072,json:true});
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({background:true,store:true,stream:false,generation_config:{thinking_level:'high',max_output_tokens:131072}});expect(result.text).toBe('{"ready":true}');
 });
 it('never assumes Priority was served when the provider supplies no tier',async()=>{
  const result=await readInteraction(Response.json({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:'OK'}]}]}));expect(result.tier).toBe('unknown');
 });
 it.each(['incomplete','failed','cancelled','requires_action','in_progress'])('rejects %s output even if it contains readable JSON',async status=>{
  await expect(readInteraction(Response.json({...complete(),status}))).rejects.toThrow('did not finish');
 });
 it('rejects truncated and explicit error streams before committing any generated data',async()=>{
  await expect(readInteraction(sse(events().slice(0,-1)))).rejects.toThrow('before Gemini completed');
  await expect(readInteraction(sse([{event_type:'error',error:{message:'KEY-DO-NOT-LEAK'}}]))).rejects.toThrow('could not complete');
 });
 it('returns on the provider completion event without waiting for the network to close',async()=>{
  let cancelled=false;
  const response=new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(events().map(e=>`data: ${JSON.stringify(e)}\n\n`).join('')));},cancel(){cancelled=true;}}),{headers:{'content-type':'text/event-stream'}});
  expect((await readInteraction(response)).text).toBe('{"name":"Café"}');expect(cancelled).toBe(true);
 });
 it('does not silently fall back or repeat billing when Priority is denied',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(models()).mockResolvedValueOnce(new Response('KEY-DO-NOT-LEAK',{status:403}));vi.stubGlobal('fetch',fetcher);
  await expect(generateText('System','User',{serviceTier:'priority'})).rejects.toMatchObject({code:'model_unavailable'});expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('propagates cancellation to the request and bounds the entire stream',async()=>{
  const controller=new AbortController();const fetcher=vi.fn().mockResolvedValueOnce(models()).mockImplementationOnce((_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')))));vi.stubGlobal('fetch',fetcher);
  const pending=generateText('System','User',{serviceTier:'priority',signal:controller.signal});await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));controller.abort();await expect(pending).rejects.toMatchObject({code:'aborted'});
 });
 it('preserves the Standard transport unless the server explicitly enables Interactions',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(models()).mockResolvedValueOnce(Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'OK'}]}}],usageMetadata:{promptTokenCount:50,candidatesTokenCount:10,thoughtsTokenCount:20}}));vi.stubGlobal('fetch',fetcher);
  const result=await generateText('System','User');expect(fetcher.mock.calls[1][0]).toContain(':generateContent');expect(result.performance).toMatchObject({transport:'generateContent',requestedTier:'standard',servedTier:'unknown',inputTokens:50,outputTokens:10,thinkingTokens:20});
 });
 it('estimates billed thinking separately, honors cached input and future published prices',()=>{
  const base:InferenceMetrics={transport:'interactions',requestedTier:'standard',servedTier:'standard',durationMs:20,firstTokenMs:null,inputTokens:20000,outputTokens:9000,thinkingTokens:1000,cachedTokens:10000};expect(estimateArgonCost(base,'gemini-4-argon',new Date('2026-10-23'))).toBeCloseTo(.121);expect(estimateArgonCost(base,'gemini-4-argon',new Date('2026-12-02'))).toBeCloseTo(.242);expect(estimateArgonCost(base,'another-model')).toBeUndefined();
 });
});

describe('honest live component progress',()=>{
 it('counts only complete valid parts, including nested arrays and escaped names',()=>{
  const a={...structuredClone(mechanicalKeyboard.parts[0]),id:'a',name:'Upper "shell"'},b={...structuredClone(mechanicalKeyboard.parts[1]),id:'b',name:'Lower shell'};
  const text=JSON.stringify({document:{parts:[a,b]}});expect(completedPartNames(text)).toEqual(['Upper "shell"','Lower shell']);expect(completedPartNames(text.slice(0,text.indexOf('"id":"b"')+20))).toEqual(['Upper "shell"']);
 });
 it('ignores malformed, invented, incomplete and duplicate component records',()=>{
  const a=structuredClone(mechanicalKeyboard.parts[0]);expect(completedPartNames('{"document":{"parts":[{"name":"not a complete part"},'+JSON.stringify(a)+','+JSON.stringify(a)+',{"name":"unfinished')).toEqual([a.name]);expect(completedPartNames('')).toEqual([]);
 });
});
