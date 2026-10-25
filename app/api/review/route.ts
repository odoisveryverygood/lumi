import {AIError,checkOrigin,readJsonBody,RequestError,safeError} from '@/lib/ai';
import {qualityRequestSchema,runQualityReview} from '@/lib/studio/quality-engine';
import {catalogJsonReplacer} from '@/lib/studio/catalog';
export const runtime='nodejs';
export const maxDuration=90;
export async function POST(request:Request){
 try{checkOrigin(request);const parsed=qualityRequestSchema.safeParse(await readJsonBody(request,6_000_000));if(!parsed.success)throw new RequestError(400,parsed.error.issues[0]?.message||'Provide a rendered candidate and its original request.');const signal=AbortSignal.any([request.signal,AbortSignal.timeout(75000)]),result=await runQualityReview(parsed.data,signal);return new Response(JSON.stringify(result,catalogJsonReplacer),{headers:{'content-type':'application/json','cache-control':'no-store'}});}
 catch(error){return Response.json({error:error instanceof RequestError?error.message:safeError(error)},{status:error instanceof RequestError?error.status:error instanceof AIError&&error.code==='quota'?429:502,headers:{'cache-control':'no-store'}});}
}
