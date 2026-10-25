import type {DeviceDocument} from './types';
import {catalogJsonReplacer} from './catalog';
function stable(value:unknown):unknown{if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)]));return value;}
export async function sha256(bytes:Uint8Array){const data=new Uint8Array(bytes);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function qualityFingerprint(document:DeviceDocument){
 const {review:_review,...value}=document;return sha256(new TextEncoder().encode(JSON.stringify(stable(JSON.parse(JSON.stringify(value,catalogJsonReplacer))))));
}

export function stableEvidenceJson(value:unknown){return JSON.stringify(stable(value));}
