import {GoogleGenAI} from '@google/genai';
import {readInteraction,InteractionProtocolError,type InferenceTier} from './inference';

export type ThinkingLevel='low'|'medium'|'high';
export async function sdkInteraction(input:{key:string;model:string;system:string;user:string;json:boolean;schema?:Record<string,unknown>;thinkingLevel:ThinkingLevel;maxTokens:number;tier:InferenceTier;signal:AbortSignal;partial?:(text:string)=>void;attachments?:{mimeType:string;data:string}[];background?:boolean}){
 const client=new GoogleGenAI({apiKey:input.key,httpOptions:{apiVersion:'v1beta',fetch:async(url,init)=>{
  const request=new Request(url,init);return fetch(request.url,{method:request.method,headers:Object.fromEntries(request.headers),body:request.method==='GET'?undefined:await request.text(),signal:input.signal,cache:'no-store'});
 }}});
 const options={retries:{strategy:'none' as const},signal:input.signal};
 const params={model:input.model,input:[{type:'text' as const,text:input.user},...(input.attachments??[]).map(file=>({type:file.mimeType==='application/pdf'?'document' as const:'image' as const,mime_type:file.mimeType,data:file.data}))],system_instruction:input.system,service_tier:input.tier,store:!!input.background,generation_config:{thinking_level:input.thinkingLevel,max_output_tokens:input.maxTokens},...(input.json?{response_format:{type:'text' as const,mime_type:'application/json',schema:input.schema??{type:'object'}}}:{})};
 if(input.background){
  let result=await client.interactions.create({...params,background:true,stream:false},options);
  const jobId=result.id;
  try{
  while(result.status==='in_progress'||result.status==='queued'){
   await new Promise<void>((resolve,reject)=>{const finish=()=>{input.signal.removeEventListener('abort',abort);resolve();};const timer=setTimeout(finish,1000);const abort=()=>{clearTimeout(timer);reject(input.signal.reason);};input.signal.addEventListener('abort',abort,{once:true});if(input.signal.aborted)abort();});
   result=await client.interactions.get(result.id,{},options);
  }
  return readInteraction(Response.json(result),undefined,input.signal);
  }catch(error){if(input.signal.aborted){try{await new GoogleGenAI({apiKey:input.key}).interactions.cancel(jobId,{}, {retries:{strategy:'none'},timeout_ms:5000});}catch{/* Keep the original cancellation/timeout; do not expose provider data. */}}throw error;}
 }
 if(!input.partial){const result=await client.interactions.create({...params,stream:false},options);return readInteraction(Response.json(result),undefined,input.signal);}
 const stream=await client.interactions.create({...params,stream:true},options),iterator=stream[Symbol.asyncIterator](),encoder=new TextEncoder();
 const body=new ReadableStream<Uint8Array>({async pull(controller){try{const next=await iterator.next();if(next.done)controller.close();else controller.enqueue(encoder.encode(`data: ${JSON.stringify(next.value)}\n\n`));}catch(error){controller.error(error);}},async cancel(){await iterator.return?.();}});
 const result=await readInteraction(new Response(body,{headers:{'content-type':'text/event-stream'}}),input.partial,input.signal);
 if(!result.text)throw new InteractionProtocolError('Gemini returned no usable text.');return result;
}
