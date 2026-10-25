import type {DeviceDocument} from './types';
/**
 * Morf's body is whatever is on screen. This module turns the current document into a
 * small 2-D silhouette (one cell per part, oblique projection, Y up) and decides how much
 * of it has "arrived": parts stream in during generation, steps accumulate in the build
 * guide, and an opened object is complete. Presentation only; nothing here edits a document.
 */
export type MorfCell={id:string;name:string;x:number;y:number;w:number;h:number;color:string};
export type MorfShape={name:string;cells:MorfCell[];total:number;built:number;progress:number;phase:'blob'|'forming'|'formed'};
export type MorfShapeInput={buildStep?:number|null;generatingPartNames?:string[]|null;busy?:boolean};
const MAX_CELLS=40,VIEW=100,PAD=8,SHEAR=.42;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
/** Which parts count as built right now, in document order. */
export function builtPartIds(document:DeviceDocument,input:MorfShapeInput):string[]{
 const ids=document.parts.map(p=>p.id);
 if(input.generatingPartNames&&input.busy){const names=new Set(input.generatingPartNames);return document.parts.filter(p=>names.has(p.name)||names.has(p.id)).map(p=>p.id);}
 if(input.buildStep!==null&&input.buildStep!==undefined&&document.steps.length){const seen=new Set(document.steps.slice(0,clamp(input.buildStep,0,document.steps.length)).flatMap(s=>s.partIds));return ids.filter(id=>seen.has(id));}
 return ids;
}
export function morfShape(document:DeviceDocument|null,input:MorfShapeInput={}):MorfShape{
 if(!document||!document.parts.length)return {name:'',cells:[],total:0,built:0,progress:0,phase:'blob'};
 const projected=document.parts.map(p=>{const [x,y,z]=p.position,[w,h,d]=p.size.map(n=>Math.max(.5,Math.abs(n)));const px=x+z*SHEAR,py=-y+z*SHEAR;return {id:p.id,name:p.name,color:p.color,left:px-w/2-d*SHEAR/2,top:py-h/2-d*SHEAR/2,w:w+d*SHEAR,h:h+d*SHEAR,area:w*h,back:z-y};});
 const kept=[...projected].sort((a,b)=>b.area-a.area).slice(0,MAX_CELLS);const keptIds=new Set(kept.map(c=>c.id));
 const minX=Math.min(...kept.map(c=>c.left)),maxX=Math.max(...kept.map(c=>c.left+c.w)),minY=Math.min(...kept.map(c=>c.top)),maxY=Math.max(...kept.map(c=>c.top+c.h));
 const scale=(VIEW-PAD*2)/Math.max(1e-6,maxX-minX,maxY-minY),ox=(VIEW-(maxX-minX)*scale)/2,oy=(VIEW-(maxY-minY)*scale)/2;
 const r=(n:number)=>Math.round(n*10)/10;
 const cells:MorfCell[]=projected.filter(c=>keptIds.has(c.id)).sort((a,b)=>a.back-b.back).map(c=>({id:c.id,name:c.name,color:c.color,x:r(ox+(c.left-minX)*scale),y:r(oy+(c.top-minY)*scale),w:r(Math.max(2.5,c.w*scale)),h:r(Math.max(2.5,c.h*scale))}));
 const builtIds=new Set(builtPartIds(document,input));const built=document.parts.filter(p=>builtIds.has(p.id)).length,total=document.parts.length;
 const generating=!!input.generatingPartNames&&!!input.busy;
 const progress=generating?clamp(built/(built+3),0,.92):clamp(built/total,0,1);
 return {name:document.name,cells,total,built,progress,phase:progress>=1?'formed':progress>0?'forming':'blob'};
}
/** Short status for the companion label and screen readers. */
export function morfShapeLabel(shape:MorfShape){
 if(shape.phase==='formed')return `morphed · ${shape.total} parts`;
 if(shape.phase==='forming')return `morphing · ${shape.built}/${shape.total}`;
 return 'unformed';
}
