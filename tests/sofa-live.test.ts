import {it,expect} from 'vitest';
import {writeFile} from 'node:fs/promises';
import {generateCustomDevice} from '../lib/studio/device-generation';

it.skipIf(process.env.LUMI_SOFA_LIVE!=='1')('checks the exact smart sofa request on Argon with one bounded generation',async()=>{
 process.loadEnvFile('.env.local');
 const started=performance.now(),progress:unknown[]=[];let raw='';
 const dir='docs/sponsor-sprint/2026-10-23-sofa-latency';
 try{
  const result=await generateCustomDevice('Build a smart sofa with an iron base and an ESP32.',AbortSignal.timeout(180000),event=>{const row={atMs:Math.round(performance.now()-started),message:event.message,parts:event.partNames?.length,performance:event.performance};progress.push(row);if(row.parts||row.performance)console.log(JSON.stringify(row));},{maxAttempts:1,onRawOutput:text=>{raw=text;}});
  await writeFile(`${dir}/diagnostic-object.json`,JSON.stringify(result.document));
  await writeFile(`${dir}/diagnostic.json`,JSON.stringify({completed:true,durationMs:Math.round(performance.now()-started),performance:result.performance,parts:result.document?.parts.length,progress},null,2));
  expect(result.document?.parts.length).toBeGreaterThan(2);
 }catch(error){
  let parseError:string|undefined,partError:string|undefined;
  try{JSON.parse(raw);}catch(e){parseError=e instanceof Error?e.message:'Invalid JSON';}
  const key=process.env.GEMINI_API_KEY;
  if(raw&&(!key||!raw.includes(key)))await writeFile(`${dir}/diagnostic-raw.txt`,raw,{mode:0o600});
  await writeFile(`${dir}/diagnostic.json`,JSON.stringify({completed:false,durationMs:Math.round(performance.now()-started),error:error instanceof Error?error.message:'Failed',parseError,stack:error instanceof Error?error.stack?.split('\n').slice(0,6):undefined,progress},null,2));
  throw error;
 }
},190000);
