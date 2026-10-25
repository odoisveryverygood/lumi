import { readJsonBody, RequestError } from '@/lib/ai';
import { checkCompileOrigin, compileProject, CompileError, sanitizeCompilerOutput } from '@/lib/compile';

export const runtime='nodejs';
export const maxDuration=75;

export async function GET() {
  // Hosted functions do not contain the board toolchains installed on a user's computer.
  if(process.env.VERCEL)return Response.json({available:false,localOnly:true,message:'Download the sketch and compile it in Arduino IDE with the listed board package and libraries.'},{headers:{'cache-control':'no-store'}});
  try {
    const {execFile}=await import('node:child_process');
    await new Promise<void>((resolve,reject)=>execFile('arduino-cli',['version'],{timeout:5000},error=>error?reject(error):resolve()));
    return Response.json({available:true,localOnly:true},{headers:{'cache-control':'no-store'}});
  }catch{return Response.json({available:false,localOnly:true,message:'Install Arduino CLI locally, or download the sketch for Arduino IDE.'},{headers:{'cache-control':'no-store'}});}
}

export async function POST(request:Request) {
  try {
    checkCompileOrigin(request);
    const body=await readJsonBody(request,350_000);
    if(!body||typeof body!=='object'||!('project'in body))throw new CompileError(400,'Provide the project to compile.');
    const result=await compileProject((body as {project:unknown}).project);
    return Response.json(result,{headers:{'cache-control':'no-store'}});
  } catch(error) {
    const expected=error instanceof CompileError||error instanceof RequestError;
    const message=sanitizeCompilerOutput(expected?error.message:'The compiler could not complete this check. Check local disk space and try again.');
    return Response.json({success:false,board:'',output:message,error:message,checkedAt:new Date().toISOString(),sourceHash:''},{status:expected?error.status:500,headers:{'cache-control':'no-store'}});
  }
}
