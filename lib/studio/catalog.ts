import data from './catalog-data/parts.json';
import type {DeviceDocument,DevicePart,Vec3} from './types';

export type CatalogSource='espressif'|'nopscadlib'|'bosl2';
export type CatalogPart={id:string;name:string;source:CatalogSource;category:string;description:string;tags:string[];license:string;revision:string;url:string;sha256:string;color:string;size:Vec3;mesh:NonNullable<DevicePart['mesh']>;wrapper?:string};
export const catalogParts=data as CatalogPart[];
export const catalogSources={
 espressif:{name:'Espressif',url:'https://github.com/espressif/kicad-libraries',licenseUrl:'/catalog/licenses/espressif.txt',detail:'Official ESP32 module CAD'},
 nopscadlib:{name:'NopSCADlib',url:'https://github.com/nophead/NopSCADlib',licenseUrl:'/catalog/licenses/nopscadlib.txt',detail:'Mechanical components'},
 bosl2:{name:'BOSL2',url:'https://github.com/BelfrySCAD/BOSL2',licenseUrl:'/catalog/licenses/bosl2.txt',detail:'Parametric geometry'},
};
export function catalogPart(id:string){return catalogParts.find(part=>part.id===id);}
export function findCatalogParts(query:string,source?:string,matchAll=true){
 const stop=new Set(['the','and','for','with','this','that','make','build','show','create','want','please','into','have','from']);
 const terms=query.toLowerCase().split(/[^a-z0-9]+/).filter(term=>term.length>1&&!stop.has(term));
 return catalogParts.filter(p=>!source||source==='all'||p.source===source).map(part=>{const text=[part.id,part.name,part.description,...part.tags].join(' ').toLowerCase();return {part,matches:terms.filter(term=>text.includes(term)).length,score:terms.reduce((n,term)=>n+([part.id,part.name,...part.tags].join(' ').toLowerCase().includes(term)?3:part.description.toLowerCase().includes(term)?1:0),0)};}).filter(row=>!terms.length||(matchAll?row.matches===terms.length:row.score>0)).sort((a,b)=>b.score-a.score).map(row=>row.part);
}
/** No arbitrary mesh, URL, executable CAD or unverified parameters come from the model. */
export function hydrateCatalogPart(id:string,placement:Partial<Pick<DevicePart,'id'|'name'|'position'|'rotation'|'explode'|'color'|'description'|'role'|'connections'|'assemblyId'|'notes'|'specs'|'attachment'>>={}):DevicePart {
 const entry=catalogPart(id);if(!entry)throw new Error(`Unknown catalog component: ${id}`);
 const source=catalogSources[entry.source];
 return {id:entry.id,name:entry.name,category:entry.category,description:entry.description,role:entry.description,position:[0,0,0],rotation:[0,0,0],explode:[0,24,0],color:entry.color,solids:[],connections:[],...placement,
  size:[...entry.size],mesh:structuredClone(entry.mesh),catalogRef:{id:entry.id},sourceUrl:entry.url,
  specs:{...placement.specs,'Catalog source':source.name,'Source revision':entry.revision,License:entry.license,'CAD envelope':entry.size.map(n=>Math.round(n*100)/100).join(' × ')+' mm','Source SHA-256':entry.sha256},
  notes:placement.notes??`Sourced ${source.name} geometry, tessellated and centered in millimetres (Y up). Placement, finish and annotations are editable. Standard dimensions are preserved. Source CAD does not verify fit, wiring, load capacity or operation of this assembly. License: ${entry.license}.`,
 };
}
export function canonicalCatalogGeometry(part:DevicePart):boolean {
 const entry=part.catalogRef&&catalogPart(part.catalogRef.id);if(!entry||part.assetNode||part.solids.length||!part.mesh)return false;
 return part.sourceUrl===entry.url&&part.size.every((v,i)=>v===entry.size[i])&&(['positions','indices','colors'] as const).every(key=>{
  const a=part.mesh?.[key],b=entry.mesh[key];return !a&&!b||Boolean(a&&b&&a.length===b.length&&a.every((n,i)=>n===b[i]));
 })&&part.specs.License===entry.license&&part.specs['Source revision']===entry.revision&&part.specs['Source SHA-256']===entry.sha256&&part.specs['Catalog source']===catalogSources[entry.source].name;
}
export function expandCatalogWire(value:unknown):unknown {
 if(!value||typeof value!=='object'||!('catalogRef' in value))return value;
 const p=value as Record<string,unknown>,ref=p.catalogRef;
 if(!ref||typeof ref!=='object'||Array.isArray(ref)||Object.keys(ref).length!==1||typeof (ref as {id?:unknown}).id!=='string')throw new Error('A catalog reference must contain exactly a known id; arbitrary parameters are not supported.');
 if(p.mesh!==undefined||p.assetNode!==undefined||p.sourceUrl!==undefined||p.size!==undefined||p.solids!==undefined)throw new Error('Catalog references use canonical geometry and dimensions; omit mesh, solids, size, assetNode and sourceUrl.');
 const placement:Record<string,unknown>={};for(const key of ['id','name','position','rotation','explode','color','description','role','connections','assemblyId','notes','specs','attachment'])if(p[key]!==undefined)placement[key]=p[key];
 return hydrateCatalogPart((ref as {id:string}).id,placement);
}
export function catalogContext(query:string){
 return findCatalogParts(query,undefined,false).slice(0,8).map(({id,name,source,description,size,license})=>({id,name,source,description,size,license}));
}
export const catalogPrompt=`A supplied readyParts catalog contains real, preprocessed CAD components. When one matches the requested component, use catalogRef:{id:"exact-catalog-id"} instead of solids. Include id,name,description,position,rotation,explode and optional color,role,connections,assemblyId. OMIT solids,size,mesh,assetNode,sourceUrl,specs and notes for that part: trusted geometry, dimensions and citations are inserted locally. A radio module is not a complete dev board; generate any carrier/support parts separately. Standard hardware dimensions cannot be scaled. Use custom solids for everything else; do not force a catalog component where it does not fit. Sourced geometry does not establish electrical compatibility or engineering validation.`;
export function catalogDocument(id:string):DeviceDocument {
 const part=hydrateCatalogPart(id);
 return {version:1,id:'catalog-'+id,name:part.name,description:part.description,provenance:`Sourced component from ${part.specs['Catalog source']}. ${part.specs.License}. ${part.sourceUrl}`,parts:[part],steps:[],source:'curated'};
}
/** Keep requests, streaming progress, saved projects and exports small by sending trusted IDs. */
export function catalogJsonReplacer(_key:string,value:unknown):unknown {
 if(value&&typeof value==='object'&&'catalogRef'in value&&value.catalogRef&&'mesh'in value&&value.mesh){
  const copy={...value} as Record<string,unknown>;
  for(const key of ['mesh','solids','size','sourceUrl'])delete copy[key];return copy;
 }
 return value;
}
export function catalogJsonReviver(_key:string,value:unknown):unknown {
 if(value&&typeof value==='object'&&'catalogRef'in value&&!('mesh'in value))return expandCatalogWire(value);
 return value;
}
export function inflateCatalogDocument(value:unknown):unknown {
 if(!value||typeof value!=='object'||!('parts'in value)||!Array.isArray(value.parts))return value;
 return {...value,parts:value.parts.map(part=>catalogJsonReviver('',part))};
}
export function appendCatalogPart(document:DeviceDocument,id:string):{document:DeviceDocument;partId:string}{
 let partId=id,n=2;while(document.parts.some(p=>p.id===partId))partId=`${id}-${n++}`;
 const right=document.parts.reduce((edge,p)=>Math.max(edge,p.position[0]+p.size[0]/2),-Infinity),entry=catalogPart(id);if(!entry)throw new Error('Unknown catalog component.');
 const position:Vec3=[Math.min(4800,Math.max(0,right)+entry.size[0]/2+Math.max(15,entry.size[0]*.2)),0,0];
 const part=hydrateCatalogPart(id,{id:partId,position});
 return {document:{...document,parts:[...document.parts,part]},partId};
}
