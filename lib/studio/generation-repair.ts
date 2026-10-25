import {z} from 'zod';

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
