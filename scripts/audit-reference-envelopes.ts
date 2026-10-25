import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Vector3} from 'three';
import {validateDeviceDocument} from '../lib/studio/validation';
import {localPartBounds} from '../lib/studio/render-model';

// Deliberate source-data repair only. This never runs on a user's saved project.
const path=process.argv.slice(2).find(arg=>!arg.startsWith('--'))??'public/assemblies/corne/document.json';
const write=process.argv.includes('--write'),raw=readFileSync(path,'utf8'),document=validateDeviceDocument(JSON.parse(raw));
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const geometry=()=>JSON.stringify(document.parts.map(({id,position,rotation,solids,mesh,catalogRef,assetNode,attachment})=>({id,position,rotation,solids,mesh,catalogRef,assetNode,attachment})));
const beforeGeometryHash=digest(geometry()),sourceDimensions=JSON.stringify(document.parts.filter(p=>p.mesh||p.catalogRef||p.assetNode).map(p=>[p.id,p.size]));
const corrections=[];
for(const part of document.parts){
 if(part.mesh||part.catalogRef||part.assetNode||!part.solids.length)continue;
 const actual=localPartBounds(part).getSize(new Vector3()).toArray().map(n=>Math.round(n*1e6)/1e6) as [number,number,number];
 if(!actual.some((n,i)=>Math.abs(n-part.size[i])>Math.max(.5,n*.02)))continue;
 corrections.push({partId:part.id,name:part.name,declared:part.size,actual});
 if(write){part.specs={...part.specs,'Original nominal dimensions':`${part.size.join(' × ')} mm`,'Model envelope':'Size metadata measures the rendered study geometry; physical dimensions remain unverified.'};part.size=actual;}
}
const afterGeometryHash=digest(geometry());
if(beforeGeometryHash!==afterGeometryHash||sourceDimensions!==JSON.stringify(document.parts.filter(p=>p.mesh||p.catalogRef||p.assetNode).map(p=>[p.id,p.size])))throw new Error('A metadata repair attempted to change actual geometry or source dimensions.');
if(write)writeFileSync(path,JSON.stringify(validateDeviceDocument(document))+'\n');
console.log(JSON.stringify({path,write,corrections,beforeFileHash:digest(raw),afterFileHash:write?digest(readFileSync(path,'utf8')):digest(raw),beforeGeometryHash,afterGeometryHash,actualGeometryUnchanged:true,sourceDimensionsUnchanged:true,scope:'Metadata of authored procedural reference parts only. Original nominal dimensions retained in specs; meshes, poses, source dimensions and rendered shapes are unchanged.'},null,2));
