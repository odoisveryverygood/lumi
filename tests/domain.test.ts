import { describe, expect, it } from 'vitest';
import { PARTS, PART_MAP } from '../lib/library';
import { demoProjects, getDemoProject } from '../lib/projects';
import { cleanLayout, projectSchema, validateProject } from '../lib/validation';
import type { Project } from '../lib/types';
const clone=(id='heart-rate'):Project=>structuredClone(demoProjects.find(p=>p.id===id)!);

describe('curated circuit library and complete demos',()=>{
  it('provides unique parts, pin names, actual output voltage and viable links',()=>{
    expect(PARTS.length).toBeGreaterThanOrEqual(25);
    expect(new Set(PARTS.map(p=>p.id)).size).toBe(PARTS.length);
    for(const p of PARTS) {
      expect(new Set(p.pins.map(pin=>pin.name)).size).toBe(p.pins.length);
      expect(p.buyUrl).toMatch(/^https:\/\//);
      expect(p.sourceUrl).toMatch(/^https:\/\//);
      expect(p.size.every(n=>n>0)).toBe(true);
      for(const pin of p.pins.filter(pin=>pin.type==='ground'))expect(pin.voltage).toBe(0);
    }
    expect(PART_MAP['arduino-nano'].pins.find(p=>p.name==='3V3')?.voltage).toBe(3.3);
    expect(PART_MAP['hc-sr04'].pins.find(p=>p.name==='ECHO')?.voltage).toBe(5);
    expect(PART_MAP['esp32-devkit'].pins.find(p=>p.name==='GPIO21')?.voltage).toBe(3.3);
  });
  for(const demo of demoProjects)it(`${demo.id} is a complete validated circuit with code and coverage`,()=>{
    const result=validateProject(demo);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.project?.code.source).toContain('void loop()');
    expect(projectSchema.safeParse(demo).success).toBe(true);
    expect(new Set(demo.buildSteps.flatMap(s=>s.connectionIds))).toEqual(new Set(demo.connections.map(c=>c.id)));
  });
  it('picks a relevant independent fallback and preserves level',()=>{
    const a=getDemoProject('a garden soil monitor','intermediate');
    expect(a.id).toBe('plant-waterer');expect(a.skillLevel).toBe('intermediate');
    a.parts[0].role='changed';expect(getDemoProject('plant').parts[0].role).not.toBe('changed');
    expect(getDemoProject('temperature and humidity').id).toBe('weather-station');
    expect(getDemoProject('reflex button').id).toBe('reaction-game');
  });
  it('does not invent a separate USB ground jumper or require power on a passive LED',()=>{
    expect(validateProject(clone('reaction-game')).errors).toEqual([]);
    const project=clone();project.connections=project.connections.filter(c=>c.id!=='sensor-gnd');
    project.buildSteps.forEach(s=>s.connectionIds=s.connectionIds.filter(id=>id!=='sensor-gnd'));
    expect(validateProject(project).errors).toContain('Powered part sensor needs a ground connection');
  });
});

describe('model output is checked against real circuit constraints',()=>{
  it('rejects an invented part and invalid pin before rendering',()=>{
    const p=clone();p.parts.find(x=>x.id==='sensor')!.libraryId='magic-sensor';
    expect(validateProject(p).errors.some(e=>e.includes('unknown libraryId'))).toBe(true);
    const q=clone();q.connections[0].to.pin='FAKE_GROUND';
    expect(validateProject(q).errors.some(e=>e.includes('pin FAKE_GROUND does not exist'))).toBe(true);
  });
  it('rejects 5V sensor power even though the MCU also has a 3.3V output',()=>{
    const p=clone();p.connections.find(c=>c.id==='sensor-power')!.from.pin='5V';
    expect(validateProject(p).errors.some(e=>e.includes('Voltage mismatch on sensor-power'))).toBe(true);
  });
  it('rejects 5V I2C logic into 3.3V inputs',()=>{
    const p=clone();const mcu=p.parts.find(x=>x.id==='mcu')!;mcu.libraryId='arduino-nano';
    p.connections.forEach(c=>{if(c.from.partId==='mcu'){if(c.from.pin==='GPIO21')c.from.pin='A4';if(c.from.pin==='GPIO22')c.from.pin='A5';}});
    expect(validateProject(p).errors.some(e=>e.includes('Logic voltage mismatch'))).toBe(true);
  });
  it('rejects missing and repeated connection coverage',()=>{
    const p=clone();p.buildSteps[6].connectionIds.push('sensor-sda');
    expect(validateProject(p).errors.some(e=>e.includes('more than one build step'))).toBe(true);
    const q=clone();q.buildSteps.forEach(s=>s.connectionIds=s.connectionIds.filter(id=>id!=='sensor-sda'));
    expect(validateProject(q).errors).toContain('Connection sensor-sda is not assigned to any build step');
  });
  it('rejects applying USB power before signal wiring',()=>{
    const p=clone();p.buildSteps[7].connectionIds=[];p.buildSteps[4].connectionIds.push('usb-power');p.buildSteps[4].partIds.push('usb');
    expect(validateProject(p).errors.some(e=>e.includes('Power source connection must be the last electrical step'))).toBe(true);
  });
  it('rejects multiple power source steps',()=>{
    const p=clone('plant-waterer');p.buildSteps[7].connectionIds=p.buildSteps[7].connectionIds.filter(id=>id!=='supply-positive');
    p.buildSteps[6].partIds.push('motorSupply');p.buildSteps[6].connectionIds.push('supply-positive');
    expect(validateProject(p).errors.some(e=>e.includes('Connect all power sources together'))).toBe(true);
  });
  it('rejects late rail wiring and early enclosure closure',()=>{
    const p=clone();p.buildSteps[3].connectionIds=p.buildSteps[3].connectionIds.filter(id=>id!=='sensor-gnd');p.buildSteps[6].connectionIds.push('sensor-gnd');
    expect(validateProject(p).errors.some(e=>e.includes('before signal/data wiring'))).toBe(true);
    const q=clone();q.buildSteps[3].partIds.push('lid');
    expect(validateProject(q).errors.some(e=>e.includes('Close enclosure part lid only after'))).toBe(true);
  });
  it('requires controller placement before peripherals',()=>{
    const p=clone();p.buildSteps[1].partIds.push('sensor');
    expect(validateProject(p).errors.some(e=>e.includes('Place controller mcu before connected part sensor'))).toBe(true);
  });
  it('rejects multiplying a wired electronic instance without its own pins',()=>{
    const p=clone();p.parts.find(x=>x.id==='sensor')!.quantity=2;
    expect(validateProject(p).errors.some(e=>e.includes('must have quantity 1'))).toBe(true);
    expect(validateProject(clone()).errors).toEqual([]); // Four mechanical screws are valid.
  });
  it('rejects bypassing the LED series resistor',()=>{
    const p=clone('reaction-game');const w=p.connections.find(c=>c.id==='led-anode')!;
    w.from={partId:'mcu',pin:'D6'};
    expect(validateProject(p).errors.some(e=>e.includes('requires its own series resistor'))).toBe(true);
  });
  it('requires separate motor supply and transient protection for a pump',()=>{
    const p=clone('plant-waterer');p.parts=p.parts.filter(x=>x.id!=='diode');
    expect(validateProject(p).errors.some(e=>e.includes('flyback diode'))).toBe(true);
    const q=clone('plant-waterer');q.parts=q.parts.filter(x=>x.id!=='motorSupply');
    expect(validateProject(q).errors.some(e=>e.includes('separate regulated 5 V motor supply'))).toBe(true);
  });
  it('rejects partial Arduino source and a final wiring step',()=>{
    const p=clone();p.code.source='void setup() {}';
    expect(validateProject(p).errors.some(e=>e.includes('complete setup() and loop()'))).toBe(true);
    const q=clone();q.buildSteps[9].title='Close the enclosure';
    expect(validateProject(q).errors).toContain('Final step must be Upload the code and test');
  });
});

describe('exploded layout normalization',()=>{
  it('normalizes directions, removes endpoint overlaps, preserves assembly and input data',()=>{
    const p=clone();for(const part of p.parts){if(part.libraryId!=='enclosure-bottom'){part.assembledPosition=[0,20,0];part.explodeDirection=[0,0,0];part.explodeDistance=0;part.layer=2;}}
    const snapshot=structuredClone(p);const result=cleanLayout(p);
    expect(p).toEqual(snapshot);expect(cleanLayout(p)).toEqual(result);
    for(const part of result.parts) {
      const original=p.parts.find(x=>x.id===part.id)!;
      expect(part.assembledPosition).toEqual(original.assembledPosition);
      if(part.libraryId!=='enclosure-bottom')expect(Math.hypot(...part.explodeDirection)).toBeCloseTo(1,8);
    }
    const points=result.parts.map(part=>({part,position:part.assembledPosition.map((v,i)=>v+part.explodeDirection[i]*part.explodeDistance)}));
    for(let a=0;a<points.length;a++)for(let b=a+1;b<points.length;b++) {
      const x=points[a],y=points[b],sx=PART_MAP[x.part.libraryId].size,sy=PART_MAP[y.part.libraryId].size;
      expect(x.position.some((n,i)=>Math.abs(n-y.position[i])>=(sx[i]+sy[i])/2)).toBe(true);
    }
  });
});

describe('resistors do not silently translate digital logic levels',()=>{
  const nanoClimate=(sensorVoltage:3.3|5=5):Project=>{
    const p=clone('weather-station');
    p.parts.find(part=>part.id==='mcu')!.libraryId='arduino-nano';
    p.parts.find(part=>part.id==='display')!.libraryId='lcd-1602';
    for(const c of p.connections)if(c.from.partId==='mcu') {
      if(c.from.pin==='GPIO27')c.from.pin='D2';
      if(c.from.pin==='GPIO21')c.from.pin='A4';
      if(c.from.pin==='GPIO22')c.from.pin='A5';
      if(c.id==='sensor-power'||c.id==='pullup-power')c.from.pin=sensorVoltage===5?'5V':'3V3';
      if(c.id==='display-power')c.from.pin='5V';
    }
    return p;
  };
  const seriesResistor=(p:Project):Project=>{
    p.parts.push({...structuredClone(p.parts.find(part=>part.id==='pullup')!),id:'series',label:'R2',libraryId:'resistor-1k',role:'One kiloohm series resistor, not a logic-level converter.'});
    p.buildSteps[2].partIds.push('series');
    const data=p.connections.find(c=>c.id==='sensor-data')!;
    data.to={partId:'series',pin:'A'};data.signalDirection='both';
    p.connections.push({id:'series-data',from:{partId:'series',pin:'B'},to:{partId:'sensor',pin:'DATA'},kind:'signal',wireColor:'blue',purpose:'Series connection to the DHT22 data terminal.',signalDirection:'both'});
    p.buildSteps[5].connectionIds.push('series-data');
    return p;
  };
  it('rejects direct Nano5V data into a3.3V-powered DHT22',()=>{
    const result=validateProject(nanoClimate(3.3));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e=>e.includes('Logic voltage mismatch on sensor-data')&&e.includes('3.3 V logic'))).toBe(true);
  });
  it('accepts a5V-powered DHT22 with a5V pull-up and a5V Nano/LCD data bus',()=>{
    const before=PART_MAP.dht22.pins.find(pin=>pin.name==='DATA')!.voltage;
    const result=validateProject(nanoClimate(5));
    expect(result.errors).toEqual([]);expect(result.valid).toBe(true);
    expect(PART_MAP.dht22.pins.find(pin=>pin.name==='DATA')!.voltage).toBe(before);
  });
  it('rejects NanoD2 through1k to3.3V DHTDATA even with its3.3V pull-up connected',()=>{
    const project=seriesResistor(nanoClimate(3.3)),result=validateProject(project);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e=>e.includes('through resistor network')&&e.includes('mcu.D2')&&e.includes('sensor.DATA')&&e.includes('5 V')&&e.includes('3.3 V logic'))).toBe(true);
    // Each individual wire ends at a passive, so the transitive check is essential.
    expect(result.errors.some(e=>e.includes('Logic voltage mismatch on sensor-data'))).toBe(false);
    expect(result.errors.some(e=>e.includes('Logic voltage mismatch on series-data'))).toBe(false);
  });
  it('also rejects a chain of resistors masquerading as a converter',()=>{
    const project=seriesResistor(nanoClimate(3.3));
    project.parts.push({...structuredClone(project.parts.find(part=>part.id==='series')!),id:'series2',label:'R3'});
    project.buildSteps[2].partIds.push('series2');
    project.connections.find(c=>c.id==='series-data')!.to={partId:'series2',pin:'A'};
    project.connections.push({id:'series2-data',from:{partId:'series2',pin:'B'},to:{partId:'sensor',pin:'DATA'},kind:'signal',wireColor:'green',purpose:'Second resistor in the same signal path.',signalDirection:'both'});
    project.buildSteps[5].connectionIds.push('series2-data');
    expect(validateProject(project).errors.some(e=>e.includes('mcu.D2')&&e.includes('sensor.DATA')&&e.includes('through resistor network'))).toBe(true);
  });
  it('derives5V DHT output levels when checking a series path into3.3V ESP32 GPIO',()=>{
    const project=seriesResistor(clone('weather-station'));
    project.connections.find(c=>c.id==='sensor-power')!.from.pin='5V';
    const result=validateProject(project);
    expect(result.errors.some(e=>e.includes('sensor.DATA')&&e.includes('mcu.GPIO27')&&e.includes('through resistor network'))).toBe(true);
  });
  it('rejects both higher and lower DHT pull-up rails relative to actual VCC',()=>{
    const lowVoltage=nanoClimate(3.3);
    lowVoltage.connections.find(c=>c.id==='pullup-power')!.from.pin='5V';
    expect(validateProject(lowVoltage).errors.some(e=>e.includes('DHT22 pull-up rail mismatch')&&e.includes('to 5 V')&&e.includes('3.3 V'))).toBe(true);
    const highVoltage=nanoClimate(5);
    highVoltage.connections.find(c=>c.id==='pullup-power')!.from.pin='3V3';
    const result=validateProject(highVoltage);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e=>e.includes('DHT22 pull-up rail mismatch')&&e.includes('to 3.3 V'))).toBe(true);
  });
  it('rejects a 5 V rail through a resistor into 3.3 V DHT DATA even without a digital driver',()=>{
    const project=seriesResistor(nanoClimate(3.3));
    const supply=project.connections.find(c=>c.id==='sensor-data')!;
    supply.from={partId:'mcu',pin:'5V'};supply.kind='power';supply.signalDirection='from-to';
    project.buildSteps[5].connectionIds=project.buildSteps[5].connectionIds.filter(id=>id!=='sensor-data');
    project.buildSteps[4].connectionIds.push('sensor-data');
    expect(validateProject(project).errors.some(e=>e.includes('DHT22 pull-up rail mismatch')&&e.includes('series'))).toBe(true);
  });
  it('accepts a 5 V DHT pull-up fed from its own actual VCC terminal',()=>{
    const project=nanoClimate(5);
    project.connections.find(c=>c.id==='pullup-power')!.from={partId:'sensor',pin:'VCC'};
    expect(validateProject(project).errors).toEqual([]);
  });
  it('does not back-propagate a NanoADC5V rating into a one-way analog sensor path',()=>{
    const project=clone('plant-waterer');
    project.parts.push({...structuredClone(project.parts.find(part=>part.id==='pullup')!),id:'analog-series',label:'R2',libraryId:'resistor-1k',role:'Series resistance on a unidirectional analog input.'});
    project.buildSteps[2].partIds.push('analog-series');
    project.connections.find(c=>c.id==='soil-data')!.to={partId:'analog-series',pin:'A'};
    project.connections.push({id:'analog-series-data',from:{partId:'mcu',pin:'A0'},to:{partId:'analog-series',pin:'B'},kind:'signal',wireColor:'green',purpose:'Sensor signal travels into the ADC, not out of it.',signalDirection:'to-from'});
    project.buildSteps[5].connectionIds.push('analog-series-data');
    expect(validateProject(project).errors).toEqual([]);
  });
});
