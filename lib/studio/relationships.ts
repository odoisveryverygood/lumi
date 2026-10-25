import type {DeviceDocument} from './types';

/** Compact generated documents keep links in the shared graph; legacy files keep per-part links. */
export function connectedPartIds(document:DeviceDocument,partId:string):string[]{
  const part=document.parts.find(p=>p.id===partId);if(!part)return [];
  const ids=new Set(part.connections.map(c=>c.partId));
  for(const relation of document.relationships||[]){if(relation.from===partId)ids.add(relation.to);if(relation.to===partId)ids.add(relation.from);}
  ids.delete(partId);const known=new Set(document.parts.map(p=>p.id));return [...ids].filter(id=>known.has(id));
}
