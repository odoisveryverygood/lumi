import { expect, it } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { generateCustomDevice } from '../lib/studio/device-generation';
import { generatedDeviceSchema } from '../lib/studio/validation';
import type { InferenceMetrics } from '../lib/inference';

// Explicit opt-in only. Two model calls, no repair loops, and no deployments.
it.skipIf(process.env.FLARE_BENCHMARK !== '1')('compares the same complete custom object on Standard and requested Priority',async()=>{
 process.loadEnvFile('.env.local');process.env.GEMINI_MODEL='gemini-4-argon';
 const prompt='Create a distinctive portable cassette player: burnt-orange split enclosure with dark rounded corner pieces, transparent tape window and two visible tape reels, a capstan/pinch roller, play/stop controls, side volume wheel, headphone socket, drive motor and battery compartment. Use 10–14 independently selectable meaningful parts, detailed multi-solid geometry, readable names, at least five relationships and one bounded animated tape mechanism. Keep the complete player compact and coherent. This is an illustrative study, not verified hardware. Generate this exact custom object, with no shared demo or template.';
 const outputDir=`../../work/flare-speed-benchmark/${new Date().toISOString().replace(/[:.]/g,'-')}`;
 const reports:Record<string,unknown>[]=[];await mkdir(outputDir,{recursive:true});
 for(const serviceTier of ['standard','priority'] as const){
  const started=performance.now(),calls:InferenceMetrics[]=[],parts:{atMs:number;count:number}[]=[];
  try{
   const result=await generateCustomDevice(prompt,AbortSignal.timeout(180000),event=>{if(event.performance)calls.push(event.performance);if(event.partNames)parts.push({atMs:Math.round(performance.now()-started),count:event.partNames.length});},{serviceTier,transport:'interactions',maxAttempts:1});
   const doc=generatedDeviceSchema.parse(result.document);const quality={valid:true,parts:doc.parts.length,solids:doc.parts.reduce((n,p)=>n+p.solids.length,0),relationships:doc.relationships?.length||0,mechanisms:doc.mechanisms?.length||0,steps:doc.steps.length,independentParts:new Set(doc.parts.map(p=>p.id)).size};
   await writeFile(`${outputDir}/${serviceTier}-object.json`,JSON.stringify(doc));
   reports.push({requestedTier:serviceTier,completed:true,durationMs:Math.round(performance.now()-started),performance:result.performance,calls,partProgress:parts,quality});
  }catch(error){reports.push({requestedTier:serviceTier,completed:false,durationMs:Math.round(performance.now()-started),calls,partProgress:parts,error:error instanceof Error?error.message:'Failed'});}
  await writeFile(`${outputDir}/report.json`,JSON.stringify({asOf:new Date().toISOString(),prompt,limits:{modelCalls:2,maxAttemptsPerObject:1,maxOutputTokensPerCall:24000},reports},null,2));
 }
 console.log(JSON.stringify({outputDir,reports}));expect(reports.every(r=>r.completed)).toBe(true);
 for(const report of reports){const q=report.quality as {parts:number;solids:number;relationships:number;mechanisms:number};expect(q.parts).toBeGreaterThanOrEqual(10);expect(q.solids).toBeGreaterThanOrEqual(20);expect(q.relationships).toBeGreaterThanOrEqual(5);expect(q.mechanisms).toBeGreaterThanOrEqual(1);}
},400000);
