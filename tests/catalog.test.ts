import {describe,expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {appendCatalogPart,canonicalCatalogGeometry,catalogContext,catalogDocument,catalogJsonReplacer,catalogJsonReviver,catalogParts,expandCatalogWire,hydrateCatalogPart} from '../lib/studio/catalog';
import {deviceDocumentSchema,generatedDeviceSchema,validateDeviceDocument} from '../lib/studio/validation';
import {applyDeviceTransaction} from '../lib/studio/interaction';
import {appendGenerationParts,completedParts} from '../lib/studio/generation-progress';
import {readDeviceResponse} from '../lib/studio/response';
import {allowedObjectUrl,downloadObjectReference} from '../lib/studio/object-download';
import {objectReferences,searchObjectReferences} from '../lib/studio/object-catalog';
import {GET as searchCatalog} from '../app/api/catalog/route';
import {GET as getModel} from '../app/api/catalog/models/[id]/route';
import {inspectEmbeddedGLB} from '../lib/studio/import';

describe('pinned sourced geometry',()=>{
 it('validates every real catalog mesh, attribution and dimension without a pretend solid',()=>{
  expect(catalogParts).toHaveLength(14);
  for(const entry of catalogParts){const document=catalogDocument(entry.id);expect(deviceDocumentSchema.safeParse(document).success).toBe(true);expect(canonicalCatalogGeometry(document.parts[0])).toBe(true);expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/);expect(entry.mesh.indices.length).toBeGreaterThan(30);expect(entry.license.length).toBeGreaterThan(3);expect(entry.revision).toMatch(/^[a-f0-9]{40}$/);}
 });
 it('resolves compact parts into independent geometry without mutating the registry',()=>{
  const part=expandCatalogWire({catalogRef:{id:'esp32-c3-mini-1'},id:'radio',position:[5,10,15],rotation:[0,90,0],name:'Sofa radio'}) as ReturnType<typeof hydrateCatalogPart>;
  expect(part.name).toBe('Sofa radio');expect(part.position).toEqual([5,10,15]);expect(part.solids).toEqual([]);expect(part.mesh!.positions.length).toBeGreaterThan(1000);expect(canonicalCatalogGeometry(part)).toBe(true);
  part.mesh!.positions[0]+=1;expect(canonicalCatalogGeometry(part)).toBe(false);expect(canonicalCatalogGeometry(hydrateCatalogPart('esp32-c3-mini-1'))).toBe(true);
 });
 it('rejects unknown IDs, arbitrary parameters, source URL overrides and forged geometry',()=>{
  for(const value of [{catalogRef:{id:'invented'}},{catalogRef:{id:'m3-nut',scale:9}},{catalogRef:{id:'m3-nut'},mesh:{}},{catalogRef:{id:'m3-nut'},sourceUrl:'https://evil.example'},{catalogRef:{id:'m3-nut'},size:[99,99,99]}])expect(()=>expandCatalogWire(value)).toThrow();
  const document=catalogDocument('m3-nut');document.parts[0].mesh!.positions[0]+=.01;expect(deviceDocumentSchema.safeParse(document).success).toBe(false);
  const forged=catalogDocument('m3-nut');forged.parts[0].specs.License='No restrictions';expect(deviceDocumentSchema.safeParse(forged).success).toBe(false);
 });
 it('saves and streams IDs instead of megabytes and restores the exact canonical mesh',async()=>{
  const document=catalogDocument('esp32-wroom-32e'),full=JSON.stringify(document),packed=JSON.stringify(document,catalogJsonReplacer);
  expect(packed.length).toBeLessThan(3000);expect(full.length).toBeGreaterThan(packed.length*100);expect(validateDeviceDocument(JSON.parse(packed))).toEqual(document);expect(JSON.parse(packed,catalogJsonReviver)).toEqual(document);
  const events=[{type:'progress',message:'received',newParts:document.parts},{type:'complete',result:{document,answer:'Ready',actions:[]}}].map(e=>JSON.stringify(e,catalogJsonReplacer)).join('\n');
  const progress=vi.fn(),result=await readDeviceResponse(new Response(events,{headers:{'content-type':'application/x-ndjson'}}),progress);
  expect(result.document).toEqual(document);expect(canonicalCatalogGeometry(progress.mock.calls[0][0].newParts[0])).toBe(true);
 });
 it('shows actual sourced parts during generation and allows them in checked generated assemblies',()=>{
  const wire={id:'fastener',catalogRef:{id:'m3-cap-12'},position:[0,0,0]},parts=completedParts(JSON.stringify({document:{parts:[wire]}}));expect(parts).toHaveLength(1);expect(canonicalCatalogGeometry(parts[0])).toBe(true);
  const preview=appendGenerationParts(null,parts);expect(preview.parts[0].mesh).toEqual(parts[0].mesh);
  const second=hydrateCatalogPart('m3-nut');expect(generatedDeviceSchema.safeParse({...preview,parts:[parts[0],second]}).success).toBe(true);
  const fake={...second,catalogRef:undefined};expect(generatedDeviceSchema.safeParse({...preview,parts:[parts[0],fake]}).success).toBe(false);
 });
 it('adds distinct editable copies, retains the old assembly and protects standard dimensions',()=>{
  const original=catalogDocument('m3-nut'),one=appendCatalogPart(original,'m3-nut'),two=appendCatalogPart(one.document,'m3-nut');expect(original.parts).toHaveLength(1);expect(two.document.parts.map(p=>p.id)).toEqual(['m3-nut','m3-nut-2','m3-nut-3']);expect(two.document.parts[1].position[0]).toBeGreaterThan(0);expect(deviceDocumentSchema.safeParse(two.document).success).toBe(true);
  const moved=applyDeviceTransaction(two.document,{updates:[{partId:'m3-nut-2',patch:{position:[10,20,30],color:'#995500'}}]});expect(canonicalCatalogGeometry(moved.parts[1])).toBe(true);expect(moved.parts[1].position).toEqual([10,20,30]);
  expect(()=>applyDeviceTransaction(moved,{updates:[{partId:'m3-nut-2',patch:{size:[100,100,100]}}]})).toThrow('preserve');
  const added=applyDeviceTransaction(original,{addParts:[{catalogRef:{id:'bearing-608'},id:'bearing'}]});expect(added.parts).toHaveLength(2);expect(canonicalCatalogGeometry(added.parts[1])).toBe(true);
 });
 it('retrieves electronics for an ESP32 request without injecting heavy meshes into model context',()=>{
  const context=catalogContext('a smart sofa with an ESP32');expect(context.some(p=>p.id==='esp32-wroom-32e')).toBe(true);expect(context.some(p=>p.id==='esp32-c3-mini-1')).toBe(true);expect(JSON.stringify(context)).not.toContain('positions');expect(context.length).toBeLessThanOrEqual(8);
 });
});
describe('bounded museum reference imports',()=>{
 const bytes=new Uint8Array(20);new DataView(bytes.buffer).setUint32(0,0x46546c67,true);
 const reference={id:'test',name:'test',license:'CC0-1.0',url:'https://3d-api.si.edu/content/document/3d_package:test/test.glb',sha256:createHash('sha256').update(bytes).digest('hex')};
 it('indexes only CC0 manifest objects, supports search/pagination, and rejects unknown model IDs',async()=>{
  expect(objectReferences).toHaveLength(2407);expect(objectReferences.every(p=>p.license==='CC0-1.0'&&allowedObjectUrl(p.url))).toBe(true);expect(searchObjectReferences('chair').items.length).toBe(3);expect(searchObjectReferences('',0).items).toHaveLength(24);expect(searchObjectReferences('',1).items[0].id).not.toBe(objectReferences[0].id);
  const response=await searchCatalog(new Request('http://localhost/api/catalog?q=chair'));expect((await response.json()).total).toBe(3);
  expect((await getModel(new Request('http://localhost'),{params:Promise.resolve({id:'unknown'})})).status).toBe(404);
 });
 it('checks exact integrity and bounds redirects and fetch time',async()=>{
  const fetcher=vi.fn().mockImplementation(async()=>new Response(bytes));expect(await downloadObjectReference(reference,undefined,fetcher)).toEqual(bytes);expect(fetcher.mock.calls[0][1].redirect).toBe('error');expect(fetcher.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  await expect(downloadObjectReference({...reference,sha256:'0'.repeat(64)},undefined,fetcher)).rejects.toThrow('changed');
 });
 it('rejects arbitrary URLs, inaccessible models, oversized responses and non-GLB data',async()=>{
  for(const url of ['http://3d-api.si.edu/content/document/3d_package:x/a.glb','https://evil.example/a.glb','https://3d-api.si.edu.evil.example/content/document/3d_package:x/a.glb','https://user@3d-api.si.edu/content/document/3d_package:x/a.glb','https://3d-api.si.edu:444/content/document/3d_package:x/a.glb'])expect(allowedObjectUrl(url)).toBe(false);
  const fetcher=vi.fn();await expect(downloadObjectReference({...reference,url:'http://127.0.0.1'},undefined,fetcher)).rejects.toThrow('unsupported');expect(fetcher).not.toHaveBeenCalled();
  fetcher.mockResolvedValueOnce(new Response(null,{status:404}));await expect(downloadObjectReference(reference,undefined,fetcher)).rejects.toThrow('unavailable');
  fetcher.mockResolvedValueOnce(new Response(bytes,{headers:{'content-length':String(26*1024*1024)}}));await expect(downloadObjectReference(reference,undefined,fetcher)).rejects.toThrow('larger');
  fetcher.mockResolvedValueOnce(new Response('not a model'));await expect(downloadObjectReference(reference,undefined,fetcher)).rejects.toThrow('binary');
 });
 it('checks Draco decoder budgets before accepting a compressed model',()=>{
  const metadata={asset:{version:'2.0'},extensionsRequired:['KHR_draco_mesh_compression'],buffers:[{byteLength:4}],bufferViews:[{buffer:0,byteOffset:0,byteLength:4}],accessors:[{type:'VEC3',componentType:5126,count:30},{type:'SCALAR',componentType:5125,count:30}],meshes:[{primitives:[{indices:1,attributes:{POSITION:0},extensions:{KHR_draco_mesh_compression:{bufferView:0,attributes:{POSITION:0}}}}]}]};
  const pack=(value:unknown)=>{const text=JSON.stringify(value),length=Math.ceil(text.length/4)*4,bytes=new Uint8Array(20+length),view=new DataView(bytes.buffer);view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,bytes.length,true);view.setUint32(12,length,true);view.setUint32(16,0x4e4f534a,true);bytes.fill(32,20);bytes.set(new TextEncoder().encode(text),20);return bytes.buffer;};
  expect(()=>inspectEmbeddedGLB(pack(metadata))).not.toThrow();
  const enormous=structuredClone(metadata);enormous.accessors[0].count=1_000_001;expect(()=>inspectEmbeddedGLB(pack(enormous))).toThrow('oversized');
  const badRef=structuredClone(metadata);badRef.meshes[0].primitives[0].extensions.KHR_draco_mesh_compression.bufferView=50;expect(()=>inspectEmbeddedGLB(pack(badRef))).toThrow('embedded buffer');
  const noMetadata=structuredClone(metadata);noMetadata.accessors=[];expect(()=>inspectEmbeddedGLB(pack(noMetadata))).toThrow('metadata');
 });
});
