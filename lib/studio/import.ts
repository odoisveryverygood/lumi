import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { DeviceDocument, DevicePart, Vec3 } from './types';
import { validateDeviceDocument } from './validation';

export const MAX_GLB_BYTES=25*1024*1024;
const MAX_MESHES=2000,MAX_TRIANGLES=1_000_000,MAX_DECODED_BYTES=100*1024*1024;
type GlbJson={asset?:{version?:string};buffers?:{uri?:string;byteLength?:number}[];bufferViews?:{buffer?:number;byteOffset?:number;byteLength?:number;extensions?:{EXT_meshopt_compression?:{buffer?:number;byteOffset?:number;byteLength?:number;count?:number;byteStride?:number;mode?:string;filter?:string}}}[];images?:{uri?:string;mimeType?:string}[];accessors?:{count?:number;type?:string;componentType?:number}[];nodes?:unknown[];extensionsRequired?:string[];extensionsUsed?:string[];meshes?:{primitives?:{indices?:number;mode?:number;attributes?:Record<string,number>;extensions?:{KHR_draco_mesh_compression?:{bufferView?:number;attributes?:Record<string,number>}}}[]}[]};
/** Parse and inspect the container before GLTFLoader can resolve any resource URL. */
export function inspectEmbeddedGLB(file:ArrayBuffer):GlbJson {
  if(!(file instanceof ArrayBuffer)||file.byteLength<20)throw new Error('Choose a valid binary .glb file.');
  if(file.byteLength>MAX_GLB_BYTES)throw new Error('This model exceeds the 25 MB import limit. Export a smaller embedded GLB.');
  const view=new DataView(file);
  if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==file.byteLength)throw new Error('This file is not a complete glTF 2.0 binary GLB.');
  let json:GlbJson|undefined,offset=12;
  while(offset<file.byteLength) {
    if(offset+8>file.byteLength)throw new Error('The GLB contains a truncated chunk.');
    const length=view.getUint32(offset,true),kind=view.getUint32(offset+4,true);offset+=8;
    if(length%4!==0||length>file.byteLength-offset)throw new Error('The GLB has invalid chunk lengths.');
    if(!json&&kind!==0x4e4f534a)throw new Error('The first GLB chunk must contain its scene description.');
    if(kind===0x4e4f534a) {
      if(json)throw new Error('The GLB contains multiple scene-description chunks.');
      try {json=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(file,offset,length)).trim()) as GlbJson;}catch{throw new Error('The GLB scene description is malformed.');}
    }
    offset+=length;
  }
  if(!json||typeof json!=='object'||Array.isArray(json)||json.asset?.version!=='2.0')throw new Error('The model must use glTF 2.0.');
  const inspect=(value:unknown,depth=0)=>{
    if(depth>120)throw new Error('The model hierarchy is too deeply nested.');
    if(typeof value==='number'&&!Number.isFinite(value))throw new Error('The model contains non-finite geometry values.');
    if(!value||typeof value!=='object')return;
    if(Array.isArray(value)){for(const item of value)inspect(item,depth+1);return;}
    for(const [key,item]of Object.entries(value)){
      if(key==='uri'&&(typeof item!=='string'||!item.startsWith('data:')))throw new Error('External model resources are blocked. Export a GLB with all buffers and textures embedded; no remote files will be fetched.');
      inspect(item,depth+1);
    }
  };
  inspect(json);
  for(const field of ['buffers','bufferViews','images','accessors','nodes','meshes','extensionsRequired','extensionsUsed'] as const)if(json[field]!==undefined&&!Array.isArray(json[field]))throw new Error('The GLB scene description contains invalid resource lists.');
  const states=new Map<number,number>(),heights=new Map<number,number>();
  const visit=(index:number,depth=0):number=>{
    if(depth>120||states.get(index)===1)throw new Error('The GLB hierarchy contains a cycle or exceeds the supported depth.');
    if(states.get(index)===2)return heights.get(index)!;
    states.set(index,1);
    const node=json!.nodes![index] as {children?:unknown};
    if(!node||typeof node!=='object'||node.children!==undefined&&!Array.isArray(node.children))throw new Error('The GLB has invalid node hierarchy data.');
    let height=1;
    for(const child of node.children as number[]??[]){if(!Number.isInteger(child)||child<0||child>=json!.nodes!.length)throw new Error('The GLB references a missing child node.');height=Math.max(height,1+visit(child,depth+1));}
    if(height>120)throw new Error('The GLB hierarchy exceeds the supported depth.');
    states.set(index,2);heights.set(index,height);return height;
  };
  for(let i=0;i<(json.nodes?.length??0);i++)visit(i);
  if((json.nodes?.length??0)>10000||(json.meshes?.length??0)>MAX_MESHES)throw new Error('This model contains too many objects. Import an assembly with at most 2000 meshes.');
  if(json.accessors?.some(accessor=>!Number.isInteger(accessor.count)||accessor.count!<0||accessor.count!>3_000_000))throw new Error('The model has an invalid or oversized geometry accessor.');
  if(json.buffers?.some(buffer=>!Number.isInteger(buffer.byteLength)||buffer.byteLength!<0||buffer.byteLength!>MAX_DECODED_BYTES)||(json.buffers??[]).reduce((sum,buffer)=>sum+(buffer.byteLength??0),0)>MAX_DECODED_BYTES)throw new Error('The model contains oversized decoded geometry buffers (100 MB limit).');
  let decodedBytes=0;
  for(const view of json.bufferViews??[]) {
    const ext=view.extensions?.EXT_meshopt_compression;if(!ext)continue;
    const count=ext.count??0,stride=ext.byteStride??0,offset=ext.byteOffset??0,length=ext.byteLength??0,buffer=ext.buffer??-1;
    const decoded=count*stride;
    if(!Number.isInteger(count)||count<1||count>3_000_000||!Number.isInteger(stride)||stride<1||stride>256||!Number.isSafeInteger(decoded)||decoded!==view.byteLength||decoded>MAX_DECODED_BYTES)throw new Error('The meshopt data has an invalid or oversized decoded geometry buffer.');
    if(!Number.isInteger(buffer)||buffer<0||buffer>=(json.buffers?.length??0)||!Number.isInteger(offset)||offset<0||!Number.isInteger(length)||length<1||offset+length>(json.buffers?.[buffer].byteLength??0))throw new Error('The meshopt data references an invalid compressed buffer range.');
    if(!['ATTRIBUTES','TRIANGLES','INDICES'].includes(ext.mode??'')||ext.filter!==undefined&&!['NONE','OCTAHEDRAL','QUATERNION','EXPONENTIAL'].includes(ext.filter))throw new Error('The meshopt data has unsupported compression settings.');
    decodedBytes+=decoded;if(decodedBytes>MAX_DECODED_BYTES)throw new Error('The model exceeds the 100 MB decoded meshopt geometry limit.');
  }
  const compressed=[...(json.extensionsRequired??[]),...(json.extensionsUsed??[])].find(name=>name==='KHR_texture_basisu');
  if(compressed)throw new Error(`This GLB uses ${compressed}. Re-export with ordinary uncompressed geometry and PNG/JPEG textures for local import.`);
  if([...(json.extensionsRequired??[]),...(json.extensionsUsed??[])].includes('KHR_draco_mesh_compression')){
    let primitives=0,estimatedBytes=0,triangles=0;
    for(const mesh of json.meshes??[])for(const primitive of mesh.primitives??[]){
      const draco=primitive.extensions?.KHR_draco_mesh_compression;if(!draco)continue;primitives++;
      const bv=draco.bufferView===undefined?undefined:json.bufferViews?.[draco.bufferView],buffer=bv?.buffer===undefined?undefined:json.buffers?.[bv.buffer];
      if(!bv||!Number.isInteger(draco.bufferView)||!buffer||!Number.isInteger(bv.byteLength)||(bv.byteLength??0)<1||!Number.isInteger(bv.byteOffset??0)||(bv.byteOffset??0)<0||(bv.byteOffset??0)+(bv.byteLength??0)>(buffer.byteLength??0)||!draco.attributes||!Object.keys(draco.attributes).length)throw new Error('Draco geometry needs a valid embedded buffer and bounded accessors; re-export uncompressed if unavailable.');
      const positionIndex=primitive.attributes?.POSITION,position=positionIndex===undefined?undefined:json.accessors?.[positionIndex];
      if(!position||!Number.isInteger(positionIndex)||!Number.isInteger(position.count)||position.count!<1||position.count!>1_000_000)throw new Error('Draco geometry has missing or oversized position metadata.');
      for(const [semantic,attribute]of Object.entries(draco.attributes))if(!Number.isInteger(attribute)||attribute<0||primitive.attributes?.[semantic]===undefined)throw new Error('Draco geometry has invalid attribute references.');
      const referenced=[...Object.values(primitive.attributes??{}),...(primitive.indices===undefined?[]:[primitive.indices])];
      for(const index of referenced){const accessor=json.accessors?.[index],width=accessor?.type?({SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16} as Record<string,number>)[accessor.type]:0;if(!Number.isInteger(index)||!accessor||!width||!Number.isInteger(accessor.count)||accessor.count!<1||![5120,5121,5122,5123,5125,5126].includes(accessor.componentType??0))throw new Error('Draco geometry has invalid decoded accessor metadata.');estimatedBytes+=accessor.count!*width*4;}
      triangles+=Math.floor((primitive.indices===undefined?position.count:json.accessors?.[primitive.indices]?.count??0)!/3);
      if(estimatedBytes>MAX_DECODED_BYTES||triangles>MAX_TRIANGLES)throw new Error('Draco geometry exceeds the 100 MB decoded / one million triangle budget.');
    }
    if(!primitives)throw new Error('Draco geometry metadata is missing. Re-export uncompressed geometry.');
  }
  for(const image of json.images??[]) {
    const mime=image.mimeType??image.uri?.match(/^data:([^;,]+)/)?.[1];
    if(mime&&!['image/png','image/jpeg','image/webp'].includes(mime))throw new Error('Use embedded PNG, JPEG or WebP textures. SVG and external image resources are not loaded.');
  }
  return json;
}

function reverseWinding(geometry:THREE.BufferGeometry) {
  if(!geometry.index){const count=geometry.getAttribute('position').count,indices=new Uint32Array(count);for(let i=0;i<count;i++)indices[i]=i;geometry.setIndex(new THREE.BufferAttribute(indices,1));}
  const index=geometry.index!;
  for(let i=0;i+2<index.count;i+=3){const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b);}
}
function contentId(file:ArrayBuffer){let hash=0x811c9dc5;for(const byte of new Uint8Array(file))hash=Math.imul(hash^byte,0x01000193);return `import-${file.byteLength.toString(36)}-${(hash>>>0).toString(16).padStart(8,'0')}`;}
function displayName(value:string,fallback:string){return(value.replace(/[\u0000-\u001f]/g,'').trim()||fallback).slice(0,160);}
/** Each returned component has centered, baked local geometry; its root UUID is the assetNode. */
export async function importDeviceGLB(file:ArrayBuffer,name:string):Promise<{document:DeviceDocument;scene:THREE.Group}> {
  const metadata=inspectEmbeddedGLB(file);
  // Defense in depth: even a newly supported extension cannot initiate remote I/O.
  const manager=new THREE.LoadingManager();
  manager.setURLModifier(url=>{if(url.startsWith('blob:')||url.startsWith('data:'))return url;throw new Error('External model resource loading is disabled.');});
  const loader=new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
  const usesDraco=[...(metadata.extensionsRequired??[]),...(metadata.extensionsUsed??[])].includes('KHR_draco_mesh_compression');
  const draco=usesDraco?new (await import('three/addons/loaders/DRACOLoader.js')).DRACOLoader().setDecoderPath('/catalog/decoders/draco/').setDecoderConfig({type:'wasm'}).setWorkerLimit(1):null;
  if(draco)loader.setDRACOLoader(draco);
  let gltf:Awaited<ReturnType<GLTFLoader['parseAsync']>>;
  try{gltf=await loader.parseAsync(file,'');}catch(error){throw new Error(error instanceof Error&&error.message.includes('External model')?error.message:'The embedded GLB could not be decoded. Export a standard glTF 2.0 binary file with embedded geometry and PNG/JPEG textures.');}finally{draco?.dispose();}
  gltf.scene.updateMatrixWorld(true);
  type MeshEntry={mesh:THREE.Mesh;matrix:THREE.Matrix4};
  const entries:{meshes:MeshEntry[];name:string}[]=[];
  let triangles=0;
  let meshCount=0;
  const meshEntry=(mesh:THREE.Mesh,matrix:THREE.Matrix4):MeshEntry=>{
    const count=mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count;
    triangles+=Math.floor(count/3);meshCount++;
    if(triangles>MAX_TRIANGLES||meshCount>MAX_MESHES)throw new Error('This model exceeds the import budget: at most 2000 meshes and one million triangles. Simplify it before importing.');
    return {mesh,matrix};
  };
  // GLTFLoader exposes each glTF primitive as a separate material mesh. A logical
  // component made of those regions must still select, move and explode as one.
  const materialGroup=(object:THREE.Object3D):boolean=>!(object instanceof THREE.Mesh)&&object.children.length>0&&(
    object.children.every(child=>child instanceof THREE.Mesh&&!(child instanceof THREE.InstancedMesh))||
    object.children.length===1&&materialGroup(object.children[0])
  );
  const collect=(object:THREE.Object3D)=>{
    if(object instanceof THREE.Mesh) {
      if(!object.geometry.getAttribute('position'))return;
      const instances=object instanceof THREE.InstancedMesh?object.count:1;
      for(let i=0;i<instances;i++) {
        const matrix=object.matrixWorld.clone();
        if(object instanceof THREE.InstancedMesh){const instance=new THREE.Matrix4();object.getMatrixAt(i,instance);matrix.multiply(instance);}
        entries.push({meshes:[meshEntry(object,matrix)],name:displayName(object.name,`Component ${entries.length+1}`)+(instances>1?` · ${i+1}`:'')});
      }
      return;
    }
    if(object!==gltf.scene&&materialGroup(object)) {
      const meshes:MeshEntry[]=[];
      object.traverse(child=>{if(child instanceof THREE.Mesh&&child.geometry.getAttribute('position'))meshes.push(meshEntry(child,child.matrixWorld.clone()));});
      if(meshes.length)entries.push({meshes,name:displayName(object.name||meshes[0].mesh.name,`Component ${entries.length+1}`)});
      return;
    }
    for(const child of object.children)collect(child);
  };
  collect(gltf.scene);
  if(!entries.length)throw new Error('This GLB contains no triangle mesh components to inspect.');
  const baked:{geometry:THREE.BufferGeometry;mesh:THREE.Mesh}[][]=[];
  const bounds=new THREE.Box3();
  try {
    for(const entry of entries) {
      const component:typeof baked[number]=[];baked.push(component);
      for(const item of entry.meshes) {
        const geometry=item.mesh.geometry.clone(),positions=geometry.getAttribute('position');
        // Register before mutation so a failed vertex conversion is also cleaned up.
        component.push({geometry,mesh:item.mesh});
        const values=new Float32Array(positions.count*3),vertex=new THREE.Vector3();
        for(let i=0;i<positions.count;i++) {
          item.mesh.getVertexPosition(i,vertex);vertex.applyMatrix4(item.matrix);
          if(![vertex.x,vertex.y,vertex.z].every(Number.isFinite))throw new Error('The model contains invalid vertex positions.');
          values.set([vertex.x,vertex.y,vertex.z],i*3);
        }
        geometry.setAttribute('position',new THREE.BufferAttribute(values,3));geometry.morphAttributes={};geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');geometry.deleteAttribute('tangent');
        if(item.matrix.determinant()<0)reverseWinding(geometry);
        // Reusing normalized Int8 source normals rounds small world-space face
        // vectors to zero. Let Three allocate fresh Float32 normals instead.
        geometry.deleteAttribute('normal');geometry.computeVertexNormals();geometry.computeBoundingBox();
        if(!geometry.boundingBox||![...geometry.boundingBox.min.toArray(),...geometry.boundingBox.max.toArray()].every(Number.isFinite))throw new Error('The model has non-finite geometry bounds.');
        bounds.union(geometry.boundingBox);
      }
    }
    const size=bounds.getSize(new THREE.Vector3()),extent=Math.max(size.x,size.y,size.z);
    if(!Number.isFinite(extent)||extent<1e-9)throw new Error('The model has no usable physical extent.');
    const factor=220/extent,origin=bounds.getCenter(new THREE.Vector3()),scene=new THREE.Group(),parts:DevicePart[]=[];
    scene.name='Imported device assembly';
    for(const [index,component]of baked.entries()) {
      const componentBounds=new THREE.Box3();for(const item of component)componentBounds.union(item.geometry.boundingBox!);
      const center=componentBounds.getCenter(new THREE.Vector3()),dimensions=componentBounds.getSize(new THREE.Vector3()).multiplyScalar(factor);
      const asset=component.length===1?new THREE.Mesh(component[0].geometry,component[0].mesh.material):new THREE.Group();
      for(const {geometry,mesh:original}of component) {
        geometry.translate(-center.x,-center.y,-center.z);geometry.scale(factor,factor,factor);geometry.computeBoundingBox();geometry.computeBoundingSphere();
        if(asset instanceof THREE.Group){const child=new THREE.Mesh(geometry,original.material);child.name=original.name;asset.add(child);}
      }
      const position=center.clone().sub(origin).multiplyScalar(factor);asset.name=entries[index].name;asset.position.copy(position);scene.add(asset);
      const material=component[0].mesh.material,first=Array.isArray(material)?material[0]:material;
      const color='color'in first&&(first as THREE.MeshStandardMaterial).color instanceof THREE.Color?`#${(first as THREE.MeshStandardMaterial).color.getHexString()}`:'#a3a7aa';
      const radial=position.clone();if(radial.length()<1)radial.set(index%2?1:-1,.5,(index%3)-1);radial.normalize().multiplyScalar(35+Math.min(50,index*1.8));radial.y+=25;
      parts.push({id:`mesh-${index+1}`,name:entries[index].name,category:'Imported mesh',description:'Original geometry from the imported GLB, preserved as a selectable component.',role:'Its function is not inferred from mesh geometry alone. Rename and annotate this component as needed.',position:position.toArray() as Vec3,rotation:[0,0,0],size:dimensions.toArray().map(value=>Math.max(.01,value)) as Vec3,explode:radial.toArray() as Vec3,color,solids:[],specs:{Geometry:`Original embedded GLB component (${component.length} material mesh${component.length===1?'':'es'})`,'Display scale':'Normalized so the full model spans 220 mm; physical dimensions are unverified'},connections:[],assetNode:asset.uuid,notes:'Static mesh snapshot. Materials and grouped material regions are preserved; original animations are not retained.'});
    }
    const title=displayName(name.replace(/\.glb$/i,''),'Imported device');
    const document:DeviceDocument={version:1,id:contentId(file),name:title,description:`Imported ${parts.length} individually selectable mesh component${parts.length===1?'':'s'} from ${displayName(name,'a local GLB file')}.`,provenance:'Original local GLB geometry. Display dimensions are normalized, not manufacturer measurements. No external resources were fetched.',source:'import',parts,steps:[]};
    return {document:validateDeviceDocument(document),scene};
  }catch(error){for(const component of baked)for(const item of component)item.geometry.dispose();throw error;}
}
