import {Box3,BufferGeometry,Float32BufferAttribute,Matrix4,Ray,Triangle,Vector3} from 'three';
import {solidGeometry,type GeometryBank} from './render-model';
import type {DevicePart} from './types';

const EPS=1e-7;
type Tree={box:Box3;left?:Tree;right?:Tree;triangles?:Triangle[]};
export type Surface={tree:Tree;seeds:Vector3[];closed:boolean;triangles:number};
export type GeometryBudget={comparisons:number;limit:number;signal?:AbortSignal};
function spend(b:GeometryBudget){if(++b.comparisons>b.limit)throw new Error('Triangle comparison budget exhausted.');if(b.comparisons%1024===0)b.signal?.throwIfAborted();}
export function boxDistance(a:Box3,b:Box3){return Math.hypot(...['x','y','z'].map(k=>{const axis=k as 'x'|'y'|'z';return Math.max(0,a.min[axis]-b.max[axis],b.min[axis]-a.max[axis]);}));}
function tree(triangles:Triangle[]):Tree{
 const box=new Box3();for(const t of triangles)box.expandByPoint(t.a).expandByPoint(t.b).expandByPoint(t.c);
 if(triangles.length<=8)return {box,triangles};
 const size=box.getSize(new Vector3()),axis=size.x>=size.y&&size.x>=size.z?'x':size.y>=size.z?'y':'z';
 triangles.sort((a,b)=>(a.a[axis]+a.b[axis]+a.c[axis])-(b.a[axis]+b.b[axis]+b.c[axis]));const half=Math.floor(triangles.length/2);
 return {box,left:tree(triangles.slice(0,half)),right:tree(triangles.slice(half))};
}
function surface(geometry:BufferGeometry,knownClosed:boolean):Surface{
 const positions=geometry.getAttribute('position'),index=geometry.getIndex(),triangles:Triangle[]=[],edges=new Map<string,number>(),parents:number[]=[],points:Vector3[]=[],weld=new Map<string,number>();
 const root=(i:number):number=>parents[i]===i?i:(parents[i]=root(parents[i]));
 const vertex=(i:number)=>{const p=new Vector3().fromBufferAttribute(positions,i),key=p.toArray().map(n=>Math.round(n*1e5)).join(',');let id=weld.get(key);if(id===undefined){id=points.length;weld.set(key,id);points.push(p);parents.push(id);}return id;};
 const n=index?.count??positions.count;
 for(let i=0;i<n;i+=3){const ids=[0,1,2].map(j=>vertex(index?index.getX(i+j):i+j)),t=new Triangle(...ids.map(j=>points[j].clone()) as [Vector3,Vector3,Vector3]);if(t.getArea()<EPS)continue;triangles.push(t);for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],key=[a,b].sort((x,y)=>x-y).join(':');edges.set(key,(edges.get(key)??0)+1);parents[root(a)]=root(b);}}
 if(!triangles.length)throw new Error('Empty source geometry.');
 const groups=new Map<number,Vector3>();points.forEach((p,i)=>groups.set(root(i),p));
 return {tree:tree(triangles),seeds:[...groups.values()],closed:knownClosed||[...edges.values()].every(count=>count===2),triangles:triangles.length};
}
export function partSurfaces(part:DevicePart,bank:GeometryBank):Surface[]{
 if(part.assetNode)throw new Error('Imported assets have no verified joint/units.');
 if(part.mesh){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(part.mesh.positions,3));g.setIndex(part.mesh.indices);try{return [surface(g,false)];}finally{g.dispose();}}
 if(!part.solids.length)throw new Error('No supported solid geometry.');
 return part.solids.map(s=>{const g=solidGeometry(s,bank);try{return surface(g,true);}finally{g.dispose();}});
}
function transformTree(node:Tree,m:Matrix4):Tree{return {box:node.box.clone().applyMatrix4(m),...(node.triangles?{triangles:node.triangles.map(t=>new Triangle(t.a.clone().applyMatrix4(m),t.b.clone().applyMatrix4(m),t.c.clone().applyMatrix4(m)))}:{left:transformTree(node.left!,m),right:transformTree(node.right!,m)})};}
export function transformSurface(s:Surface,m:Matrix4):Surface{return {...s,tree:transformTree(s.tree,m),seeds:s.seeds.map(p=>p.clone().applyMatrix4(m))};}
function segmentDistance(p1:Vector3,q1:Vector3,p2:Vector3,q2:Vector3){
 const d1=q1.clone().sub(p1),d2=q2.clone().sub(p2),r=p1.clone().sub(p2),a=d1.lengthSq(),e=d2.lengthSq(),f=d2.dot(r);let s=0,t=0;
 const clamp=(n:number)=>Math.max(0,Math.min(1,n));
 if(a<=EPS&&e<=EPS)return p1.distanceTo(p2);
 if(a<=EPS)t=clamp(f/e);else{const c=d1.dot(r);if(e<=EPS)s=clamp(-c/a);else{const b=d1.dot(d2),den=a*e-b*b;s=den!==0?clamp((b*f-c*e)/den):0;t=(b*s+f)/e;if(t<0){t=0;s=clamp(-c/a);}else if(t>1){t=1;s=clamp((b-c)/a);}}}
 return p1.clone().addScaledVector(d1,s).distanceTo(p2.clone().addScaledVector(d2,t));
}
function triangleDistance(a:Triangle,b:Triangle){
 const av=[a.a,a.b,a.c],bv=[b.a,b.b,b.c],point=new Vector3();let best=Infinity;
 for(const [vertices,target] of [[av,b],[bv,a]] as const)for(let i=0;i<3;i++){
  const p=vertices[i],q=vertices[(i+1)%3],dir=q.clone().sub(p),length=dir.length();
  if(length>EPS){const hit=new Ray(p,dir.divideScalar(length)).intersectTriangle(target.a,target.b,target.c,false,point);if(hit&&hit.distanceTo(p)<=length+EPS)return 0;}
  best=Math.min(best,p.distanceTo(target.closestPointToPoint(p,point)));
 }
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)best=Math.min(best,segmentDistance(av[i],av[(i+1)%3],bv[j],bv[(j+1)%3]));return best;
}
function inside(point:Vector3,node:Tree,budget:GeometryBudget):boolean{
 // Non-axis-aligned ray; deduplicate edge/vertex hits shared by triangles.
 const ray=new Ray(point,new Vector3(1,.3713906763541037,.5298129428260175).normalize()),hits:number[]=[];
 function visit(n:Tree){if(!ray.intersectsBox(n.box))return;if(n.triangles){for(const t of n.triangles){spend(budget);const hit=ray.intersectTriangle(t.a,t.b,t.c,false,new Vector3());if(hit)hits.push(hit.distanceTo(point));}}else{visit(n.left!);visit(n.right!);}}
 visit(node);hits.sort((a,b)=>a-b);return hits.filter((d,i)=>i===0||Math.abs(d-hits[i-1])>1e-5).length%2===1;
}
/** Exact tessellated-surface distance plus closed-solid containment. No filled outer boxes. */
export function surfaceDistance(a:Surface,b:Surface,budget:GeometryBudget):number|undefined{
 if(!a.closed||!b.closed)return undefined;
 let best=Infinity;
 function visit(x:Tree,y:Tree){if(best<=EPS||boxDistance(x.box,y.box)>=best)return;
  if(x.triangles&&y.triangles){for(const ta of x.triangles)for(const tb of y.triangles){spend(budget);best=Math.min(best,triangleDistance(ta,tb));if(best<=EPS)return;}}
  else{const pairs=x.triangles?[[x,y.left!],[x,y.right!]]:y.triangles?[[x.left!,y],[x.right!,y]]:[[x.left!,y.left!],[x.left!,y.right!],[x.right!,y.left!],[x.right!,y.right!]];pairs.sort((p,q)=>boxDistance(p[0].box,p[1].box)-boxDistance(q[0].box,q[1].box));for(const [p,q] of pairs)visit(p,q);}}
 visit(a.tree,b.tree);if(best<=EPS)return 0;
 if(a.seeds.some(p=>b.tree.box.containsPoint(p)&&inside(p,b.tree,budget))||b.seeds.some(p=>a.tree.box.containsPoint(p)&&inside(p,a.tree,budget)))return 0;
 return best;
}
