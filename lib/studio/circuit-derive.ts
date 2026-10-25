import type {DeviceDocument,DevicePart,Vec3} from './types';
import type {BuildStep,Connection,LibraryPart,PartInstance,Project} from '../types';
import {PART_MAP} from '../library';
/**
 * Circuits is derived from whatever is open in Studio. This module classifies the Studio
 * object's parts into electrical roles, maps each to a catalog part with real pins, generates
 * wires only between pins that exist, builds one ordered assembly-and-wiring guide, writes
 * firmware for the actual controller, and reports which checks were really run.
 * Pure functions, no provider calls: the base circuit must be reproducible without a key.
 */
export type ElectricalRole='controller'|'driver'|'motor'|'servo'|'sensor-i2c'|'sensor-analog'|'sensor-digital'|'display'|'knob'|'button'|'led'|'power-usb'|'battery'|'supply'|'unknown';
export type Classified={part:DevicePart;role:ElectricalRole|null;libraryId:string|null;reason:string};
export type CircuitPlan={parts:PartInstance[];connections:Connection[];added:PartInstance[];unresolved:{part:DevicePart;reason:string}[];roles:Record<string,ElectricalRole>;controllerId:string|null;sourceId:string|null};
export type CircuitCheck={id:string;title:string;status:'pass'|'fail'|'unchecked';detail:string};
export type CircuitOverlay={version:1;connections?:Connection[];code?:{filename:string;source:string;libraries:string[]};addedParts?:PartInstance[]};
const text=(p:DevicePart)=>[p.name,p.category,p.description,p.role,...Object.entries(p.specs).map(([k,v])=>`${k} ${v}`)].join(' ').toLowerCase();
const slug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'x';
/** Decide what a Studio part is electrically. Catalog references win; then explicit words. */
export function classifyPart(part:DevicePart):Classified{
 const name=`${part.name} ${part.category}`.toLowerCase(),t=text(part),ref=part.catalogRef?.id??'';
 const out=(role:ElectricalRole|null,libraryId:string|null,reason:string):Classified=>({part,role,libraryId,reason});
 if(/^esp32-c3/.test(ref))return out('controller','esp32-c3-mini','Sourced ESP32-C3 module');
 if(/^esp32/.test(ref))return out('controller','esp32-devkit','Sourced ESP32 module');
 const explicit=part.specs['Circuits library'];
 if(explicit&&PART_MAP[explicit]){const cat=PART_MAP[explicit].category;const role:ElectricalRole|null=cat==='microcontroller'?'controller':cat==='display'?'display':cat==='power'?(explicit==='usb-c-power'||explicit==='usb-cable'?'power-usb':/lipo|battery/.test(explicit)?'battery':explicit==='ldo-3v3'?null:'supply'):cat==='input'?(explicit==='potentiometer'?'knob':'button'):cat==='output'?(explicit==='dc-motor'?'motor':explicit==='sg90-servo'?'servo':explicit==='pwm-motor-driver'?'driver':'led'):cat==='sensor'?(/mpu|max3010/.test(explicit)?'sensor-i2c':/soil|photo/.test(explicit)?'sensor-analog':'sensor-digital'):null;if(role)return out(role,explicit,'Added from the Circuits library');}
 // The part name decides first. Descriptions mention neighbours ("encloses the PWM PCB"), so they only break ties.
 const mechanicalName=/bearing|screw|bolt|nut|washer|bracket|axle|shaft|grille|housing|\bpod\b|\bboss\b|\bcase\b|frame|stand|\bbase\b|yoke|blade|rotor|\blid\b|cover|panel|fin stack|heatsink|standoff|feet|tray|fascia|\brim\b|strap|thumb knob|locking knob|thumbscrew|enclosure|chassis|spacer|gasket|hinge|tube|duct|shroud|harness|cable|mount\b/.test(name);
 const electricalName=/\bmotor\b(?!.*(?:pod|housing|mount|bracket|boss))|\bsensor\b|\bled\b|\bpcb\b|\bboard\b|controller|\bmodule\b|display|screen|\bbattery\b|servo|button|switch|potentiometer|speaker|buzzer|camera|antenna|\bradio\b|usb/.test(name);
 if(mechanicalName&&!electricalName)return out(null,null,'Mechanical');
 const role=(src:string):Classified|null=>{
  if(/esp32|esp8266|arduino|raspberry pi pico|rp2040|microcontroller|\bmcu\b|dev ?kit|devboard/.test(src)){const lib=/c3/.test(src)?'esp32-c3-mini':/esp/.test(src)?'esp32-devkit':/uno/.test(src)?'arduino-uno':/nano/.test(src)?'arduino-nano':/pico|rp2040/.test(src)?'raspberry-pi-pico':'esp32-devkit';return out('controller',lib,'Programmable controller');}
  if(/pwm|speed control|motor driver|motor controller|\besc\b|h-bridge|mosfet|dimmer/.test(src)&&/control|driver|pcb|board|module|esc/.test(src))return out('driver','pwm-motor-driver','Motor speed controller board');
  if(/servo/.test(src))return out('servo','sg90-servo','Positional servo');
  if(/\bmotor\b|brushless|stepper/.test(src)&&!/pod|housing|mount|bracket|boss/.test(src))return out('motor','dc-motor','DC motor');
  if(/oled|ssd1306|\bdisplay\b|\bscreen\b|\blcd\b/.test(src)&&!/display window|display state/.test(src))return out('display',/lcd|1602/.test(src)?'lcd-1602':'ssd1306-oled','Display');
  if(/potentiometer|\bknob\b|\bdial\b|rotary/.test(src))return out('knob','potentiometer','Knob read as a potentiometer');
  if(/push ?button|tactile|\bbutton\b|toggle switch|\bswitch\b/.test(src)&&!/switch(ing)? (regulator|mode)/.test(src))return out('button','push-button','Momentary button');
  if(/buzzer|piezo/.test(src))return out('led','piezo-buzzer','Piezo buzzer, driven like an indicator');
  if(/\bled\b|status light|indicator (light|lamp)|neopixel/.test(src))return out('led','led-red','Indicator LED');
  if(/usb-?c|usb (power|input|port|jack)|type-c/.test(src)&&/power|input|port|jack|receptacle|charg/.test(src))return out('power-usb','usb-c-power','USB power input');
  if(/lipo|li-?ion|\bbattery\b|cell pack|18650/.test(src))return out('battery','lipo-37v','Battery');
  if(/power supply|dc supply|wall adapter|\bpsu\b|power adapter|barrel jack/.test(src))return out('supply','supply-5v','DC supply');
  if(/humidity|\bdht\b|temperature sensor|thermometer/.test(src))return out('sensor-digital','dht22','Temperature and humidity sensor');
  if(/ultrasonic|hc-?sr04|distance sensor|rangefinder/.test(src))return out('sensor-digital','hc-sr04','Ultrasonic range module');
  if(/\bimu\b|gyro|accelerometer|mpu6050|pulse sensor|max3010|i2c sensor|i²c sensor/.test(src))return out('sensor-i2c',/pulse|max3010/.test(src)?'max30102':'mpu6050','I²C sensor');
  if(/soil|moisture/.test(src))return out('sensor-analog','soil-moisture','Analog soil probe');
  if(/photoresistor|\bldr\b|light sensor|photocell/.test(src))return out('sensor-analog','photoresistor','Light-dependent resistor');
  if(/\bpir\b|motion sensor|presence sensor/.test(src))return out('sensor-digital','pir-motion','PIR motion sensor');
  return null;
 };
 const byName=role(name);if(byName)return byName;
 if(electricalName||/electronic|electrical/.test(part.category.toLowerCase()))return role(t)??out('unknown',null,'Electrical, but its pins are not in the catalog');
 if(mechanicalName)return out(null,null,'Mechanical');
 return out(null,null,'Mechanical');
}
const PIN_BY_TYPE=(lib:LibraryPart,type:LibraryPart['pins'][number]['type'])=>lib.pins.filter(p=>p.type===type).map(p=>p.name);
const INPUT_ONLY:Record<string,string[]>={'esp32-devkit':['GPIO34','GPIO35','GPIO36','GPIO39'],'arduino-nano':['A6','A7']};
class PinPool{
 used=new Set<string>();
 constructor(readonly lib:LibraryPart,readonly partId:string){}
 take(types:LibraryPart['pins'][number]['type'][],output=false){
  for(const type of types)for(const name of PIN_BY_TYPE(this.lib,type)){
   if(this.used.has(name))continue;if(output&&INPUT_ONLY[this.lib.id]?.includes(name))continue;if(['i2c-sda','i2c-scl'].includes(type))continue;
   this.used.add(name);return name;
  }
  return null;
 }
 bus(type:'i2c-sda'|'i2c-scl'){return PIN_BY_TYPE(this.lib,type)[0]??null;}
 rail(voltage:number){const exact=this.lib.pins.find(p=>p.type==='power'&&p.voltage===voltage&&p.name!=='USB'&&p.name!=='VIN');return exact?.name??null;}
 ground(){return PIN_BY_TYPE(this.lib,'ground')[0]??null;}
}
const colourFor=(kind:Connection['kind'],hint?:Connection['wireColor']):Connection['wireColor']=>hint??(kind==='power'?'red':kind==='ground'?'black':kind==='data'?'blue':'yellow');
function instanceFromStudio(part:DevicePart,libraryId:string,layer:number):PartInstance{
 const lib=PART_MAP[libraryId];
 return {id:part.id,libraryId,label:part.name.slice(0,40),role:(part.role||part.description||lib.whatItIs).slice(0,2000),quantity:1,assembledPosition:part.position.map(n=>Math.max(-1000,Math.min(1000,Math.round(n*10)/10))) as Vec3,rotation:part.rotation,explodeDirection:[0,1,0],explodeDistance:layer?20+layer*12:0,layer,size:part.size.map(n=>Math.max(.5,n)) as Vec3,colour:/^#[0-9a-fA-F]{6}$/.test(part.color)?part.color:undefined};
}
function addedInstance(id:string,libraryId:string,label:string,role:string,near:Vec3,offset:Vec3,layer:number):PartInstance{
 return {id,libraryId,label,role,quantity:1,assembledPosition:[near[0]+offset[0],near[1]+offset[1],near[2]+offset[2]] as Vec3,rotation:[0,0,0],explodeDirection:[0,1,0],explodeDistance:20+layer*12,layer};
}
/** Generate the circuit for a Studio object. Deterministic; every wire ends on a catalog pin. */
export function deriveCircuit(document:DeviceDocument):CircuitPlan{
 const classified=document.parts.map(classifyPart);
 const roles:Record<string,ElectricalRole>={},parts:PartInstance[]=[],added:PartInstance[]=[],unresolved:CircuitPlan['unresolved']=[],connections:Connection[]=[];
 for(const c of classified){
  if(c.role==='unknown'||(c.role&&!c.libraryId)){unresolved.push({part:c.part,reason:c.reason});continue;}
  if(!c.role){parts.push(instanceFromStudio(c.part,'mechanical-part',0));continue;}
  roles[c.part.id]=c.role;parts.push(instanceFromStudio(c.part,c.libraryId!,c.role==='controller'?2:c.role==='power-usb'||c.role==='battery'||c.role==='supply'?1:3));
 }
 const byRole=(role:ElectricalRole)=>parts.filter(p=>roles[p.id]===role);
 const electrical=parts.filter(p=>roles[p.id]);
 if(!electrical.length)return {parts,connections,added,unresolved,roles,controllerId:null,sourceId:null};
 const controller=byRole('controller')[0]??null,driver=byRole('driver')[0]??null;
 const anchor=(controller??driver??electrical[0]).assembledPosition;
 let source=byRole('power-usb')[0]??byRole('supply')[0]??byRole('battery')[0]??null;
 if(!source){source=addedInstance('added-usb-power','usb-c-power','USB-C power input','Added for wiring: a 5 V USB-C power input, because the object lists no power source.',anchor,[-40,0,-30],1);added.push(source);roles[source.id]='power-usb';}
 const sourceLib=PART_MAP[source.libraryId],sourcePlus=sourceLib.pins.find(p=>p.type==='power')!,sourceGnd=sourceLib.pins.find(p=>p.type==='ground')!;
 const ids=new Set<string>();const wire=(id:string,from:Connection['from'],to:Connection['to'],kind:Connection['kind'],purpose:string,direction:Connection['signalDirection']='from-to',hint?:Connection['wireColor'])=>{let n=id,i=2;while(ids.has(n))n=`${id}-${i++}`;ids.add(n);connections.push({id:n,from,to,kind,wireColor:colourFor(kind,hint),purpose,signalDirection:direction});};
 const pool=controller?new PinPool(PART_MAP[controller.libraryId],controller.id):null;
 // Logic rail for 3.3 V peripherals: the controller's 3V3 pin, or an added regulator when the controller itself is a bare 3.3 V module.
 let rail33:Connection['from']|null=null,rail5:Connection['from']|null=null,gnd:Connection['from']={partId:source.id,pin:sourceGnd.name};
 if(controller){
  const lib=PART_MAP[controller.libraryId],cg=pool!.ground()!;
  if(lib.id==='esp32-c3-mini'){
   const reg=addedInstance('added-regulator','ldo-3v3','3.3 V regulator','Added for wiring: the bare ESP32-C3 module needs a regulated 3.3 V rail from the 5 V input.',controller.assembledPosition,[-25,0,0],2);added.push(reg);
   wire('source-regulator-vin',{partId:source.id,pin:sourcePlus.name},{partId:reg.id,pin:'VIN'},'power','5 V from the USB-C input into the regulator');
   wire('source-regulator-gnd',{partId:source.id,pin:sourceGnd.name},{partId:reg.id,pin:'GND'},'ground','Ground for the regulator');
   wire('regulator-controller-3v3',{partId:reg.id,pin:'VOUT'},{partId:controller.id,pin:'3V3'},'power','Regulated 3.3 V into the module');
   wire('regulator-controller-gnd',{partId:reg.id,pin:'GND'},{partId:controller.id,pin:cg},'ground','Shared ground for the module');
   rail33={partId:controller.id,pin:'3V3'};gnd={partId:controller.id,pin:cg};
  }else{
   const in5=pool!.rail(5)??lib.pins.find(p=>p.name==='VSYS')?.name??null;
   if(in5){wire('source-controller-5v',{partId:source.id,pin:sourcePlus.name},{partId:controller.id,pin:in5},'power',`${sourcePlus.voltage} V from the ${sourceLib.name} into the board's ${in5} input`);wire('source-controller-gnd',{partId:source.id,pin:sourceGnd.name},{partId:controller.id,pin:cg},'ground','Ground reference from the power input');rail5={partId:controller.id,pin:in5};}
   const out33=pool!.rail(3.3);if(out33)rail33={partId:controller.id,pin:out33};gnd={partId:controller.id,pin:cg};
  }
 }
 if(driver){
  const lib=PART_MAP[driver.libraryId];
  wire('source-driver-vin',{partId:source.id,pin:sourcePlus.name},{partId:driver.id,pin:'VIN'},'power',`Motor supply from the ${sourceLib.name} into the driver`);
  wire('source-driver-gnd',{partId:source.id,pin:sourceGnd.name},{partId:driver.id,pin:'GND'},'ground','Ground for the driver');
  if(!controller){gnd={partId:driver.id,pin:'GND'};rail33={partId:driver.id,pin:'VREF'};}
  else{const pwm=pool!.take(['pwm','digital'],true);if(pwm){wire('controller-driver-pwm',{partId:controller.id,pin:pwm},{partId:driver.id,pin:'PWM'},'signal',`PWM duty from ${pwm} sets the motor speed`,'from-to','orange');wire('controller-driver-gnd',{partId:controller.id,pin:pool!.ground()!},{partId:driver.id,pin:'GND'},'ground','Logic ground shared with the driver');}}
  void lib;
 }
 const needsRail=(lib:LibraryPart)=>lib.voltage.min<=3.3&&lib.voltage.max>=3.3?rail33??rail5:rail5??rail33;
 for(const p of electrical){
  const role=roles[p.id],lib=PART_MAP[p.libraryId];if(role==='controller'||role==='driver'||role==='power-usb'||role==='battery'||role==='supply')continue;
  const vcc=lib.pins.find(x=>x.type==='power')?.name,g=lib.pins.find(x=>x.type==='ground')?.name,label=slug(p.id);
  if(role==='motor'){
   if(driver){wire(`driver-${label}-plus`,{partId:driver.id,pin:'M+'},{partId:p.id,pin:'PLUS'},'power','Switched motor positive from the driver');wire(`driver-${label}-minus`,{partId:driver.id,pin:'M-'},{partId:p.id,pin:'MINUS'},'ground','Motor return to the driver');}
   else unresolved.push({part:document.parts.find(d=>d.id===p.id)!,reason:'A motor needs a driver or speed controller; none is in the object'});
   continue;
  }
  if(role==='servo'){wire(`source-${label}-vcc`,{partId:source.id,pin:sourcePlus.name},{partId:p.id,pin:'VCC'},'power','Servo power straight from the 5 V input, not a GPIO');wire(`source-${label}-gnd`,{partId:source.id,pin:sourceGnd.name},{partId:p.id,pin:'GND'},'ground','Servo ground');if(pool){const s=pool.take(['pwm'],true);if(s)wire(`controller-${label}-signal`,{partId:controller!.id,pin:s},{partId:p.id,pin:'SIGNAL'},'signal','Servo pulse from a PWM-capable pin','from-to','orange');}continue;}
  const rail=needsRail(lib);
  if(role==='knob'){const r=rail33??rail;if(r){wire(`rail-${label}-vcc`,r,{partId:p.id,pin:'VCC'},'power','Reference voltage for the knob');wire(`gnd-${label}`,gnd,{partId:p.id,pin:'GND'},'ground','Knob ground');}
   if(pool){const a=pool.take(['analog']);if(a)wire(`${label}-wiper`,{partId:p.id,pin:'WIPER'},{partId:controller!.id,pin:a},'signal',`Knob position read on analog ${a}`,'from-to','green');}
   else if(driver)wire(`${label}-wiper`,{partId:p.id,pin:'WIPER'},{partId:driver.id,pin:'POT'},'signal','Knob position sets the PWM duty directly','from-to','green');
   continue;}
  if(role==='button'){if(pool){const d=pool.take(['digital','pwm']);if(d)wire(`${label}-signal`,{partId:p.id,pin:'A'},{partId:controller!.id,pin:d},'signal',`Button read on ${d} with INPUT_PULLUP`,'from-to','blue');}wire(`gnd-${label}`,gnd,{partId:p.id,pin:'B'},'ground','Button pulls the input low');continue;}
  if(role==='led'){
   if(lib.id==='piezo-buzzer'){if(pool){const d=pool.take(['pwm','digital'],true);if(d)wire(`controller-${label}`,{partId:controller!.id,pin:d},{partId:p.id,pin:'PLUS'},'signal','tone() output','from-to','yellow');}wire(`gnd-${label}`,gnd,{partId:p.id,pin:'MINUS'},'ground','Buzzer ground');continue;}
   const res=addedInstance(`added-resistor-${label}`,'resistor-220','220 Ω resistor',`Added for wiring: current limiting for ${p.label}.`,p.assembledPosition,[8,0,0],3);added.push(res);
   if(pool){const d=pool.take(['digital','pwm'],true);if(d)wire(`controller-${label}-drive`,{partId:controller!.id,pin:d},{partId:res.id,pin:'A'},'signal',`Drives ${p.label} through its resistor`,'from-to','orange');}
   wire(`${label}-anode`,{partId:res.id,pin:'B'},{partId:p.id,pin:'ANODE'},'signal','Limited current into the LED anode','from-to','red');wire(`gnd-${label}`,gnd,{partId:p.id,pin:'CATHODE'},'ground','LED cathode to ground');continue;
  }
  // Sensors and displays
  if(vcc&&rail)wire(`rail-${label}-vcc`,rail,{partId:p.id,pin:vcc},'power',`${lib.name} supply`);
  if(g)wire(`gnd-${label}`,gnd,{partId:p.id,pin:g},'ground',`${lib.name} ground`);
  if(!pool){unresolved.push({part:document.parts.find(d=>d.id===p.id)!,reason:'Needs a controller to read it'});continue;}
  if(role==='sensor-i2c'||role==='display'){const sda=pool.bus('i2c-sda'),scl=pool.bus('i2c-scl');if(sda&&scl){wire(`${label}-sda`,{partId:controller!.id,pin:sda},{partId:p.id,pin:'SDA'},'data',`I²C data to ${lib.name}`,'both','blue');wire(`${label}-scl`,{partId:controller!.id,pin:scl},{partId:p.id,pin:'SCL'},'data',`I²C clock to ${lib.name}`,'from-to','yellow');}continue;}
  if(role==='sensor-analog'){const a=pool.take(['analog']);const out=lib.pins.find(x=>x.type==='analog'&&x.name!=='A'&&x.name!=='B')?.name;if(a&&out)wire(`${label}-aout`,{partId:p.id,pin:out},{partId:controller!.id,pin:a},'signal',`Analog reading on ${a}`,'from-to','green');continue;}
  if(role==='sensor-digital'){
   if(lib.id==='dht22'){const d=pool.take(['digital','pwm']);if(d){wire(`${label}-data`,{partId:controller!.id,pin:d},{partId:p.id,pin:'DATA'},'signal','Single-wire DHT readings','both','green');const pull=addedInstance(`added-pullup-${label}`,'resistor-10k','10 kΩ pull-up','Added for wiring: holds the DHT data line high.',p.assembledPosition,[-8,0,0],3);added.push(pull);if(rail)wire(`rail-${label}-pullup`,rail,{partId:pull.id,pin:'A'},'power','Pull-up supply');wire(`${label}-pullup`,{partId:pull.id,pin:'B'},{partId:p.id,pin:'DATA'},'signal','10 kΩ pull-up on DATA','both','white');}continue;}
   for(const x of lib.pins.filter(x=>x.type==='digital'&&x.name!=='NC')){const d=pool.take(['digital','pwm']);if(!d)break;const out=/OUT|ECHO/.test(x.name);wire(`${label}-${slug(x.name)}`,out?{partId:p.id,pin:x.name}:{partId:controller!.id,pin:d},out?{partId:controller!.id,pin:d}:{partId:p.id,pin:x.name},'signal',`${x.name} on ${d}`,'from-to',out?'green':'blue');}
  }
 }
 return {parts:[...parts,...added],connections,added,unresolved,roles,controllerId:controller?.id??null,sourceId:source.id};
}
const camera=(i:number):BuildStep['camera']=>({position:[130,100,140],target:[0,20,0+i*0]});
/** One ordered guide: mechanical assembly, board and parts, ground, power, signals, check, power on, upload and test. */
export function buildGuide(document:DeviceDocument,plan:CircuitPlan):BuildStep[]{
 const steps:BuildStep[]=[];const ids=new Set(plan.parts.map(p=>p.id));const placed=new Set<string>();
 const push=(title:string,instructions:string,partIds:string[],connectionIds:string[]=[],check?:string,tip?:string)=>{const fresh=partIds.filter(id=>ids.has(id)&&!placed.has(id));fresh.forEach(id=>placed.add(id));steps.push({index:steps.length+1,title:title.slice(0,200),instructions:instructions.slice(0,6000),partIds:[...new Set(fresh)],connectionIds,...(tip?{tip}:{}),...(check?{check}:{}),camera:camera(steps.length)});};
 const electricalIds=new Set(Object.keys(plan.roles));
 const mechanical=document.steps.map(s=>({...s,partIds:s.partIds.filter(id=>ids.has(id)&&!electricalIds.has(id))})).filter(s=>s.partIds.length);
 // The schema allows 12 steps. Count the electrical steps first; mechanical assembly gets the rest, grouped if needed.
 const srcIds=new Set(plan.parts.filter(p=>PART_MAP[p.libraryId]?.category==='power').map(p=>p.id));
 const nonSource=plan.connections.filter(c=>![c.from.partId,c.to.partId].some(id=>srcIds.has(id)));
 const electricalSteps=2+(nonSource.some(c=>c.kind==='ground')?1:0)+(nonSource.some(c=>c.kind==='power')?1:0)+(nonSource.some(c=>c.kind==='data')?1:0)+(nonSource.some(c=>c.kind==='signal'&&['orange','red'].includes(c.wireColor))?1:0)+(nonSource.some(c=>c.kind==='signal'&&!['orange','red'].includes(c.wireColor))?1:0)+3;
 const leftover=plan.parts.filter(p=>!electricalIds.has(p.id)&&!mechanical.some(s=>s.partIds.includes(p.id))&&!p.id.startsWith('added-')).map(p=>p.id);
 if(leftover.length)mechanical.push({title:'Fit the remaining mechanical parts',description:'Fit the parts the object lists outside its assembly steps.',partIds:leftover});
 const budget=Math.max(1,Math.min(4,12-electricalSteps));
 const grouped=mechanical.length<=budget?mechanical:Array.from({length:budget},(_,i)=>{const slice=mechanical.slice(Math.floor(i*mechanical.length/budget),Math.floor((i+1)*mechanical.length/budget));return {title:slice.map(s=>s.title).join(' · ').slice(0,200),description:slice.map(s=>s.description).join(' '),partIds:slice.flatMap(s=>s.partIds)};});
 for(const s of grouped)push(s.title,s.description,s.partIds,[],'Nothing is powered yet. Check each part seats fully before moving on.');
 const controller=plan.controllerId,source=plan.sourceId,regulator=plan.added.find(p=>p.libraryId==='ldo-3v3')?.id;
 const boardIds=[controller,source,regulator].filter((x):x is string=>!!x);
 push(controller?'Place the controller and the power input':'Place the power input',controller?'Seat the controller with its pin labels readable and the power input where its cable can reach. Keep power disconnected.':'Seat the power input where its cable can reach. Keep it disconnected.',boardIds,[],'Power input is unplugged.','Pin names in the 3D view come from the catalog; use the printed labels on the real board.');
 const peripherals=plan.parts.filter(p=>electricalIds.has(p.id)&&!boardIds.includes(p.id)).map(p=>p.id),passives=plan.added.filter(p=>!boardIds.includes(p.id)).map(p=>p.id);
 if(peripherals.length||passives.length)push('Place the electrical parts',`Place ${peripherals.length} electrical part${peripherals.length===1?'':'s'}${passives.length?` and ${passives.length} added wiring part${passives.length===1?'':'s'} (resistors, drivers or regulators marked "added")`:''}. Leave room to route wires to each pin.`,[...peripherals,...passives],[],'Every electrical part is seated with its pins reachable.');
 const powerPart=(id:string)=>{const p=plan.parts.find(x=>x.id===id);return !!p&&PART_MAP[p.libraryId]?.category==='power';};const isSource=(c:Connection)=>[c.from.partId,c.to.partId].some(powerPart);
 const grounds=plan.connections.filter(c=>c.kind==='ground'&&!isSource(c)),powers=plan.connections.filter(c=>c.kind==='power'&&!isSource(c)),signals=plan.connections.filter(c=>(c.kind==='signal'||c.kind==='data')&&!isSource(c)),sources=plan.connections.filter(isSource);
 if(grounds.length)push('Connect ground','Connect every black ground wire first so all parts share one reference. Power stays unplugged.',[],grounds.map(c=>c.id),'Unplug power before connecting this.');
 if(powers.length)push('Connect the power rails','Connect the red supply wires between the board rails and each part. These carry nothing until the power input is connected in a later step.',[],powers.map(c=>c.id),'No wire runs from a 5 V rail into a 3.3 V-only pin.');
 const data=signals.filter(c=>c.kind==='data'),drive=signals.filter(c=>c.kind==='signal'&&['orange','red'].includes(c.wireColor)),inputs=signals.filter(c=>!data.includes(c)&&!drive.includes(c));
 if(data.length)push('Connect the data bus','Connect SDA (blue) and SCL (yellow). Parts share one I²C bus because they answer at different addresses.',[],data.map(c=>c.id),'SDA goes to SDA and SCL to SCL on every part.');
 if(drive.length)push('Connect the drive signals','Connect the PWM and LED drive wires from the controller.',[],drive.map(c=>c.id),'Each drive wire leaves a PWM-capable or digital output pin.');
 if(inputs.length)push('Connect the input signals','Connect the knob, button and sensor signal wires into the controller inputs.',[],inputs.map(c=>c.id),'Each input wire ends on the pin named in the firmware.');
 push('Check the wiring before power','Trace every wire against the list: no supply pin touches a ground pin, no pin has two signals, and every wire ends on a real pin.',[],[],'Nothing is plugged in. Every wire matches the guide.');
 push('Connect power',sources.length?'Only now connect the power input and any regulator. The wires in this step carry the supply into the board and driver.':'Connect the power input.',[],sources.map(c=>c.id),'Connect power last, with nothing else touching the wires.');
 push(controller?'Upload the firmware and test':'Upload nothing and test',controller?'Open the firmware, select the board and port, upload, then open Serial Monitor at 115200 baud and exercise each input.':'This object has no programmable controller: there is no firmware to upload. Power it and test each input and motor by hand.',[],[],controller?'Serial Monitor shows readings that change when you move the controls.':'Each control changes the output as expected.');
 return steps;
}
/** Firmware for the actual controller and the pins the derivation chose. */
export function firmwareFor(document:DeviceDocument,plan:CircuitPlan):Project['code']{
 const name=document.name.replace(/\s*\/\s*01$/,'');const file=`${slug(name).replace(/-/g,'_').slice(0,40)||'morf'}.ino`;
 if(!plan.controllerId)return {language:'arduino',filename:file,source:`// ${name}\n// This object has no programmable controller, so there is nothing to upload.\n// Add an ESP32 from the Parts library in Studio and Morf will write firmware for its pins.\nvoid setup() { Serial.begin(115200); Serial.println("No controller in this object."); }\nvoid loop() { delay(1000); }\n`,libraries:[]};
 const mcu=plan.parts.find(p=>p.id===plan.controllerId)!,lib=PART_MAP[mcu.libraryId],esp=/esp32/.test(lib.id);
 const pinOf=(partId:string,pin:string)=>{const c=plan.connections.find(x=>(x.from.partId===partId&&x.from.pin===pin&&x.to.partId===mcu.id)||(x.to.partId===partId&&x.to.pin===pin&&x.from.partId===mcu.id));const e=c?(c.from.partId===mcu.id?c.from:c.to):null;return e?e.pin.replace(/^GPIO|^GP/,'')||e.pin:null;};
 const num=(pin:string|null)=>pin===null?null:/^A\d/.test(pin)?pin:pin.replace(/^D/,'');
 const lines:string[]=[`// ${name} — generated by Morf for ${lib.name}`,'// Pins below match the wiring guide. Verify them on the board silkscreen before uploading.',''];
 const consts:string[]=[],setup:string[]=['  Serial.begin(115200);'],loop:string[]=[],libs:string[]=[];
 const driver=plan.parts.find(p=>plan.roles[p.id]==='driver'),pwm=driver?num(pinOf(driver.id,'PWM')):null;
 if(driver&&pwm!==null){consts.push(`const int MOTOR_PWM = ${pwm};`);if(esp){lines.push('#include <driver/ledc.h>');setup.push('  ledcAttach(MOTOR_PWM, 25000, 8); // 25 kHz, 8-bit duty');}else setup.push('  pinMode(MOTOR_PWM, OUTPUT);');}
 const knob=plan.parts.find(p=>plan.roles[p.id]==='knob'),knobPin=knob?num(pinOf(knob.id,'WIPER')):null;
 if(knob&&knobPin!==null)consts.push(`const int SPEED_KNOB = ${knobPin};`);
 const buttons=plan.parts.filter(p=>plan.roles[p.id]==='button').map((p,i)=>({p,i,pin:num(pinOf(p.id,'A'))})).filter(b=>b.pin!==null);
 buttons.forEach(b=>{consts.push(`const int BUTTON_${b.i+1} = ${b.pin};`);setup.push(`  pinMode(BUTTON_${b.i+1}, INPUT_PULLUP);`);});
 const leds=plan.parts.filter(p=>plan.roles[p.id]==='led'&&p.libraryId==='led-red').map((p,i)=>{const res=plan.added.find(a=>a.id===`added-resistor-${slug(p.id)}`);return {p,i,pin:res?num(pinOf(res.id,'A')):null};}).filter(l=>l.pin!==null);
 leds.forEach(l=>{consts.push(`const int LED_${l.i+1} = ${l.pin};`);setup.push(`  pinMode(LED_${l.i+1}, OUTPUT);`);});
 const servos=plan.parts.filter(p=>plan.roles[p.id]==='servo').map((p,i)=>({p,i,pin:num(pinOf(p.id,'SIGNAL'))})).filter(s=>s.pin!==null);
 if(servos.length){lines.push(esp?'#include <ESP32Servo.h>':'#include <Servo.h>');libs.push(esp?'ESP32Servo':'');servos.forEach(s=>{consts.push(`const int SERVO_${s.i+1} = ${s.pin};`,`Servo servo${s.i+1};`);setup.push(`  servo${s.i+1}.attach(SERVO_${s.i+1});`);});}
 const i2c=plan.parts.filter(p=>['sensor-i2c','display'].includes(plan.roles[p.id]));
 if(i2c.length){lines.push('#include <Wire.h>');const sda=lib.pins.find(p=>p.type==='i2c-sda')?.name.replace(/^GPIO|^GP/,''),scl=lib.pins.find(p=>p.type==='i2c-scl')?.name.replace(/^GPIO|^GP/,'');setup.push(esp&&sda&&scl?`  Wire.begin(${sda}, ${scl});`:'  Wire.begin();');loop.push('  // I2C scan: lists every responding address so you can confirm each sensor/display.','  for (uint8_t a = 1; a < 127; a++) { Wire.beginTransmission(a); if (Wire.endTransmission() == 0) { Serial.print("I2C device at 0x"); Serial.println(a, HEX); } }');}
 const analogs=plan.parts.filter(p=>plan.roles[p.id]==='sensor-analog').map((p,i)=>{const lib2=PART_MAP[p.libraryId];const out=lib2.pins.find(x=>x.type==='analog'&&x.name!=='A'&&x.name!=='B')?.name;return {p,i,pin:out?num(pinOf(p.id,out)):null};}).filter(a=>a.pin!==null);
 analogs.forEach(a=>consts.push(`const int SENSOR_${a.i+1} = ${a.pin};`));
 const dht=plan.parts.find(p=>p.libraryId==='dht22'),dhtPin=dht?num(pinOf(dht.id,'DATA')):null;
 if(dht&&dhtPin!==null){lines.push('#include <DHT.h>');libs.push('DHT sensor library by Adafruit','Adafruit Unified Sensor');consts.push(`DHT climate(${dhtPin}, DHT22);`);setup.push('  climate.begin();');loop.push('  float t = climate.readTemperature(), h = climate.readHumidity();','  if (!isnan(t)) { Serial.print("Temperature C: "); Serial.print(t, 1); Serial.print("  Humidity %: "); Serial.println(h, 0); }');}
 if(knob&&knobPin!==null){loop.push('  int knob = analogRead(SPEED_KNOB);',`  int duty = map(knob, 0, ${esp?4095:1023}, 0, 255);`,'  Serial.print("Knob: "); Serial.print(knob); Serial.print("  Duty: "); Serial.println(duty);');if(driver&&pwm!==null)loop.push(esp?'  ledcWrite(MOTOR_PWM, duty);':'  analogWrite(MOTOR_PWM, duty);');}
 else if(driver&&pwm!==null)loop.push('  // No knob wired: ramp the motor slowly so you can hear the PWM take effect.','  static int duty = 0; duty = (duty + 5) % 256;',esp?'  ledcWrite(MOTOR_PWM, duty);':'  analogWrite(MOTOR_PWM, duty);','  Serial.print("Motor duty: "); Serial.println(duty);');
 buttons.forEach(b=>loop.push(`  Serial.print("Button ${b.i+1}: "); Serial.println(digitalRead(BUTTON_${b.i+1}) == LOW ? "pressed" : "released");`));
 leds.forEach(l=>loop.push(`  digitalWrite(LED_${l.i+1}, (millis() / 500) % 2);`));
 servos.forEach(s=>loop.push(`  servo${s.i+1}.write((millis() / 20) % 180);`));
 analogs.forEach(a=>loop.push(`  Serial.print("Sensor ${a.i+1}: "); Serial.println(analogRead(SENSOR_${a.i+1}));`));
 if(!loop.some(l=>/Serial\.print/.test(l)))loop.push('  Serial.println("Running. No inputs are wired yet.");');
 loop.push('  delay(250);');
 const source=[...lines,...consts,'',`void setup() {`,...setup,'}','','void loop() {',...loop,'}',''].join('\n');
 return {language:'arduino',filename:file,source,libraries:libs.filter(Boolean)};
}
const SUPPLY_MA:Record<string,number>={'usb-c-power':1500,'usb-cable':500,'supply-5v':1000,'battery-9v':500,'lipo-37v':1000,'tp4056':1000};
/** Only what is actually checked. Anything else is reported as unchecked, never as passed. */
export function circuitChecks(project:Pick<Project,'parts'|'connections'>):CircuitCheck[]{
 const parts=new Map(project.parts.map(p=>[p.id,p]));const pinOf=(e:Connection['from'])=>{const p=parts.get(e.partId);const lib=p&&PART_MAP[p.libraryId];return lib?.pins.find(x=>x.name===e.pin)??null;};
 const checks:CircuitCheck[]=[];const add=(id:string,title:string,status:CircuitCheck['status'],detail:string)=>checks.push({id,title,status,detail});
 if(!project.connections.length){['pins-exist','no-shorts','voltage','pin-reuse','supply-current'].forEach(id=>add(id,{ 'pins-exist':'Every pin used exists','no-shorts':'No power-to-ground short','voltage':'Voltages match','pin-reuse':'No pin used twice','supply-current':'Supply covers estimated current'}[id]!,'unchecked','No wires to check.'));return checks;}
 const missing=project.connections.flatMap(c=>[c.from,c.to].filter(e=>!pinOf(e)).map(e=>`${e.partId}.${e.pin}`));
 add('pins-exist','Every pin used exists',missing.length?'fail':'pass',missing.length?`Unknown pins: ${[...new Set(missing)].join(', ')}`:`${project.connections.length*2} endpoints resolved against the catalog.`);
 // Nets by union-find over endpoints.
 const parent=new Map<string,string>();const key=(e:Connection['from'])=>`${e.partId}:${e.pin}`;const find=(k:string):string=>{const p=parent.get(k)??k;if(p===k)return k;const r=find(p);parent.set(k,r);return r;};const union=(a:string,b:string)=>{parent.set(find(a),find(b));};
 for(const c of project.connections)union(key(c.from),key(c.to));
 const nets=new Map<string,Connection['from'][]>();for(const c of project.connections)for(const e of [c.from,c.to]){const r=find(key(e));nets.set(r,[...(nets.get(r)??[]),e]);}
 const shorts:string[]=[],mismatches:string[]=[];
 for(const members of nets.values()){
  const pins=members.map(e=>({e,pin:pinOf(e)})).filter(x=>x.pin);const powers=pins.filter(x=>x.pin!.type==='power'&&x.pin!.voltage!==undefined&&x.pin!.voltage>0),grounds=pins.filter(x=>x.pin!.type==='ground');
  if(powers.length&&grounds.length)shorts.push(`${powers[0].e.partId}.${powers[0].e.pin} ↔ ${grounds[0].e.partId}.${grounds[0].e.pin}`);
  const driving=powers.filter(x=>{const p=parts.get(x.e.partId);const lib=p&&PART_MAP[p.libraryId];return !!lib&&(lib.category==='power'||/^(3V3|5V|VOUT|VREF|VSYS|M\+|NO|COM)$/.test(x.e.pin));});const volts=[...new Set(driving.map(x=>x.pin!.voltage!))];if(volts.length>1)mismatches.push(`${volts.join(' V / ')} V sources joined at ${driving[0].e.partId}.${driving[0].e.pin}`);
 }
 add('no-shorts','No power-to-ground short',shorts.length?'fail':'pass',shorts.length?`Supply and ground share a net: ${shorts.join('; ')}`:`${nets.size} nets, none joining a supply pin to a ground pin.`);
 for(const c of project.connections){if(c.kind!=='signal'&&c.kind!=='data')continue;const a=pinOf(c.from),b=pinOf(c.to);if(!a||!b)continue;const pairs=c.signalDirection==='both'?[[a,b,c.to],[b,a,c.from]]:c.signalDirection==='to-from'?[[b,a,c.from]]:[[a,b,c.to]];for(const [s,t,target] of pairs as [typeof a,typeof b,Connection['from']][]){const tp=parts.get(target.partId);const passive=tp&&PART_MAP[tp.libraryId]?.category==='passive';if(!passive&&s.voltage!==undefined&&t.voltage!==undefined&&s.voltage>t.voltage+.3)mismatches.push(`${s.voltage} V signal into ${target.partId}.${target.pin} (${t.voltage} V logic)`);}}
 for(const c of project.connections){if(c.kind!=='power')continue;const s=pinOf(c.from),t=parts.get(c.to.partId);const lib=t&&PART_MAP[t.libraryId];if(s?.voltage!==undefined&&lib&&lib.category!=='passive'&&(s.voltage<lib.voltage.min-.15||s.voltage>lib.voltage.max+.15))mismatches.push(`${s.voltage} V into ${t!.id} (${lib.voltage.min}–${lib.voltage.max} V)`);}
 add('voltage','Voltages match (3.3 V vs 5 V)',mismatches.length?'fail':'pass',mismatches.length?[...new Set(mismatches)].join('; '):'Every supply and signal voltage is within the receiving part\'s rating.');
 const useCount=new Map<string,number>();for(const c of project.connections)for(const e of [c.from,c.to]){const p=pinOf(e);if(!p||['power','ground','i2c-sda','i2c-scl'].includes(p.type))continue;const part=parts.get(e.partId);if(!part||PART_MAP[part.libraryId]?.category==='passive')continue;const k=key(e);useCount.set(k,(useCount.get(k)??0)+1);}
 const reused=[...useCount].filter(([,n])=>n>1).map(([k])=>k);
 add('pin-reuse','No signal pin used twice',reused.length?'fail':'pass',reused.length?`Shared: ${reused.join(', ')}`:'Each signal pin carries one wire; I²C bus pins are allowed to be shared.');
 const sources=project.parts.filter(p=>SUPPLY_MA[p.libraryId]);const draw=project.parts.filter(p=>!SUPPLY_MA[p.libraryId]).reduce((n,p)=>n+(PART_MAP[p.libraryId]?.currentMa??0)*p.quantity,0);const capacity=sources.reduce((n,p)=>n+SUPPLY_MA[p.libraryId],0);
 add('supply-current','Supply covers estimated current',!sources.length?'unchecked':capacity>=draw?'pass':'fail',!sources.length?'No power source in the circuit.':`Catalog estimate ${Math.round(draw)} mA against ${capacity} mA available. Motors and radios draw more at startup; this is not a measurement.`);
 return checks;
}
/** Apply user edits saved on the document: full wire override, added parts and firmware. Wires that reference missing pins are dropped. */
export function applyOverlay(plan:CircuitPlan,overlay?:CircuitOverlay):CircuitPlan{
 if(!overlay)return plan;
 const parts=[...plan.parts];for(const p of overlay.addedParts??[])if(!parts.some(x=>x.id===p.id)&&PART_MAP[p.libraryId])parts.push(p);
 const partMap=new Map(parts.map(p=>[p.id,p]));const valid=(e:Connection['from'])=>{const p=partMap.get(e.partId);return !!p&&!!PART_MAP[p.libraryId].pins.some(x=>x.name===e.pin);};
 let connections=plan.connections;
 if(overlay.connections){const kept=overlay.connections.filter(c=>valid(c.from)&&valid(c.to));const key=(e:Connection['from'])=>`${e.partId}:${e.pin}`;const taken=new Set(kept.flatMap(c=>[key(c.from),key(c.to)]));const signalPin=(e:Connection['from'])=>{const p=partMap.get(e.partId);const pin=p&&PART_MAP[p.libraryId].pins.find(x=>x.name===e.pin);return !!pin&&!['power','ground','i2c-sda','i2c-scl'].includes(pin.type);};const fresh=plan.connections.filter(c=>![c.from,c.to].some(e=>taken.has(key(e))&&signalPin(e)));const ids=new Set(kept.map(c=>c.id));connections=[...kept,...fresh.filter(c=>!ids.has(c.id))];}
 return {...plan,parts,connections,added:[...plan.added,...(overlay.addedParts??[])]};
}
/** The complete Circuits project for a Studio document, or null when the object has no electronics. */
export function projectFromDocument(document:DeviceDocument,overlay:CircuitOverlay|undefined=document.circuit):{project:Project;plan:CircuitPlan}|null{
 const plan=applyOverlay(deriveCircuit(document),overlay);
 if(!Object.keys(plan.roles).length&&!plan.unresolved.length)return null;
 const steps=buildGuide(document,plan);
 const code=overlay?.code?{language:"arduino" as const,...overlay.code}:firmwareFor(document,plan);
 const minutes=Math.max(5,Math.min(1440,15+plan.parts.length*4+plan.connections.length*2));
 const project:Project={id:document.id,name:document.name,prompt:document.designBrief||document.description.slice(0,4000)||document.name,description:document.description.slice(0,5000)||document.name,howItWorks:(plan.connections.length?`Power enters through ${plan.parts.find(p=>p.id===plan.sourceId)?.label??'the power input'}. ${plan.controllerId?`The controller reads the inputs and drives the outputs over the wires listed.`:'There is no programmable controller; the speed controller board drives the motor directly.'} `:'This object has electrical parts but no complete circuit yet. ')+'Checks cover pin, voltage and connection rules only. Real wiring, loads and firmware still need testing.',difficulty:Math.min(5,Math.max(1,Math.ceil(plan.connections.length/6)+1)) as Project['difficulty'],buildTimeMinutes:minutes,skillLevel:'beginner',parts:plan.parts,connections:plan.connections,buildSteps:steps,code};
 return {project,plan};
}
