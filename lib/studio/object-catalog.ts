import objects from './catalog-data/objects.json';
export type ObjectReference={id:string;name:string;url:string;sha256:string;license:string};
export const objectReferences=objects as ObjectReference[];
export function searchObjectReferences(query:string,page=0,limit=24){
 const terms=query.toLowerCase().split(/\s+/).filter(Boolean),rows=objectReferences.filter(row=>terms.every(term=>row.name.toLowerCase().includes(term)));
 const start=Math.max(0,Math.floor(page))*limit;
 return {items:rows.slice(start,start+limit),total:rows.length,page:Math.max(0,Math.floor(page)),hasMore:start+limit<rows.length};
}
export function objectReference(id:string){return objectReferences.find(row=>row.id===id);}
