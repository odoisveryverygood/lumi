import {expect,it} from 'vitest';
import {mkdir,writeFile} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {generateCustomDevice} from '../lib/studio/device-generation';
import {canonicalCatalogGeometry,catalogJsonReplacer} from '../lib/studio/catalog';
import {objectReference} from '../lib/studio/object-catalog';
import {downloadObjectReference} from '../lib/studio/object-download';
import {inspectEmbeddedGLB} from '../lib/studio/import';

it.skipIf(process.env.LUMI_CATALOG_LIVE!=='1')('generates a fresh Argon assembly with sourced parts and imports a real CC0 model',async()=>{
 process.loadEnvFile('.env.local');const dir='docs/sponsor-sprint/2026-10-23-catalog';await mkdir(dir,{recursive:true});
 const prompt='Design a compact desk sensor with an ESP32-C3-MINI-1 radio module, a custom orange bracket and an M3 x 12 socket screw. Use these two exact standard components from readyParts, at their source dimensions. Add a separate sensor, carrier board and housing. Keep it a distinctive compact object, with clear selectable components and a relationship graph.';
 const started=performance.now(),result=await generateCustomDevice(prompt,new AbortController().signal,undefined,{maxAttempts:2,onRawOutput:text=>writeFileSync(dir+'/generated-wire.json',text)});
 const sourced=result.document!.parts.filter(p=>p.catalogRef);await writeFile(dir+'/generated-sensor.part.json',JSON.stringify({document:result.document},catalogJsonReplacer,2));
 expect(sourced.some(p=>p.catalogRef?.id==='esp32-c3-mini-1')).toBe(true);expect(sourced.every(canonicalCatalogGeometry)).toBe(true);expect(result.document!.parts.some(p=>p.solids.length>0)).toBe(true);
 await writeFile(dir+'/generation-report.json',JSON.stringify({model:result.model,elapsedSeconds:(performance.now()-started)/1000,parts:result.document!.parts.length,sourced:sourced.map(p=>p.catalogRef),customSolids:result.document!.parts.reduce((n,p)=>n+p.solids.length,0)},null,2));
 const reference=objectReference('e6efcc80071aebfc9612')!,bytes=await downloadObjectReference(reference);const glb=inspectEmbeddedGLB(bytes.buffer as ArrayBuffer);await writeFile(dir+'/smithsonian-chair.glb',bytes);
 await writeFile(dir+'/live-report.json',JSON.stringify({prompt,model:result.model,elapsedSeconds:(performance.now()-started)/1000,parts:result.document!.parts.length,sourced:sourced.map(p=>({name:p.name,catalogRef:p.catalogRef,vertices:p.mesh!.positions.length/3})),customSolids:result.document!.parts.reduce((n,p)=>n+p.solids.length,0),museum:{id:reference.id,name:reference.name,bytes:bytes.length,license:reference.license,sha256:reference.sha256,meshes:glb.meshes?.length},physicalEngineeringVerified:false},null,2));
},260000);
