import { z } from 'zod';
import { PART_MAP } from './library';
import type { Connection, LibraryPart, PartInstance, Project, ValidationResult, Vec3 } from './types';

const text = z.string().trim().min(1);
const finite = z.number().finite();
const vec3 = z.tuple([finite,finite,finite]);
const identifier = text.max(100).regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/, 'Use letters, numbers, dots, dashes or underscores for ids');
const endpoint = z.object({partId:identifier,pin:text.max(40)});
export const projectSchema = z.object({
  id:identifier,name:text.max(120),prompt:text.max(4000),description:text.max(5000),howItWorks:text.max(10000),
  difficulty:z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4),z.literal(5)]),
  buildTimeMinutes:z.number().int().min(5).max(1440),skillLevel:z.enum(['beginner','intermediate']),
  parts:z.array(z.object({id:identifier,libraryId:identifier,label:text.max(40),role:text.max(2000),quantity:z.number().int().min(1).max(100),assembledPosition:vec3,rotation:vec3,explodeDirection:vec3,explodeDistance:finite.min(0).max(2000),layer:z.number().int().min(0).max(20),watchOut:text.max(2000).optional(),size:vec3.optional(),colour:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()})).min(2).max(60),
  connections:z.array(z.object({id:identifier,from:endpoint,to:endpoint,kind:z.enum(['power','ground','signal','data']),wireColor:z.enum(['red','black','yellow','blue','green','white','orange']),purpose:text.max(2000),signalDirection:z.enum(['from-to','to-from','both'])})).min(1).max(180),
  buildSteps:z.array(z.object({index:z.number().int().min(1),title:text.max(200),instructions:text.max(6000),partIds:z.array(identifier).max(60),connectionIds:z.array(identifier).max(180),tip:text.max(3000).optional(),check:text.max(3000).optional(),camera:z.object({position:vec3,target:vec3})})).min(6).max(12),
  code:z.object({language:z.literal('arduino'),filename:text.regex(/^[a-zA-Z0-9_-]+\.ino$/,'Arduino filename must end in .ino'),source:z.string().min(1).max(120000).refine(value=>value.trim().length>0,'Arduino source cannot be blank'),libraries:z.array(text.max(200)).max(30)}),
  heroImagePrompt:text.max(3000).optional(),
});


/** Local drafts may temporarily contain one component and no wires while being repaired. */
export const editableProjectSchema = projectSchema.extend({
  parts: projectSchema.shape.parts.min(1),
  connections: projectSchema.shape.connections.min(0),
});

type Pin = LibraryPart['pins'][number];
const isSource = (part:PartInstance|undefined)=>!!part && PART_MAP[part.libraryId]?.category==='power';
const isUsb = (connection:Connection)=>connection.from.pin==='USB'&&connection.to.pin==='USB';
const isClosingPart=(p:PartInstance)=>p.libraryId==='enclosure-top'||p.libraryId==='screw-m3';
const isMechanical=(p:PartInstance)=>['enclosure','wiring'].includes(PART_MAP[p.libraryId]?.category);
const isPassive=(p:PartInstance)=>PART_MAP[p.libraryId]?.category==='passive';
const conductive=(p:PartInstance)=>PART_MAP[p.libraryId]?.pins.length>0;
const connectionsFor=(project:Project,id:string)=>project.connections.filter(c=>c.from.partId===id||c.to.partId===id);
const hasEndpoint=(c:Connection,id:string,pin:string)=>[c.from,c.to].some(e=>e.partId===id&&e.pin===pin);
function duplicates(ids:string[]):string[] {const seen=new Set<string>();return [...new Set(ids.filter(id=>{const repeated=seen.has(id);seen.add(id);return repeated;}))];}

/** DHT22 DATA follows the selected VCC rail, rather than an immutable 3.3 V default.
 * https://learn.adafruit.com/dht/connecting-to-a-dhtxx-sensor
 */
function effectiveSignalPin(project:Project,part:PartInstance,pin:Pin):Pin {
  if(part.libraryId!=='dht22'||!['DATA','VCC'].includes(pin.name))return pin;
  const suppliedVoltages=project.connections.flatMap(connection=>{
    if(connection.kind!=='power'||!hasEndpoint(connection,part.id,'VCC'))return [];
    const other=connection.from.partId===part.id&&connection.from.pin==='VCC'?connection.to:connection.from;
    const otherPart=project.parts.find(item=>item.id===other.partId);
    const supplyPin=otherPart&&PART_MAP[otherPart.libraryId]?.pins?.find(item=>item.name===other.pin);
    return supplyPin?.type==='power'&&supplyPin.voltage!==undefined?[supplyPin.voltage]:[];
  });
  return suppliedVoltages.length?{...pin,voltage:Math.max(...suppliedVoltages)}:pin;
}
function inputOnlyPin(part:PartInstance,pin:Pin) {
  return(part.libraryId==='esp32-devkit'&&['GPIO34','GPIO35','GPIO36','GPIO39'].includes(pin.name))||(['arduino-nano','arduino-uno'].includes(part.libraryId)&&['A6','A7'].includes(pin.name));
}
/** A resistor conducts a signal; its resistance alone never certifies logic-level translation.
 * Rails/grounds are not joined into this graph, and wire directions remain significant.
 * Divider transfer ratios and bidirectional level conversion require an explicit supported model.
 */
function checkResistiveSignalPaths(project:Project,fail:(message:string)=>void) {
  const nodes=new Map<string,{part:PartInstance;pin:Pin}>();
  const edges=new Map<string,{to:string;resistive:boolean}[]>();
  const key=(endpoint:Connection['from'])=>`${endpoint.partId}:${endpoint.pin}`;
  const register=(endpoint:Connection['from'])=>{
    const part=project.parts.find(item=>item.id===endpoint.partId),raw=part&&PART_MAP[part.libraryId]?.pins?.find(pin=>pin.name===endpoint.pin);
    if(!part||!raw)return false;
    nodes.set(key(endpoint),{part,pin:effectiveSignalPin(project,part,raw)});return true;
  };
  const edge=(from:string,to:string,resistive=false)=>{const list=edges.get(from)??[];list.push({to,resistive});edges.set(from,list);};
  for(const wire of project.connections) {
    if(!['signal','data'].includes(wire.kind)||!register(wire.from)||!register(wire.to))continue;
    if(wire.signalDirection!=='to-from')edge(key(wire.from),key(wire.to));
    if(wire.signalDirection!=='from-to')edge(key(wire.to),key(wire.from));
  }
  for(const part of project.parts) {
    const library=PART_MAP[part.libraryId];
    if(library?.category!=='passive'||!library.pins.some(pin=>pin.name==='A')||!library.pins.some(pin=>pin.name==='B'))continue;
    const a={partId:part.id,pin:'A'},b={partId:part.id,pin:'B'};register(a);register(b);
    edge(key(a),key(b),true);edge(key(b),key(a),true);
  }
  for(const [start,source]of nodes) {
    const library=PART_MAP[source.part.libraryId];
    const digital=source.pin.type!=='analog'||library.category==='microcontroller';
    if(!digital||['power','ground'].includes(source.pin.type)||['passive','power','enclosure','wiring'].includes(library.category)||source.pin.voltage===undefined||inputOnlyPin(source.part,source.pin))continue;
    const queue=[{id:start,resistive:false}],visited=new Set<string>();
    for(let index=0;index<queue.length;index++) {
      const current=queue[index],stamp=`${current.id}|${current.resistive}`;
      if(visited.has(stamp))continue;visited.add(stamp);
      const target=nodes.get(current.id);
      if(current.resistive&&current.id!==start&&target&&PART_MAP[target.part.libraryId]?.category!=='passive'&&target.pin.voltage!==undefined&&source.pin.voltage>target.pin.voltage+0.3)fail(`Logic voltage mismatch through resistor network: ${source.part.id}.${source.pin.name} drives ${source.pin.voltage} V into ${target.part.id}.${target.pin.name} (${target.pin.voltage} V logic). A series resistor does not translate logic levels.`);
      for(const next of edges.get(current.id)??[])queue.push({id:next.to,resistive:current.resistive||next.resistive});
    }
  }
}

/** A DHT22 pull-up belongs on its actual VCC rail, not a differently powered logic rail.
 * Follow only direct signal-wire nets here, never global power or ground connectivity.
 */
function checkDhtPullupRails(project:Project,fail:(message:string)=>void) {
  const endpointKey=(endpoint:Connection['from'])=>`${endpoint.partId}:${endpoint.pin}`;
  for(const sensor of project.parts.filter(part=>part.libraryId==='dht22')) {
    const dataPin=PART_MAP.dht22.pins.find(pin=>pin.name==='DATA')!;
    const voltage=effectiveSignalPin(project,sensor,dataPin).voltage;
    if(voltage===undefined)continue;
    const dataNet=new Set([`${sensor.id}:DATA`]);
    let changed=true;
    while(changed) {
      changed=false;
      for(const wire of project.connections) {
        if(!['signal','data'].includes(wire.kind))continue;
        const from=endpointKey(wire.from),to=endpointKey(wire.to);
        if(dataNet.has(from)&&!dataNet.has(to)){dataNet.add(to);changed=true;}
        if(dataNet.has(to)&&!dataNet.has(from)){dataNet.add(from);changed=true;}
      }
    }
    for(const resistor of project.parts.filter(part=>part.libraryId.startsWith('resistor-')))for(const terminal of ['A','B']) {
      if(!dataNet.has(`${resistor.id}:${terminal}`))continue;
      const railTerminal=terminal==='A'?'B':'A';
      for(const wire of project.connections) {
        if(wire.kind!=='power'||!hasEndpoint(wire,resistor.id,railTerminal))continue;
        const other=wire.from.partId===resistor.id&&wire.from.pin===railTerminal?wire.to:wire.from;
        const supply=project.parts.find(part=>part.id===other.partId),raw=supply&&PART_MAP[supply.libraryId]?.pins?.find(pin=>pin.name===other.pin);
        if(!supply||!raw||raw.type!=='power')continue;
        const rail=effectiveSignalPin(project,supply,raw).voltage;
        if(rail!==undefined&&Math.abs(rail-voltage)>.3)fail(`DHT22 pull-up rail mismatch: ${resistor.id} connects ${sensor.id}.DATA to ${rail} V, while its VCC/DATA rail is ${voltage} V. Use a 10 kΩ pull-up to the same VCC rail.`);
      }
    }
  }
}

/** Structural and circuit checks are deliberately separate from model-generated claims. */
export function validateProject(input:unknown):ValidationResult {
  const parsed=projectSchema.safeParse(input);
  if(!parsed.success) return {valid:false,errors:parsed.error.issues.map(e=>`${e.path.join('.')||'project'}: ${e.message}`),warnings:[]};
  const project:Project=parsed.data;
  const errors:string[]=[],warnings:string[]=[];
  const fail=(message:string)=>{if(!errors.includes(message))errors.push(message);};
  const warn=(message:string)=>{if(!warnings.includes(message))warnings.push(message);};
  duplicates(project.parts.map(p=>p.id)).forEach(id=>fail(`Duplicate part id: ${id}`));
  duplicates(project.connections.map(c=>c.id)).forEach(id=>fail(`Duplicate connection id: ${id}`));
  const parts=new Map(project.parts.map(p=>[p.id,p]));
  const wiring=new Map(project.connections.map(c=>[c.id,c]));
  const firstPlacement=new Map<string,number>();
  const wireStep=new Map<string,number>();
  for(const [i,s]of project.buildSteps.entries()) {
    if(s.index!==i+1)fail(`Build step ${i+1} must have index ${i+1}`);
    duplicates(s.partIds).forEach(id=>fail(`Step ${s.index} lists part ${id} more than once`));
    duplicates(s.connectionIds).forEach(id=>fail(`Step ${s.index} lists connection ${id} more than once`));
    for(const id of s.partIds) {
      if(!parts.has(id))fail(`Step ${s.index} refers to unknown part ${id}`);
      if(!firstPlacement.has(id))firstPlacement.set(id,s.index);
    }
    for(const id of s.connectionIds) {
      if(!wiring.has(id))fail(`Step ${s.index} refers to unknown connection ${id}`);
      if(wireStep.has(id))fail(`Connection ${id} appears in more than one build step`);
      wireStep.set(id,s.index);
    }
  }
  for(const p of project.parts) {
    const lib=PART_MAP[p.libraryId];
    if(!lib){fail(`Part ${p.id} uses unknown libraryId ${p.libraryId}`);continue;}
    if(!firstPlacement.has(p.id))fail(`Part ${p.id} never appears in a build step`);
    if(conductive(p)&&p.quantity!==1)fail(`Electrical part ${p.id} must have quantity 1 and its own pins; create separate instances for multiple components`);
    if(project.skillLevel==='beginner' && /\b(solder|soldering)\b/i.test(p.role+' '+(p.watchOut??''))&&!/no solder|without solder|factory|fitted|not.*solder|do not solder/i.test(p.role+' '+(p.watchOut??'')))warn(`Beginner part ${p.id}: confirm it has fitted headers/leads and requires no soldering`);
    if(Math.max(...p.assembledPosition.map(Math.abs))>1000)fail(`Part ${p.id} position exceeds the 1 metre workspace`);
    const c=connectionsFor(project,p.id);
    if(conductive(p)&&!c.length)fail(`Electrical part ${p.id} has no connections`);
    const bundledUsb=c.some(isUsb);
    const needsSupply=lib.pins.some(pin=>pin.type==='power')&&!isSource(p)&&!isPassive(p);
    if(needsSupply&&!bundledUsb) {
      if(!c.some(connection=>connection.kind==='power'&&[connection.from,connection.to].some(e=>e.partId===p.id&&lib.pins.find(pin=>pin.name===e.pin)?.type==='power')))fail(`Powered part ${p.id} needs a supply connection`);
    }
    if(lib.pins.some(pin=>pin.type==='ground')&&!isSource(p)&&!isPassive(p)&&!bundledUsb) {
      if(!c.some(connection=>connection.kind==='ground'&&[connection.from,connection.to].some(e=>e.partId===p.id&&lib.pins.find(pin=>pin.name===e.pin)?.type==='ground')))fail(`Powered part ${p.id} needs a ground connection`);
    }
    if(lib.id==='lipo-37v')warn('A LiPo requires a compatible protected charging and regulated power path; a TP4056 alone does not provide regulated output or load sharing.');
  }
  const controllers=project.parts.filter(p=>PART_MAP[p.libraryId]?.category==='microcontroller');
  if(!controllers.length)fail('Project needs a microcontroller to run the Arduino sketch');
  const sourceSteps:number[]=[],otherElectricalSteps:number[]=[],railSteps:number[]=[],signalSteps:number[]=[];
  const mcuSignals=new Map<string,Set<string>>();
  const endpointsSeen=new Set<string>();
  for(const c of project.connections) {
    const from=parts.get(c.from.partId),to=parts.get(c.to.partId);
    const fromLib=from&&PART_MAP[from.libraryId],toLib=to&&PART_MAP[to.libraryId];
    if(!from)fail(`Connection ${c.id} has unknown from part ${c.from.partId}`);
    if(!to)fail(`Connection ${c.id} has unknown to part ${c.to.partId}`);
    const rawFromPin=fromLib?.pins.find(p=>p.name===c.from.pin),rawToPin=toLib?.pins.find(p=>p.name===c.to.pin);
    const fromPin=from&&rawFromPin?effectiveSignalPin(project,from,rawFromPin):rawFromPin,toPin=to&&rawToPin?effectiveSignalPin(project,to,rawToPin):rawToPin;
    if(fromLib&&!fromPin)fail(`Connection ${c.id}: pin ${c.from.pin} does not exist on ${fromLib.name}`);
    if(toLib&&!toPin)fail(`Connection ${c.id}: pin ${c.to.pin} does not exist on ${toLib.name}`);
    if(c.from.partId===c.to.partId&&c.from.pin===c.to.pin)fail(`Connection ${c.id} connects a pin to itself`);
    const key=[`${c.from.partId}:${c.from.pin}`,`${c.to.partId}:${c.to.pin}`].sort().join('|');
    if(endpointsSeen.has(key))fail(`Connection ${c.id} duplicates an existing pair of pins`);
    endpointsSeen.add(key);
    if(!wireStep.has(c.id))fail(`Connection ${c.id} is not assigned to any build step`);
    const n=wireStep.get(c.id);
    if(n!==undefined) {
      for(const p of [from,to])if(p&&(firstPlacement.get(p.id)??Infinity)>n)fail(`Connection ${c.id} is installed before part ${p.id} is placed`);
      if(isSource(from)||isSource(to))sourceSteps.push(n);
      else {otherElectricalSteps.push(n);if(c.kind==='power'||c.kind==='ground')railSteps.push(n);else signalSteps.push(n);}
    }
    if(from&&to)for(const [controller,other]of [[from,to],[to,from]])if(PART_MAP[controller.libraryId]?.category==='microcontroller'&&!isSource(other)&&!isMechanical(other)&&!isPassive(other)) {
      if((firstPlacement.get(controller.id)??Infinity)>=(firstPlacement.get(other.id)??Infinity))fail(`Place controller ${controller.id} before connected part ${other.id}`);
    }
    if(!fromPin||!toPin||!from||!to)continue;
    for(const [p,pin,isFrom] of [[from,fromPin,true],[to,toPin,false]] as [PartInstance,Pin,boolean][]) {
      const inputOnly=inputOnlyPin(p,pin);
      const drives=c.signalDirection==='both'||(isFrom?c.signalDirection==='from-to':c.signalDirection==='to-from');
      if(inputOnly&&drives)fail(`Input-only pin ${p.id}.${pin.name} cannot drive connection ${c.id}`);
    }
    if(c.kind==='ground'&& (fromPin.type!=='ground'||toPin.type!=='ground'))fail(`Ground connection ${c.id} must join ground terminals`);
    if((fromPin.type==='ground'||toPin.type==='ground')&&c.kind!=='ground')fail(`Connection ${c.id} uses a ground terminal but is not marked ground`);
    if(c.kind==='power') {
      if(fromPin.type!=='power'&&!isPassive(from))fail(`Power connection ${c.id} must start at a supply terminal`);
      if(toPin.type!=='power'&&!isPassive(to))fail(`Power connection ${c.id} must end at a supply terminal`);
      // Header outputs have their own voltage: a Nano's 3V3 is not its 5V logic rail.
      const supply=c.signalDirection==='to-from'?toPin:fromPin;
      const destination=c.signalDirection==='to-from'?from:to;
      const inputPin=c.signalDirection==='to-from'?fromPin:toPin;
      if(supply.voltage!==undefined&&!isPassive(destination)) {
        const range=supplyRange(destination,inputPin);
        if(supply.voltage<range.min-0.15||supply.voltage>range.max+0.15)fail(`Voltage mismatch on ${c.id}: ${supply.voltage} V supply into ${destination.id}.${inputPin.name} (${range.min}–${range.max} V)`);
      }
    } else if(c.kind==='signal'||c.kind==='data') {
      if(fromPin.type==='power'||toPin.type==='power')fail(`Signal connection ${c.id} uses a power terminal`);
      if(c.kind==='data'&&((fromPin.type==='i2c-sda'&&toPin.type==='i2c-scl')||(fromPin.type==='i2c-scl'&&toPin.type==='i2c-sda')))fail(`I²C connection ${c.id} crosses SDA and SCL`);
      const pairs=c.signalDirection==='both'?[[fromPin,toPin,to],[toPin,fromPin,from]]:c.signalDirection==='to-from'?[[toPin,fromPin,from]]:[[fromPin,toPin,to]];
      for(const [rawSource,rawTarget,rawPart] of pairs) {
        const source=rawSource as Pin,target=rawTarget as Pin,targetPart=rawPart as PartInstance;
        if(source.voltage!==undefined&&target.voltage!==undefined&&source.voltage>target.voltage+0.3&&!isPassive(targetPart))fail(`Logic voltage mismatch on ${c.id}: ${source.voltage} V signal into ${targetPart.id}.${target.name} (${target.voltage} V logic)`);
      }
      for(const [p,pin,other]of [[from,fromPin,to],[to,toPin,from]] as [PartInstance,Pin,PartInstance][])if(PART_MAP[p.libraryId]?.category==='microcontroller'&&!['i2c-sda','i2c-scl','spi'].includes(pin.type)) {
        const slot=`${p.id}.${pin.name}`;const attached=mcuSignals.get(slot)??new Set<string>();attached.add(other.id);mcuSignals.set(slot,attached);
      }
    }
  }
  checkResistiveSignalPaths(project,fail);
  checkDhtPullupRails(project,fail);
  for(const controller of controllers) {
    const wires=connectionsFor(project,controller.id);
    if(wires.some(isUsb)&&wires.some(c=>!isUsb(c)&&[c.from,c.to].some(e=>e.partId===controller.id&&['5V','3V3','VSYS'].includes(e.pin))&&[c.from,c.to].some(e=>isSource(parts.get(e.partId)))))fail(`Controller ${controller.id} must not receive USB and an external rail supply at the same time`);
  }
  for(const [pin,attached]of mcuSignals)if(attached.size>1)warn(`Check shared GPIO ${pin}: it connects to ${[...attached].join(', ')}; only intentional passive networks may share a non-bus pin.`);
  if(sourceSteps.length===0)fail('Project needs a USB or other power source connection');
  if(sourceSteps.length&&new Set(sourceSteps).size>1)fail('Connect all power sources together in the last electrical step; no wiring while powered');
  if(sourceSteps.length&&otherElectricalSteps.length&&Math.min(...sourceSteps)<=Math.max(...otherElectricalSteps))fail('Power source connection must be the last electrical step, after every other wire');
  if(railSteps.length&&signalSteps.length&&Math.max(...railSteps)>=Math.min(...signalSteps))fail('Install all unpowered supply and ground conductors before signal/data wiring');
  const lastElectrical=Math.max(0,...sourceSteps,...otherElectricalSteps);
  for(const p of project.parts) {
    const placed=firstPlacement.get(p.id)??0;
    if((p.libraryId==='enclosure-bottom'||p.libraryId==='breadboard')&&placed!==1)fail(`Place base part ${p.id} in step 1`);
    if(isClosingPart(p)&&placed<=lastElectrical)fail(`Close enclosure part ${p.id} only after the last electrical step`);
    if(isClosingPart(p)&&placed===project.buildSteps.length)fail(`Place enclosure part ${p.id} before the final upload/test step`);
  }
  const final=project.buildSteps.at(-1)!;
  if(!/upload/i.test(final.title)||!/test/i.test(final.title))fail('Final step must be Upload the code and test');
  if(final.connectionIds.length)fail('Final upload/test step must not introduce new wiring');
  if(!/void\s+setup\s*\(\s*(?:void)?\s*\)/.test(project.code.source)||!/void\s+loop\s*\(\s*(?:void)?\s*\)/.test(project.code.source))fail('Arduino code must contain complete setup() and loop() functions');
  if(/\b(TODO|INSERT_CODE_HERE|YOUR_API_KEY|placeholder code)\b/i.test(project.code.source))fail('Arduino code contains unfinished placeholder text');
  if(!/Serial\.begin\s*\(/.test(project.code.source)||!/Serial\.(?:print|println|printf|write)\s*\(/.test(project.code.source))fail('Arduino code must initialize Serial and print real status/readings');
  for(const p of project.parts.filter(p=>p.libraryId==='led-red'||p.libraryId==='rgb-led')) {
    const channels=p.libraryId==='rgb-led'?['R','G','B']:['ANODE'];
    for(const channel of channels) {
      const feeds=connectionsFor(project,p.id).filter(c=>hasEndpoint(c,p.id,channel));
      for(const c of feeds) {
        const other=parts.get(c.from.partId===p.id?c.to.partId:c.from.partId);
        if(other&&!other.libraryId.startsWith('resistor-'))fail(`LED ${p.id}.${channel} requires its own series resistor`);
      }
      if(!feeds.length)fail(`LED ${p.id}.${channel} is not connected through a series resistor`);
    }
  }
  if(project.parts.some(p=>p.libraryId==='water-pump')) {
    if(!project.parts.some(p=>p.libraryId==='relay-module'))fail('Water pump requires a relay/driver; never connect it directly to a GPIO');
    if(!project.parts.some(p=>p.libraryId==='diode-1n4007'))fail('Water pump requires a reverse-biased flyback diode across the motor');
    if(!project.parts.some(p=>p.libraryId==='supply-5v'))fail('Water pump requires its separate regulated 5 V motor supply');
    for(const p of project.parts.filter(p=>p.libraryId==='water-pump'))for(const c of connectionsFor(project,p.id)) {
      const other=parts.get(c.from.partId===p.id?c.to.partId:c.from.partId);
      if(other&&PART_MAP[other.libraryId]?.category==='microcontroller'&&c.kind!=='ground')fail(`Pump ${p.id} must not draw current from controller ${other.id}`);
    }
  }
  return {valid:errors.length===0,errors,warnings,...(errors.length?{}:{project})};
}
function supplyRange(part:PartInstance,pin:Pin):{min:number;max:number} {
  if(pin.name==='USB')return {min:4.75,max:5.25};
  if(['arduino-nano','arduino-uno'].includes(part.libraryId)&&pin.name==='VIN')return {min:7,max:12};
  if(['arduino-nano','arduino-uno'].includes(part.libraryId)&&pin.name==='5V')return {min:4.75,max:5.25};
  if(part.libraryId==='esp32-devkit'&&pin.name==='5V')return {min:4.75,max:5.25};
  if(pin.name==='3V3')return {min:3.15,max:3.45};
  return PART_MAP[part.libraryId].voltage;
}

function rotatedBounds(size:Vec3,rotation:Vec3):Vec3 {
  const [a,b,c]=rotation.map(n=>n*Math.PI/180);const ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),cc=Math.cos(c),sc=Math.sin(c);
  const matrix=[[cc*cb,cc*sb*sa-sc*ca,cc*sb*ca+sc*sa],[sc*cb,sc*sb*sa+cc*ca,sc*sb*ca-cc*sa],[-sb,cb*sa,cb*ca]];
  return matrix.map(row=>row.reduce((sum,value,i)=>sum+Math.abs(value)*size[i],0)) as Vec3;
}
/** Deterministic collision cleanup affects exploded endpoints only; assembled pin maps stay intact. */
export function cleanLayout(project:Project):Project {
  const output=structuredClone(project);
  const placed:{position:Vec3;size:Vec3}[]=[];
  const ordered=[...output.parts].sort((a,b)=>a.layer-b.layer||a.id.localeCompare(b.id));
  for(const p of ordered) {
    const lib=PART_MAP[p.libraryId];if(!lib)continue;
    if(p.libraryId==='enclosure-bottom') {p.layer=0;p.explodeDirection=[0,0,0];p.explodeDistance=0;placed.push({position:p.assembledPosition,size:rotatedBounds(lib.size,p.rotation)});continue;}
    if(p.libraryId==='enclosure-top')p.layer=Math.max(5,p.layer);
    if(p.libraryId==='screw-m3')p.layer=Math.max(6,p.layer);
    const direction=p.explodeDirection;const length=Math.hypot(...direction);
    const normalized:Vec3=length>0.00001?direction.map(n=>n/length) as Vec3:[p.assembledPosition[0]>=0?0.3:-0.3,0.95,0];
    const distance=Math.max(p.explodeDistance,35+p.layer*13+(lib.size[0]*lib.size[1]*lib.size[2]<600?16:0));
    const end=p.assembledPosition.map((n,i)=>n+normalized[i]*distance) as Vec3;
    const bounds=rotatedBounds(lib.size,p.rotation);
    // Give each higher layer a consistent vertical band without forcing horizontal spacing.
    end[1]=Math.max(end[1],p.assembledPosition[1]+p.layer*18+25);
    for(let pass=0;pass<120;pass++) {
      const conflict=placed.find(other=>end.every((n,i)=>Math.abs(n-other.position[i])<(bounds[i]+other.size[i])/2+7));
      if(!conflict)break;
      const sign=p.assembledPosition[0]<0?-1:1;
      end[0]=conflict.position[0]+sign*((bounds[0]+conflict.size[0])/2+8);
    }
    const delta=end.map((n,i)=>n-p.assembledPosition[i]) as Vec3;
    const actualDistance=Math.hypot(...delta);p.explodeDistance=actualDistance;p.explodeDirection=delta.map(n=>n/(actualDistance||1)) as Vec3;
    placed.push({position:end,size:bounds});
  }
  return output;
}
