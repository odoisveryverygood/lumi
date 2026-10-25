import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { readFile } from 'node:fs/promises';
import { importDeviceGLB, inspectEmbeddedGLB, MAX_GLB_BYTES } from '../lib/studio/import';
import { deviceDocumentSchema, generatedDeviceSchema } from '../lib/studio/validation';
import type { DeviceDocument } from '../lib/studio/types';
import { generateText } from '../lib/ai';
import { desktopComputer } from '../lib/studio/desktop';
import { POST } from '../app/api/device/route';
import { loadStackChan } from '../lib/studio/stack-chan';
vi.mock('../lib/ai',async importOriginal=>({...await importOriginal<typeof import('../lib/ai')>(),generateText:vi.fn()}));
const generate=vi.mocked(generateText);
const device=():DeviceDocument=>({version:1,id:'test-device',name:'Concept computer',description:'A conceptual two-part computer assembly.',provenance:'Illustrative geometry.',source:'gemini',parts:['board','case'].map((id,index)=>({id,name:id,category:'Hardware',description:'Illustrative component.',role:'Part of the assembly.',position:[index*20,0,0],rotation:[0,0,0],size:[20,5,20],explode:[index*30,50,0],color:'#778899',solids:[{kind:'box',position:[0,0,0],size:[20,5,20]}],specs:{Size:'Illustrative'},connections:[{partId:index?'board':'case',label:'Mounts with the other component'}]})),steps:[{title:'Inspect the assembly',description:'Review its approximate components.',partIds:['board','case']}]});
const request=(body:unknown,origin='http://localhost:3000')=>new Request('http://localhost:3000/api/device',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});
const generated=(document=device())=>({text:JSON.stringify(document),model:'gemini-4-argon'});
beforeEach(()=>{generate.mockReset();});afterEach(()=>vi.unstubAllGlobals());

function packGLB(json:unknown,binary?:ArrayBuffer):ArrayBuffer {
  const encoded=new TextEncoder().encode(JSON.stringify(json)),length=Math.ceil(encoded.length/4)*4,binLength=binary?Math.ceil(binary.byteLength/4)*4:0;
  const result=new ArrayBuffer(12+8+length+(binary?8+binLength:0)),view=new DataView(result);
  view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,result.byteLength,true);view.setUint32(12,length,true);view.setUint32(16,0x4e4f534a,true);
  new Uint8Array(result,20,length).fill(32);new Uint8Array(result,20,encoded.length).set(encoded);
  if(binary){view.setUint32(20+length,binLength,true);view.setUint32(24+length,0x004e4942,true);new Uint8Array(result,28+length,binary.byteLength).set(new Uint8Array(binary));}
  return result;
}
function meshFixture(){const positions=new Float32Array([0,0,0,1,0,0,0,1,0]);return packGLB({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0,1]}],nodes:[{name:'Main board',mesh:0},{name:'Cover',mesh:0,translation:[2,0,1],rotation:[0,0,Math.SQRT1_2,Math.SQRT1_2]}],meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],buffers:[{byteLength:positions.byteLength}],bufferViews:[{buffer:0,byteLength:positions.byteLength}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}],materials:[{pbrMetallicRoughness:{baseColorFactor:[.4,.6,.7,1],metallicFactor:.3,roughnessFactor:.5}}]},positions.buffer);}

describe('private embedded GLB import',()=>{
  it('rebuilds quantized source normals as unit Float32 vectors after small world-space transforms',async()=>{
    const binary=new ArrayBuffer(48);
    new Float32Array(binary,0,9).set([0,0,0,.001,0,0,0,.001,0]);
    new Int8Array(binary,36,9).set([0,0,127,0,0,127,0,0,127]);
    const file=packGLB({asset:{version:'2.0'},extensionsRequired:['KHR_mesh_quantization'],scene:0,scenes:[{nodes:[0]}],nodes:[{name:'Quantized normals',mesh:0,translation:[1,2,3],rotation:[Math.SQRT1_2,0,0,Math.SQRT1_2]}],meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1}}]}],buffers:[{byteLength:48}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36},{buffer:0,byteOffset:36,byteLength:9}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[.001,.001,0]},{bufferView:1,componentType:5120,normalized:true,count:3,type:'VEC3'}]},binary);
    const result=await importDeviceGLB(file,'Quantized.glb');
    const mesh=result.scene.getObjectByProperty('uuid',result.document.parts[0].assetNode!) as Mesh;
    const normals=mesh.geometry.getAttribute('normal');expect(normals.array).toBeInstanceOf(Float32Array);expect(normals.normalized).toBe(false);
    for(let i=0;i<normals.count;i++){
      expect(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))).toBeCloseTo(1,5);
      expect(normals.getX(i)).toBeCloseTo(0,5);expect(normals.getY(i)).toBeCloseTo(-1,5);expect(normals.getZ(i)).toBeCloseTo(0,5);
    }
  });
  it('keeps a logical GLB component with two material regions selectable as one part',async()=>{
    const positions=new Float32Array([0,0,0,1,0,0,0,1,0]);
    const file=packGLB({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'J3',mesh:0,translation:[2,1,0]}],meshes:[{primitives:[{attributes:{POSITION:0},material:0},{attributes:{POSITION:0},material:1}]}],buffers:[{byteLength:positions.byteLength}],bufferViews:[{buffer:0,byteLength:positions.byteLength}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}],materials:[{pbrMetallicRoughness:{baseColorFactor:[1,0,0,1]}},{pbrMetallicRoughness:{baseColorFactor:[0,1,0,1]}}]},positions.buffer);
    const result=await importDeviceGLB(file,'Connector.glb');expect(result.document.parts).toHaveLength(1);
    const part=result.document.parts[0],asset=result.scene.getObjectByProperty('uuid',part.assetNode!);
    expect(part.name).toBe('J3');expect(asset).toBeInstanceOf(Group);expect(asset!.children).toHaveLength(2);expect(asset!.position.toArray()).toEqual(part.position);
    const regions=asset!.children as Mesh[];expect(regions.every(mesh=>mesh.geometry.attributes.position.count===3)).toBe(true);expect(regions[0].material).not.toBe(regions[1].material);
    expect(new Box3().setFromObject(asset!).getSize(new Vector3()).x).toBeCloseTo(220,5);
  });
  it('imports actual transformed meshes with centered geometry, stable IDs and preserved materials',async()=>{
    const file=meshFixture(),first=await importDeviceGLB(file,'Computer.glb'),second=await importDeviceGLB(file,'Computer.glb');
    expect(first.document.parts.map(part=>part.id)).toEqual(['mesh-1','mesh-2']);expect(second.document.parts.map(part=>part.id)).toEqual(['mesh-1','mesh-2']);
    expect(first.document.source).toBe('import');expect(first.document.name).toBe('Computer');expect(first.document.parts.every(part=>part.solids.length===0)).toBe(true);
    for(const part of first.document.parts){const mesh=first.scene.getObjectByProperty('uuid',part.assetNode!) as Mesh;expect(mesh).toBeInstanceOf(Mesh);expect(mesh.geometry.getAttribute('position').count).toBe(3);expect(mesh.position.toArray()).toEqual(part.position);expect(mesh.rotation.toArray().slice(0,3)).toEqual([0,0,0]);mesh.geometry.computeBoundingBox();expect(mesh.geometry.boundingBox!.getCenter(new Vector3()).length()).toBeCloseTo(0,8);expect(Array.isArray(mesh.material)).toBe(false);}
    const size=new Box3().setFromObject(first.scene).getSize(new Vector3());expect(Math.max(size.x,size.y,size.z)).toBeCloseTo(220,5);
    expect(deviceDocumentSchema.safeParse(first.document).success).toBe(true);
  });
  it('uses content identity so different models with the same filename cannot overwrite each other',async()=>{
    const first=meshFixture(),changed=first.slice(0);new DataView(changed).setFloat32(changed.byteLength-4,.5,true);
    const a=await importDeviceGLB(first,'same.glb'),b=await importDeviceGLB(changed,'same.glb'),renamed=await importDeviceGLB(first,'renamed.glb');
    expect(a.document.id).not.toBe(b.document.id);expect(renamed.document.id).toBe(a.document.id);
  });
  it('blocks every external URI before any request and rejects non-embedded textures',async()=>{
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    for(const resources of [{buffers:[{uri:'https://private.example/model.bin',byteLength:4}]},{images:[{uri:'file:///private/image.png'}]},{extras:{uri:'https://example.test/hidden'}},{images:[{uri:'data:image/svg+xml,<svg></svg>'}]}])await expect(importDeviceGLB(packGLB({asset:{version:'2.0'},...resources}),'private.glb')).rejects.toThrow(/External|embedded|SVG/);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects malformed containers, oversized geometry, unsupported compression and cycles',()=>{
    expect(()=>inspectEmbeddedGLB(new ArrayBuffer(16))).toThrow();
    expect(()=>inspectEmbeddedGLB(new ArrayBuffer(MAX_GLB_BYTES+1))).toThrow(/25 MB/);
    const corrupt=meshFixture();new DataView(corrupt).setUint32(8,20,true);expect(()=>inspectEmbeddedGLB(corrupt)).toThrow(/complete/);
    expect(()=>inspectEmbeddedGLB(packGLB({asset:{version:'2.0'},accessors:[{count:3_000_001}]}))).toThrow(/oversized/);
    expect(()=>inspectEmbeddedGLB(packGLB({asset:{version:'2.0'},extensionsUsed:['KHR_draco_mesh_compression']}))).toThrow(/uncompressed/);
    expect(()=>inspectEmbeddedGLB(packGLB({asset:{version:'2.0'},nodes:[{children:[1]},{children:[0]}]}))).toThrow(/cycle/);
    expect(()=>inspectEmbeddedGLB(packGLB({asset:{version:'2.0'},nodes:[{children:[20]}]}))).toThrow(/missing child/);
    expect(()=>inspectEmbeddedGLB(packGLB({asset:{version:'2.0'},buffers:[{byteLength:8}],bufferViews:[{byteLength:1024,extensions:{EXT_meshopt_compression:{buffer:0,byteLength:8,count:3_000_000,byteStride:256,mode:'ATTRIBUTES'}}}]}))).toThrow(/oversized decoded/);
    expect(()=>inspectEmbeddedGLB(packGLB({asset:{version:'2.0'},buffers:[{byteLength:100*1024*1024+1}]}))).toThrow(/100 MB/);
  });
});

describe('real Stack Chan KiCad assembly',()=>{
  it('decodes the bundled meshopt board locally, preserves component grouping and enriches source metadata',async()=>{
    const model=await readFile(new URL('../public/assemblies/stack-chan/original.glb',import.meta.url));
    const metadata=await readFile(new URL('../public/assemblies/stack-chan/meta.json',import.meta.url),'utf8');
    const parts=await readFile(new URL('../public/assemblies/stack-chan/parts.json',import.meta.url),'utf8');
    const fetcher=vi.fn(async(input:string)=>input.endsWith('original.glb')?new Response(model):input.endsWith('meta.json')?new Response(metadata):input.endsWith('parts.json')?new Response(parts):new Response('blocked',{status:404}));vi.stubGlobal('fetch',fetcher);
    const result=await loadStackChan();expect(result.asset.byteLength).toBe(801804);expect(result.document.parts).toHaveLength(40);expect(result.document.source).toBe('import');expect(deviceDocumentSchema.safeParse(result.document).success).toBe(true);
    const connector=result.document.parts.find(part=>part.specs['KiCad reference']==='J3')!;expect(connector.name).toContain('3-pin JST');
    const connectorAsset=result.scene.getObjectByProperty('uuid',connector.assetNode!) as Group;expect(connectorAsset).toBeInstanceOf(Group);expect(connectorAsset.children).toHaveLength(2);
    const regions=connectorAsset.children as Mesh[];
    expect((regions[0].material as MeshStandardMaterial).color.getHexString()).toBe('e4e3cf');
    expect((regions[1].material as MeshStandardMaterial).color.getHexString()).toBe('d2d1c7');
    for(const region of regions){const normals=region.geometry.getAttribute('normal');expect(normals.array).toBeInstanceOf(Float32Array);for(let i=0;i<normals.count;i++)expect(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))).toBeCloseTo(1,5);}
    expect(result.document.parts.filter(part=>part.specs['KiCad reference']==='R3')).toHaveLength(1);expect(result.document.parts.find(part=>part.specs['KiCad reference']==='U1')!.name).toContain('MAX3485');
    expect(result.document.parts.some(part=>part.specs['KiCad reference']==='SW1')).toBe(false);expect(result.document.description).toContain('SW1');expect(result.document.description).toContain('50 × 50 mm');
    expect(result.document.provenance).toContain('ad876ea36e7ef13f08de2982fe8d15a6ffda5cc7');expect(result.document.provenance).toContain('c548129ec5ed13f59f76b0a852a5dd03b728825b');
    const bounds=new Box3().setFromObject(result.scene).getSize(new Vector3());expect(Math.max(bounds.x,bounds.y,bounds.z)).toBeCloseTo(220,4);
    expect(fetcher).toHaveBeenCalledTimes(3);expect(fetcher.mock.calls.every(([url])=>url.startsWith('/assemblies/stack-chan/'))).toBe(true);
    const reparsed=await importDeviceGLB(result.asset,'Saved board.glb');expect(reparsed.document.parts.map(part=>part.id)).toEqual(result.document.parts.map(part=>part.id));expect(reparsed.document.id).toBe(result.document.id);
  });
});

describe('universal device document boundaries',()=>{
  it('accepts the full detailed curated desktop under the shared document contract',()=>{
    const result=deviceDocumentSchema.safeParse(desktopComputer);expect(result.success?[]:result.error.issues).toEqual([]);
  });
  it('validates procedural geometry and rejects bad references, non-finite dimensions and fake asset nodes',()=>{
    expect(generatedDeviceSchema.safeParse(device()).success).toBe(true);
    const missing=device();missing.parts[0].connections[0].partId='absent';expect(deviceDocumentSchema.safeParse(missing).success).toBe(false);
    const bad=device();bad.parts[0].solids[0].size[1]=NaN;expect(deviceDocumentSchema.safeParse(bad).success).toBe(false);
    const fake=device();fake.parts[0].assetNode='invented';expect(generatedDeviceSchema.safeParse(fake).success).toBe(false);
    const duplicate=device();duplicate.parts[1].id=duplicate.parts[0].id;expect(deviceDocumentSchema.safeParse(duplicate).success).toBe(false);
  });
  it('bounds AI part counts and total procedural solids',()=>{
    const crowded=device();crowded.parts=Array.from({length:61},(_,i)=>({...structuredClone(crowded.parts[0]),id:`part-${i}`,connections:[]}));crowded.steps=[];
    expect(generatedDeviceSchema.safeParse(crowded).success).toBe(false);
    const detailed=device();detailed.parts[0].solids=Array.from({length:1500},()=>({kind:'box',position:[0,0,0],size:[1,1,1]}));detailed.parts[1].solids=structuredClone(detailed.parts[0].solids);
    expect(deviceDocumentSchema.safeParse(detailed).success).toBe(false);
  });
});

describe('universal device API',()=>{
  it('rejects invalid actions, unknown selections, malformed documents and foreign origins before Gemini',async()=>{
    for(const body of [{action:'bad',prompt:'Make a computer'},{action:'ask',prompt:'Explain it'},{action:'edit',prompt:'Make it blue',document:{}},{action:'ask',prompt:'Explain it',document:device(),partId:'missing'}])expect((await POST(request(body))).status).toBe(400);
    expect((await POST(request({action:'generate',prompt:'Make a computer'},'https://evil.test'))).status).toBe(403);expect(generate).not.toHaveBeenCalled();
  });
  it('returns validated conceptual geometry and actual responding model',async()=>{
    generate.mockResolvedValueOnce(generated());const response=await POST(request({action:'generate',prompt:'Make an exploded desktop computer'}));expect(response.status).toBe(200);const payload=await response.json();expect(payload.model).toBe('gemini-4-argon');expect(payload.document.provenance).toContain('illustrative');expect(generatedDeviceSchema.safeParse(payload.document).success).toBe(true);
  });
  it('repairs bad references, then rejects exhausted invalid output without a sample fallback',async()=>{
    const invalid=device();invalid.parts[0].connections[0].partId='absent';generate.mockResolvedValueOnce(generated(invalid)).mockResolvedValueOnce({model:'gemini-4-argon',text:JSON.stringify({repairs:[{path:['document','parts',0,'connections',0,'partId'],value:device().parts[0].connections[0].partId}]})});expect((await POST(request({action:'generate',prompt:'Make a computer'}))).status).toBe(200);expect(generate).toHaveBeenCalledTimes(2);
    generate.mockReset();generate.mockResolvedValue(generated(invalid));const response=await POST(request({action:'edit',prompt:'Make the case blue',document:device()}));expect(response.status).toBe(422);expect(generate).toHaveBeenCalledTimes(3);expect((await response.json()).document).toBeUndefined();
  });
  it('edits a selected curated part with a small patch while preserving the rest of a detailed assembly',async()=>{
    const original=device();original.source='curated';
    original.parts[0].solids[0].color=original.parts[0].color;
    original.parts[0].solids.push({kind:'sphere',position:[0,1,0],size:[2,2,2],color:'#aa44ff'});
    original.parts[1].solids=Array.from({length:1222},(_,i)=>({kind:'box',position:[i%20,0,0],size:[1,1,1],color:'#998877'}));
    const before=structuredClone(original);
    generate.mockResolvedValueOnce({text:JSON.stringify({patch:{color:'#0055ff',notes:'Blue primary fan housing; accent materials preserved.'}}),model:'gemini-4-argon'});
    const response=await POST(request({action:'edit',prompt:'Make this component blue',document:original,partId:'board'}));
    expect(response.status).toBe(200);const result=(await response.json()).document;
    expect(result.parts[0].color).toBe('#0055ff');expect(result.parts[0].solids[0].color).toBe('#0055ff');expect(result.parts[0].solids[1].color).toBe('#aa44ff');
    expect(result.parts[0].solids.map(({kind,position,size,rotation}:DeviceDocument['parts'][number]['solids'][number])=>({kind,position,size,rotation}))).toEqual(before.parts[0].solids.map(({kind,position,size,rotation})=>({kind,position,size,rotation})));
    expect(result.parts[1]).toEqual(before.parts[1]);expect(result.steps).toEqual(before.steps);expect(result.parts.map((part:{id:string})=>part.id)).toEqual(before.parts.map(part=>part.id));expect(original).toEqual(before);
    const context=JSON.parse(generate.mock.calls[0][1]).context;expect(context.otherComponents[0].solids).toBeUndefined();expect(generate).toHaveBeenCalledTimes(1);
  });
  it('answers selected-part questions with document context',async()=>{
    generate.mockResolvedValueOnce({text:JSON.stringify({intent:'ask',answer:'The board coordinates the device components.',actions:[{type:'focus',partIds:['board']}]}),model:'gemini-4-argon'});const response=await POST(request({action:'ask',prompt:'What does this part do?',document:device(),partId:'board'}));expect(await response.json()).toMatchObject({answer:'The board coordinates the device components.',actions:[{type:'focus',partIds:['board']}],model:'gemini-4-argon'});expect(generate.mock.calls[0][1]).toContain('"selected"');
  });
  it('preserves actual imported mesh identity and geometry during scoped appearance edits',async()=>{
    const imported=device();imported.source='import';imported.parts.forEach((part,i)=>{part.assetNode=`original-uuid-${i}`;part.solids=[];});const before=structuredClone(imported);
    generate.mockResolvedValueOnce({text:JSON.stringify({supported:true,patch:{color:'#ff0000',position:[10,20,30]}}),model:'gemini-4-argon'});
    const response=await POST(request({action:'edit',prompt:'Move this part up and make it red',document:imported,partId:'board'}));expect(response.status).toBe(200);const result=(await response.json()).document;expect(result.parts[0].assetNode).toBe(before.parts[0].assetNode);expect(result.parts[0].solids).toEqual([]);expect(result.parts[0].size).toEqual(before.parts[0].size);expect(result.parts[1]).toEqual(before.parts[1]);expect(imported).toEqual(before);
  });
  it('refuses imported mesh replacement patches and whole-model edits',async()=>{
    const imported=device();imported.source='import';imported.parts[0].assetNode='original-node';imported.parts[0].solids=[];
    expect((await POST(request({action:'edit',prompt:'Replace it with a new mesh',document:imported}))).status).toBe(400);
    generate.mockResolvedValue({text:JSON.stringify({supported:true,patch:{assetNode:'fake'}}),model:'gemini-4-argon'});expect((await POST(request({action:'edit',prompt:'Replace this mesh',document:imported,partId:'board'}))).status).toBe(422);
  });
});
