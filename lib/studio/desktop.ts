import type { DeviceDocument, DevicePart, Solid, Vec3 } from './types';

// An original, editable compact-PC study. Coordinates are illustrative mm,
// y is up, and each primitive belongs to exactly one selectable assembly.
// Standard interfaces are named; the geometry is not a manufacturer CAD/BOM.
const C = {
  case: '#454b4d', edge: '#303638', black: '#252b2e', charcoal: '#394145',
  aluminum: '#b8c0c0', bright: '#d9dfe0', darkMetal: '#7c898b',
  pcb: '#376f68', pcbDark: '#24554f', trace: '#5a9384', chip: '#262d30',
  gold: '#b89b59', copper: '#a77c56', teal: '#70ada0', rubber: '#24292c',
};
const B = (p: Vec3, size: Vec3, color?: string, rotation?: Vec3, metalness = .25, roughness = .6): Solid => ({ kind: 'box', position: p, size, ...(color ? { color } : {}), ...(rotation ? { rotation } : {}), metalness, roughness });
const Y = (p: Vec3, diameter: number, height: number, color?: string, rotation?: Vec3, bottomDiameter = diameter): Solid => ({ kind: 'cylinder', position: p, size: [diameter, height, bottomDiameter], ...(color ? { color } : {}), ...(rotation ? { rotation } : {}), metalness: .5, roughness: .42 });
const T = (p: Vec3, radius: number, tube: number, color?: string, rotation: Vec3 = [90, 0, 0]): Solid => ({ kind: 'torus', position: p, size: [radius, tube, radius], ...(color ? { color } : {}), rotation, metalness: .4, roughness: .5 });
const part = (id: string, name: string, category: string, position: Vec3, size: Vec3, explode: Vec3, color: string, description: string, role: string, solids: Solid[], specs: Record<string, string> = {}, connections: DevicePart['connections'] = [], notes?: string): DevicePart => ({ id, name, category, description, role, position, rotation: [0, 0, 0], size, explode, color, solids, specs, connections, ...(notes ? { notes } : {}) });
const screwAt = (x: number, y: number, z: number, diameter = 3.2): Solid[] => [
  Y([x, y - 1, z], diameter * .55, 3.3, C.darkMetal), Y([x, y + .9, z], diameter, 1, C.aluminum),
  B([x, y + 1.42, z], [diameter * .65, .12, .4], C.edge),
];
function chipAt(x: number, z: number, width: number, depth: number, y = 2.5): Solid[] {
  const s: Solid[] = [B([x, y, z], [width, 1.7, depth], C.chip)];
  const count = Math.max(3, Math.min(8, Math.round(depth / 2)));
  for (let i = 0; i < count; i++) for (const side of [-1, 1]) s.push(B([x + side * (width / 2 + .55), y - .45, z - depth / 2 + .7 + i * (depth - 1.4) / (count - 1)], [1.4, .4, .5], C.aluminum));
  s.push(Y([x - width / 2 + 1, y + .88, z - depth / 2 + 1], .65, .05, C.darkMetal));
  return s;
}
function cable(points: Vec3[], color = C.black, thickness = 1.1): Solid[] {
  const out: Solid[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], v = b.map((n, j) => n - a[j]);
    const length = Math.hypot(...v);
    if (length < .001) continue;
    const rotation: Vec3 = [Math.atan2(v[2], v[1]) * 180 / Math.PI, 0, -Math.asin(v[0] / length) * 180 / Math.PI];
    out.push(Y(a.map((n, j) => (n + b[j]) / 2) as Vec3, thickness, length + .2, color, rotation));
  }
  return out;
}
function curve(from: Vec3, viaA: Vec3, viaB: Vec3, to: Vec3, steps = 12): Vec3[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps, u = 1 - t;
    return from.map((v, j) => u ** 3 * v + 3 * u * u * t * viaA[j] + 3 * u * t * t * viaB[j] + t ** 3 * to[j]) as Vec3;
  });
}
function fanSolids(radius: number, frame: boolean, blades = 9): Solid[] {
  const out: Solid[] = [];
  if (frame) {
    for (const x of [-1, 1]) for (const z of [-1, 1]) out.push(B([x * (radius - 2), 0, z * (radius - 2)], [5, 5.5, 5]));
    for (const x of [-1, 1]) out.push(B([x * radius, 0, 0], [2.6, 5.5, radius * 2]));
    for (const z of [-1, 1]) out.push(B([0, 0, z * radius], [radius * 2, 5.5, 2.6]));
  }
  out.push(T([0, .2, 0], radius - .6, .9, C.charcoal));
  for (let blade = 0; blade < blades; blade++) {
    const start = blade * Math.PI * 2 / blades;
    // Three pitched, tangentially swept sections give each blade a curved
    // silhouette while remaining editable standard solid primitives.
    for (let segment = 0; segment < 3; segment++) {
      const r = radius * (.3 + segment * .2), angle = start + segment * .22;
      out.push(B([Math.cos(angle) * r, .7 + segment * .18, Math.sin(angle) * r], [radius * .30, 1.05, radius * (.24 + segment * .025)], undefined, [8, -angle * 180 / Math.PI - 22, 3]));
    }
  }
  out.push(Y([0, .8, 0], radius * .53, 6.1), Y([0, 4, 0], radius * .41, .5, C.darkMetal), Y([0, 4.3, 0], radius * .16, .15, C.teal));
  for (const x of [-1, 1]) for (const z of [-1, 1]) if (frame) out.push(...screwAt(x * (radius - 2), 2, z * (radius - 2), 2.8));
  return out;
}

const tray: Solid[] = [B([0, 0, 0], [220, 2.4, 210]), B([0, -2.2, 0], [213, 2, 203], C.edge)];
for (const z of [-102, 102]) tray.push(B([0, 5, z], [220, 8, 2]));
for (const x of [-107, 107]) tray.push(B([x, 5, 0], [3, 8, 204]));
for (const x of [-102, 102]) for (const z of [-97, 97]) tray.push(B([x, 14, z], [4.5, 24, 4.5], C.darkMetal));
for (let i = 0; i < 10; i++) tray.push(B([-87 + i * 7, 1.3, 79], [4.5, .12, 1.1], C.darkMetal));

const front: Solid[] = [B([0, 0, 0], [220, 4.5, 2.2]), B([0, 38, 0], [220, 4.5, 2.2])];
for (const x of [-107, 107]) front.push(B([x, 19, 0], [6, 34, 2.2]));
for (let i = 0; i < 26; i++) front.push(B([-98 + i * 7.7, 18, 0], [1.35, 30, 1.8], C.darkMetal));
front.push(B([74, 31, 1.3], [42, 10, 1.3], C.edge));

const rear: Solid[] = [B([0, -38, 0], [220, 5, 2.2]), B([0, 44, 0], [220, 5, 2.2]), B([0, 22, 0], [220, 4, 2.2])];
for (const x of [-107, 107]) rear.push(B([x, 2, 0], [6, 80, 2.2]));
rear.push(B([33, -7, 0], [3, 56, 2.2]), B([58, -7, 0], [3, 56, 2.2]));
for (let i = 0; i < 13; i++) rear.push(B([-97 + i * 9.8, 33, 0], [2.5, 17, 1.8], C.charcoal));
for (let i = 0; i < 5; i++) rear.push(B([83, -27 + i * 9.2, 0], [39, 2.2, 1.8], C.charcoal));

function sidePanel(): Solid[] {
  const out: Solid[] = [B([0, -34, 0], [2, 5, 210]), B([0, 42, 0], [2, 5, 210])];
  for (const z of [-102, 102]) out.push(B([0, 4, z], [2, 71, 6]));
  for (let i = 0; i < 23; i++) out.push(B([0, 4, -91 + i * 8.2], [1.25, 69, 1.35], C.darkMetal));
  return out;
}
const topFrame: Solid[] = [];
for (const x of [-107, 107]) topFrame.push(B([x, 0, 0], [6, 2.4, 210]));
for (const z of [-102, 102]) topFrame.push(B([0, 0, z], [208, 2.4, 6]));
for (const x of [-104, 104]) for (const z of [-99, 99]) topFrame.push(...screwAt(x, 1, z));
// Open service rim is deliberate: no opaque roof hides the components.

const motherboard: Solid[] = [B([0, 0, 0], [152, 1.8, 148]), B([0, -.98, 0], [150, .16, 146], C.pcbDark)];
for (const x of [-69, 69]) for (const z of [-67, 67]) motherboard.push(Y([x, 1.02, z], 5, .16, C.gold), Y([x, 1.13, z], 2.6, .18, C.darkMetal));
for (let i = 0; i < 12; i++) {
  const x = -61 + i % 2 * 12, z = -54 + Math.floor(i / 2) * 9;
  motherboard.push(Y([x, 4, z], 5.4, 6.2, C.aluminum), Y([x, 7.2, z], 4.7, .3, C.darkMetal), B([x - 1, 7.4, z], [3, .1, .3], C.chip));
}
for (let i = 0; i < 7; i++) {
  motherboard.push(B([-58 + i * 9, 3.2, -58], [6, 4.2, 6], C.charcoal));
  motherboard.push(B([-58 + i * 9, 5.4, -58], [4.7, .2, 4.7], C.darkMetal));
}
for (const [x, z, width, depth] of [[-37, 43, 14, 12], [34, 35, 9, 9], [39, -59, 10, 8], [-59, 37, 7, 6], [7, -60, 8, 7]] as const) motherboard.push(...chipAt(x, z, width, depth));
for (const x of [32, 43]) {
  motherboard.push(B([x, 3.6, -10], [5.2, 5.2, 69], C.black));
  motherboard.push(B([x, 6.3, -10], [1.2, .3, 61], C.edge));
  for (const z of [-43, 23]) motherboard.push(B([x, 5, z], [7, 7, 3.5], C.darkMetal));
  for (let i = 0; i < 16; i++) motherboard.push(B([x - 1.6, 6.1, -39 + i * 3.7], [.6, .5, 1], C.gold));
}
motherboard.push(B([-15, 4, 65], [72, 6.2, 6], C.black), B([-15, 7.2, 65], [65, .2, 1.2], C.gold));
for (let i = 0; i < 24; i++) motherboard.push(B([-44 + i * 2.5, 7.35, 64], [1.1, .22, .8], C.gold));
motherboard.push(B([67, 5.3, -13], [8, 9, 36], C.black));
for (let row = 0; row < 2; row++) for (let i = 0; i < 12; i++) motherboard.push(B([65 + row * 3.3, 10, -28 + i * 2.65], [1.7, .8, 1.7], C.darkMetal));
for (let i = 0; i < 18; i++) {
  // Short routed copper traces join pads/IC areas; no arbitrary floating rules.
  const x = -30 + i * 3.4, z = 23 + i % 3 * 2.2;
  motherboard.push(B([x, 1.01, z], [.35, .08, 26 - i % 4 * 3], C.trace));
  motherboard.push(B([x + 3, 1.02, z - 12 + i % 4 * 1.5], [6, .08, .35], C.trace));
  motherboard.push(Y([x, 1.12, z + 13 - i % 4 * 1.5], 1.1, .1, C.gold));
}
for (let i = 0; i < 14; i++) motherboard.push(B([-41 + i * 6.4, 1.7, -66], [2.3, 1, 1.3], i % 2 ? C.darkMetal : C.copper));

const socket: Solid[] = [B([0, 0, 0], [43, 3, 43], C.black)];
for (const x of [-21, 21]) socket.push(B([x, 2.6, 0], [2.3, 2.3, 43], C.darkMetal));
for (const z of [-21, 21]) socket.push(B([0, 2.6, z], [40, 2.3, 2.3], C.aluminum));
for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) socket.push(Y([-14 + x * 4, 1.7, -14 + z * 4], .9, .3, C.gold));
socket.push(Y([24, 4, 0], 1.6, 44, C.aluminum, [90, 0, 0]), B([24, 4, -24], [1.5, 1.5, 8], C.aluminum));
const processor: Solid[] = [B([0, 0, 0], [36, 1.2, 36], C.pcbDark), B([0, 1.2, 0], [32, 1.2, 32]), B([0, 1.85, 0], [27, .25, 27], C.bright)];
for (const x of [-1, 1]) for (let i = 0; i < 10; i++) processor.push(B([x * 16.5, -.7, -14 + i * 3.1], [1.3, .2, 1.4], C.gold));
const coolerBase: Solid[] = [B([0, 0, 0], [43, 3.6, 43]), B([0, -2.2, 0], [33, 1.2, 33], C.copper), B([0, 2.1, 0], [57, 1.2, 6], C.darkMetal)];
for (const x of [-25, 25]) coolerBase.push(...screwAt(x, 2.8, 0));
for (let i = 0; i < 4; i++) coolerBase.push(Y([-12 + i * 8, 4, 0], 4.2, 46, C.copper, [90, 0, 0]));
const fins: Solid[] = [];
for (let i = 0; i < 25; i++) fins.push(B([-26.4 + i * 2.2, 0, 0], [.75, 23, 53]));
for (const z of [-25, 25]) fins.push(B([0, -11.2, z], [56, 1.2, 2.2], C.darkMetal));

function memoryModule(): Solid[] {
  const out: Solid[] = [B([0, 0, 0], [1.25, 23, 61])];
  for (const side of [-1, 1]) for (let i = 0; i < 8; i++) out.push(B([side * 1.45, 2, -25.5 + i * 7.3], [1.6, 10.5, 5.7], C.chip));
  for (const side of [-1, 1]) for (let i = 0; i < 20; i++) out.push(B([side * .72, -10.3, -27 + i * 2.85], [.18, 3, 1.4], C.gold));
  out.push(B([0, 12.1, 0], [4, 2.1, 63], C.charcoal));
  for (const z of [-30.8, 30.8]) out.push(B([0, 1, z], [3.2, 22, 1.2], C.darkMetal));
  return out;
}
const ssd: Solid[] = [B([0, 0, 0], [22, 1.1, 42])];
for (const z of [-10, 5]) ssd.push(B([0, 1.4, z], [15, 1.7, 11], C.chip));
ssd.push(B([0, 2.3, -10], [10, .12, 6], C.darkMetal));
for (let i = 0; i < 10; i++) ssd.push(B([-9 + i * 2, .1, -20], [.9, .18, 2.5], C.gold));
ssd.push(Y([0, .65, 18.5], 4, .2, C.gold), Y([0, .8, 18.5], 1.8, .12, C.darkMetal));

const gpuBoard: Solid[] = [B([0, 0, 0], [165, 1.8, 52])];
for (let i = 0; i < 8; i++) gpuBoard.push(B([-61 + i * 17.5, 2.3, 0], [11, 2.8, 12], C.chip));
gpuBoard.push(B([0, 3.3, 0], [24, 2.2, 24], C.darkMetal));
for (let i = 0; i < 15; i++) gpuBoard.push(B([-67 + i * 8.8, 2.5, -20], [4.8, 3.3, 4.8], i % 2 ? C.darkMetal : C.aluminum));
for (let i = 0; i < 24; i++) gpuBoard.push(B([-71 + i * 2.2, -1, -25.3], [1.3, .22, 3.2], C.gold));
gpuBoard.push(B([77, 4.5, 0], [8, 7, 17], C.black));
const gpuHeatsink: Solid[] = [B([0, -4.4, 0], [158, 2, 50], C.darkMetal)];
for (let i = 0; i < 37; i++) gpuHeatsink.push(B([-78 + i * 4.3, .3, 0], [.7, 9, 50]));
for (const z of [-16, 16]) gpuHeatsink.push(Y([0, -2.5, z], 3.5, 150, C.copper, [0, 0, 90]));
const gpuShroud: Solid[] = [];
for (const z of [-28, 28]) gpuShroud.push(B([0, 0, z], [173, 6.5, 3]));
for (const x of [-85, 0, 85]) gpuShroud.push(B([x, 0, 0], [x === 0 ? 9 : 3, 6.5, 53]));
gpuShroud.push(B([0, 3.5, 0], [6, .35, 47], C.darkMetal));
for (const x of [-75, 75]) for (const z of [-24, 24]) gpuShroud.push(...screwAt(x, 3.2, z, 2.6));

const power: Solid[] = [B([0, -15, 0], [44, 2, 108]), B([0, 15, 0], [44, 2, 108])];
for (const x of [-21, 21]) power.push(B([x, 0, 0], [2, 28, 108]));
for (const z of [-53, 53]) power.push(B([0, 0, z], [40, 28, 2]));
for (let i = 0; i < 17; i++) power.push(B([0, 16.1, -45 + i * 5.6], [32, .12, 1.6], C.edge));
power.push(B([0, 16.2, 4], [25, .18, 33], C.darkMetal), Y([0, 1, -55], 9, 3, C.aluminum, [90, 0, 0]), Y([0, 1, -56.8], 5.6, .5, C.black, [90, 0, 0]));
power.push(B([-23, -2, 23], [3, 10, 15], C.black), B([-23, -2, 48], [3, 9, 11], C.black));
for (const z of [-35, 35]) power.push(...screwAt(15, 16, z));
const harness: Solid[] = [];
for (let strand = 0; strand < 6; strand++) {
  const z = -14 + strand * 1.3;
  harness.push(...cable(curve([57.5, 27, z], [44, 39, z + 6], [44, 27, -29 + strand * 1.3], [46, 18, -29 + strand * 1.3]), strand === 0 ? C.darkMetal : C.black, 1));
}
for (let strand = 0; strand < 4; strand++) harness.push(...cable(curve([57.5, 27, 14 + strand * 1.3], [55, 30, 30], [83, 23, 47], [78, 28, 66 + strand * 1.4]), C.black, 1));
harness.push(B([46, 18, -25.8], [6, 7, 12], C.black), B([78, 28, 68.2], [7, 6, 10], C.black));
for (const z of [-1, 2.5]) harness.push(B([58, 32, z], [4, 5, 2], C.charcoal));
const riser: Solid[] = [B([0, 0, 0], [65, 4, 4], C.black), B([0, 11, -1], [65, 4, 4], C.black)];
for (let i = 0; i < 12; i++) {
  const x = -29 + i * 5.2;
  riser.push(...cable(curve([x, 1, 1], [x, 5, 4], [x, 8, 0], [x, 10, -1], 5), i % 4 ? C.charcoal : C.darkMetal, 1.8));
}
const frontIO: Solid[] = [B([0, 0, 0], [38, 8, 4])];
for (const x of [-11, 4]) {
  frontIO.push(B([x, 0, 2.7], [10, 5.7, 2], C.aluminum), B([x, 0, 3.85], [8, 3.4, .5], C.black), B([x, -.6, 4.15], [6.5, .8, .2], C.teal));
  for (let i = 0; i < 4; i++) frontIO.push(B([x - 2.2 + i * 1.5, -.2, 4.3], [.45, .2, .2], C.gold));
}
frontIO.push(Y([16, 0, 3.1], 5.1, 2.4, C.aluminum, [90, 0, 0]), Y([16, 0, 4.4], 2.6, .2, C.black, [90, 0, 0]));
const rearIO: Solid[] = [B([0, 0, 0], [58, 1.5, 12], C.pcb)];
for (let i = 0; i < 3; i++) {
  rearIO.push(B([-20 + i * 16, 5, 0], [12, 9, 13], C.aluminum), B([-20 + i * 16, 5, -6.7], [9, 5.5, .7], C.black));
  for (let j = 0; j < 4; j++) rearIO.push(B([-23 + i * 16 + j * 2, 4.4, -7.1], [.7, .6, .2], C.gold));
}
rearIO.push(B([24, 7, 0], [10, 13, 13], C.darkMetal), B([24, 7, -6.8], [7.5, 8, .5], C.black));
const feet: Solid[] = [];
for (const x of [-93, 93]) for (const z of [-88, 88]) feet.push(Y([x, 0, z], 14, 5), Y([x, 2.6, z], 11.5, .8, C.darkMetal), Y([x, -.3, z], 9, 5.4, C.rubber));
const standoffs: Solid[] = [];
for (const x of [-89, 49]) for (const z of [-81, 53]) standoffs.push(Y([x, 0, z], 5.5, 7), Y([x, 4, z], 2.8, 1.8, C.darkMetal));
const screws: Solid[] = [];
for (const x of [-104, 104]) for (const z of [-99, 99]) screws.push(...screwAt(x, 92, z, 4));
for (const x of [-89, 49]) for (const z of [-81, 53]) screws.push(...screwAt(x, 12, z, 3));
for (const x of [-73, -21]) for (const z of [-53, -1]) screws.push(...screwAt(x, 50, z, 3));

export const desktopComputer: DeviceDocument = {
  version: 1,
  id: 'desktop-studio-01',
  name: 'Desktop / 01',
  description: 'A compact desktop computer, opened for inspection. Explore the chassis, processor cooling, dual-fan graphics, memory, storage and power as separate editable assemblies.',
  provenance: 'Original illustrative compact-PC geometry, informed by the Anatomy desk-computer craft reference. All parts are independent standard solids; shared interfaces are conceptual. This service-open layout is not manufacturer CAD, a compatibility-verified shopping list, or a proven physical build. No operating temperatures, performance or live device readings are claimed.',
  source: 'curated',
  parts: [
    part('case-tray', 'Chassis tray', 'Chassis', [0, 0, 0], [220, 32, 210], [0, -18, 0], '#929b9c', 'Folded metal base with perimeter rails and four short corner supports. Everything else is supported by the tray or the posts.', 'Carries the computer and defines its footprint.', tray, { 'Concept envelope': '220 × 210 × 100 mm', 'Material': 'Coated aluminum / steel study', 'View': 'Open service layout' }, [{ partId: 'standoffs', label: 'Motherboard mounting points' }, { partId: 'case-feet', label: 'Vibration-isolating feet' }]),
    part('case-feet', 'Isolation feet · set of 4', 'Chassis', [0, -7, 0], [200, 7, 190], [-12, -34, 14], C.rubber, 'Four rubber feet keep the metal base off the surface and limit vibration transfer.', 'Supports the chassis on a desk.', feet, { 'Count': '4', 'Type': 'Rubber isolation pads' }, [{ partId: 'case-tray', label: 'Underside mounting' }]),
    part('standoffs', 'Motherboard standoffs', 'Fasteners', [0, 5, 0], [145, 10, 140], [-20, 8, -12], C.gold, 'Conductive mounting posts keep the back of the motherboard clear of the metal tray. Their positions must match the actual board.', 'Creates safe clearance behind the PCB.', standoffs, { 'Pattern': 'Concept board pattern', 'Rule': 'Install only under actual mounting holes' }, [{ partId: 'motherboard', label: 'PCB mounting holes' }, { partId: 'case-tray', label: 'Tray attachment' }]),
    part('rear-frame', 'Rear I/O frame', 'Chassis', [0, 42, -105], [220, 88, 3], [0, 8, -45], '#9aa3a5', 'Rear perimeter frame with separate motherboard I/O and power entry openings. Ventilation is constructed from real open slats.', 'Protects the rear connectors without blocking airflow.', rear, { 'Features': 'I/O opening, DC inlet, exhaust slots' }, [{ partId: 'rear-io', label: 'Connector opening' }, { partId: 'power-unit', label: 'Power entry opening' }]),
    part('front-panel', 'Vented front fascia', 'Chassis', [0, 4, 105], [220, 44, 4], [0, 10, 60], '#727d80', 'Low front grille with open vertical ventilation slots and a separate port module. The low service fascia keeps the graphics cooling visible.', 'Admits air and presents the front connectors.', front, { 'Ventilation': '26 slim grille slats', 'Finish': 'Graphite metal study' }, [{ partId: 'front-io', label: 'USB / audio module' }]),
    part('left-panel', 'Left ventilation panel', 'Chassis', [-110, 39, 0], [3, 82, 210], [-45, 10, -8], '#a0aaac', 'Removable side frame with repeated metal slats and open spaces between them.', 'Guards the components while passing air.', sidePanel(), { 'Service': 'Removable side panel', 'Construction': 'Open slatted concept' }, [{ partId: 'case-tray', label: 'Side mounting rail' }]),
    part('right-panel', 'Right ventilation panel', 'Chassis', [110, 39, 0], [3, 82, 210], [45, 10, 8], '#a0aaac', 'Matching removable side ventilation panel. Its open geometry makes the power unit visible in the assembled study.', 'Provides a ventilated side boundary.', sidePanel(), { 'Service': 'Removable side panel' }, [{ partId: 'case-tray', label: 'Side mounting rail' }]),
    part('top-frame', 'Removable upper service rim', 'Chassis', [0, 91, 0], [220, 5, 210], [30, 45, -65], '#9ca7a9', 'Four slim perimeter rails form the upper case rim. This intentionally open service model omits an opaque roof so the installed components remain visible.', 'Braces the case and defines the service opening.', topFrame, { 'Display state': 'Open service model', 'Access': 'Fastened perimeter rim' }, [{ partId: 'case-tray', label: 'Case perimeter mounts' }, { partId: 'screws', label: 'Rim screws' }]),
    part('motherboard', 'Compact motherboard', 'Compute', [-20, 10, -14], [152, 12, 148], [0, 110, -10], C.pcb, 'Illustrative compact mainboard with memory sockets, PCIe connection, power socket, voltage regulation, plated mounting holes, chips and copper traces.', 'Connects the processor, RAM, storage and peripherals.', motherboard, { 'Board': 'Custom compact concept geometry', 'Interfaces': 'CPU socket · memory · M.2 · PCIe', 'Compatibility': 'Requires a matched commercial platform' }, [{ partId: 'cpu-socket', label: 'Processor socket' }, { partId: 'ram-a', label: 'Memory channel A' }, { partId: 'ram-b', label: 'Memory channel B' }, { partId: 'm2-ssd', label: 'M.2 storage' }, { partId: 'riser-cable', label: 'PCIe expansion' }, { partId: 'power-harness', label: 'Main power connector' }]),
    part('cpu-socket', 'Processor socket & retention', 'Compute', [-47, 14, -27], [50, 8, 52], [-15, 130, -18], C.darkMetal, 'Socket bed, plated contact field, metal retention frame and a side lever. Contact positions are illustrative, not a pin map for a real processor.', 'Aligns and secures the processor electrically and mechanically.', socket, { 'Interface': 'Matched CPU / motherboard socket required', 'Handling': 'Never touch socket contacts' }, [{ partId: 'processor', label: 'Processor contact interface' }, { partId: 'motherboard', label: 'Socket soldered to board' }]),
    part('processor', 'Processor package', 'Compute', [-47, 19, -27], [36, 3, 36], [-15, 160, -18], C.aluminum, 'Processor substrate beneath a metal integrated heat spreader. The illustrated package carries no invented core count, clock speed or performance result.', 'Executes the operating system and applications.', processor, { 'Package': 'Illustrative desktop CPU', 'Selection': 'Match socket and firmware support', 'Thermal path': 'Heat spreader → thermal interface → cooler' }, [{ partId: 'cpu-socket', label: 'Socket contacts' }, { partId: 'cooler-base', label: 'Thermal interface' }]),
    part('cooler-base', 'Copper cooler base & heatpipes', 'Cooling', [-47, 24, -27], [58, 12, 48], [-15, 205, -18], C.aluminum, 'Flat cold plate with a copper contact face, mounting crossbar and four transverse heatpipes carrying heat into the fins.', 'Transfers processor heat to the fin stack.', coolerBase, { 'Contact': 'Thermal compound required', 'Mount': 'Socket-specific bracket required', 'Structure': 'Cold plate + heatpipes' }, [{ partId: 'processor', label: 'Thermal compound contact' }, { partId: 'cooler-fins', label: 'Heatpipe-to-fin contact' }]),
    part('cooler-fins', 'Aluminum fin stack', 'Cooling', [-47, 37, -27], [57, 23, 53], [-15, 245, -18], C.aluminum, 'Twenty-five thin aluminum fins sit above the cooler base. Visible spacing provides an actual air path rather than a solid decorative block.', 'Spreads heat over a larger air-cooled surface.', fins, { 'Illustrated fins': '25', 'Material': 'Aluminum', 'Air path': 'Between fins' }, [{ partId: 'cooler-base', label: 'Heatpipe interface' }, { partId: 'cpu-fan', label: 'Forced airflow' }]),
    part('cpu-fan', 'Processor cooling fan', 'Cooling', [-47, 55, -27], [59, 10, 59], [-15, 295, -18], C.black, 'A square fan frame with nine swept blades, a bearing hub, rim and four fasteners. Blade sections are editable solids; the fan is shown stationary.', 'Moves air through the processor heatsink.', fanSolids(27.5, true), { 'Blade study': '9 swept blades', 'Power': 'Motherboard fan header (unit-specific)', 'State': 'Stationary illustration' }, [{ partId: 'cooler-fins', label: 'Airflow through fin stack' }, { partId: 'motherboard', label: 'Fan power/control header' }]),
    part('ram-a', 'Memory module A', 'Memory', [12, 26, -24], [5, 27, 64], [70, 170, -40], C.pcb, 'Separate DIMM-style module with memory packages on both faces, gold edge contacts and a slim top spreader. Geometry is an illustrative compact module.', 'Provides volatile working memory.', memoryModule(), { 'Type': 'Matched memory generation required', 'Install': 'Align notch; fully engage both latches' }, [{ partId: 'motherboard', label: 'Memory socket A' }]),
    part('ram-b', 'Memory module B', 'Memory', [23, 26, -24], [5, 27, 64], [95, 205, -25], C.pcb, 'Second independently selectable memory module, with its own chips, contact fingers and alignment geometry.', 'Populates the second supported memory socket.', memoryModule(), { 'Pairing': 'Use the board manual for supported kits / slots', 'Power': 'Supplied by memory socket' }, [{ partId: 'motherboard', label: 'Memory socket B' }]),
    part('m2-ssd', 'M.2 NVMe storage', 'Storage', [7, 14, 32], [22, 4, 42], [70, 110, 10], C.pcb, 'A 22 × 42 mm M.2 storage study with controller / flash packages, edge contacts and a retention hole. A real drive must match the board key, length and protocol.', 'Stores the operating system and files.', ssd, { 'Illustrated form': 'M.2 2242 envelope', 'Interface': 'NVMe over PCIe (compatible slot required)', 'Retention': 'Single mounting screw' }, [{ partId: 'motherboard', label: 'M.2 socket' }]),
    part('gpu-board', 'Graphics card PCB', 'Graphics', [0, 22, 75], [165, 9, 52], [0, 135, 65], C.pcb, 'Graphics board carrying a processor location, memory packages, power components and edge contacts. A low-profile sandwich arrangement connects it through a riser.', 'Renders graphics and drives displays.', gpuBoard, { 'Connection': 'PCIe through riser', 'Study': 'Illustrative compact graphics board', 'Check': 'Length, bracket, riser and power compatibility' }, [{ partId: 'riser-cable', label: 'PCIe connection to motherboard' }, { partId: 'gpu-heatsink', label: 'Thermal interface' }, { partId: 'power-harness', label: 'Auxiliary power (if required)' }]),
    part('gpu-heatsink', 'Graphics heatsink & heatpipes', 'Cooling', [0, 31, 75], [160, 12, 51], [0, 170, 80], C.aluminum, 'A thin fin array and two copper heatpipes span the graphics board. The fan openings above it remain clear.', 'Carries graphics heat into the dual-fan air path.', gpuHeatsink, { 'Illustrated fins': '37', 'Interface': 'Model-specific pads / compound required' }, [{ partId: 'gpu-board', label: 'Graphics thermal contact' }, { partId: 'gpu-fan-left', label: 'Left airflow zone' }, { partId: 'gpu-fan-right', label: 'Right airflow zone' }]),
    part('gpu-shroud', 'Graphics cooling shroud', 'Graphics', [0, 39, 75], [173, 8, 59], [0, 205, 90], C.charcoal, 'Open perimeter shroud with two fan bays, a center bridge, screw bosses and a restrained center trim.', 'Positions the two graphics fans above the heatsink.', gpuShroud, { 'Layout': 'Two independent fan bays', 'Construction': 'Open frame; no hidden opaque face' }, [{ partId: 'gpu-heatsink', label: 'Shroud mounting' }, { partId: 'gpu-fan-left', label: 'Left fan bay' }, { partId: 'gpu-fan-right', label: 'Right fan bay' }]),
    part('gpu-fan-left', 'Graphics fan · left', 'Cooling', [-43, 41, 75], [53, 9, 53], [-20, 255, 105], C.black, 'Nine swept blades, bearing hub and circular inlet rim. The left fan is independently selectable and editable.', 'Cools the left graphics fin bank.', fanSolids(25, false), { 'State': 'Stationary illustration', 'Blade study': '9 swept blades' }, [{ partId: 'gpu-shroud', label: 'Left mounting bay' }, { partId: 'gpu-heatsink', label: 'Airflow zone' }]),
    part('gpu-fan-right', 'Graphics fan · right', 'Cooling', [43, 41, 75], [53, 9, 53], [20, 255, 105], C.black, 'Matching right graphics fan with separate blades, hub and inlet rim.', 'Cools the right graphics fin bank.', fanSolids(25, false), { 'State': 'Stationary illustration', 'Blade study': '9 swept blades' }, [{ partId: 'gpu-shroud', label: 'Right mounting bay' }, { partId: 'gpu-heatsink', label: 'Airflow zone' }]),
    part('power-unit', 'Compact DC power unit', 'Power', [81, 29, -33], [44, 34, 112], [65, 110, -25], C.case, 'Enclosed conceptual DC-to-ATX power module with ventilation, connector end and external DC inlet. The computer uses a matched certified external supply; no exposed mains circuitry is illustrated.', 'Converts a matched DC supply into the rails required by the selected platform.', power, { 'Input': 'Matched certified external DC supply', 'Output rails': 'Unit-specific ATX rails', 'Budget': 'Must cover actual CPU / GPU load', 'Form': 'Illustrative compact enclosure' }, [{ partId: 'power-harness', label: 'Matched output harness' }, { partId: 'rear-frame', label: 'Rear power entry' }], 'This is a visual architecture study. Select a commercially supported power solution and verify its load capacity, voltage, pinout and enclosure fit before purchasing or assembling.'),
    part('power-harness', 'Main & graphics power harness', 'Cables', [0, 0, 0], [48, 40, 116], [75, 120, 15], C.black, 'Bundled curved cable runs connect the power module to mainboard and graphics connectors. The depicted conductors are conceptual bundles, not a wiring pinout.', 'Distributes regulated power to the installed assemblies.', harness, { 'Pinout': 'Use only the supply manufacturer’s compatible cables', 'Routing': 'Keep away from fan blades and sharp edges' }, [{ partId: 'power-unit', label: 'Power outputs' }, { partId: 'motherboard', label: 'Main power' }, { partId: 'gpu-board', label: 'Graphics power' }]),
    part('riser-cable', 'PCIe riser interconnect', 'Cables', [-35, 16, 51], [66, 18, 17], [5, 118, 45], C.charcoal, 'Two connector blocks joined by a short bank of bent conductors. Real risers require the correct slot orientation, PCIe generation and bend clearance.', 'Allows the graphics board to sit flat in the compact case.', riser, { 'Interface': 'PCIe', 'Selection': 'Matched generation, length and bracket layout' }, [{ partId: 'motherboard', label: 'PCIe slot' }, { partId: 'gpu-board', label: 'Graphics edge connector' }]),
    part('front-io', 'Front USB & audio module', 'I/O', [74, 34, 105], [40, 10, 9], [35, 40, 88], C.black, 'Front port module with two USB-shaped receptacles, internal tongues and plated contacts, plus a small audio jack.', 'Brings peripheral connections to the front fascia.', frontIO, { 'Study ports': '2 × USB-shaped ports · audio jack', 'Connection': 'Board-specific internal headers' }, [{ partId: 'front-panel', label: 'Front fascia mount' }, { partId: 'motherboard', label: 'Internal I/O headers' }]),
    part('rear-io', 'Rear connector cluster', 'I/O', [-62, 20, -97], [62, 18, 16], [-35, 70, -50], C.aluminum, 'Metal connector shells, inset receptacles and individual contacts form a separate rear I/O cluster.', 'Provides external motherboard connections.', rearIO, { 'Study': 'Generic USB / network-style connector cluster', 'Actual ports': 'Determined by the chosen motherboard' }, [{ partId: 'rear-frame', label: 'Rear I/O opening' }, { partId: 'motherboard', label: 'Board edge connection' }]),
    part('screws', 'Captive fasteners · set', 'Fasteners', [0, 0, 0], [212, 95, 205], [0, 15, -10], C.aluminum, 'Grouped fasteners at chassis, motherboard and cooler attachment points. Each screw has a shank, head and visible driver slot.', 'Secures the service rim, mainboard and cooling assembly.', screws, { 'Pattern': 'Illustrative grouping', 'Hardware': 'Use the actual case / cooler hardware', 'Rule': 'Do not overtighten PCB mounts' }, [{ partId: 'top-frame', label: 'Upper rim fastening' }, { partId: 'motherboard', label: 'Board fastening' }, { partId: 'cpu-fan', label: 'Cooling attachment' }]),
  ],
  steps: [
    { title: 'Prepare the open chassis', description: 'Disconnect every power source. Remove the service rim and side panels. Confirm the actual motherboard mounting pattern and install only the standoffs that align with its holes. Work on an antistatic surface.', partIds: ['case-tray', 'case-feet', 'rear-frame', 'standoffs'] },
    { title: 'Install the processor', description: 'Consult the motherboard and processor manuals. Release the socket retention mechanism, align the processor’s marked corner without force, then close the latch. Never touch the socket contacts. This drawing does not specify a compatible socket family.', partIds: ['motherboard', 'cpu-socket', 'processor'] },
    { title: 'Fit memory and storage', description: 'Match the supported memory type and orient each module by its notch before pressing it into its socket. Install an M.2 drive of the correct key, protocol and supported length, then secure its retention screw.', partIds: ['ram-a', 'ram-b', 'm2-ssd'] },
    { title: 'Attach processor cooling', description: 'Use the cooler’s socket-specific hardware and the recommended thermal compound procedure. Secure the base evenly, fit the fin stack / fan assembly and connect the fan to the correct motherboard header. Keep cables outside the blades.', partIds: ['cooler-base', 'cooler-fins', 'cpu-fan'] },
    { title: 'Mount the mainboard and I/O', description: 'Align the rear connector area and lower the board onto its matching standoffs. Tighten the correct board screws gently. Connect the front I/O headers according to the actual motherboard manual; the illustrated ports do not define a pinout.', partIds: ['motherboard', 'rear-io', 'front-io', 'screws'] },
    { title: 'Install the graphics assembly', description: 'Use a compatible graphics card, bracket and PCIe riser. Secure the riser and graphics board before attaching the card’s original matched cooling hardware. Do not use this visual shroud as a replacement for a manufacturer-tested cooler.', partIds: ['riser-cable', 'gpu-board', 'gpu-heatsink', 'gpu-shroud', 'gpu-fan-left', 'gpu-fan-right'] },
    { title: 'Connect the matched power system', description: 'With the external supply unplugged, fit the supported power module and only its manufacturer-compatible harness. Verify connector seating and actual power capacity. Route bundles clear of fans, heatsinks and panel edges. This architecture requires a validated commercial power solution.', partIds: ['power-unit', 'power-harness'] },
    { title: 'Inspect, close and start', description: 'Check for loose fasteners, trapped cables and unobstructed fans. Refit the side panels, front fascia and service rim. Connect the matched external supply and peripherals, then follow the motherboard’s first-boot and firmware setup instructions. Install an operating system from trusted media; no Arduino sketch is involved.', partIds: ['left-panel', 'right-panel', 'front-panel', 'top-frame', 'screws'] },
  ],
};

// Separate moving rotors from stationary frames before defining motion tracks.
for (const fanId of ['cpu-fan', 'gpu-fan-left', 'gpu-fan-right']) {
  const fan = desktopComputer.parts.find(p => p.id === fanId)!;
  const start = fanId === 'cpu-fan' ? 9 : 1;
  const rotorSolids = fan.solids.slice(start, start + 30);
  fan.solids = fan.solids.filter((_, i) => i < start || i >= start + 30);
  const rotorId = `${fanId}-rotor`;
  fan.connections.push({ partId: rotorId, label: 'Stationary frame supports the rotor bearing' });
  const rotor = part(rotorId, fanId === 'cpu-fan' ? 'CPU fan rotor' : fanId === 'gpu-fan-left' ? 'Graphics rotor · left' : 'Graphics rotor · right', 'Cooling', [...fan.position], [...fan.size], [...fan.explode], fan.color, 'Swept blades and the central bearing hub, separated from the stationary frame.', 'Rotates to move air across the heat exchanger.', rotorSolids, { Motion: 'Illustrative rotation; no airflow or speed measurement' }, [{ partId: fanId, label: 'Bearing supported by the stationary frame' }]);
  desktopComputer.parts.push(rotor);
  for (const step of desktopComputer.steps) if (step.partIds.includes(fanId)) step.partIds.push(rotorId);
}

// Semantic groups retain the original solids and stable component identities.
desktopComputer.assemblies = Array.from(new Set(desktopComputer.parts.map(p => p.category))).map((category, index) => ({ id: `pc-assembly-${index}`, name: category, partIds: desktopComputer.parts.filter(p => p.category === category).map(p => p.id) }));
desktopComputer.relationships = desktopComputer.parts.flatMap(part => part.connections.map((connection, index) => ({ id: `${part.id}-link-${index}`, from: part.id, to: connection.partId, type: /power|output harness/i.test(connection.label) ? 'electrical' as const : /PCIe|memory|socket|data|channel/i.test(connection.label) ? 'data' as const : 'mechanical' as const, description: connection.label })));
desktopComputer.capabilities = ['desktop-computer', 'component-exploration'];
desktopComputer.mechanisms = [{ id: 'pc-cooling-fans', name: 'Cooling fan rotation', description: 'Illustrative rotation of the independently modeled cooling assemblies. This is a motion explanation, not an airflow simulation.', duration: 8, motion: 'linear', tracks: ['cpu-fan-rotor', 'gpu-fan-left-rotor', 'gpu-fan-right-rotor'].map(partId => ({ partId, rotation: [0, 720, 0] as Vec3 })), stages: [{ at: 0, title: 'Cooling assemblies', description: 'The processor and graphics cooling assemblies are separate components. Their motors turn the fan blades.', partIds: ['cpu-fan', 'gpu-fan-left', 'gpu-fan-right'] }, { at: .25, title: 'Move air across the fins', description: 'Rotating blades move air across the heatsinks. Only the blades and hub rotate; their supporting frames remain stationary.', partIds: ['cpu-fan', 'cooler-fins', 'gpu-fan-left', 'gpu-fan-right', 'gpu-heatsink'] }, { at: .75, title: 'Keep the path clear', description: 'Cables and panels need clearance from rotating fans. Actual airflow and temperatures require measurements of the real computer.', partIds: ['power-harness', 'left-panel', 'right-panel'] }, { at: 1, title: 'Explore the cooling path', description: 'Select the copper base, fin stacks, or fans to trace how the cooling assemblies work together.', partIds: ['cooler-base', 'cooler-fins', 'cpu-fan', 'gpu-heatsink'] }] }];
