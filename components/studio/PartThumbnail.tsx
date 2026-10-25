'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { DevicePart, Solid, Vec3 } from '@/lib/studio/types';
type Face = { points: Vec3[]; color: string; depth: number; light: number; source?:boolean };
function rotate(p: Vec3, r: Vec3): Vec3 {
  let [x,y,z]=p; const [a,b,c]=r.map(n=>n*Math.PI/180);
  [y,z]=[y*Math.cos(a)-z*Math.sin(a),y*Math.sin(a)+z*Math.cos(a)];
  [x,z]=[x*Math.cos(b)+z*Math.sin(b),-x*Math.sin(b)+z*Math.cos(b)];
  return [x*Math.cos(c)-y*Math.sin(c),x*Math.sin(c)+y*Math.cos(c),z];
}
function faces(solid: Solid, base: string): Face[] {
  const points: Vec3[]=[]; const indices: number[][]=[];
  const [w,h,d]=solid.size;
  if(solid.kind==='box') {
    for(const y of [-h/2,h/2])for(const z of [-d/2,d/2])for(const x of [-w/2,w/2])points.push([x,y,z]);
    indices.push([4,5,7,6],[1,3,7,5],[2,6,7,3],[0,4,6,2],[0,1,5,4],[0,2,3,1]);
  } else if(solid.kind==='cylinder') {
    const n=20; for(const y of [-h/2,h/2])for(let i=0;i<n;i++){const a=i/n*Math.PI*2,r=(y>0?w:d)/2;points.push([Math.cos(a)*r,y,Math.sin(a)*r]);}
    indices.push(Array.from({length:n},(_,i)=>i+n),Array.from({length:n},(_,i)=>n-1-i));
    for(let i=0;i<n;i++)indices.push([i,(i+1)%n,(i+1)%n+n,i+n]);
  } else {
    const n=18,m=solid.kind==='torus'?6:10;
    for(let j=0;j<=m;j++)for(let i=0;i<n;i++){const a=i/n*Math.PI*2,b=j/m*Math.PI*(solid.kind==='torus'?2:1);points.push(solid.kind==='torus'?[(w+h*Math.cos(b))*Math.cos(a),(w+h*Math.cos(b))*Math.sin(a),h*Math.sin(b)]:[Math.sin(b)*Math.cos(a)*w/2,Math.cos(b)*h/2,Math.sin(b)*Math.sin(a)*d/2]);}
    for(let j=0;j<m;j++)for(let i=0;i<n;i++)indices.push([j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i]);
  }
  const transformed=points.map(p=>{const t=rotate(p,solid.rotation||[0,0,0]);return t.map((v,i)=>v+solid.position[i]) as Vec3;});
  return indices.map(index=>{const v=index.map(i=>transformed[i]);const a=v[1].map((n,i)=>n-v[0][i]),b=v[2].map((n,i)=>n-v[0][i]);const normal=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];const center=v.reduce<number[]>((sum,p)=>sum.map((n,i)=>n+p[i]/v.length),[0,0,0]);if(normal.reduce((sum,n,i)=>sum+n*(center[i]-solid.position[i]),0)<0)for(let i=0;i<3;i++)normal[i]*=-1;const l=Math.hypot(...normal)||1;const light=.57+.43*Math.max(0,(normal[0]*.3+normal[1]*.9+normal[2]*.35)/l);return {points:v,color:solid.color||base,depth:v.reduce((sum,p)=>sum+p[0]+p[1]+p[2],0)/v.length,light};});
}
function meshFinish(mesh:NonNullable<DevicePart['mesh']>,index:number,base:string){
  if(!mesh.colors)return base;
  const tint=new THREE.Color(base),c=mesh.colors.slice(index*3,index*3+3);
  return '#'+c.map((n,i)=>Math.round(n*[tint.r,tint.g,tint.b][i]*255).toString(16).padStart(2,'0')).join('');
}
const noSourceMeshes:{mesh:NonNullable<DevicePart['mesh']>;color:string}[]=[];
export default function PartThumbnail({part,large=false,scene,detailLimit=300,sourceMeshes=noSourceMeshes}:{part:DevicePart;large?:boolean;scene?:unknown;detailLimit?:number;sourceMeshes?:{mesh:NonNullable<DevicePart['mesh']>;color:string}[]}) {
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;
    const width=large?420:100,height=large?220:90;canvas.width=width;canvas.height=height;ctx.clearRect(0,0,width,height);
    const polygons: Face[]=[];
    if(part.mesh){
      const vertices=part.mesh.positions,indices=part.mesh.indices,step=part.catalogRef?1:Math.max(1,Math.ceil(indices.length/3/5000));
      for(let i=0;i+2<indices.length;i+=3*step){const points=[0,1,2].map(j=>vertices.slice(indices[i+j]*3,indices[i+j]*3+3) as Vec3),normal=new THREE.Triangle(...points.map(p=>new THREE.Vector3(...p)) as [THREE.Vector3,THREE.Vector3,THREE.Vector3]).getNormal(new THREE.Vector3());polygons.push({points,source:true,color:meshFinish(part.mesh,indices[i],part.color),depth:points.reduce((n,p)=>n+p[0]+p[1]+p[2],0)/3,light:.64+.36*Math.max(0,normal.dot(new THREE.Vector3(.3,.9,.35)))});}
    } else if(part.assetNode && scene instanceof THREE.Object3D){
      const node=scene.getObjectByProperty('uuid',part.assetNode);
      if(node){
        scene.updateMatrixWorld(true); const origin=node.getWorldPosition(new THREE.Vector3()); let primary: string | undefined; node.traverse(child => { if (!primary && child instanceof THREE.Mesh) { const first = Array.isArray(child.material) ? child.material[0] : child.material; if ('color' in first && first.color instanceof THREE.Color) primary = '#' + first.color.getHexString(); } });
        node.traverse(child=>{
          if(!(child instanceof THREE.Mesh))return;
          const geometry=child.geometry,index=geometry.index,count=index?.count||geometry.attributes.position.count;
          const material=Array.isArray(child.material)?child.material[0]:child.material;
          const sourceColor='color' in material && material.color instanceof THREE.Color ? '#'+material.color.getHexString():part.color; const base=sourceColor===primary?part.color:sourceColor;
          const step=Math.max(1,Math.ceil(count/3/6000));
          for(let i=0;i+2<count;i+=3*step){
            const points: Vec3[]=[];
            for(let j=0;j<3;j++){const vertex=new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,index?index.getX(i+j):i+j).applyMatrix4(child.matrixWorld).sub(origin);points.push(vertex.toArray() as Vec3);}
            const normal=new THREE.Vector3().subVectors(new THREE.Vector3(...points[1]),new THREE.Vector3(...points[0])).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...points[2]),new THREE.Vector3(...points[0]))).normalize();
            polygons.push({points,color:base,depth:points.reduce((sum,p)=>sum+p[0]+p[1]+p[2],0)/3,light:.72+.25*Math.max(0,normal.dot(new THREE.Vector3(.3,.9,.35)))});
          }
        });
      }
    } else {
      const solids=part.solids.length>detailLimit?[...part.solids].sort((a,b)=>b.size[0]*b.size[1]*b.size[2]-a.size[0]*a.size[1]*a.size[2]).slice(0,detailLimit):part.solids;
      polygons.push(...solids.flatMap(s=>faces(s,part.color)));
    }
    for(const source of sourceMeshes){const vertices=source.mesh.positions,indices=source.mesh.indices,step=Math.max(1,Math.ceil(indices.length/3/3500));for(let i=0;i+2<indices.length;i+=3*step){const points=[0,1,2].map(j=>vertices.slice(indices[i+j]*3,indices[i+j]*3+3) as Vec3),normal=new THREE.Triangle(...points.map(p=>new THREE.Vector3(...p)) as [THREE.Vector3,THREE.Vector3,THREE.Vector3]).getNormal(new THREE.Vector3());polygons.push({points,source:true,color:meshFinish(source.mesh,indices[i],source.color),depth:points.reduce((n,p)=>n+p[0]+p[1]+p[2],0)/3,light:.64+.36*Math.max(0,normal.dot(new THREE.Vector3(.3,.9,.35)))});}}
    if(!polygons.length)return;
    polygons.sort((a,b)=>a.depth-b.depth);
    const project=(p:Vec3)=>[(p[0]-p[2])*.866,(p[0]+p[2])*.38-p[1]];
    const projected=polygons.flatMap(f=>f.points.map(project));
    const lo=[Infinity,Infinity],hi=[-Infinity,-Infinity]; for(const p of projected){lo[0]=Math.min(lo[0],p[0]);lo[1]=Math.min(lo[1],p[1]);hi[0]=Math.max(hi[0],p[0]);hi[1]=Math.max(hi[1],p[1]);}
    const scale=Math.min((width-12)/(hi[0]-lo[0]||1),(height-12)/(hi[1]-lo[1]||1))*.87;
    ctx.translate(width/2,height/2);ctx.scale(scale,scale);ctx.translate(-(lo[0]+hi[0])/2,-(lo[1]+hi[1])/2);
    for(const face of polygons){ctx.beginPath();face.points.forEach((p,i)=>{const xy=project(p);if(i===0)ctx.moveTo(xy[0],xy[1]);else ctx.lineTo(xy[0],xy[1]);});ctx.closePath();const hex=face.color.length===4?face.color.slice(1).split('').map(c=>c+c).join(''):face.color.slice(1);const rgb=[0,2,4].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*face.light));ctx.fillStyle=`rgb(${rgb.join(',')})`;ctx.fill();if(!face.source){ctx.strokeStyle='rgba(23,43,35,.13)';ctx.lineWidth=.45/scale;ctx.stroke();}}
  },[part.mesh,part.solids,part.color,part.assetNode,large,scene,detailLimit,sourceMeshes]);
  return <canvas ref={ref} role="img" aria-label={`${part.name} geometry thumbnail`} className={large?'ds-thumbnail ds-thumbnail-large':'ds-thumbnail'}/>;
}
