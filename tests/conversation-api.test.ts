import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../app/api/device/route';
import { generateText } from '../lib/ai';
import { mechanicalKeyboard } from '../lib/studio/keyboard';
import { validateDeviceDocument } from '../lib/studio/validation';
import type { DeviceDocument } from '../lib/studio/types';
vi.mock('../lib/ai',async importOriginal=>({...await importOriginal<typeof import('../lib/ai')>(),generateText:vi.fn()}));
const generate=vi.mocked(generateText);
const request=(body:unknown)=>new Request('http://localhost:3000/api/device',{method:'POST',headers:{'content-type':'application/json',origin:'http://localhost:3000'},body:JSON.stringify(body)});
function document():DeviceDocument{return {version:1,id:'assembly',name:'Illustrative keyboard control',description:'A simple educational two-component input assembly.',provenance:'Conceptual data; not physically verified.',source:'curated',parts:['key','board'].map((id,index)=>({id,name:id,category:'Input assembly',description:'An illustrative component.',role:index?'Receives the key signal.':'Moves when pressed.',position:[index*15,0,0],rotation:[0,0,0],size:[10,4,10],explode:[0,30,0],color:'#778899',solids:[{kind:'box',position:[0,0,0],size:[10,4,10]}],specs:{Geometry:'Illustrative'},connections:[]})),steps:[{title:'Explore',description:'See the physical parts.',partIds:['key','board']}],relationships:[{id:'key-data',from:'key',to:'board',type:'data',description:'Conceptual key signal.'}],mechanisms:[{id:'press',name:'Press',description:'Illustrative key travel.',duration:2,tracks:[{partId:'key',translation:[0,-2,0]}],stages:[{at:0,title:'Rest',description:'No motion.',partIds:['key']},{at:1,title:'Released',description:'Returns to rest.',partIds:['key']}]}]};}
const plan=(value:unknown)=>({text:JSON.stringify(value),model:'gemini-4-argon'});
beforeEach(()=>generate.mockReset());

describe('structured object conversation API',()=>{
  it('answers hypothetical placement without editing and forwards bounded follow-up history/semantic neighbors',async()=>{
    generate.mockResolvedValueOnce(plan({intent:'ask',answer:'A battery could sit below the PCB, but clearance and protected charging need design work.',actions:[{type:'focus',partIds:['board']}],suggestions:['Show the keypress']}));
    const original=document(),before=structuredClone(original),history=[{role:'user',text:'How could this be powered?'},{role:'assistant',text:'The board would need a suitable power circuit.'}];
    const response=await POST(request({action:'converse',prompt:'Where would the battery go?',document:original,partId:'key',history}));expect(response.status).toBe(200);const body=await response.json();expect(body.document).toBeUndefined();expect(body.actions).toEqual([{type:'focus',partIds:['board']}]);expect(original).toEqual(before);expect(generate).toHaveBeenCalledTimes(1);
    const context=JSON.parse(generate.mock.calls[0][1]);expect(context.history).toEqual(history);expect(context.context.neighbors[0].id).toBe('board');expect(generate.mock.calls[0][2]?.json).toBe(true);
  });
  it('applies an explicit multi-part edit from the first plan with no full geometry regeneration',async()=>{
    const original=document(),before=structuredClone(original);
    generate.mockResolvedValueOnce(plan({intent:'edit',operation:'patch',answer:'I colored the key blue and raised the board by2mm. The source geometry remains illustrative.',actions:[{type:'highlight',partIds:['key','board']}],transaction:{updates:[{partId:'key',patch:{color:'#0055ff'}},{partId:'board',patch:{position:[15,2,0]}}]}}));
    const response=await POST(request({action:'converse',prompt:'Make the key blue and move the board up2mm',document:original}));expect(response.status).toBe(200);const body=await response.json();expect(body.document.parts[0].color).toBe('#0055ff');expect(body.document.parts[1].position).toEqual([15,2,0]);expect(body.document.parts[1].solids).toEqual(before.parts[1].solids);expect(body.checks.some((check:{message:string})=>/transactionally/.test(check.message))).toBe(true);expect(generate).toHaveBeenCalledTimes(1);expect(original).toEqual(before);
  });
  it('supplies actual compound geometry for whole-object edits without a selected component',async()=>{
    const original=document();original.parts[1].solids.push({kind:'cylinder',position:[2,1.5,0],size:[2,1,2],color:'#ffaa33'});
    const solids=[{kind:'box',position:[0,0,0],size:[10,3,10]},{kind:'cylinder',position:[2,1.125,0],size:[2,.75,2],color:'#ffaa33'}];
    generate.mockResolvedValueOnce(plan({intent:'edit',operation:'patch',answer:'Reduced the illustrative board envelope while preserving both modeled shapes.',actions:[],transaction:{updates:[{partId:'board',patch:{size:[10,3,10],solids}}]}}));
    const response=await POST(request({action:'converse',prompt:'Reduce the board height to a maximum of 3 mm. Keep its existing shape details.',document:original}));
    expect(response.status).toBe(200);const context=JSON.parse(generate.mock.calls[0][1]).context;
    expect(context.otherComponents.find((p:{id:string})=>p.id==='board').solids).toEqual(original.parts[1].solids);
    const edited=await response.json();expect(edited.document.parts[1].solids).toEqual(solids);expect(edited.document.parts[0]).toEqual(original.parts[0]);
  });
  it('fails closed on invented scene targets and malformed drafts without partial changes',async()=>{
    generate.mockResolvedValue(plan({intent:'edit',operation:'patch',answer:'Changed the key.',actions:[{type:'focus',partIds:['invented']}],transaction:{updates:[{partId:'key',patch:{color:'#0055ff'}}]}}));
    const original=document(),before=structuredClone(original),response=await POST(request({action:'converse',prompt:'Make this key blue',document:original}));expect(response.status).toBe(422);expect((await response.json()).document).toBeUndefined();expect(original).toEqual(before);expect(generate).toHaveBeenCalledTimes(3);
    generate.mockReset();const invalid=document();invalid.mechanisms![0].tracks[0].partId='missing';expect((await POST(request({action:'converse',prompt:'Show how it works',document:invalid}))).status).toBe(400);expect(generate).not.toHaveBeenCalled();
    expect((await POST(request({action:'converse',prompt:'Explain it',document:original,history:Array.from({length:13},()=>({role:'user',text:'Hello'}))}))).status).toBe(400);
  });
  it('uses a valid existing mechanism in structured answers',async()=>{
    generate.mockResolvedValueOnce(plan({intent:'ask',answer:'The key moves down, then returns to rest. This animation does not simulate force.',actions:[{type:'animate',mechanismId:'press'},{type:'highlight',partIds:['key']}]}));
    const response=await POST(request({action:'ask',prompt:'Show how the key moves',document:document(),partId:'key'}));expect(response.status).toBe(200);expect((await response.json()).actions[0]).toEqual({type:'animate',mechanismId:'press'});
  });
  it('creates a fresh supplied document and offers no shared template in the generation prompt',async()=>{
    const fresh={...document(),id:'custom-control',name:'Custom control',source:'gemini'};
    generate.mockResolvedValueOnce(plan({document:fresh,answer:'A fresh control assembly.',actions:[]}));
    const response=await POST(request({action:'generate',prompt:'Create a custom mechanical control'}));const body=await response.json();expect(response.status).toBe(200);expect(body.document.id).toBe('custom-control');expect(body.document.parts).toEqual(fresh.parts);expect(generate.mock.calls[0][1]).not.toContain('availableKeyboardTemplate');expect(generate.mock.calls[0][0]).toContain('fresh design');
  });
  it('rejects a shared-template shortcut instead of presenting it as unique generation',async()=>{
    generate.mockResolvedValue(plan({operation:'keyboard-template',wireless:false,answer:'A reused keyboard.',actions:[]}));
    const response=await POST(request({action:'generate',prompt:'Create a unique keyboard'}));expect(response.status).toBe(422);expect((await response.json()).document).toBeUndefined();expect(generate).toHaveBeenCalledTimes(3);
  });
  it('runs deterministic wireless conversion only when the model selects that explicit operation',async()=>{
    generate.mockResolvedValueOnce(plan({intent:'edit',operation:'keyboard-wireless',answer:'Added a conceptual wireless controller, protected power path and battery. Firmware, charging and fit still need engineering verification.',actions:[{type:'highlight',partIds:['wireless-battery','wireless-controller']},{type:'focus',partIds:['wireless-battery']}]}));
    const original=structuredClone(mechanicalKeyboard),before=structuredClone(original);
    const response=await POST(request({action:'converse',prompt:'Please apply this conversion to the object',document:original}));expect(response.status).toBe(200);const body=await response.json();expect(body.document.parts.some((part:{id:string})=>part.id==='wireless-battery')).toBe(true);expect(body.document.capabilities).toContain('wireless-keyboard');expect(()=>validateDeviceDocument(body.document)).not.toThrow();expect(body.checks.some((check:{message:string})=>/charging\/protection/.test(check.message))).toBe(true);expect(original).toEqual(before);expect(generate).toHaveBeenCalledTimes(1);
    generate.mockResolvedValueOnce(plan({intent:'edit',operation:'keyboard-wireless',answer:'This keyboard already has the conceptual wireless components.',actions:[]}));
    const repeated=await POST(request({action:'converse',prompt:'Apply the conversion again',document:body.document}));expect(repeated.status).toBe(200);const second=await repeated.json();expect(second.document.parts).toEqual(body.document.parts);expect(new Set(second.document.parts.map((part:{id:string})=>part.id)).size).toBe(second.document.parts.length);
  });
});
