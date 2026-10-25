import type { DeviceAssembly, DeviceDocument, DevicePart, DeviceRelationship, Solid, Vec3 } from './types';
import { validateDeviceDocument } from './validation';

/** Original concept geometry. Key pitch, switch travel and internal placement are
 * illustrative, not a particular manufacturer's CAD or a validated PCB design. */
const PITCH = 19.05;
const C = { case: '#41494d', edge: '#2b3439', ivory: '#e4e0d4', darkCap: '#717e80', teal: '#418479', pcb: '#3b786e', trace: '#80a490', chip: '#263136', silver: '#aeb8b8', bright: '#d0d7d4', gold: '#baa06a', copper: '#af8762', spring: '#b8bfba', rubber: '#31383a', glass: '#78948f' };
const box = (position: Vec3, size: Vec3, color?: string, rotation?: Vec3, metalness = .16): Solid => ({ kind: 'box', position, size, ...(color ? { color } : {}), ...(rotation ? { rotation } : {}), metalness, roughness: .56 });
const cyl = (position: Vec3, diameter: number, height: number, color?: string, rotation?: Vec3): Solid => ({ kind: 'cylinder', position, size: [diameter, height, diameter], ...(color ? { color } : {}), ...(rotation ? { rotation } : {}), metalness: .48, roughness: .44 });
const torus = (position: Vec3, radius: number, tube: number, color?: string): Solid => ({ kind: 'torus', position, size: [radius, tube, radius], rotation: [90, 0, 0], ...(color ? { color } : {}), metalness: .5, roughness: .42 });
function link(from: Vec3, to: Vec3, diameter: number, color: string): Solid {
  const v = to.map((n, i) => n - from[i]), length = Math.hypot(...v);
  return cyl(from.map((n, i) => (n + to[i]) / 2) as Vec3, diameter, Math.max(.01, length + .03), color, [Math.atan2(v[2], v[1]) * 180 / Math.PI, 0, -Math.asin(v[0] / Math.max(.001, length)) * 180 / Math.PI]);
}
const fastening = (x: number, y: number, z: number): Solid[] => [cyl([x, y - 1.3, z], 1.6, 3.5, C.silver), cyl([x, y + .9, z], 3.2, .9, C.silver), box([x, y + 1.39, z], [1.9, .1, .36], C.edge)];
function makePart(id: string, name: string, category: string, position: Vec3, size: Vec3, explode: Vec3, color: string, solids: Solid[], role: string, assemblyId: string, specs: Record<string, string> = {}, connections: DevicePart['connections'] = [], description = role): DevicePart {
  return { id, name, category, description, role, position, rotation: [0, 0, 0], size, explode, color, solids, specs, connections, assemblyId };
}

interface Key { id: string; legend: string; units: number; row: number; x: number; z: number; name: string }
const layout: [string, string, number?][][] = [
  [['esc','Esc'],['1','1'],['2','2'],['3','3'],['4','4'],['5','5'],['6','6'],['7','7'],['8','8'],['9','9'],['0','0'],['minus','−'],['equal','='],['backspace','Backspace',2],['delete','Del']],
  [['tab','Tab',1.5],['q','Q'],['w','W'],['e','E'],['r','R'],['t','T'],['y','Y'],['u','U'],['i','I'],['o','O'],['p','P'],['bracket-left','['],['bracket-right',']'],['backslash','\\',1.5],['page-up','PgUp']],
  [['caps-lock','Caps',1.75],['a','A'],['s','S'],['d','D'],['f','F'],['g','G'],['h','H'],['j','J'],['k','K'],['l','L'],['semicolon',';'],['quote',"'"],['enter','Enter',2.25],['page-down','PgDn']],
  [['shift-left','Shift',2.25],['z','Z'],['x','X'],['c','C'],['v','V'],['b','B'],['n','N'],['m','M'],['comma',','],['period','.'],['slash','/'],['shift-right','Shift',1.75],['arrow-up','↑'],['end','End']],
  [['ctrl-left','Ctrl',1.25],['meta','Win',1.25],['alt-left','Alt',1.25],['space','',6.25],['fn','Fn'],['alt-right','Alt'],['ctrl-right','Ctrl'],['arrow-left','←'],['arrow-down','↓'],['arrow-right','→']],
];
const keys: Key[] = layout.flatMap((row, rowIndex) => {
  let offset = -8 * PITCH;
  return row.map(([id, legend, units = 1]) => {
    const key = { id: `key-${id}`, legend, units, row: rowIndex, x: offset + units * PITCH / 2, z: (rowIndex - 2) * PITCH, name: id === 'space' ? 'Space bar' : `${legend} keycap` };
    offset += units * PITCH;
    return key;
  });
});
export const KEYBOARD_KEY_IDS = keys.map(key => key.id);
const esc = keys[0];
function keycap(key: Key): DevicePart {
  const w = key.units * PITCH - 1.15, d = PITCH - 1.15;
  const special = key.id === 'key-esc' || key.id === 'key-enter';
  const solids: Solid[] = [
    box([0, 3, 0], [w - 2.8, 1.8, d - 2.8]),
    box([-w / 2 + .7, 0, 0], [1.3, 5.4, d - 1.4], undefined, [0, 0, -7]),
    box([w / 2 - .7, 0, 0], [1.3, 5.4, d - 1.4], undefined, [0, 0, 7]),
    box([0, 0, -d / 2 + .7], [w - 1.4, 5.4, 1.3], undefined, [7, 0, 0]),
    box([0, 0, d / 2 - .7], [w - 1.4, 5.4, 1.3], undefined, [-7, 0, 0]),
    box([0, -3, 0], [4.4, 2, 1.4], C.ivory), box([0, -3, 0], [1.4, 2, 4.4], C.ivory),
  ];
  if (key.id === 'key-f' || key.id === 'key-j') solids.push(box([0, 3.99, 4.9], [4.3, .3, .65], C.ivory));
  return makePart(key.id, key.name, 'Keycaps', [key.x, 36, key.z], [w, 8, d], key.id === 'key-esc' ? [-35, 145, -30] : [0, 80 + key.row * 1.4, 0], special ? C.teal : key.units > 1 || key.id.startsWith('key-arrow') ? '#c9d0c8' : C.ivory, solids,
    key.id === 'key-esc' ? 'The Esc keycap carries finger motion into the selected switch stem. It is part of the animated press / release example.' : `Removable ${key.legend || 'space'} keycap. Its stem socket couples the key to a mechanical switch.`,
    'assembly-keycaps', { Legend: key.legend || 'SPACE', 'Layout position': `Row ${key.row + 1}`, 'Width': `${key.units}u · illustrative`, 'Mount': 'Cross-stem-style concept', ...(key.id === 'key-esc' ? { Mechanism: 'Press / hold / release' } : {}) },
    [{ partId: key.id === 'key-esc' ? 'switch-stem' : 'keyboard-switch-array', label: 'Mechanical keycap / stem coupling' }]);
}

const base: Solid[] = [box([0, 0, 0], [313, 2.5, 120]), box([0, 0, 0], [325, 2.5, 108])];
for (const x of [-156.5, 156.5]) for (const z of [-54, 54]) base.push(cyl([x, 0, z], 12, 2.5));
for (const x of [-145, 145]) for (const z of [-45, 45]) base.push(cyl([x, 5.6, z], 5.6, 8.4, C.silver), cyl([x, 10.1, z], 2.5, .6, C.edge));
for (let i = 0; i < 9; i++) base.push(box([-40 + i * 10, 1.31, 54], [5.4, .1, .55], C.darkCap));
const frame: Solid[] = [box([0, 14, 58.3], [315, 27, 3.5]), box([-160.7, 14, 0], [3.5, 27, 109]), box([160.7, 14, 0], [3.5, 27, 109])];
frame.push(box([-27, 14, -58.3], [266, 27, 3.5]), box([144, 14, -58.3], [33, 27, 3.5]), box([116, 4.7, -58.3], [20, 7.4, 3.5]), box([116, 24.5, -58.3], [20, 6, 3.5]));
for (const x of [-157, 157]) for (const z of [-54, 54]) frame.push(cyl([x, 14, z], 7, 27));
for (const z of [-55.9, 55.9]) frame.push(box([0, 27.65, z], [312, .7, 1], C.silver));
const feet: Solid[] = [];
for (const x of [-135, 135]) for (const z of [-44, 44]) feet.push(box([x, 0, z], [22, 3.4, 10]), box([x, -1.8, z], [19, .7, 8], C.rubber));
const fasteners: Solid[] = [];
for (const x of [-145, 145]) for (const z of [-45, 45]) fasteners.push(...fastening(x, 11.4, z));
for (const x of [-156, 156]) for (const z of [-51, 51]) fasteners.push(...fastening(x, 26, z));

const plate: Solid[] = [];
for (const z of [-48.7, 48.7]) plate.push(box([0, 0, z], [309, 1.5, 3]));
for (const x of [-153, 153]) plate.push(box([x, 0, 0], [3, 1.5, 96]));
for (let row = 0; row < 5; row++) {
  const rowKeys = keys.filter(key => key.row === row), z = (row - 2) * PITCH;
  for (const sign of [-1, 1]) plate.push(box([0, 0, z + sign * (7 + 1.265)], [302, 1.5, 2.53]));
  let start = -151;
  for (const key of rowKeys) {
    const end = key.x - 7;
    if (end > start) plate.push(box([(start + end) / 2, 0, z], [end - start, 1.5, 14]));
    start = key.x + 7;
  }
  if (start < 151) plate.push(box([(start + 151) / 2, 0, z], [151 - start, 1.5, 14]));
}
const pcb: Solid[] = [box([0, 0, 0], [306, 1.6, 101]), box([0, -.86, 0], [303, .1, 98], C.pcb)];
for (const key of keys) {
  for (const x of [-3.6, 3.6]) pcb.push(cyl([key.x + x, .88, key.z], 2.4, .12, C.gold), cyl([key.x + x, 1, key.z], .9, .12, C.edge));
  pcb.push(box([key.x + 4.2, 1.3, key.z + 5.3], [2.3, .8, 1], C.chip));
  for (const x of [2.8, 5.6]) pcb.push(box([key.x + x, 1.3, key.z + 5.3], [.6, .85, 1.1], C.silver));
  pcb.push(box([key.x, -.95, key.z + 2], [7.2, .08, .28], C.trace));
}
for (let row = 0; row < 5; row++) pcb.push(box([0, -.96, (row - 2) * PITCH + 2], [298, .1, .24], C.trace));
for (let i = 0; i < 16; i++) pcb.push(box([-142.8 + i * PITCH, -.96, 0], [.24, .1, 92], C.trace));
for (const x of [-145, 145]) for (const z of [-45, 45]) pcb.push(cyl([x, .9, z], 5, .12, C.gold), cyl([x, 1.02, z], 2.7, .12, C.edge));
const switches: Solid[] = [];
for (const key of keys.filter(key => key.id !== 'key-esc')) {
  switches.push(box([key.x, 0, key.z], [13.6, 7, 13.6]), box([key.x, 4.4, key.z], [4.1, 2.1, 1.3], C.teal), box([key.x, 4.4, key.z], [1.3, 2.1, 4.1], C.teal));
}
const stabilizers: Solid[] = [];
for (const key of keys.filter(key => key.units >= 1.75)) {
  const reach = key.units > 5 ? 45 : Math.max(10, (key.units * PITCH - 16) / 2);
  for (const x of [key.x - reach, key.x + reach]) stabilizers.push(box([x, 0, key.z], [5.5, 7, 6.5]), cyl([x, 3.8, key.z], 2.8, 1.3, C.ivory));
  stabilizers.push(link([key.x - reach, -1, key.z], [key.x + reach, -1, key.z], .95, C.silver));
  for (const x of [key.x - reach, key.x + reach]) stabilizers.push(link([x, -1, key.z], [x, -1, key.z + 3], .95, C.silver));
}
const controller: Solid[] = [box([0, 0, 0], [26, 1.5, 17]), box([0, 1.8, 0], [9, 2, 9], C.chip), box([-8, 1.3, -4], [4, 1, 2], C.silver)];
for (let i = 0; i < 10; i++) for (const x of [-5.3, 5.3]) controller.push(box([x, 1.1, -4.1 + i * .9], [1.4, .5, .4], C.silver));
for (let i = 0; i < 5; i++) controller.push(box([8, 1.3, -5 + i * 2.3], [1.6, .8, .8], i % 2 ? C.gold : C.silver));
const usb: Solid[] = [box([0, 0, 0], [14, 1.2, 8], C.pcb), box([0, 2.1, -.5], [9, 3.2, 8]), box([0, 2.1, -4.6], [7.2, 1.8, .3], C.edge), box([0, 2.1, -4.8], [5.3, .65, .2], C.glass)];
for (let i = 0; i < 6; i++) usb.push(box([-2.4 + i * .95, 2.5, -4.95], [.4, .18, .15], C.gold));
for (const x of [-5.8, 5.8]) usb.push(box([x, 1, 1], [1.7, 1.4, 4], C.silver));
const wire: Solid[] = [box([0, 0, 0], [10, 5, 17]), box([0, 0, 10], [8, 3, 7], C.silver)];
for (let i = 0; i < 14; i++) {
  const a = i / 14, b = (i + 1) / 14;
  wire.push(link([a * a * 30, 0, -8 - a * 40], [b * b * 30, 0, -8 - b * 40], 3, C.rubber));
}
const lowerHousing: Solid[] = [];
for (const x of [-5, 5]) lowerHousing.push(box([x, -2.1, 0], [3.5, 1.2, 13.8]));
for (const z of [-5, 5]) lowerHousing.push(box([0, -2.1, z], [6.5, 1.2, 3.5]));
for (const x of [-6.35, 6.35]) lowerHousing.push(box([x, .5, 0], [1.1, 5.5, 13.8]));
for (const z of [-6.35, 6.35]) lowerHousing.push(box([0, .5, z], [11.6, 5.5, 1.1]));
lowerHousing.push(cyl([0, -2.6, 0], 2.3, 1.2, C.darkCap));
const upperHousing: Solid[] = [];
for (const x of [-5.5, 5.5]) upperHousing.push(box([x, 0, 0], [2.7, 5.3, 13.8]));
for (const z of [-5.5, 5.5]) upperHousing.push(box([0, 0, z], [8.2, 5.3, 2.7]));
for (const x of [-6.7, 6.7]) upperHousing.push(box([x, -.8, 0], [1, 2.1, 5], C.silver));
const stem: Solid[] = [box([0, -1, 0], [5.1, 7.2, 4.6]), box([0, 3.1, 0], [4.1, 2.2, 1.3]), box([0, 3.1, 0], [1.3, 2.2, 4.1]), cyl([0, -5.2, 0], 1.65, 3), box([3.15, -2, 0], [1.4, 4.2, 2], undefined, [0, 0, -15])];
const spring: Solid[] = [];
const coilSteps = 80;
for (let i = 0; i < coilSteps; i++) {
  const a = i / coilSteps, b = (i + 1) / coilSteps;
  spring.push(link([Math.cos(a * Math.PI * 16) * 2.15, -4 + a * 8, Math.sin(a * Math.PI * 16) * 2.15], [Math.cos(b * Math.PI * 16) * 2.15, -4 + b * 8, Math.sin(b * Math.PI * 16) * 2.15], .4, C.spring));
}
spring.push(torus([0, -4, 0], 2.15, .2), torus([0, 4, 0], 2.15, .2));
const fixedContact: Solid[] = [box([0, 0, 0], [.4, 8.7, 2.4]), box([-.45, 1.2, 0], [.55, 1.2, 1.6], C.bright), box([0, -9.3, 0], [.55, 9.9, 1.1]), box([-.7, -3.7, 0], [1.8, .5, 2.4])];
const movingContactAtBody: Solid[] = [box([0, 0, 0], [.32, 8.5, 2.2], undefined, [0, 0, 4]), box([.36, 1.15, 0], [.4, 1.1, 1.5], C.bright), box([-.25, -9.2, 0], [.55, 9.8, 1.1]), box([-.9, -3.6, 0], [2.1, .5, 2.2])];

// Pivot near the PCB terminal, so actuation moves the upper leaf while the
// soldered end stays nearly fixed. A small rotation closes a visible rest gap.
const movingContact = movingContactAtBody.map(solid => ({ ...solid, position: [solid.position[0], solid.position[1] + 13.7, solid.position[2]] as Vec3 }));

const parts: DevicePart[] = [
  makePart('keyboard-case-base','Lower enclosure','Enclosure',[0,0,0],[325,14,120],[0,-8,0],C.case,base,'Supports the mounting posts and protects the bottom of the circuit board. The shell is a polymer enclosure study, not a machined production drawing.','assembly-enclosure',{'Material study':'Graphite polymer shell','Concept envelope':'325 × 120 mm','Lower cavity':'Reserved for a conceptual wireless upgrade'},[{partId:'keyboard-pcb',label:'PCB mounting posts'}]),
  makePart('keyboard-case-frame','Upper enclosure frame','Enclosure',[0,0,0],[325,29,120],[0,10,0],C.case,frame,'A slim upper bezel surrounds the 68-key field and leaves a rear opening for the USB receptacle.','assembly-enclosure',{'Type':'65% concept enclosure'},[{partId:'keyboard-plate',label:'Plate perimeter support'}]),
  makePart('keyboard-feet','Isolation feet · set of 4','Enclosure',[0,-3,0],[292,5,99],[-4,-20,4],C.rubber,feet,'Rubber pads keep the case off the desk and reduce vibration transfer.','assembly-enclosure',{'Count':'4'},[{partId:'keyboard-case-base',label:'Underside attachment'}]),
  makePart('keyboard-fasteners','Case & PCB fasteners','Fasteners',[0,0,0],[316,30,108],[10,18,-8],C.silver,fasteners,'Grouped screws secure the board and upper case. Use hardware supplied with an actual supported keyboard kit.','assembly-enclosure',{},[{partId:'keyboard-case-base',label:'Case fastening'},{partId:'keyboard-pcb',label:'Board fastening'}]),
  makePart('keyboard-dampener','Lower acoustic pad','Enclosure',[0,3,0],[308,1.2,104],[0,6,0],'#8a928b',[box([0,0,0],[308,1.2,104])],'Thin compliant pad reduces case resonance in the concept. Clearance around components must be checked on real hardware.','assembly-enclosure',{'Type':'Illustrative insulating acoustic pad'},[{partId:'keyboard-case-base',label:'Lies on the inner floor'}]),
  makePart('keyboard-pcb','Key matrix PCB','Electronics',[0,12,0],[306,4,101],[0,20,0],C.pcb,pcb,'A teal PCB carries a conceptual row / column key matrix, per-key diodes and plated switch contacts. Copper traces illustrate topology and are not a fabrication-ready netlist.','assembly-electronics',{'Layout':'68 keys · 5 physical rows','Pitch study':'19.05 mm','Matrix':'Conceptual scan rows / columns','Electrical status':'No netlist or firmware verification'},[{partId:'keyboard-controller',label:'Matrix scan connections'},{partId:'keyboard-switch-array',label:'Switch contact pads'}]),
  makePart('keyboard-plate','Switch mounting plate','Mounting',[0,20,0],[309,1.5,100],[0,38,0],C.silver,plate,'An open metal plate contains individual switch apertures. It supports switch bodies while the keycaps remain independently removable.','assembly-switches',{'Material':'Aluminum plate study','Openings':'68 illustrative rectangular switch apertures'},[{partId:'keyboard-case-frame',label:'Perimeter mounting'},{partId:'keyboard-switch-array',label:'Housing clips into plate'}]),
  makePart('keyboard-switch-array','Remaining switches · 67 housings','Switch array',[0,25.1,0],[303,10,94],[0,54,0],C.edge,switches,'Sixty-seven non-selected switch bodies and cross stems form the rest of the keyboard. The Esc switch is separated into its actual educational subparts.','assembly-switches',{'Count':'67 grouped switch bodies','Selected example':'Esc switch is dissected separately'},[{partId:'keyboard-plate',label:'Mounting apertures'},{partId:'keyboard-pcb',label:'Electrical contact pads'}]),
  makePart('keyboard-stabilizers','Long-key stabilizers','Mounting',[0,25,0],[291,9,87],[0,59,0],C.edge,stabilizers,'Paired guide housings and bent stabilizer wires keep long keycaps level when pressed off center.','assembly-switches',{'Purpose':'Limits long-key tilt','Coverage':'Backspace, Enter, Shift and Space-sized keys'},[{partId:'key-space',label:'Space-bar stabilization'},{partId:'key-enter',label:'Enter-key stabilization'},{partId:'keyboard-plate',label:'Stabilizer mounting'}]),
  makePart('keyboard-controller','Matrix scan & USB controller','Electronics',[112,15,-32],[27,5,18],[28,40,-20],C.pcb,controller,'A conceptual 3.3 V controller scans switch states and exposes the wired keyboard interface. The USB stack, matrix pin assignments and firmware are not supplied or verified.','assembly-electronics',{'Logic study':'3.3 V','Wired mode':'USB HID concept','Firmware':'Platform-specific implementation required'},[{partId:'keyboard-pcb',label:'Rows and columns'},{partId:'keyboard-usb',label:'USB data and regulated power'}]),
  makePart('keyboard-usb','USB-C receptacle module','I/O',[116,14,-57],[15,5,11],[38,35,-28],C.silver,usb,'A separate USB-shaped receptacle and small carrier connect the conceptual keyboard to a host. Contact geometry is illustrative and does not define a wiring pinout.','assembly-electronics',{'Mode':'Wired USB data + power','Connector study':'USB-C-shaped receptacle'},[{partId:'keyboard-controller',label:'USB HID data path'},{partId:'keyboard-wired-cable',label:'External USB cable'}]),
  makePart('keyboard-wired-cable','USB data & power cable','Cables',[116,16,-77],[42,7,68],[50,15,-45],C.edge,wire,'A removable cable supplies power and carries wired keyboard data to the host. The drawn cable is an electrical bundle, not a single bare conductor.','assembly-electronics',{'Mode':'Wired USB bundle'},[{partId:'keyboard-usb',label:'Mating cable plug'}]),
  makePart('switch-lower-housing','Switch lower housing','Switch housing',[esc.x,23,esc.z],[14,7,14],[-35,45,-30],'#887b62',lowerHousing,'The lower housing locates the spring, guides the stem and retains the electrical contact leaves. Its center passage lets the stem move through its travel.','assembly-switch-esc',{'Model':'Illustrative linear mechanical switch','Role':'Spring seat and contact support'},[{partId:'keyboard-plate',label:'Plate retention'},{partId:'switch-spring',label:'Lower spring seat'},{partId:'switch-contact-fixed',label:'Fixed contact support'},{partId:'switch-contact-moving',label:'Moving contact support'}]),
  makePart('switch-upper-housing','Switch upper housing','Switch housing',[esc.x,28,esc.z],[14,6,14],[-35,75,-30],'#a3b6b0',upperHousing,'The upper housing guides the stem and retains the assembled switch. The animated cutaway makes it translucent to expose the mechanism.','assembly-switch-esc',{'View':'Cutaway during mechanism playback'},[{partId:'switch-stem',label:'Vertical guide'},{partId:'switch-lower-housing',label:'Housing latch clips'}]),
  makePart('switch-stem','Cross stem & contact cam','Switch mechanism',[esc.x,30.2,esc.z],[8,13,7],[-35,105,-30],C.teal,stem,'The cap drives this guided stem downward. A side cam changes the moving leaf contact while the spring supplies the return force.','assembly-switch-esc',{'Illustrative travel':'4 mm','Geometry':'Cross mount, guide and contact cam'},[{partId:'key-esc',label:'Keycap coupling'},{partId:'switch-spring',label:'Spring compression'},{partId:'switch-contact-moving',label:'Cam changes contact state'}]),
  makePart('switch-spring','Return coil spring','Switch mechanism',[esc.x,26,esc.z],[4.8,8.4,4.8],[-35,65,-30],C.spring,spring,'An eight-turn helix compresses as the key moves down and expands on release. The animation anchors the lower spring seat while reducing coil height.','assembly-switch-esc',{'Spring study':'8 turns · 8.4 mm resting envelope','Travel model':'Approximately half-height at full press','Rating':'No force constant is claimed'},[{partId:'switch-stem',label:'Upper spring seat'},{partId:'switch-lower-housing',label:'Fixed lower spring seat'}]),
  makePart('switch-contact-fixed','Fixed electrical contact','Switch contacts',[esc.x+5.75,27,esc.z],[2.2,20,2.5],[-50,50,-30],C.copper,fixedContact,'A fixed conductive leaf and its terminal provide one side of the switch connection. The small light contact face is the electrical mating surface.','assembly-switch-esc',{'State at rest':'Separated from moving contact','Electrical role':'One matrix switch terminal'},[{partId:'switch-contact-moving',label:'Makes / breaks the switch circuit'},{partId:'keyboard-pcb',label:'PCB terminal pad'}]),
  makePart('switch-contact-moving','Moving electrical contact','Switch contacts',[esc.x+4.15,13.3,esc.z],[3,20,2.5],[-20,50,-30],C.copper,movingContact,'A compliant leaf moves toward the fixed contact as the stem cam travels. Release restores the open state. This is a conceptual mechanism, not a measured contact-force simulation.','assembly-switch-esc',{'State at rest':'Open circuit','At press':'Contact closes for the matrix scan'},[{partId:'switch-contact-fixed',label:'Electrical closure'},{partId:'switch-stem',label:'Actuation cam'},{partId:'keyboard-pcb',label:'PCB terminal pad'}]),
  ...keys.map(keycap),
];
const group = (id: string, name: string, parentId?: string): DeviceAssembly => ({ id, name, ...(parentId ? { parentId } : {}), partIds: parts.filter(part => part.assemblyId === id).map(part => part.id) });
const relationships: DeviceRelationship[] = [
  ...parts.filter(part => part.id !== 'keyboard-case-base').map(part => ({ id: `contain-${part.id}`, from: 'keyboard-case-base', to: part.id, type: 'contains' as const, description: 'Part of the complete conceptual keyboard assembly.' })),
  {id:'usb-controller-data',from:'keyboard-usb',to:'keyboard-controller',type:'data',description:'Wired keyboard data path to the controller.'},
  {id:'controller-matrix',from:'keyboard-controller',to:'keyboard-pcb',type:'data',description:'Controller scans the conceptual key matrix.'},
  {id:'spring-stem',from:'switch-spring',to:'switch-stem',type:'mechanical',description:'Spring returns the stem to its resting position.'},
  {id:'stem-keycap',from:'switch-stem',to:'key-esc',type:'mechanical',description:'Cross-stem coupling transfers finger displacement.'},
  {id:'stem-moving-leaf',from:'switch-stem',to:'switch-contact-moving',type:'mechanical',description:'Stem cam changes the moving leaf position.'},
  {id:'switch-electrical-closure',from:'switch-contact-moving',to:'switch-contact-fixed',type:'electrical',description:'Leaf contact makes or breaks the matrix switch connection.'},
];
export const mechanicalKeyboard: DeviceDocument = {
  version:1,id:'mechanical-keyboard-65',name:'Type / 01',source:'curated',
  description:'A 68-key mechanical keyboard with every keycap independently editable. Explore the plate, matrix PCB, controller and enclosure, then play the Esc switch to see its stem, spring and electrical contacts work together.',
  provenance:'Original conceptual 65% keyboard study. All geometry is independently selectable procedural solids, with illustrative dimensions and a simplified linear-switch mechanism. This is not manufacturer CAD, a production PCB, measured contact dynamics, a firmware implementation, or a verified build. The wireless conversion is a conceptual architecture update requiring compatible commercial components and engineering validation.',
  parts,
  capabilities:['wired-keyboard','switch-mechanism','editable-keycaps'],
  assemblies:[group('assembly-keyboard','Complete keyboard'),group('assembly-enclosure','Enclosure & mounting','assembly-keyboard'),group('assembly-electronics','Matrix & wired electronics','assembly-keyboard'),group('assembly-switches','Switch mounting & array','assembly-keyboard'),group('assembly-keycaps','68 individual keycaps','assembly-keyboard'),group('assembly-switch-esc','Esc switch internals','assembly-switches')],
  relationships,
  mechanisms:[{id:'keyboard-switch-press',name:'Press & release a mechanical switch',description:'The Esc cap drives a guided stem down, compressing a return spring and closing the two electrical leaves. Holding maintains closure; release expands the spring and opens the circuit. Travel and contact geometry are illustrative, with no force or debounce timing claim.',duration:4.8,
    tracks:[{partId:'key-esc',translation:[0,-4,0]},{partId:'switch-stem',translation:[0,-4,0]},{partId:'switch-spring',translation:[0,-2.1,0],scale:[1,.5,1]},{partId:'switch-contact-moving',rotation:[0,0,-1.5]}],
    stages:[
      {at:0,title:'Rest · contact open',description:'The spring supports the stem and keycap. The moving and fixed leaves are separated.',partIds:['key-esc','switch-stem','switch-spring','switch-contact-fixed','switch-contact-moving','switch-upper-housing','switch-lower-housing']},
      {at:.2,title:'Finger force compresses the spring',description:'The cap and stem travel down together while the lower coil seat stays fixed. The stem cam approaches the contact transition.',partIds:['key-esc','switch-stem','switch-spring']},
      {at:.34,title:'Press · electrical contact closes',description:'The moving leaf meets the fixed contact. A controller can detect the closed matrix connection; this visual is not a debounce simulation.',partIds:['switch-stem','switch-contact-moving','switch-contact-fixed']},
      {at:.48,title:'Hold · circuit remains closed',description:'The stem remains down and the spring stores return energy. The two contact leaves remain closed.',partIds:['switch-stem','switch-spring','switch-contact-moving','switch-contact-fixed']},
      {at:.6,title:'Release · spring returns the stem',description:'As finger force is removed, the spring expands and lifts the stem and cap. The moving contact returns toward its open position.',partIds:['key-esc','switch-stem','switch-spring','switch-contact-moving']},
      {at:.96,title:'Reset · ready for another press',description:'The contacts separate and the key returns to rest. No electrical or physical hardware is connected to this animation.',partIds:['key-esc','switch-contact-fixed','switch-contact-moving']},
    ]}],
  steps:[
    {title:'Inspect the open enclosure',description:'Disconnect power. Inspect the base, mounting posts, insulating pad and enclosure clearance. This study is not a compatible kit or a drilling template.',partIds:['keyboard-case-base','keyboard-case-frame','keyboard-feet','keyboard-dampener','keyboard-fasteners']},
    {title:'Understand the matrix electronics',description:'The PCB routes switches through a conceptual row / column matrix. The per-key diodes illustrate isolation between scan paths. Real nets, controller pin assignments and firmware must be designed and verified.',partIds:['keyboard-pcb','keyboard-controller','keyboard-usb','keyboard-wired-cable']},
    {title:'Fit the mounting plate and stabilizers',description:'The plate locates each switch. Long keys use paired stabilizer guides and a connecting wire so an off-center press does not tilt the keycap excessively.',partIds:['keyboard-plate','keyboard-stabilizers','keyboard-switch-array']},
    {title:'Explore the selected switch',description:'Inspect the Esc switch housing, guided stem, return coil and two electrical leaves. Play its press / hold / release mechanism to see how motion changes contact state. Do not disassemble a live keyboard.',partIds:['switch-lower-housing','switch-upper-housing','switch-stem','switch-spring','switch-contact-fixed','switch-contact-moving']},
    {title:'Fit the individual keycaps',description:'Each cap is an independently selectable part. Match its intended row and width, align the stem socket, and press evenly. The wide Space and Enter caps must also align with their stabilizers.',partIds:KEYBOARD_KEY_IDS},
    {title:'Review the wired interface',description:'The conceptual USB interface supplies power and carries keyboard reports. A functional build additionally needs a validated PCB, compatible components, USB firmware and testing; this animation does not generate or flash that firmware.',partIds:['keyboard-controller','keyboard-usb','keyboard-wired-cable','keyboard-case-frame']},
  ],
};

const WIRELESS_IDS = ['wireless-battery','wireless-controller','wireless-power-board','wireless-harness'] as const;
function wirelessParts(): DevicePart[] {
  const radio: Solid[] = [box([0,0,0],[38,1.4,19]),box([-5,1.8,0],[15,2.1,13],C.silver),box([11,1,0],[10,.5,17],C.edge)];
  for(let i=0;i<6;i++)radio.push(box([8+i*1.25,1.31,i%2?5:-5],[.6,.12,10],C.gold));
  for(let i=0;i<8;i++)radio.push(box([-17+i*3.8,.9,8],[1.4,.35,1.8],C.gold));
  const battery: Solid[] = [box([0,0,0],[65,5,31]),box([0,2.6,0],[59,.14,26],C.silver),box([0,2.75,0],[37,.12,17],C.ivory),box([0,0,-16.2],[9,3,2.5],C.rubber)];
  const charging: Solid[] = [box([0,0,0],[28,1.3,23]),box([0,1.5,0],[7,1.6,7],C.chip),cyl([8,2,3],5,2.7,C.silver),box([-8,1.6,1],[6,2.2,5],C.darkCap)];
  for(let i=0;i<6;i++)charging.push(box([-10+i*4,1.2,-8],[1.4,.8,1],i%2?C.silver:C.gold));
  for(const x of [-12,12])charging.push(box([x,1.4,3],[3,2,7],C.ivory));
  const harness: Solid[] = [];
  const routes: [Vec3,Vec3,string][] = [ [[-85,5.6,12],[15,7,19],C.copper], [[-85,5.1,14],[15,6.2,21],C.edge], [[28,7,19],[65,7,-37],C.teal], [[28,6.5,21],[65,6.5,-35],C.edge], [[83,7,-37],[110,14,-35],C.copper], [[83,7,-35],[110,13.2,-33],C.edge], [[113,14,-51],[22,7,28],C.copper] ];
  for(const [from,to,color]of routes){const middle:Vec3=[(from[0]+to[0])/2,Math.min(from[1],to[1]),(from[2]+to[2])/2];harness.push(link(from,middle,.65,color),link(middle,to,.65,color));}
  for(const [x,y,z]of [[-85,5.4,13],[15,7,20],[65,7,-36],[110,13.5,-34]])harness.push(box([x,y,z],[3,2,4],C.ivory));
  return [
    makePart('wireless-battery','Protected battery pack','Wireless power',[-85,6,28],[65,6,34],[-55,22,28],'#9ca9a2',battery,'A factory-protected single-cell rechargeable pack powers the wireless concept. Its chemistry, charging current and connector must match a commercially supported charging / protection solution.','assembly-wireless',{'Battery study':'Protected single-cell pack','Placement':'Illustrative lower-cavity clearance','Verification':'No capacity, runtime or pack safety rating claimed'},[{partId:'wireless-power-board',label:'Matched protected battery power path'}]),
    makePart('wireless-controller','Bluetooth HID radio module','Wireless electronics',[65,7,-43],[39,5,20],[90,55,-30],C.pcb,radio,'A Bluetooth HID-capable controller module receives matrix key states and sends keyboard reports wirelessly. It needs compatible firmware and an explicitly engineered interface to the retained matrix scanner.','assembly-wireless',{'Link concept':'Bluetooth keyboard reports','Logic concept':'Matched 3.3 V interfaces','RF placement':'Antenna toward rear polymer edge','Firmware':'Not supplied or verified'},[{partId:'keyboard-controller',label:'Matrix key-state data'},{partId:'wireless-power-board',label:'Regulated logic supply'}]),
    makePart('wireless-power-board','Charge, protection & regulation board','Wireless power',[15,7,25],[29,5,24],[30,42,34],C.pcb,charging,'A conceptual commercial power module coordinates USB charging input, a matched protected pack and regulated logic power. Actual charge/load-sharing behavior and ratings must be verified for the chosen unit.','assembly-wireless',{'Input':'USB charge input','Output':'Regulated logic supply matched to electronics','Selection':'Matched pack chemistry, protection and load path required'},[{partId:'wireless-battery',label:'Protected pack connection'},{partId:'keyboard-usb',label:'USB charging input'},{partId:'wireless-controller',label:'Regulated radio power'},{partId:'keyboard-controller',label:'Regulated scanner power'}]),
    makePart('wireless-harness','Wireless power & data harness','Cables',[0,0,0],[210,17,100],[20,32,35],C.edge,harness,'Small insulated routes connect the protected pack, power module, radio and scanner. The drawn routes are conceptual bundles, not a connector pinout or a live-cell wiring guide.','assembly-wireless',{'Routing':'Below the PCB; verify clearance and connector mating','Electrical status':'Concept architecture only'},[{partId:'wireless-battery',label:'Pack harness'},{partId:'wireless-power-board',label:'Power distribution'},{partId:'wireless-controller',label:'Radio connection'},{partId:'keyboard-controller',label:'Scanner interface'}]),
  ];
}

/** Safe, repeatable architecture recipe. This does not claim to fabricate a
 * wireless keyboard or flash its controller. Existing geometry and manual edits
 * stay intact; only the affected interface descriptions and relationships change. */
export function convertKeyboardToWireless(document: DeviceDocument): DeviceDocument {
  const required = ['keyboard-pcb','keyboard-controller','keyboard-usb','keyboard-case-base'];
  if (!document.capabilities?.some(capability => capability === 'wired-keyboard' || capability === 'wireless-keyboard') || required.some(id => !document.parts.some(part => part.id === id)) || document.parts.some(part => part.assetNode)) throw new Error('Open the editable mechanical keyboard reference or an edited copy before applying the wireless concept conversion. Imported mesh geometry is preserved and is not converted by this recipe.');
  if (document.capabilities.includes('wireless-keyboard') && WIRELESS_IDS.every(id => document.parts.some(part => part.id === id))) return structuredClone(document);
  if (WIRELESS_IDS.some(id => document.parts.some(part => part.id === id))) throw new Error('This keyboard already contains a partial wireless conversion. Restore its complete conversion or undo it before trying again.');
  const next = structuredClone(document);
  next.parts = next.parts.map(part => {
    if(part.id === 'keyboard-controller') {
      const specs=Object.fromEntries(Object.entries(part.specs).filter(([key])=>key!=='Wired mode'));
      const role='Scans the existing key matrix and forwards key-state data to the added Bluetooth HID radio. Firmware and the scanner / radio interface require implementation and validation.';
      return {...part,name:part.name==='Matrix scan & USB controller'?'Matrix scan controller':part.name,description:role,role,specs:{...specs,'Interface mode':'Matrix scanner → wireless radio','USB data path':'Bypassed in this wireless concept'},connections:[...part.connections.filter(c=>c.partId!=='keyboard-usb'&&c.partId!=='keyboard-wired-cable'),{partId:'wireless-controller',label:'Key-state data to Bluetooth controller'},{partId:'wireless-power-board',label:'Matched regulated logic power'}]};
    }
    if(part.id === 'keyboard-usb') {
      const role='The retained physical receptacle is a charging input in this wireless concept. Keyboard reports travel through the radio; the original USB data path is bypassed.';
      return {...part,description:role,role,specs:{...part.specs,Mode:'Charging input; keyboard data is wireless','USB data':'Not used in this concept'},connections:[{partId:'wireless-power-board',label:'USB charge input'},...part.connections.filter(c=>c.partId!=='keyboard-controller'&&c.partId!=='wireless-power-board')]};
    }
    if(part.id === 'keyboard-wired-cable') {
      const role='Retained USB cable used for charging the protected battery through the matched power board. Wireless keyboard reports do not travel through this cable in this concept.';
      return {...part,name:part.name==='USB data & power cable'?'USB charging cable':part.name,description:role,role,specs:{...part.specs,Mode:'Charging cable; wireless keyboard data'}};
    }
    return part;
  });
  const additions = wirelessParts(); next.parts.push(...additions);
  const ids = new Set(next.parts.map(part=>part.id));
  next.relationships = (next.relationships ?? []).filter(r=>!(r.type==='data'&&(r.from==='keyboard-usb'||r.to==='keyboard-usb')));
  next.relationships.push(
    {id:'wireless-pack-power',from:'wireless-battery',to:'wireless-power-board',type:'electrical',description:'Protected battery path into a matched commercial power module.'},
    {id:'wireless-usb-charge',from:'keyboard-usb',to:'wireless-power-board',type:'electrical',description:'USB is used for charging rather than keyboard data.'},
    {id:'wireless-radio-power',from:'wireless-power-board',to:'wireless-controller',type:'electrical',description:'Regulated logic supply matched to the radio.'},
    {id:'wireless-scanner-power',from:'wireless-power-board',to:'keyboard-controller',type:'electrical',description:'Regulated logic supply matched to the matrix scanner.'},
    {id:'wireless-scanner-data',from:'keyboard-controller',to:'wireless-controller',type:'data',description:'Firmware-defined key-state link to the Bluetooth HID controller.'},
    ...additions.map(part=>({id:`contain-${part.id}`,from:'keyboard-case-base',to:part.id,type:'contains' as const,description:'Added inside the conceptual lower enclosure; physical fit requires validation.'})),
  );
  next.relationships=next.relationships.filter(r=>ids.has(r.from)&&ids.has(r.to));
  next.assemblies = next.assemblies ?? [];
  if(!next.assemblies.some(assembly=>assembly.id==='assembly-keyboard'))next.assemblies.push({id:'assembly-keyboard',name:'Complete keyboard',partIds:[]});
  const wirelessAssembly=next.assemblies.find(assembly=>assembly.id==='assembly-wireless');
  if(wirelessAssembly)wirelessAssembly.partIds=[...new Set([...wirelessAssembly.partIds,...additions.map(part=>part.id)])];
  else next.assemblies.push({id:'assembly-wireless',name:'Wireless radio & protected power',parentId:'assembly-keyboard',partIds:additions.map(part=>part.id)});
  next.capabilities = [...new Set([...(next.capabilities ?? []).filter(capability=>capability!=='wired-keyboard'),'wireless-keyboard','switch-mechanism','editable-keycaps'])];
  next.description = `${document.description.slice(0,7600)} Wireless concept: a protected battery, matched power module and Bluetooth HID controller are added; the retained USB receptacle is used for charging.`;
  next.provenance = `${document.provenance.slice(0,3500)} Deterministic wireless concept conversion: original keycaps, switch mechanism, plate, PCB and unrelated manual edits are retained. Added pack, power management, Bluetooth controller and harness are conceptual; RF performance, firmware, electrical compatibility, charge/load behavior and physical fit remain unverified.`;
  next.steps = [...document.steps.map(step=>step.title==='Review the wired interface'?{...step,title:'Review the retained USB charging interface',description:'The same physical USB connector is retained for charging. Keyboard reports now follow the conceptual scanner-to-radio path. Charging circuitry and firmware are not implemented by this visualization.'}:step),
    {title:'Inspect the wireless power architecture',description:'Use a commercially supported protected pack and matched charging / regulation module. Check chemistry, polarity, connector mating, charge current and power-path behavior against the actual manufacturer documentation. Do not assemble or charge loose cells from this drawing.',partIds:['wireless-battery','wireless-power-board','wireless-harness','keyboard-usb']},
    {title:'Review wireless firmware and clearance',description:'The existing scanner and added Bluetooth HID controller need a designed key-state protocol and compatible firmware. Verify radio antenna clearance, regulated logic voltage, grounding and all actual enclosure clearances. This is a concept conversion, not tested firmware or a validated hardware modification.',partIds:['wireless-controller','keyboard-controller','keyboard-pcb','keyboard-case-base']},
  ];
  try { return validateDeviceDocument(next); }
  catch(error) { throw new Error(`The wireless concept would exceed this document's supported limits or references: ${error instanceof Error?error.message:'Invalid conversion'}`); }
}
