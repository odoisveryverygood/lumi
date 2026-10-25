import type { DeviceDocument,DevicePart } from './types';
import { devicePartSchema } from './validation';
import {expandGeneratedPart} from './generated-part';
import {canonicalCatalogGeometry} from './catalog';

/** Decode each completed component once as cumulative provider text arrives.
 * A replaced/shortened response resets the cursor; partial strings never become parts. */
export function createGenerationProgress(){
  let previous='',offset=0,started=false,done=false,quoted=false,escaped=false,depth=0,start=-1;
  let parts:DevicePart[]=[],sources=new Map<string,DevicePart>(),solidCount=0;
  const reset=()=>{offset=0;started=false;done=false;quoted=false;escaped=false;depth=0;start=-1;parts=[];sources=new Map();solidCount=0;};
  return {read(text:string):{parts:DevicePart[];partsComplete:boolean}{
    if(!text.startsWith(previous))reset();previous=text;
    if(!started){
      const match=/"parts"\s*:\s*\[/.exec(text);
      if(!match)return {parts:[],partsComplete:false};
      started=true;offset=match.index+match[0].length;
    }
    if(!done)for(;offset<text.length;offset++){
      const char=text[offset];
      if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}
      if(char==='"'){quoted=true;continue;}
      if(!depth&&char===']'){done=true;offset++;break;}
      if(char==='{'||char==='['){if(!depth&&char==='{')start=offset;depth++;}
      if(char==='}'||char===']'){
        depth--;
        if(!depth&&start>=0){
          if(parts.length<60)try{
            const raw=JSON.parse(text.slice(start,offset+1)),part=devicePartSchema.safeParse(expandGeneratedPart(raw,sources));
            if(part.success&&(canonicalCatalogGeometry(part.data)||part.data.solids.length&&!part.data.mesh)&&!part.data.assetNode&&!sources.has(part.data.id)&&solidCount+part.data.solids.length<=2000){sources.set(part.data.id,part.data);solidCount+=part.data.solids.length;parts.push(part.data);}
          }catch{/* Invalid/incomplete geometry is never progress. */}
          start=-1;
        }
      }
    }
    return {parts:[...parts],partsComplete:done};
  }};
}

/** One-shot compatibility for imports, diagnostics and syntax-preservation guards. */
export function completedParts(text:string):DevicePart[]{return createGenerationProgress().read(text).parts;}

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
