import type { DeviceDocument,DevicePart } from './types';
import { devicePartSchema } from './validation';
import {expandGeneratedPart} from './generated-part';
import {canonicalCatalogGeometry} from './catalog';

/** Only name complete, schema-valid parts from the real output. Never invent progress. */
export function completedParts(text: string): DevicePart[] {
  const match = /"parts"\s*:\s*\[/.exec(text);
  if (!match) return [];
  const parts: DevicePart[] = [], ids = new Set<string>();
  let quoted = false, escaped = false, depth = 0, start = -1;
  for (let i = match.index + match[0].length; i < text.length; i++) {
    const char = text[i];
    if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; continue; }
    if (char === '"') { quoted = true; continue; }
    if (!depth && char === ']') break;
    if (char === '{' || char === '[') { if (!depth && char === '{') start = i; depth++; }
    if (char === '}' || char === ']') {
      depth--;
      if (!depth && start >= 0) {
        try { const raw=JSON.parse(text.slice(start,i+1));const part = devicePartSchema.safeParse(expandGeneratedPart(raw)); if (part.success && (canonicalCatalogGeometry(part.data)||part.data.solids.length&&!part.data.mesh) && !part.data.assetNode && !ids.has(part.data.id)) { ids.add(part.data.id); parts.push(part.data); } } catch { /* An incomplete object is not progress. */ }
        start = -1;
        if (parts.length === 60) break;
      }
    }
  }
  return parts;
}

export const completedPartNames=(text:string)=>completedParts(text).map(part=>part.name);

/** A transient preview has real geometry but no unverified graph or saved edits. */
export function appendGenerationParts(previous:DeviceDocument|null,incoming:DevicePart[]):DeviceDocument {
  const existing=previous?.parts||[],ids=new Set(existing.map(p=>p.id));
  const added:DevicePart[]=[];
  for(const value of incoming){const part=devicePartSchema.parse(value);if(ids.has(part.id)||part.assetNode||!(canonicalCatalogGeometry(part)||part.solids.length&&!part.mesh))continue;ids.add(part.id);added.push({...part,connections:[],assemblyId:undefined});}
  const parts=[...existing,...added];
  if(parts.length>60||parts.reduce((n,p)=>n+p.solids.length,0)>2000)throw new Error('The preview exceeds the generation budget.');
  return {version:1,id:'flare-live-generation',name:'Your object, taking shape',description:'Real generated components arriving from Gemini. The full assembly is still being checked.',provenance:'Transient generated geometry; relationships, engineering and final completeness are not yet verified.',source:'gemini',parts,steps:[],assemblies:[],relationships:[],mechanisms:[]};
}
