import type {DeviceDocument} from './types';
import type {CircuitOverlay} from './circuit-derive';
import {validateDeviceDocument} from './validation';
import {catalogJsonReplacer} from './catalog';
/**
 * One project for Studio and Circuits. Studio already saves the open object under
 * STUDIO_KEY; Circuits reads the same record instead of its own example, and both tabs
 * share one persisted undo/redo history under HISTORY_KEY. Imported GLB scenes are not
 * part of the history record because their binary asset lives in IndexedDB.
 */
export const STUDIO_KEY='partexplode-studio-v1';
export const HISTORY_KEY='morf-history-v1';
export const HISTORY_LIMIT=12;
export type SharedHistory={version:1;past:string[];future:string[]};
export type StudioRecord={document:DeviceDocument;conversation?:unknown[]};
const serialize=(document:DeviceDocument)=>JSON.stringify(document,catalogJsonReplacer);
export function readStudioRecord(storage:Pick<Storage,'getItem'>=localStorage):StudioRecord|null{
 try{const raw=storage.getItem(STUDIO_KEY);if(!raw)return null;const value=JSON.parse(raw);const document=validateDeviceDocument(value.document||value);return {document,conversation:Array.isArray(value.conversation)?value.conversation:[]};}catch{return null;}
}
export function writeStudioDocument(document:DeviceDocument,storage:Pick<Storage,'getItem'|'setItem'>=localStorage){
 const previous=readStudioRecord(storage);
 let saved:Record<string,unknown>={};
 if(previous?.document.id===document.id)try{const raw=JSON.parse(storage.getItem(STUDIO_KEY)||'{}');if(raw&&typeof raw==='object'&&!Array.isArray(raw)&&raw.document)saved=raw;}catch{}
 // Preserve imported asset metadata and future Studio fields on same-object
 // edits. A new object must not inherit the old object's conversation/asset.
 storage.setItem(STUDIO_KEY,JSON.stringify({...saved,document,conversation:previous?.document.id===document.id?previous.conversation??[]:[]},catalogJsonReplacer));
}
export function readHistory(storage:Pick<Storage,'getItem'>=localStorage):SharedHistory{
 try{const raw=storage.getItem(HISTORY_KEY);if(!raw)return {version:1,past:[],future:[]};const value=JSON.parse(raw);if(value?.version!==1||!Array.isArray(value.past)||!Array.isArray(value.future))return {version:1,past:[],future:[]};return {version:1,past:value.past.filter((x:unknown)=>typeof x==='string').slice(-HISTORY_LIMIT),future:value.future.filter((x:unknown)=>typeof x==='string').slice(0,HISTORY_LIMIT)};}catch{return {version:1,past:[],future:[]};}
}
export function writeHistory(history:SharedHistory,storage:Pick<Storage,'setItem'>=localStorage){
 try{storage.setItem(HISTORY_KEY,JSON.stringify({version:1,past:history.past.slice(-HISTORY_LIMIT),future:history.future.slice(0,HISTORY_LIMIT)}));}catch{/* Storage full: the in-memory history still works for this tab. */}
}
/** Entry counts without keeping the documents around. */
export function historyCounts(storage:Pick<Storage,'getItem'>=localStorage){const h=readHistory(storage);return {past:h.past.length,future:h.future.length};}
export function parseHistoryEntry(entry:string):DeviceDocument|null{try{return validateDeviceDocument(JSON.parse(entry));}catch{return null;}}
/** Record a change: the previous document goes onto the shared past and redo is cleared. */
export function recordChange(previous:DeviceDocument,storage:Storage=localStorage){
 if(previous.source==='import')return;
 const history=readHistory(storage);writeHistory({version:1,past:[...history.past,serialize(previous)],future:[]},storage);
}
/** Undo across tabs: returns the document to show, or null when nothing is recorded. */
export function undoShared(current:DeviceDocument,storage:Storage=localStorage):DeviceDocument|null{
 const history=readHistory(storage);const entry=history.past.at(-1);if(!entry)return null;const document=parseHistoryEntry(entry);if(!document)return null;
 writeHistory({version:1,past:history.past.slice(0,-1),future:[serialize(current),...history.future]},storage);return document;
}
export function redoShared(current:DeviceDocument,storage:Storage=localStorage):DeviceDocument|null{
 const history=readHistory(storage);const entry=history.future[0];if(!entry)return null;const document=parseHistoryEntry(entry);if(!document)return null;
 writeHistory({version:1,past:[...history.past,serialize(current)],future:history.future.slice(1)},storage);return document;
}
export function clearHistory(storage:Storage=localStorage){writeHistory({version:1,past:[],future:[]},storage);}
/** Overlay helpers: Circuits keeps its wire/firmware edits on the document itself. */
export function withOverlay(document:DeviceDocument,overlay:CircuitOverlay|undefined):DeviceDocument{
 const next={...document} as DeviceDocument&{circuit?:CircuitOverlay};
 if(overlay)next.circuit=overlay;else delete next.circuit;
 return next;
}
export function overlayOf(document:DeviceDocument):CircuitOverlay|undefined{return (document as DeviceDocument&{circuit?:CircuitOverlay}).circuit;}
