import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {generateText,AIError} from '../lib/ai';
import {generateCustomDevice} from '../lib/studio/device-generation';
import {parseAssemblyJson,repairAssemblyJson} from '../lib/studio/generation-json';
vi.mock('../lib/ai',async original=>({...await original<typeof import('../lib/ai')>(),generateText:vi.fn()}));
const generate=vi.mocked(generateText);
const brief='Build a robot dog with an iron chassis and an ESP32.';
const part={id:'chassis',name:'Iron chassis',category:'Structure',description:'Iron support concept.',position:[0,20,0],explode:[0,20,0],color:'#414141',solids:[['box',0,0,0,100,10,50]]};
const assembly=()=>({document:{id:'robot-dog',name:'Robot dog',description:'Requested robot dog concept.',parts:[structuredClone(part),{...structuredClone(part),id:'esp32',name:'ESP32 controller',position:[0,30,0],solids:[['box',0,0,0,28,2,52]]}],relationships:[],steps:[{title:'Inspect',description:'Inspect chassis.',partIds:['chassis']}]},answer:'An illustrative robot dog chassis.',actions:[]});
const response=(text:string)=>({text,model:'gemini-4-argon'});
beforeEach(()=>generate.mockReset());
afterEach(()=>vi.useRealTimers());

describe('conservative assembly syntax recovery',()=>{
 it('removes only trailing commas outside strings, including escaped quotes and fenced output',()=>{
  expect(parseAssemblyJson('```json\n{"label":"a,} and \\\"b,]","values":[1,2,],}\n```')).toEqual({label:'a,} and "b,]',values:[1,2]});
 });
 it('does not evaluate arithmetic, complete missing geometry or parse arbitrary prose',()=>{
  for(const value of ['{"x":1+2}','{"x":','prefix {"x":2}','{"x":undefined}'])expect(()=>parseAssemblyJson(value)).toThrow();
 });
 it('requires unique, nonoverlapping edits and blocks complete response replacement',()=>{
  for(const edits of [
   [{find:'missing',replace:'x'}],
   [{find:'"a"',replace:'"b"'}],
   [{find:'"a":0',replace:'"a":2'},{find:':0',replace:':1'}],
   [{find:'{"x":1}',replace:'{"x":2}'}],
  ])expect(()=>repairAssemblyJson('{"a":0,"a":1}',{edits})).toThrow();
  expect(()=>repairAssemblyJson('{"x":1}',{edits:[{find:'{"x":1}',replace:'{"x":2}'}]})).toThrow('whole response');
 });
 it('rejects changing or removing complete received parts during syntax repair',()=>{
  const source=JSON.stringify(assembly()).replace('"relationships":','relationships:');
  expect(()=>repairAssemblyJson(source,{edits:[{find:'Iron chassis',replace:'Plastic chassis'},{find:'relationships:',replace:'"relationships":'}]})).toThrow('complete component');
  expect(()=>repairAssemblyJson(source,{edits:[{find:JSON.stringify(part),replace:''},{find:'relationships:',replace:'"relationships":'}]})).toThrow('complete component');
 });
 it('rejects invalid edits and inputs above the character budget',()=>{
  expect(()=>parseAssemblyJson(' '.repeat(240001))).toThrow('size limit');
  expect(()=>repairAssemblyJson('{"x":1}',{edits:[{find:'"x"',replace:'"'.repeat(4001)}]})).toThrow();
 });
});

describe('generation recovery and cancellation',()=>{
 it('accepts harmless trailing commas without buying another model call',async()=>{
  generate.mockResolvedValueOnce(response(JSON.stringify(assembly()).replace('"actions":[]','"actions":[], ')));
  const output=await generateCustomDevice(brief,new AbortController().signal);
  expect(output.document?.designBrief).toBe(brief);expect(generate).toHaveBeenCalledTimes(1);
 });
 it('repairs malformed JSON, then fixes a reference without regenerating received geometry',async()=>{
  const invalid=assembly();invalid.document.steps[0].partIds=['missing'];
  const text=JSON.stringify(invalid).replace('"relationships":','relationships:');
  generate.mockResolvedValueOnce(response(text))
   .mockResolvedValueOnce(response(JSON.stringify({edits:[{find:'relationships:',replace:'"relationships":'}]})))
   .mockResolvedValueOnce(response(JSON.stringify({repairs:[{path:['document','steps',0,'partIds'],value:['chassis']}]})));
  const progress=vi.fn(),output=await generateCustomDevice(brief,new AbortController().signal,progress);
  expect(output.document?.parts[0].name).toBe('Iron chassis');expect(output.document?.steps[0].partIds).toEqual(['chassis']);
  expect(output.document?.designBrief).toBe(brief);expect(generate).toHaveBeenCalledTimes(3);
  for(const call of generate.mock.calls)expect(call[1]).toContain(brief);
  expect(JSON.parse(generate.mock.calls[1][1]).original).toBe(text);
  expect(progress.mock.calls.some(([event])=>event.message.includes('Repairing assembly JSON'))).toBe(true);
 });
 it('rejects repeated malformed corrections within the fixed call budget',async()=>{
  generate.mockResolvedValue(response('{"document":'));
  await expect(generateCustomDevice(brief,new AbortController().signal)).rejects.toThrow('unresolved validation');
  expect(generate).toHaveBeenCalledTimes(3);
 });
 it('never commits a syntax repair that rewrites complete component geometry',async()=>{
  const text=JSON.stringify(assembly()).replace('"relationships":','relationships:');
  generate.mockResolvedValueOnce(response(text)).mockResolvedValue(response(JSON.stringify({edits:[{find:'100,10,50',replace:'1,1,1'},{find:'relationships:',replace:'"relationships":'}]})));
  await expect(generateCustomDevice(brief,new AbortController().signal)).rejects.toThrow('unresolved validation');
  expect(generate).toHaveBeenCalledTimes(3);
 });
 it('does no work when already cancelled',async()=>{
  const controller=new AbortController();controller.abort();
  await expect(generateCustomDevice(brief,controller.signal)).rejects.toMatchObject({code:'aborted'});expect(generate).not.toHaveBeenCalled();
 });
 it('does not repair or return a completed result after cancellation',async()=>{
  const controller=new AbortController();
  generate.mockImplementationOnce(async()=>{controller.abort();return response(JSON.stringify(assembly()));});
  await expect(generateCustomDevice(brief,controller.signal)).rejects.toMatchObject({code:'aborted'});expect(generate).toHaveBeenCalledTimes(1);
 });
 it('aborts a stalled repair at the shared generation deadline',async()=>{
  vi.useFakeTimers();generate.mockResolvedValueOnce(response('{"document":'));
  generate.mockImplementationOnce(async(_system,_user,options)=>new Promise((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(new AIError('aborted','Cancelled')),{once:true})));
  const pending=generateCustomDevice(brief,new AbortController().signal,undefined,{timeoutMs:1000});
  const assertion=expect(pending).rejects.toMatchObject({code:'timeout'});
  await vi.advanceTimersByTimeAsync(1001);await assertion;
  expect(generate).toHaveBeenCalledTimes(2);expect(generate.mock.calls[1][2]?.signal?.aborted).toBe(true);expect(vi.getTimerCount()).toBe(0);
 });
 it.each(['quota','provider','model_unavailable','timeout'] as const)('does not buy automatic retries on %s errors',async code=>{
  generate.mockRejectedValueOnce(new AIError(code,'Provider failed'));
  await expect(generateCustomDevice(brief,new AbortController().signal)).rejects.toMatchObject({code});expect(generate).toHaveBeenCalledTimes(1);
 });
 it('includes repair tokens and cost in final performance instead of reporting only the first call',async()=>{
  const text=JSON.stringify(assembly()).replace('"relationships":','relationships:');
  const metrics={transport:'interactions' as const,requestedTier:'priority' as const,servedTier:'priority' as const,durationMs:20,firstTokenMs:10,inputTokens:100,outputTokens:40,estimatedCostUsd:.01};
  generate.mockResolvedValueOnce({...response(text),performance:metrics})
   .mockResolvedValueOnce({...response(JSON.stringify({edits:[{find:'relationships:',replace:'"relationships":'}]})),performance:{...metrics,firstTokenMs:null}});
  const output=await generateCustomDevice(brief,new AbortController().signal);
  expect(output.performance).toMatchObject({inputTokens:200,outputTokens:80,estimatedCostUsd:.02,firstTokenMs:10});
 });
});
