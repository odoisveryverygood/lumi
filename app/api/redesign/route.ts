import { designSourceSchema, resolveSources } from '@/lib/studio/knowledge';
import { z } from 'zod';
import { AIError, checkOrigin, readJsonBody, RequestError, safeError } from '@/lib/ai';
import { deviceDocumentSchema } from '@/lib/studio/validation';
import { designConstraintsSchema } from '@/lib/studio/redesign';
import { runObjectConversation, runRedesign } from '@/lib/studio/redesign-engine';

export const runtime='nodejs';
export const maxDuration=300;
const schema=z.object({sources:z.array(designSourceSchema).max(18).optional(),view:z.object({mimeType:z.literal('image/jpeg'),data:z.string().max(800000).regex(/^[A-Za-z0-9+/]*={0,2}$/)}).strict().optional(),document:deviceDocumentSchema,baseline:deviceDocumentSchema,prompt:z.string().trim().min(3).max(4000),constraints:designConstraintsSchema.optional(),conversation:z.boolean().optional(),partId:z.string().max(100).optional(),history:z.array(z.object({role:z.enum(['user','assistant']),text:z.string().max(2500)}).strict()).max(8).optional()}).strict();
export async function POST(request:Request){
  try{
    checkOrigin(request);
    const parsed=schema.safeParse(await readJsonBody(request,10_000_000));
    if(!parsed.success)throw new RequestError(400,'Provide a valid assembly, original baseline and redesign brief.');
    try{resolveSources(parsed.data.sources);}catch(error){throw new RequestError(400,error instanceof Error?error.message:'Invalid source notebook.');}
    if(parsed.data.partId&&!parsed.data.document.parts.some(p=>p.id===parsed.data.partId))throw new RequestError(400,'Select a part in the visible object.');
    const run=parsed.data.conversation?runObjectConversation:runRedesign;
    const operation=new AbortController(),deadline=setTimeout(()=>operation.abort(new DOMException('Redesign deadline exceeded','TimeoutError')),270_000);
    const signal=AbortSignal.any([request.signal,operation.signal]);
    const message=(error:unknown)=>operation.signal.reason?.name==='TimeoutError'?'The redesign timed out. Your assembly is unchanged. Try again.':error instanceof RequestError?error.message:safeError(error);
    if(request.headers.get('accept')?.includes('application/x-ndjson')){
      const encoder=new TextEncoder();let closed=false;
      return new Response(new ReadableStream<Uint8Array>({start(controller){
        const send=(value:unknown)=>{if(!closed&&!signal.aborted)try{controller.enqueue(encoder.encode(JSON.stringify(value)+'\n'));}catch{closed=true;operation.abort();}};
        const heartbeat=setInterval(()=>send({type:'heartbeat'}),10000);
        void(async()=>{try{const result=await run(parsed.data,signal,value=>send({type:'progress',...value}));send({type:'complete',result});}catch(error){if(!request.signal.aborted){try{controller.enqueue(encoder.encode(JSON.stringify({type:'error',error:message(error)})+'\n'));}catch{}}}finally{clearTimeout(deadline);clearInterval(heartbeat);if(!closed){closed=true;controller.close();}}})();
      },cancel(){closed=true;clearTimeout(deadline);operation.abort();}}),{headers:{'content-type':'application/x-ndjson; charset=utf-8','cache-control':'no-store, no-transform','x-content-type-options':'nosniff'}});
    }
    try{return Response.json(await run(parsed.data,signal),{headers:{'cache-control':'no-store'}});}finally{clearTimeout(deadline);}
  }catch(error){return Response.json({error:error instanceof RequestError?error.message:safeError(error)},{status:error instanceof RequestError?error.status:error instanceof AIError?error.code==='quota'?429:503:500,headers:{'cache-control':'no-store'}});}
}
