import { mechanicalKeyboard } from '../lib/studio/keyboard';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readDeviceResponse } from '../lib/studio/response';
import { POST } from '../app/api/device/route';
import { GET as compileStatus } from '../app/api/compile/route';
import { generateText } from '../lib/ai';
vi.mock('../lib/ai',async original=>({...await original<typeof import('../lib/ai')>(),generateText:vi.fn()}));
const generate=vi.mocked(generateText);
const result={answer:'The switch returns to rest — spring action.',actions:[]};
const request=(extra={})=>new Request('https://part-explode.vercel.app/api/device',{method:'POST',headers:{'content-type':'application/json',accept:'application/x-ndjson',origin:'https://part-explode.vercel.app'},body:JSON.stringify({action:'generate',prompt:'Show me a mechanical keyboard',...extra})});
beforeEach(()=>{generate.mockReset();});
afterEach(()=>vi.unstubAllEnvs());
function stream(text:string){const encoded=new TextEncoder().encode(text);return new Response(new ReadableStream({start(controller){for(let i=0;i<encoded.length;i+=7)controller.enqueue(encoded.slice(i,i+7));controller.close();}}),{headers:{'content-type':'application/x-ndjson'}});}

describe('hosted device responses',()=>{
  it('decodes arbitrary UTF-8 chunks, heartbeat frames and a final line without a newline',async()=>{
    const progress=vi.fn();
    const response=stream(JSON.stringify({type:'progress',message:'Checking…'})+'\n'+JSON.stringify({type:'heartbeat'})+'\n'+JSON.stringify({type:'complete',result}));
    expect(await readDeviceResponse(response,progress)).toEqual(result);expect(progress).toHaveBeenCalledWith({message:'Checking…',model:undefined});
  });
  it('preserves JSON compatibility and surfaces HTTP/platform errors',async()=>{
    expect(await readDeviceResponse(Response.json(result),()=>{})).toEqual(result);
    await expect(readDeviceResponse(Response.json({error:'Gemini quota reached'},{status:429}),()=>{})).rejects.toThrow('Gemini quota reached');
    await expect(readDeviceResponse(new Response('<html>Gateway timeout</html>',{status:504}),()=>{})).rejects.toThrow('server could not finish');
  });
  it('rejects truncated, malformed and explicit failed streams without committing a draft',async()=>{
    await expect(readDeviceResponse(stream('{"type":"heartbeat"}\n'),()=>{})).rejects.toThrow('before the assembly was ready');
    await expect(readDeviceResponse(stream('{"type":'),()=>{})).rejects.toThrow('incomplete response');
    await expect(readDeviceResponse(stream('{"type":"error","error":"Try a smaller object"}\n'),()=>{})).rejects.toThrow('Try a smaller object');
  });
  it('sends immediate progress while the model is still pending, then a validated complete assembly',async()=>{
    let finish!:(value:{text:string;model:string})=>void;
    generate.mockImplementation((_system,_user,options)=>{options?.onModel?.('gemini-4-argon');return new Promise(resolve=>{finish=resolve;});});
    const response=await POST(request());expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    const progress: string[]=[];
    const pending=readDeviceResponse(response,event=>progress.push(event.message));
    await vi.waitFor(()=>expect(progress).toContain('Request received. Connecting to Gemini…'));
    finish({model:'gemini-4-argon',text:JSON.stringify({document:{...mechanicalKeyboard,id:'custom-stream-keyboard',source:'gemini',parts:mechanicalKeyboard.parts.slice(0,6).map(p=>({...p,connections:[],assemblyId:undefined})),assemblies:[],relationships:[],mechanisms:[],steps:[{title:'Explore the assembly',description:'Inspect each custom component.',partIds:mechanicalKeyboard.parts.slice(0,6).map(p=>p.id)}]},answer:'A custom keyboard.',actions:[]})});
    const value=await pending;expect(value.document?.parts.length).toBe(6);expect(value.model).toBe('gemini-4-argon');expect(progress.some(p=>p.includes('Checking component'))).toBe(true);
  });
  it('aborts provider work when the browser cancels the stream',async()=>{
    let signal:AbortSignal|undefined;
    generate.mockImplementation((_system,_user,options)=>{signal=options?.signal;return new Promise((_resolve,reject)=>signal?.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true}));});
    const response=await POST(request());await response.body!.cancel();expect(signal?.aborted).toBe(true);
  });
  it('validates bad requests before opening a stream',async()=>{
    const response=await POST(request({prompt:''}));expect(response.status).toBe(400);expect(generate).not.toHaveBeenCalled();
  });
  it('reports that hosted functions need external Arduino tooling',async()=>{
    vi.stubEnv('VERCEL','1');const response=await compileStatus();expect(await response.json()).toMatchObject({available:false,localOnly:true,message:expect.stringContaining('Arduino IDE')});
  });
});
