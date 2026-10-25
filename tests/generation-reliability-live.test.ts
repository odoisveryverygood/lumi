import {expect,it} from 'vitest';
import {mkdir,writeFile} from 'node:fs/promises';
import {POST} from '../app/api/device/route';
import {readDeviceResponse} from '../lib/studio/response';
import {generatedDeviceSchema} from '../lib/studio/validation';

// Billable opt-in: one fresh request, at most three Argon calls including repairs.
// Load a private environment externally; never copy a credential into this test.
it.skipIf(process.env.LUMI_RELIABILITY_LIVE!=='1')('generates the previously failing robot dog through the real streaming route',async()=>{
  const prompt='a robot dog',started=performance.now();
  const outputDir=`work/generation-reliability/${new Date().toISOString().replace(/[:.]/g,'-')}`;
  await mkdir(outputDir,{recursive:true});
  const progress:{atMs:number;message:string;parts?:number}[]=[];
  try{
    const response=await POST(new Request('http://127.0.0.1:3002/api/device',{method:'POST',headers:{'content-type':'application/json',accept:'application/x-ndjson'},body:JSON.stringify({action:'generate',prompt})}));
    const result=await readDeviceResponse(response,event=>{progress.push({atMs:Math.round(performance.now()-started),message:event.message,parts:event.partNames?.length});});
    const document=generatedDeviceSchema.parse(result.document);
    expect(document.designBrief).toBe(prompt);expect(document.model).toBe('gemini-4-argon');
    const text=JSON.stringify(document);
    if(process.env.GEMINI_API_KEY&&text.includes(process.env.GEMINI_API_KEY))throw new Error('Refused to save private configuration.');
    await writeFile(`${outputDir}/document.json`,text);
    const report={completed:true,prompt,model:result.model,durationMs:Math.round(performance.now()-started),performance:result.performance,parts:document.parts.length,solids:document.parts.reduce((sum,part)=>sum+part.solids.length,0),progress,limits:'Schema validation and live streaming route only; no visual/physical verification. Syntax recovery is only exercised here if the provider naturally emits malformed data.'};
    await writeFile(`${outputDir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({outputDir,completed:true,durationMs:report.durationMs,parts:report.parts,solids:report.solids}));
  }catch(error){
    await writeFile(`${outputDir}/report.json`,JSON.stringify({completed:false,prompt,durationMs:Math.round(performance.now()-started),progress,error:error instanceof Error?error.message:'Failed'},null,2));throw error;
  }
},280_000);
