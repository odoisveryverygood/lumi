import {z} from 'zod';
import {expandGeneratedPart} from './generated-part';
import type {DevicePart} from './types';

const key=z.union([z.string().min(1).max(100),z.number().int().min(0).max(2000)]);
const repairSchema=z.object({repairs:z.array(z.object({path:z.array(key).min(1).max(12),value:z.unknown()}).strict()).min(1).max(40)}).strict();
const blocked=new Set(['__proto__','constructor','prototype']);
/** A narrow JSON replacement preserves the entire received design and uses no code evaluation. */
export function applyGenerationRepair(original:unknown,patch:unknown):unknown{
  const {repairs}=repairSchema.parse(patch),next=structuredClone(original);
  for(const {path,value} of repairs){
    if(path.some(k=>typeof k==='string'&&blocked.has(k)))throw new Error('Invalid repair path.');
    if(path[0]!=='document'&&!['answer','actions','suggestions'].includes(String(path[0])))throw new Error('Repair paths must target the generated response.');
    if(path.length===1&&path[0]==='document')throw new Error('A repair cannot replace the whole document.');
    if(path[0]==='document'&&path.length===2&&path[1]==='parts')throw new Error('A repair cannot replace all component geometry.');
    let cursor=next as Record<string|number,unknown>;
    for(const k of path.slice(0,-1)){
      if(!cursor||typeof cursor!=='object'||!Object.hasOwn(cursor,k))throw new Error('Repair path does not exist.');
      cursor=cursor[k] as Record<string|number,unknown>;
    }
    const last=path.at(-1)!;
    if(!cursor||typeof cursor!=='object'||Array.isArray(cursor)&&(typeof last!=='number'||last>=cursor.length))throw new Error('Invalid repair target.');
    Object.defineProperty(cursor,last,{value,writable:true,enumerable:true,configurable:true});
  }
  return next;
}
export function generationIssues(error:unknown){
  if(error instanceof z.ZodError)return error.issues.slice(0,12).map(issue=>({path:['document',...issue.path],message:issue.message}));
  return [{path:['document'],message:error instanceof Error?error.message.slice(0,1600):'Invalid structured response'}];
}

/** Keep original part indexes, but do not send unrelated solid arrays back to
 * the model for a graph/metadata correction. The full original stays local. */
export function generationRepairContext(original:unknown,issues:ReturnType<typeof generationIssues>):unknown{
  if(!original||typeof original!=='object'||!('document'in original))return original;
  const doc=(original as {document:Record<string,unknown>}).document;
  if(!doc||!Array.isArray(doc.parts))return original;
  const involved=new Set(issues.flatMap(issue=>issue.path[1]==='parts'&&typeof issue.path[2]==='number'?[issue.path[2]]:[]));
  return {...original,document:{...doc,parts:doc.parts.map((part,index)=>{
    if(involved.has(index)||!part||typeof part!=='object')return part;
    const {solids,mesh,...rest}=part;
    return {...rest,...(solids||mesh?{geometryOmitted:true}:{})};
  })}};
}

/** Repairs may fix references on a valid part, but cannot silently simplify,
 * move, recolor or replace its already validated geometry. */
export function preserveGeneratedGeometry(original:unknown,next:unknown):void{
  const parts=(value:unknown)=>value&&typeof value==='object'&&'document'in value
    ?(value as {document:{parts?:unknown[]}}).document?.parts:undefined;
  const before=parts(original),after=parts(next);
  if(!Array.isArray(before)||!Array.isArray(after))return;
  const sources=new Map<string,DevicePart>(),corrected=new Map<string,DevicePart>();
  for(let index=0;index<before.length;index++){
    let part:DevicePart|undefined,replacement:DevicePart|undefined;
    try{part=expandGeneratedPart(before[index],sources);sources.set(part.id,part);}catch{/* A genuinely invalid component may be repaired. */}
    try{replacement=expandGeneratedPart(after[index],corrected);corrected.set(replacement.id,replacement);}catch{/* Checked below when geometry was valid. */}
    if(part){
      const geometry=(p:DevicePart)=>({id:p.id,name:p.name,description:p.description,role:p.role,solids:p.solids,mesh:p.mesh,catalogRef:p.catalogRef,sourceUrl:p.sourceUrl,size:p.size,position:p.position,rotation:p.rotation,color:p.color});
      if(!replacement||JSON.stringify(geometry(part))!==JSON.stringify(geometry(replacement)))throw new Error(`Repair changed valid geometry or identity of component ${part.id}. Correct only the reported invalid fields.`);
    }
  }
}
