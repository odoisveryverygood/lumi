import {checkOrigin,readJsonBody,RequestError,safeError,AIError} from '@/lib/ai';
import {constraintPlanInputSchema,prepareDesignChecks} from '@/lib/studio/constraint-planner';
export const runtime='nodejs';
export const maxDuration=90;
export async function POST(request:Request){
 try{checkOrigin(request);const parsed=constraintPlanInputSchema.safeParse(await readJsonBody(request,3_000_000));if(!parsed.success)throw new RequestError(400,parsed.error.issues[0]?.message||'Provide the request and actual baseline/candidate.');
  const result=await prepareDesignChecks(parsed.data,AbortSignal.any([request.signal,AbortSignal.timeout(75000)]));return Response.json(result,{headers:{'cache-control':'no-store'}});
 }catch(error){return Response.json({error:error instanceof RequestError?error.message:safeError(error)},{status:error instanceof RequestError?error.status:error instanceof AIError&&error.code==='quota'?429:502,headers:{'cache-control':'no-store'}});}
}
