import { describe, expect, it } from 'vitest';
import { applyDeviceTransaction, checkedInteraction, validateSceneActions } from '../lib/studio/interaction';
import { validateDeviceDocument } from '../lib/studio/validation';
import type { DeviceDocument, DevicePart } from '../lib/studio/types';

const part=(id:string,index=0):DevicePart=>({id,name:id,category:'Component',description:'Illustrative mechanical component.',role:'Supports the assembly.',position:[index*20,0,0],rotation:[0,0,0],size:[12,8,10],explode:[0,30,0],color:'#778899',solids:[{kind:'box',position:[0,0,0],size:[12,8,10],color:'#778899'},{kind:'box',position:[0,1,0],size:[1,1,1],color:'#ffcc00'}],specs:{Geometry:'Illustrative'},connections:[],assemblyId:'body'});
function document():DeviceDocument{return {version:1,id:'object',name:'Object',description:'An educational object.',provenance:'Illustrative; no physical testing.',source:'curated',parts:[part('stem'),part('spring',1),part('case',2)],steps:[{title:'Inspect',description:'Explore these components.',partIds:['stem','spring','case']}],assemblies:[{id:'body',name:'Main assembly',partIds:['stem','spring','case']}],relationships:[{id:'spring-link',from:'stem',to:'spring',type:'mechanical',description:'Presses the spring.'}],mechanisms:[{id:'keypress',name:'Key press',description:'Illustrative compression and release.',duration:3,tracks:[{partId:'stem',translation:[0,-3,0]},{partId:'spring',translation:[0,-1,0],scale:[1,.6,1]}],stages:[{at:0,title:'Rest',description:'At rest.',partIds:['stem','spring']},{at:.5,title:'Pressed',description:'Stem travels and spring compresses.',partIds:['stem','spring']},{at:1,title:'Released',description:'Returns to rest.',partIds:['stem']}]}],capabilities:['mechanical-input']};}

describe('semantic object boundaries',()=>{
  it('accepts old documents and preserves bounded assemblies, relationships and mechanism metadata',()=>{
    const current=document();expect(validateDeviceDocument(current)).toEqual(current);
    const old={...current};delete old.assemblies;delete old.relationships;delete old.mechanisms;delete old.capabilities;old.parts=old.parts.map(({assemblyId,...value})=>value);expect(()=>validateDeviceDocument(old)).not.toThrow();
  });
  it('rejects hierarchy cycles, invalid ownership and containment cycles',()=>{
    const cyclic=document();cyclic.assemblies=[{id:'body',name:'Body',parentId:'outer',partIds:['stem','spring','case']},{id:'outer',name:'Outer',parentId:'body',partIds:[]}];expect(()=>validateDeviceDocument(cyclic)).toThrow(/cycles/);
    const ownership=document();ownership.parts[0].assemblyId='unknown';expect(()=>validateDeviceDocument(ownership)).toThrow(/assemblyId/);
    const contains=document();contains.relationships=[{id:'a',from:'stem',to:'case',type:'contains',description:'Contains case.'},{id:'b',from:'case',to:'stem',type:'contains',description:'Contains stem.'}];expect(()=>validateDeviceDocument(contains)).toThrow(/cycles/);
  });
  it('rejects invalid joint tracks, unsupported scale, out-of-order stages and missing references',()=>{
    for(const change of [
      (value:DeviceDocument)=>{value.mechanisms![0].tracks[0].partId='ghost';},
      (value:DeviceDocument)=>{value.mechanisms![0].tracks.push({...value.mechanisms![0].tracks[0]});},
      (value:DeviceDocument)=>{value.mechanisms![0].tracks[0].translation=[0,0,0];},
      (value:DeviceDocument)=>{value.mechanisms![0].tracks[1].scale=[1,0,1];},
      (value:DeviceDocument)=>{value.mechanisms![0].stages[1].at=1;},
      (value:DeviceDocument)=>{value.mechanisms![0].tracks[0].translation=[Infinity,0,0];},
      (value:DeviceDocument)=>{value.mechanisms![0].stages[0].partIds=['missing'];},
    ]){const value=document();change(value);expect(()=>validateDeviceDocument(value)).toThrow();}
  });
  it('validates every scene action target and bounds before the client receives it',()=>{
    const current=document();expect(validateSceneActions([{type:'focus',partIds:['spring']},{type:'animate',mechanismId:'keypress'},{type:'view',view:'top'}],current)).toHaveLength(3);
    for(const actions of [[{type:'highlight',partIds:['ghost']}],[{type:'animate',mechanismId:'ghost'}],[{type:'explode',amount:2}],[{type:'focus',partIds:['stem','stem']}],[{type:'navigate',url:'https://example.test'}]])expect(()=>validateSceneActions(actions,current)).toThrow();
    expect(checkedInteraction({answer:'The spring compresses.',actions:[{type:'animate',mechanismId:'keypress'}]},current).checks?.some(check=>/not simulated/.test(check.message))).toBe(true);
  });
});

describe('immutable edit transactions',()=>{
  it('applies multiple updates and additions atomically while preserving unaffected geometry and accents',()=>{
    const original=document(),before=structuredClone(original),battery={...part('battery',3),role:'Illustrative protected power pack.'};
    const next=applyDeviceTransaction(original,{updates:[{partId:'stem',patch:{color:'#0055ff'}},{partId:'spring',patch:{position:[20,2,0],connections:[{partId:'battery',label:'Illustrative neighboring mount.'}]}}],addParts:[battery],assemblies:[{id:'body',name:'Main assembly',partIds:['stem','spring','case','battery']}],relationships:[...original.relationships!,{id:'battery-link',from:'battery',to:'case',type:'mechanical',description:'Illustrative mounting relationship.'}]});
    expect(next.parts[0].color).toBe('#0055ff');expect(next.parts[0].solids[0].color).toBe('#0055ff');expect(next.parts[0].solids[1].color).toBe('#ffcc00');
    expect(next.parts[2]).toEqual(before.parts[2]);expect(next.mechanisms).toEqual(before.mechanisms);expect(next.parts).toHaveLength(4);expect(original).toEqual(before);
  });
  it('rejects a bad transaction without exposing a partially changed document',()=>{
    const original=document(),before=structuredClone(original);
    expect(()=>applyDeviceTransaction(original,{updates:[{partId:'stem',patch:{color:'#123456'}},{partId:'ghost',patch:{position:[1,2,3]}}]})).toThrow(/unknown/);
    expect(()=>applyDeviceTransaction(original,{updates:[{partId:'stem',patch:{size:[24,8,10]}}]})).toThrow(/actual solids/);
    expect(()=>applyDeviceTransaction(original,{updates:[{partId:'stem',patch:{color:'#123456'}},{partId:'stem',patch:{position:[1,2,3]}}]})).toThrow(/twice/);
    expect(()=>applyDeviceTransaction(original,{updates:[{partId:'stem',patch:{connections:[{partId:'ghost',label:'Invalid connection'}]}}]})).toThrow(/existing/);expect(original).toEqual(before);
  });
  it('prunes deleted-part references from connections, assemblies, stages and mechanisms',()=>{
    const original=document();original.parts[2].connections=[{partId:'spring',label:'Supports spring'}];
    const next=applyDeviceTransaction(original,{removePartIds:['spring']});expect(next.parts.map(part=>part.id)).toEqual(['stem','case']);expect(next.relationships).toEqual([]);expect(next.parts[1].connections).toEqual([]);expect(next.assemblies![0].partIds).toEqual(['stem','case']);expect(next.mechanisms![0].tracks.map(track=>track.partId)).toEqual(['stem']);expect(next.mechanisms![0].stages.every(stage=>!stage.partIds.includes('spring'))).toBe(true);expect(next.steps[0].partIds).toEqual(['stem','case']);
    expect(()=>applyDeviceTransaction(original,{removePartIds:['stem','spring','case']})).toThrow();
  });
  it('keeps imported geometry and IDs immutable and limits patches to the selected part',()=>{
    const original=document();original.source='import';original.parts=original.parts.map((value,index)=>({...value,assetNode:`asset-${index}`,solids:[]}));const before=structuredClone(original);
    const next=applyDeviceTransaction(original,{updates:[{partId:'stem',patch:{position:[1,2,3],color:'#ff0000'}}]},{selectedPartId:'stem'});expect(next.parts[0].assetNode).toBe('asset-0');expect(next.parts[0].size).toEqual(before.parts[0].size);expect(next.parts[1]).toEqual(before.parts[1]);
    for(const transaction of [{updates:[{partId:'stem',patch:{size:[1,2,3]}}]},{updates:[{partId:'case',patch:{color:'#ff0000'}}]},{addParts:[part('new')]}])expect(()=>applyDeviceTransaction(original,transaction,{selectedPartId:'stem'})).toThrow(/Imported/);expect(original).toEqual(before);
  });
});
