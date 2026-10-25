import * as THREE from 'three';
import {renderAssembly} from './render-model';
import {qualityFingerprint} from './quality-fingerprint';
import type {DeviceDocument,Vec3} from './types';
import type {ReviewFrame} from './quality-types';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
export type RenderOptions={width:number;height:number;view?:'assembled'|'top'|'exploded';explode?:number;zoom?:number;yaw?:number;pitch?:number;selectedId?:string|null;hiddenIds?:string[];isolatedId?:string|null;framing?:{center:Vec3;radius:number}};
export type GeometryImage={rgba:Uint8ClampedArray;partIndices:Int32Array;width:number;height:number;visiblePartIds:string[];triangles:number};
const light=new THREE.Vector3(.35,.8,.6).normalize();
const srgb=(n:number)=>Math.round(255*Math.max(0,Math.min(1,n<=.0031308?n*12.92:1.055*n**(1/2.4)-.055)));

/** Z-buffered triangle rasterization. No dropped triangles, fabricated meshes or external images. */
export function createGeometryRenderer(document:DeviceDocument,importedScene?:unknown){
 const assembly=renderAssembly(document,importedScene),root=assembly.root;
 function setup(options:RenderOptions){
  const hidden=new Set(options.hiddenIds),amount=options.explode??(options.view==='exploded'?.7:0);
  root.children.forEach((object,index)=>{const part=document.parts[index];object.visible=!hidden.has(part.id)&&(!options.isolatedId||part.id===options.isolatedId);object.position.set(...part.position).addScaledVector(new THREE.Vector3(...part.explode),amount);});root.updateMatrixWorld(true);
  const bounds=new THREE.Box3();for(const child of root.children)if(child.visible)bounds.expandByObject(child);
  const center=options.framing?new THREE.Vector3(...options.framing.center):bounds.isEmpty()?new THREE.Vector3():bounds.getCenter(new THREE.Vector3()),radius=options.framing?.radius??Math.max(1,bounds.isEmpty()?100:bounds.getSize(new THREE.Vector3()).length()/2),aspect=options.width/options.height,span=radius*1.15/Math.max(.2,options.zoom??1);
  const camera=new THREE.OrthographicCamera(-span*aspect,span*aspect,span,-span,.01,radius*10+100);
  if(options.view==='top'){camera.position.copy(center).add(new THREE.Vector3(0,radius*3+10,0));camera.up.set(0,0,-1);}
  else{const yaw=options.yaw??.73,pitch=options.pitch??.43;camera.position.copy(center).add(new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(radius*3+10));}
  camera.lookAt(center);camera.updateMatrixWorld(true);camera.updateProjectionMatrix();return {camera,radius,center};
 }
 function render(options:RenderOptions):GeometryImage{
  const {width,height}=options;if(width<1||height<1||width*height>2_000_000)throw new Error('Review render exceeds the pixel budget.');
  const {camera}=setup(options),rgba=new Uint8ClampedArray(width*height*4),depth=new Float32Array(width*height).fill(Infinity),partIndices=new Int32Array(width*height).fill(-1);
  for(let p=0;p<rgba.length;p+=4){rgba[p]=250;rgba[p+1]=246;rgba[p+2]=237;rgba[p+3]=255;}
  const projection=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),combined=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),n=new THREE.Vector3(),u=new THREE.Vector3(),v=new THREE.Vector3();let triangles=0;
  root.traverseVisible(node=>{
   if(!(node instanceof THREE.Mesh))return;
   const geometry=node.geometry,positions=geometry.getAttribute('position');if(!positions)return;const index=geometry.index,colors=geometry.getAttribute('color'),count=index?.count??positions.count;
   combined.multiplyMatrices(projection,node.matrixWorld);normalMatrix.getNormalMatrix(node.matrixWorld);
   const materials=Array.isArray(node.material)?node.material:[node.material],groups=geometry.groups;
   for(let i=0;i+2<count;i+=3){
    if(++triangles>1_000_000)throw new Error('Review render exceeds one million triangles.');
    const group=groups.find((g:{start:number;count:number;materialIndex?:number})=>i>=g.start&&i<g.start+g.count),material=materials[group?.materialIndex??0]||materials[0];if(!material||material.opacity<.2)continue;
    const ia=index?index.getX(i):i,ib=index?index.getX(i+1):i+1,ic=index?index.getX(i+2):i+2;
    a.fromBufferAttribute(positions,ia);b.fromBufferAttribute(positions,ib);c.fromBufferAttribute(positions,ic);n.crossVectors(u.subVectors(b,a),v.subVectors(c,a)).applyMatrix3(normalMatrix).normalize();
    const shade=.58+.42*Math.max(0,n.dot(light)),base='color'in material&&material.color instanceof THREE.Color?material.color:new THREE.Color('#a7a29b');
    let red=base.r,green=base.g,blue=base.b;if(colors&&'vertexColors'in material&&material.vertexColors){red*=(colors.getX(ia)+colors.getX(ib)+colors.getX(ic))/3;green*=(colors.getY(ia)+colors.getY(ib)+colors.getY(ic))/3;blue*=(colors.getZ(ia)+colors.getZ(ib)+colors.getZ(ic))/3;}
    const rr=srgb(red*shade),gg=srgb(green*shade),bb=srgb(blue*shade);
    a.applyMatrix4(combined);b.applyMatrix4(combined);c.applyMatrix4(combined);
    const ax=(a.x+1)*width/2,ay=(1-a.y)*height/2,bx=(b.x+1)*width/2,by=(1-b.y)*height/2,cx=(c.x+1)*width/2,cy=(1-c.y)*height/2;
    const area=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(area)<1e-9)continue;
    const left=Math.max(0,Math.floor(Math.min(ax,bx,cx))),right=Math.min(width-1,Math.ceil(Math.max(ax,bx,cx))),top=Math.max(0,Math.floor(Math.min(ay,by,cy))),bottom=Math.min(height-1,Math.ceil(Math.max(ay,by,cy)));
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
     const wa=((by-cy)*(x+.5-cx)+(cx-bx)*(y+.5-cy))/area,wb=((cy-ay)*(x+.5-cx)+(ax-cx)*(y+.5-cy))/area,wc=1-wa-wb;if(wa<-.00001||wb<-.00001||wc<-.00001)continue;
     const z=wa*a.z+wb*b.z+wc*c.z,at=y*width+x;if(z>=depth[at])continue;depth[at]=z;partIndices[at]=node.userData.partIndex;rgba[at*4]=rr;rgba[at*4+1]=gg;rgba[at*4+2]=bb;
    }
   }
  });
  const seen=new Set<number>();for(const id of partIndices)if(id>=0)seen.add(id);
  const selected=document.parts.findIndex(p=>p.id===options.selectedId);if(selected>=0)for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const p=y*width+x;if(partIndices[p]===selected&&[p-1,p+1,p-width,p+width].some(q=>partIndices[q]!==selected)){rgba[p*4]=225;rgba[p*4+1]=123;rgba[p*4+2]=45;}}
  return {rgba,partIndices,width,height,visiblePartIds:[...seen].map(i=>document.parts[i].id),triangles};
 }
 return {root,setup,render,dispose:assembly.dispose};
}
const nextFrame=(signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{const abort=()=>{cancelAnimationFrame(frame);reject(signal.reason);};const frame=requestAnimationFrame(()=>{signal.removeEventListener('abort',abort);resolve();});signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});
export async function captureReviewViews(value:DeviceDocument,signal:AbortSignal,importedScene?:unknown,referenceFrames?:ReviewFrame[],views:ReviewFrame['view'][]=['assembled','top','exploded']):Promise<ReviewFrame[]>{
 const documentHash=await qualityFingerprint(value),renderer=createGeometryRenderer(value,importedScene),frames:ReviewFrame[]=[],canvas=document.createElement('canvas');canvas.width=640;canvas.height=440;
 const context=canvas.getContext('2d');if(!context){renderer.dispose();throw new Error('A canvas is required to inspect the actual geometry.');}
 const gpuCanvas=document.createElement('canvas'),gl=gpuCanvas.getContext('webgl2',{antialias:true,preserveDrawingBuffer:true});let gpu:THREE.WebGLRenderer|undefined,target:THREE.WebGLRenderTarget|undefined,scene:THREE.Scene|undefined;
 try{if(gl){gpu=new THREE.WebGLRenderer({canvas:gpuCanvas,context:gl,antialias:true,preserveDrawingBuffer:true});gpu.setSize(640,440);gpu.setPixelRatio(1);gpu.outputColorSpace=THREE.SRGBColorSpace;gpu.toneMapping=THREE.ACESFilmicToneMapping;scene=new THREE.Scene();scene.background=new THREE.Color('#faf6ed');scene.add(renderer.root,new THREE.HemisphereLight('#fff5df','#bdb5ac',2));const key=new THREE.DirectionalLight('#fff4df',3);key.position.set(300,500,400);scene.add(key);const room=new RoomEnvironment(),generator=new THREE.PMREMGenerator(gpu);target=generator.fromScene(room,.05,.1,100,{size:128});scene.environment=target.texture;scene.environmentIntensity=.85;room.dispose();generator.dispose();}
  for(const view of views){signal.throwIfAborted();await nextFrame(signal);const options={width:640,height:440,view,framing:referenceFrames?.find(f=>f.view===view)?.framing},result=renderer.render(options),camera=renderer.setup(options);if(!result.visiblePartIds.length)throw new Error('The review render contains no visible geometry.');let data:string;if(gpu&&scene){gpu.render(scene,camera.camera);data=gpuCanvas.toDataURL('image/jpeg',.82).split(',')[1];}else{context.putImageData(new ImageData(new Uint8ClampedArray(result.rgba),640,440),0,0);data=canvas.toDataURL('image/jpeg',.82).split(',')[1];}frames.push({view,renderer:gpu?'webgl':'software',mimeType:'image/jpeg',data,documentHash,visiblePartIds:result.visiblePartIds,width:640,height:440,framing:{center:camera.center.toArray() as Vec3,radius:camera.radius}});}return frames;
 }finally{renderer.dispose();target?.dispose();gpu?.dispose();gpu?.forceContextLoss();}
}
