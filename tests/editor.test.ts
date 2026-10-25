import { describe, expect, it } from 'vitest';
import { Euler, Vector3 } from 'three';
import { PART_MAP } from '../lib/library';
import { getDemoProject } from '../lib/projects';
import { validateProject } from '../lib/validation';
import { addConnection, getPartPinWorldPosition, removeConnection, removePart, updateConnection, updatePart } from '../lib/editor';
import type { Project, Vec3 } from '../lib/types';
const demo=()=>getDemoProject('heart rate tracker');

function freezeDeep<T>(value:T):T {
  if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freezeDeep);}
  return value;
}

describe('manual part editing',()=>{
  it('keeps original history immutable, trims text and copies patch vectors',()=>{
    const original=freezeDeep(demo()),position:Vec3=[31,42,-16];
    const result=updatePart(original,'sensor',{label:'  PULSE  ',role:'  Reads a finger.  ',assembledPosition:position});
    expect(result).not.toBe(original);expect(result.parts).not.toBe(original.parts);
    expect(result.parts.find(p=>p.id==='sensor')).toMatchObject({label:'PULSE',role:'Reads a finger.',assembledPosition:[31,42,-16]});
    position[0]=99;expect(result.parts.find(p=>p.id==='sensor')!.assembledPosition[0]).toBe(31);
    expect(original.parts.find(p=>p.id==='sensor')!.label).toBe('U2');
    result.buildSteps[0].partIds.push('independent');expect(original.buildSteps[0].partIds).not.toContain('independent');
  });
  it('normalizes rotations and explode directions without moving the assembly',()=>{
    const p=demo(),r=updatePart(p,'sensor',{rotation:[450,-540,1080],explodeDirection:[0,3,4],explodeDistance:120,layer:7});
    const part=r.parts.find(x=>x.id==='sensor')!;
    expect(part.rotation).toEqual([90,-180,0]);expect(part.explodeDirection).toEqual([0,.6,.8]);
    expect(part.assembledPosition).toEqual(p.parts.find(x=>x.id==='sensor')!.assembledPosition);
    expect(part.explodeDistance).toBe(120);expect(part.layer).toBe(7);
    expect(updatePart(p,'sensor',{explodeDirection:[0,0,0]}).parts.find(x=>x.id==='sensor')!.explodeDirection).toEqual([0,0,0]);
  });
  it('handles very large finite directions without overflow',()=>{
    const part=updatePart(demo(),'sensor',{explodeDirection:[1e308,1e308,1e308]}).parts.find(x=>x.id==='sensor')!;
    expect(Math.hypot(...part.explodeDirection)).toBeCloseTo(1);
  });
  it('rejects unknown parts, non-finite values, out-of-range positions and malformed vectors',()=>{
    expect(()=>updatePart(demo(),'missing',{label:'X'})).toThrow(/does not exist/);
    for(const assembledPosition of [[NaN,0,0],[0,Infinity,0],[0,0,-Infinity],[1001,0,0],[0,0],new Array(3)])expect(()=>updatePart(demo(),'sensor',{assembledPosition:assembledPosition as Vec3})).toThrow();
    expect(()=>updatePart(demo(),'sensor',{rotation:[0,NaN,0]})).toThrow(/finite/);
    expect(()=>updatePart(demo(),'sensor',{explodeDirection:[0,Infinity,0]})).toThrow(/finite/);
    expect(()=>updatePart(demo(),'sensor',{explodeDistance:-1})).toThrow();
    expect(()=>updatePart(demo(),'sensor',{explodeDistance:Infinity})).toThrow();
    expect(()=>updatePart(demo(),'sensor',{layer:1.5})).toThrow();
    expect(()=>updatePart(demo(),'sensor',{layer:21})).toThrow();
    expect(()=>updatePart(demo(),'sensor',{label:'  '})).toThrow();
    expect(()=>updatePart(demo(),'sensor',{label:'x'.repeat(41)})).toThrow();
  });
  it('allows incomplete drafts instead of gating every move on whole-project validation',()=>{
    const p=demo();p.connections=p.connections.filter(c=>c.id!=='sensor-gnd');
    expect(validateProject(p).valid).toBe(false);
    expect(updatePart(p,'sensor',{assembledPosition:[1000,-1000,0]}).parts.find(x=>x.id==='sensor')!.assembledPosition).toEqual([1000,-1000,0]);
  });
});

describe('pin-to-pin connection editing',()=>{
  it('updates endpoint metadata immutably and preserves wire/build step identity',()=>{
    const p=freezeDeep(demo()),from={partId:'mcu',pin:'GPIO23'};
    const result=updateConnection(p,'sensor-sda',{from,purpose:'  Alternate data pin for a draft.  ',wireColor:'green',kind:'signal',signalDirection:'both'});
    expect(result.connections.find(c=>c.id==='sensor-sda')).toMatchObject({from:{partId:'mcu',pin:'GPIO23'},purpose:'Alternate data pin for a draft.',wireColor:'green',kind:'signal',signalDirection:'both'});
    from.pin='GPIO19';expect(result.connections.find(c=>c.id==='sensor-sda')!.from.pin).toBe('GPIO23');
    expect(p.connections.find(c=>c.id==='sensor-sda')!.from.pin).toBe('GPIO21');
    expect(result.buildSteps).toEqual(p.buildSteps);expect(result.code).toEqual(p.code);
  });
  it('rejects nonexistent pins and components even for a metadata-only edit',()=>{
    expect(()=>updateConnection(demo(),'missing',{purpose:'A test.'})).toThrow(/does not exist/);
    expect(()=>updateConnection(demo(),'sensor-sda',{from:{partId:'absent',pin:'GPIO21'}})).toThrow(/does not exist/);
    expect(()=>updateConnection(demo(),'sensor-sda',{to:{partId:'sensor',pin:'FAKE'}})).toThrow(/Pin FAKE does not exist/);
    expect(()=>updateConnection(demo(),'sensor-sda',{to:{partId:'sensor',pin:'sda'}})).toThrow(/does not exist/);
    const p=demo();p.connections.find(c=>c.id==='sensor-sda')!.to.pin='MISSING';
    expect(()=>updateConnection(p,'sensor-sda',{purpose:'Check endpoint.'})).toThrow(/does not exist/);
  });
  it('rejects an identical endpoint and duplicate pairs regardless of direction',()=>{
    expect(()=>updateConnection(demo(),'sensor-sda',{to:{partId:'mcu',pin:'GPIO21'}})).toThrow(/different pin endpoints/);
    expect(()=>updateConnection(demo(),'sensor-sda',{from:{partId:'display',pin:'SDA'},to:{partId:'mcu',pin:'GPIO21'}})).toThrow(/already have a connection/);
    expect(()=>addConnection(demo(),{partId:'sensor',pin:'SDA'},{partId:'mcu',pin:'GPIO21'})).toThrow(/already have a connection/);
  });
  it('permits reversal of the same wire and temporary electrically invalid drafts',()=>{
    const p=demo(),existing=p.connections.find(c=>c.id==='sensor-sda')!;
    expect(updateConnection(p,existing.id,{from:existing.to,to:existing.from}).connections.find(c=>c.id===existing.id)!.from).toEqual(existing.to);
    const r=updateConnection(p,'sensor-power',{from:{partId:'mcu',pin:'5V'}});
    expect(validateProject(r).errors.some(e=>e.includes('Voltage mismatch'))).toBe(true);
  });
  it('adds unique ids, chooses sensible defaults and covers the new wire in one build step',()=>{
    const p=freezeDeep(demo()),a=addConnection(p,{partId:'mcu',pin:'GPIO23'},{partId:'sensor',pin:'INT'});
    const wire=a.connections.at(-1)!;expect(wire.id).toBe('wire-1');expect(wire.kind).toBe('signal');expect(wire.wireColor).toBe('yellow');
    expect(wire.purpose).toContain('U1 GPIO23');expect(wire.purpose).toContain('U2 INT');
    expect(a.buildSteps.flatMap(s=>s.connectionIds).filter(id=>id===wire.id)).toHaveLength(1);
    const b=addConnection(a,{partId:'mcu',pin:'GPIO19'},{partId:'sensor',pin:'INT'},'signal','orange');
    expect(b.connections.at(-1)!.id).toBe('wire-2');expect(b.connections.at(-1)!.wireColor).toBe('orange');
    expect(p.connections).toHaveLength(a.connections.length-1);
  });
  it('infers power, ground and I2C data roles using real pin types',()=>{
    let p=removeConnection(demo(),'sensor-gnd');p=addConnection(p,{partId:'mcu',pin:'GND'},{partId:'sensor',pin:'GND'});
    expect(p.connections.at(-1)).toMatchObject({kind:'ground',wireColor:'black'});
    p=removeConnection(p,'sensor-power');p=addConnection(p,{partId:'mcu',pin:'3V3'},{partId:'sensor',pin:'VIN'});
    expect(p.connections.at(-1)).toMatchObject({kind:'power',wireColor:'red'});
    p=removeConnection(p,'sensor-sda');p=addConnection(p,{partId:'mcu',pin:'GPIO21'},{partId:'sensor',pin:'SDA'});
    expect(p.connections.at(-1)).toMatchObject({kind:'data',wireColor:'blue',signalDirection:'both'});
  });
  it('rejects runtime enum garbage and invalid pins on creation',()=>{
    expect(()=>addConnection(demo(),{partId:'mcu',pin:'FAKE'},{partId:'sensor',pin:'INT'})).toThrow();
    expect(()=>updateConnection(demo(),'sensor-sda',{wireColor:'purple' as never})).toThrow(/not supported/);
    expect(()=>updateConnection(demo(),'sensor-sda',{kind:'ac' as never})).toThrow(/not supported/);
    expect(()=>updateConnection(demo(),'sensor-sda',{signalDirection:'backwards' as never})).toThrow(/not supported/);
  });
});

describe('deletion preserves referential integrity',()=>{
  it('removes a connection and every step reference without changing history',()=>{
    const p=freezeDeep(demo()),r=removeConnection(p,'sensor-sda');
    expect(r.connections.some(c=>c.id==='sensor-sda')).toBe(false);expect(r.buildSteps.some(s=>s.connectionIds.includes('sensor-sda'))).toBe(false);
    expect(p.connections.some(c=>c.id==='sensor-sda')).toBe(true);expect(r.buildSteps).toHaveLength(p.buildSteps.length);
    expect(()=>removeConnection(p,'missing')).toThrow(/does not exist/);
  });
  it('removes a component, all its wires and all related placement/wiring references',()=>{
    const p=freezeDeep(demo()),removedIds=new Set(p.connections.filter(c=>c.from.partId==='sensor'||c.to.partId==='sensor').map(c=>c.id));
    const r=removePart(p,'sensor');
    expect(r.parts.some(part=>part.id==='sensor')).toBe(false);
    expect(r.connections.some(c=>c.from.partId==='sensor'||c.to.partId==='sensor')).toBe(false);
    expect(r.buildSteps.some(s=>s.partIds.includes('sensor')||s.connectionIds.some(id=>removedIds.has(id)))).toBe(false);
    expect(r.connections.filter(c=>!removedIds.has(c.id))).toEqual(p.connections.filter(c=>!removedIds.has(c.id)));
    expect(r.buildSteps.map(s=>s.index)).toEqual(p.buildSteps.map(s=>s.index));expect(r.code).toEqual(p.code);
  });
  it('refuses to remove the final component and reports unknown ids',()=>{
    const p=demo();p.parts=[p.parts[0]];expect(()=>removePart(p,p.parts[0].id)).toThrow(/final component/);
    expect(()=>removePart(p,'missing')).toThrow(/does not exist/);
  });
});

describe('pin anchors follow actual model transformations',()=>{
  it('uses the library anchor and assembled position at zero rotation',()=>{
    const p=demo(),part=p.parts.find(x=>x.id==='sensor')!,pin=PART_MAP[part.libraryId].pins.find(x=>x.name==='SDA')!;
    expect(getPartPinWorldPosition(p,{partId:'sensor',pin:'SDA'})).toEqual(pin.position.map((n,i)=>n+part.assembledPosition[i]));
  });
  it('matches Three Euler XYZ for a combined rotation and moves every attached wire anchor',()=>{
    const original=demo(),p=updatePart(original,'sensor',{assembledPosition:[23,47,-9],rotation:[35,-70,115]});
    const part=p.parts.find(x=>x.id==='sensor')!,pins=PART_MAP[part.libraryId].pins;
    for(const pin of pins){
      const expected=new Vector3(...pin.position).applyEuler(new Euler(...part.rotation.map(n=>n*Math.PI/180) as Vec3,'XYZ')).add(new Vector3(...part.assembledPosition));
      const actual=getPartPinWorldPosition(p,{partId:part.id,pin:pin.name});
      actual.forEach((n,i)=>expect(n).toBeCloseTo(expected.toArray()[i],10));
    }
    expect(getPartPinWorldPosition(p,{partId:'sensor',pin:'SDA'})).not.toEqual(getPartPinWorldPosition(original,{partId:'sensor',pin:'SDA'}));
  });
  it('rejects anchors for absent endpoints and invalid transformation data',()=>{
    expect(()=>getPartPinWorldPosition(demo(),{partId:'sensor',pin:'FAKE'})).toThrow();
    const p:Project=demo();p.parts.find(x=>x.id==='sensor')!.rotation=[0,Infinity,0];
    expect(()=>getPartPinWorldPosition(p,{partId:'sensor',pin:'SDA'})).toThrow(/finite/);
    p.parts.find(x=>x.id==='sensor')!.rotation=[1e308,0,0];expect(getPartPinWorldPosition(p,{partId:'sensor',pin:'SDA'}).every(Number.isFinite)).toBe(true);
  });
});
