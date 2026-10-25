import {objectReference} from '@/lib/studio/object-catalog';
import {downloadObjectReference} from '@/lib/studio/object-download';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params,reference=objectReference(id);if(!reference)return Response.json({error:'Unknown object reference.'},{status:404});
 try{const bytes=await downloadObjectReference(reference,request.signal);let offset=0;const stream=new ReadableStream<Uint8Array>({pull(controller){if(offset>=bytes.length){controller.close();return;}const end=Math.min(offset+128*1024,bytes.length);controller.enqueue(bytes.subarray(offset,end));offset=end;}});return new Response(stream,{headers:{'content-type':'model/gltf-binary','cache-control':'public, max-age=86400','x-content-type-options':'nosniff'}});}
 catch(error){return Response.json({error:request.signal.aborted?'Model download cancelled.':error instanceof Error?error.message:'Could not download this model.'},{status:502});}
}
