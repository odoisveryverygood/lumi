import {createHash} from 'node:crypto';
import type {ObjectReference} from './object-catalog';
const MAX_BYTES=25*1024*1024;
export function allowedObjectUrl(value:string){
 try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='3d-api.si.edu'&&!url.port&&!url.username&&!url.password&&url.pathname.startsWith('/content/document/3d_package:')&&url.pathname.toLowerCase().endsWith('.glb');}catch{return false;}
}
/** Only manifest URLs; never act as an arbitrary URL proxy. Bound redirects, time, bytes and integrity. */
export async function downloadObjectReference(reference:ObjectReference,signal?:AbortSignal,fetcher:typeof fetch=fetch):Promise<Uint8Array>{
 if(!allowedObjectUrl(reference.url))throw new Error('This reference has an unsupported source URL.');
 const timeout=AbortSignal.timeout(45000),combined=signal?AbortSignal.any([signal,timeout]):timeout;
 const response=await fetcher(reference.url,{signal:combined,redirect:'error',cache:'no-store'});
 if(!response.ok||!response.body)throw new Error('The source model is currently unavailable. Choose another reference.');
 const length=Number(response.headers.get('content-length'));
 if(length>MAX_BYTES){await response.body.cancel();throw new Error('This source model is larger than Lumi’s 25 MB import limit. Choose another reference.');}
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;if(value){size+=value.length;if(size>MAX_BYTES)throw new Error('This source model exceeds the 25 MB import limit.');chunks.push(value);}}}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 if(size<20||new DataView(bytes.buffer).getUint32(0,true)!==0x46546c67)throw new Error('The source did not return a binary 3D model.');
 if(createHash('sha256').update(bytes).digest('hex')!==reference.sha256)throw new Error('The source model has changed since it was indexed. Its integrity could not be confirmed.');
 return bytes;
}
