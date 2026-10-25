import {mkdir,writeFile} from 'node:fs/promises';
import {expect,it} from 'vitest';
import {generateCustomDevice} from '../lib/studio/device-generation';
import {generatedDeviceSchema} from '../lib/studio/validation';
import {createGeometryRenderer} from '../lib/studio/review-renderer';

// Billable, explicit opt-in. Two independent fresh designs, same model, prompt,
// reasoning and output budget. This is a diagnostic pair, not a latency SLA or
// proof that two independently generated designs have identical quality.
it.skipIf(process.env.MORF_SPEED_LIVE!=='1')('measures literal versus shared geometry on fresh Argon assemblies',async()=>{
 const prompt='Create a complete conceptual robot dog with an iron chassis, an ESP32 controller, a battery, four matching hip motors, four matching upper leg links, and four matching lower leg links with rounded feet. Each motor and link must remain a separately selectable part with its own placement. Use at least 15 meaningful parts, clear multi-solid mechanical details, proper local material finishes, at least eight relationships, four to six assembly steps and one illustrative leg movement mechanism. Use realistic millimetre scale. Preserve the complete design, not a bare chassis. No claim of physical verification.';
 const outputDir='work/assembly-speed-comparison';await mkdir(outputDir,{recursive:true});
 const reports:Record<string,unknown>[]=[];
 for(const sharedGeometry of [false,true]){
  const mode=sharedGeometry?'shared':'literal',started=performance.now();let firstPreviewMs:number|null=null;
  try{
   const result=await generateCustomDevice(prompt,AbortSignal.timeout(210000),event=>{if(event.newParts?.length)firstPreviewMs??=Math.round(performance.now()-started);},{sharedGeometry,maxAttempts:2,timeoutMs:210000});
   const doc=generatedDeviceSchema.parse(result.document),renderer=createGeometryRenderer(doc);
   const views=[];
   try{for(const view of ['assembled','top','exploded'] as const){
    const image=renderer.render({width:320,height:240,view});
    views.push({view,visibleParts:image.visiblePartIds.length,triangles:image.triangles});
    const header=Buffer.from(`P6\n${image.width} ${image.height}\n255\n`),rgb=Buffer.alloc(image.width*image.height*3);
    for(let i=0;i<image.width*image.height;i++)for(let channel=0;channel<3;channel++)rgb[i*3+channel]=image.rgba[i*4+channel];
    await writeFile(`${outputDir}/${mode}-${view}.ppm`,Buffer.concat([header,rgb]));
   }}finally{renderer.dispose();}
   await writeFile(`${outputDir}/${mode}.part.json`,JSON.stringify({document:doc}));
   reports.push({mode,completed:true,durationMs:Math.round(performance.now()-started),firstPreviewMs,performance:result.performance,generation:result.generation,quality:{parts:doc.parts.length,solids:doc.parts.reduce((n,p)=>n+p.solids.length,0),relationships:doc.relationships?.length??0,mechanisms:doc.mechanisms?.length??0,steps:doc.steps.length},views});
  }catch(error){reports.push({mode,completed:false,durationMs:Math.round(performance.now()-started),firstPreviewMs,error:error instanceof Error?error.message:'Request failed'});}
  await writeFile(`${outputDir}/report.json`,JSON.stringify({prompt,limits:'One independent sample per mode; geometry preservation is tested separately against identical retained input. These renders do not establish engineering or physical validity.',reports},null,2));
  console.log(JSON.stringify(reports.at(-1)));
 }
 expect(reports.every(report=>report.completed)).toBe(true);
 for(const report of reports){const quality=report.quality as {parts:number;solids:number;relationships:number;mechanisms:number;steps:number};
  expect(quality.parts).toBeGreaterThanOrEqual(15);expect(quality.solids).toBeGreaterThanOrEqual(40);expect(quality.relationships).toBeGreaterThanOrEqual(8);expect(quality.mechanisms).toBeGreaterThanOrEqual(1);expect(quality.steps).toBeGreaterThanOrEqual(4);
 }
},440000);
