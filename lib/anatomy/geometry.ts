/** Electronics geometry built with the MIT Anatomy projection/solid toolkit. */
import * as k from '@/vendor/anatomy/iso-kit';
import type { LibraryPart, Vec3 } from '@/lib/types';

export type Mark =
  | { kind: 'solid'; key: number; depth: number; paths: k.SolidPaths; colour: string; opacity?: number }
  | { kind: 'line'; key: number; depth: number; path: string; colour: string; width: number; opacity?: number }
  | { kind: 'text'; key: number; depth: number; transform: string; text: string; colour: string; size: number };
export interface PartArt { marks: Mark[]; silhouette: string; microParts: number; transform: string; hitBounds: { x: number; y: number; width: number; height: number } }
const PCB = '#6b8277', CHIP = '#343b3c', METAL = '#b9bfba', GOLD = '#bdab76', INK = '#43534d', WHITE = '#e5e6df';

/** A pure builder; no random details, values, or live sensor readings. */
export function makeHardwareArt(part: LibraryPart, projection: k.Projection, rotation: Vec3 = [0, 0, 0], colourOverride?: string): PartArt {
  const [w, h, d] = part.size;
  if (colourOverride && !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(colourOverride)) colourOverride = undefined;
  const orientation = partCamera(projection, rotation);
  const P = orientation.projection;
  const z0 = -h / 2;
  const marks: Mark[] = [];
  const supportLevel = new Map<number, number>();
  let serial = 0, microParts = 0;
  const depth = (x: number, y: number, z: number) => k.depthOf([x, y, z], P);
  const slab = (x: number, y: number, width: number, length: number, z: number, height: number, colour = WHITE, radius = .4, opacity?: number) => {
    if (width <= 0 || length <= 0 || height < 0) return;
    marks.push({ kind: 'solid', key: serial++, depth: depth(x + width / 2, y + length / 2, z + height / 2), paths: k.slabOf({ x, y, w: width, d: length, r: radius }, z, height, P, 4, Math.min(.2, height / 4)), colour: colourOverride && (width * length > w * d * .14 || [PCB, '#dce0d4'].includes(colour)) ? colourOverride : colour, opacity });
    supportLevel.set(serial - 1, z);
    microParts++;
  };
  const cyl = (x: number, y: number, radius: number, z: number, height: number, colour = METAL, opacity?: number) => {
    marks.push({ kind: 'solid', key: serial++, depth: depth(x, y, z + height / 2), paths: k.cylinder(x, y, radius, z, height, P, radius > 5 ? 40 : 20, Math.min(.15, height / 4)), colour: colourOverride && radius >= w * .3 && ![METAL, GOLD].includes(colour) ? colourOverride : colour, opacity });
    supportLevel.set(serial - 1, z);
    microParts++;
  };
  const line = (path: string, colour = INK, width = .24, at: k.Point3 = [0, 0, 0], opacity = 1) => { supportLevel.set(serial, at[2]); marks.push({ kind: 'line', key: serial++, depth: depth(...at) + .01, path, colour, width, opacity }); };
  const onTop = (points: k.Plane[], z: number, colour = INK, width = .23, opacity = 1) => {
    const c = points[Math.floor(points.length / 2)] ?? [0, 0];
    line(k.onTop(points, z, P), colour, width, [c[0], c[1], z], opacity);
  };
  const label = (text: string, x: number, y: number, z: number, size = 1.45, colour = '#dce6db') => { supportLevel.set(serial, z); marks.push({ kind: 'text', key: serial++, depth: depth(x, y, z) + .1, transform: k.topMatrix([x, y], z, P), text, colour, size }); };
  const screw = (x: number, y: number, z: number, radius = 1.15) => {
    cyl(x, y, radius, z, .35, METAL);
    onTop([[x - radius * .6, y], [x + radius * .6, y]], z + .36, '#5f6761', .22);
    onTop([[x, y - radius * .6], [x, y + radius * .6]], z + .36, '#5f6761', .22);
  };
  const mounting = (z: number) => {
    if (w < 15 || d < 15) return;
    for (const [x, y] of k.corners({ x: -w / 2, y: -d / 2, w, d, r: 0 }, 2.1)) {
      cyl(x, y, 1.15, z, .06, GOLD);
      cyl(x, y, .64, z + .065, .02, '#e4e3dc');
    }
  };
  const passive = (x: number, y: number, z: number, wide = false) => {
    const width = wide ? 2 : 1;
    slab(x - width / 2, y - .65, width, 1.3, z, .45, '#a49c83', .15);
    slab(x - width / 2, y - .68, .32, 1.36, z + .03, .45, METAL, .08);
    slab(x + width / 2 - .32, y - .68, .32, 1.36, z + .03, .45, METAL, .08);
  };
  const chip = (x: number, y: number, cw: number, cd: number, z: number, height = 1.4, text?: string) => {
    const pins = Math.max(3, Math.min(12, Math.floor(cd / 1.4)));
    for (let i = 0; i < pins; i++) {
      const yy = y - cd / 2 + .65 + i * (cd - 1.3) / Math.max(1, pins - 1);
      slab(x - cw / 2 - .8, yy - .18, cw + 1.6, .36, z, .25, METAL, .05);
    }
    slab(x - cw / 2, y - cd / 2, cw, cd, z + .15, height, CHIP, .4);
    cyl(x - cw / 2 + .8, y - cd / 2 + .8, .22, z + height + .16, .01, '#b9c4bb');
    if (text && cw > 5) label(text, x - cw / 2 + .7, y + .5, z + height + .17, Math.min(1.3, cw / (text.length * .7)), '#adb9b1');
  };
  const usb = (x: number, y: number, z: number, size = 7) => {
    slab(x - size / 2, y, size, 5.5, z, 2.8, METAL, .7);
    slab(x - size / 2 + .6, y - .06, size - 1.2, .3, z + .4, 1.7, CHIP, .4);
    slab(x - size / 2 + 1, y + .2, size - 2, 3.8, z + 2.82, .08, '#d1d4ce', .25);
    for (const xx of [-1, 1]) slab(x + xx * (size / 2 - .8) - .4, y + 3.5, .8, 1, z + 2.92, .02, '#848e87', .1);
  };
  const headers = (z: number) => {
    for (const pin of part.pins) {
      const x = pin.position[0], y = -pin.position[2];
      if (pin.name === 'USB') continue;
      const pinTop = Math.max(z + 1.3, pin.position[1]);
      const shellHeight = Math.max(.6, pinTop - z - 1.1);
      slab(x - 1.02, y - 1.02, 2.04, 2.04, z, shellHeight, CHIP, .18);
      slab(x - .32, y - .32, .64, .64, z + shellHeight, pinTop - z - shellHeight, GOLD, .04);
      // The fitted header tip is exactly the library's schematic wire anchor.
      line(k.ring(x, y, .78, z + shellHeight + .02, P, 16), '#8b8e71', .16, [x, y, z + shellHeight + .03]);
    }
  };
  const pcb = (colour = PCB) => {
    slab(-w / 2, -d / 2, w, d, z0, 1.6, colour, 1);
    mounting(z0 + 1.63);
    const boardTop = z0 + 1.67;
    // Traces start on the actual header pads and end at device pads.
    part.pins.filter(p => p.name !== 'USB').slice(0, 24).forEach((pin, i) => {
      const x = pin.position[0], y = -pin.position[2];
      const destX = (i % 4 - 1.5) * Math.min(w / 12, 1.8);
      const destY = (i % 7 - 3) * Math.min(d / 24, 1.5);
      onTop([[x, y], [x * .68, y], [x * .44, destY], [destX, destY]], boardTop, '#a7baa7', .16, .55);
      cyl(destX, destY, .25, boardTop + .01, .02, GOLD);
    });
    return boardTop;
  };

  if (part.category === 'microcontroller') {
    const top = pcb(part.id === 'raspberry-pi-pico' ? '#768f70' : PCB);
    const esp = part.id === 'esp32-devkit';
    if (esp) {
      slab(-w * .32, -d * .30, w * .64, d * .46, top, 2.1, METAL, .65);
      label('ESPRESSIF', -w * .25, -d * .14, top + 2.13, 1.5, '#596962');
      label('ESP32-WROOM', -w * .25, -d * .07, top + 2.13, 1.2, '#596962');
      slab(-w * .31, d * .17, w * .62, d * .18, top, .4, '#354943', .25);
      const antenna: k.Plane[] = [];
      for (let i = 0; i < 6; i++) antenna.push([-w * .23 + i * w * .085, d * (i % 2 ? .3 : .2)]);
      onTop(antenna, top + .43, GOLD, .55);
    } else {
      chip(0, -d * .02, Math.min(w * .45, 14), d * .25, top, 1.4, part.id === 'raspberry-pi-pico' ? 'RP2040' : 'ATMEGA');
    }
    usb(0, -d / 2 -.6, top, part.id === 'arduino-uno' ? 11 : 7);
    for (let i = 0; i < 7; i++) passive((i % 2 ? -1 : 1) * w * .25, d * .2 + Math.floor(i / 2) * 2.1, top);
    chip(0, -d * .32 + 6, Math.min(w * .35, 7), 4.4, top, .8);
    for (const x of [-1, 1]) {
      slab(x * w * .24 - 1.6, -d * .29, 3.2, 3, top, 1.1, '#b5b8ad', .35);
      cyl(x * w * .24, -d * .29 + 1.5, .8, top + 1.12, .6, CHIP);
    }
    slab(w * .23, d * .05, 1.5, 2.5, top, .65, '#9fac6c', .2);
    headers(top);
  } else if (part.id === 'breadboard') {
    const top = z0 + h;
    slab(-w / 2, -d / 2, w, d, z0, h, '#e1e2db', 2.4);
    slab(-w / 2 + 3, -2.1, w - 6, 4.2, top, .03, '#c1c6bc', .6);
    // 30 columns, 10 terminal rows and 4 power rails: physically recognisable groups.
    const cols = 30, pitch = (w - 10) / (cols - 1);
    for (let col = 0; col < cols; col++) {
      const x = -w / 2 + 5 + col * pitch;
      for (let row = 0; row < 10; row++) {
        const y = row < 5 ? -15.5 + row * 2.54 : 5.34 + (row - 5) * 2.54;
        slab(x - .56, y - .56, 1.12, 1.12, top + .02, .05, '#78817a', .2);
      }
      for (const y of [-23.2, -20.7, 20.7, 23.2]) slab(x - .46, y - .46, .92, .92, top + .02, .05, '#7d857d', .18);
    }
    for (const [y, colour] of [[-25, '#a07e74'], [-18.6, '#789198'], [18.6, '#a07e74'], [25, '#789198']] as const) onTop([[-w / 2 + 4, y], [w / 2 - 4, y]], top + .1, colour, .32);
    for (let i = 0; i < 6; i++) label(String(i * 5 + 1), -w / 2 + 4 + i * pitch * 5, -3.2, top + .15, 1.35, '#858f82');
  } else if (part.id === 'ssd1306-oled' || part.id === 'lcd-1602') {
    const top = pcb();
    const isLCD = part.id === 'lcd-1602';
    const gw = w - (isLCD ? 12 : 3.5), gd = d * .63;
    slab(-gw / 2 - .7, -gd / 2 - .7, gw + 1.4, gd + 1.4, top, 1.6, '#343f3b', 1);
    slab(-gw / 2, -gd / 2, gw, gd, top + 1.6, .35, isLCD ? '#9da998' : '#253b3b', .75);
    const screenTop = top + 1.98;
    if (isLCD) {
      for (let row = 0; row < 2; row++) for (let col = 0; col < 16; col++) slab(-gw / 2 + 2 + col * (gw - 4) / 16, -gd / 2 + 2 + row * (gd - 4) / 2, (gw - 4) / 16 * .72, (gd - 4) / 2 * .75, screenTop, .01, '#73836e', .1);
    } else {
      label('FIRMWARE PREVIEW', -gw / 2 + 1.6, -gd / 2 + 3, screenTop, 1.18, '#a7c6c1');
      label('--', -gw / 2 + 2, 2.3, screenTop, 5.4, '#bcd1c7');
      onTop([[-gw / 2 + 1.5, gd / 2 - 3], [gw / 2 - 1.5, gd / 2 - 3]], screenTop, '#5d7f76', .2);
      label('CONNECT HARDWARE', -gw / 2 + 1.6, gd / 2 - 1, screenTop, 1.05, '#8ca99c');
    }
    for (let i = 0; i < 4; i++) passive(-w * .28 + i * w * .17, d * .38, top);
    headers(top);
  } else if (part.id === 'max30102') {
    const top = pcb('#8f7774');
    slab(-4.2, -4.7, 8.4, 8.3, top, 1.1, CHIP, .6);
    slab(-3.5, -4.1, 7, 7.1, top + 1.1, .15, '#252d2d', .35);
    for (const [x, colour] of [[-1.6, '#996b64'], [1.6, '#5e6663']] as const) {
      cyl(x, -1.5, 1.2, top + 1.27, .06, '#bdc3b9');
      cyl(x, -1.5, .86, top + 1.34, .1, colour);
    }
    slab(-2.8, 1, 5.6, 1.5, top + 1.28, .1, '#6a7774', .2);
    chip(0, 6, 3.4, 2.4, top, .55);
    for (let i = 0; i < 4; i++) passive(i % 2 ? 6 : -6, -4 + Math.floor(i / 2) * 4.2, top);
    headers(top);
  } else if (part.id === 'dht22') {
    slab(-w / 2, -d / 2, w, d, z0, h, '#dedfd7', 2);
    for (let row = 0; row < 7; row++) for (let col = 0; col < 3; col++) slab(-w / 2 + 2 + col * 3.8, -d / 2 + 2.7 + row * 2.6, 2.3, 1.1, z0 + h + .01, .06, '#8b968a', .4);
    for (let i = 0; i < 4; i++) slab(-5 + i * 3.3, d / 2 -.5, .65, 6, z0, .5, METAL, .05);
  } else if (part.id === 'hc-sr04') {
    const top = pcb();
    for (const x of [-w * .28, w * .28]) {
      cyl(x, 0, 7.6, top, 10.5, METAL);
      cyl(x, 0, 6.65, top + 10.5, .12, '#53635c');
      cyl(x, 0, 5.8, top + 10.65, .08, '#a7b4a6');
      for (let i = -4; i <= 4; i++) {
        const half = Math.sqrt(Math.max(0, 5.4 ** 2 - i ** 2));
        onTop([[x - half, i], [x + half, i]], top + 10.76, '#6a7d70', .18);
      }
    }
    headers(top);
  } else if (part.id === 'pir-motion') {
    const top = pcb();
    cyl(0, 0, 10.5, top, 3, '#cbd3c6');
    for (let i = 0; i < 5; i++) {
      const t = i / 5;
      cyl(0, 0, 10.5 * Math.cos(t * 1.35), top + 3 + t * 14, 3.1, '#e7e9df');
    }
    for (let i = 0; i < 5; i++) line(k.ring(0, 0, 10 * Math.cos(i / 5 * 1.35), top + 3.2 + i / 5 * 14, P), '#a6b4a0', .15, [0, 0, top + 5 + i * 2.7]);
    headers(top);
  } else if (part.id === 'soil-moisture') {
    const top = pcb('#56675b');
    for (let i = 0; i < 4; i++) {
      const inset = 3 + i * 1.3;
      line(k.planOutline({ x: -w / 2 + inset, y: -d / 2 + 24 + inset, w: w - 2 * inset, d: d - 28 - 2 * inset, r: 3 }, top, P), GOLD, .35, [0, d / 5, top]);
    }
    chip(0, -d / 2 + 10, 6, 5, top, 1);
    for (let i = 0; i < 4; i++) passive(-w * .3 + i * 3.5, -d / 2 + 18, top);
    headers(top);
  } else if (part.id === 'mpu6050' || part.id === 'tp4056' || part.id === 'relay-module') {
    const top = pcb();
    if (part.id === 'relay-module') {
      slab(-w / 2 + 4, -d * .18, w - 8, d * .5, top, h - 3.5, '#81958a', 1);
      label('SRD-05VDC', -w / 2 + 5, d * .08, top + h - 3.46, 1.45, '#e1e7dd');
      for (let i = 0; i < 3; i++) { slab(-w / 2 + 2 + i * 7.5, d * .35, 6.4, 7, top, 7, '#8a9c85', .7); screw(-w / 2 + 5.2 + i * 7.5, d * .35 + 3.4, top + 7, 1.7); }
      chip(-w * .2, -d * .3, 4, 5, top, .8);
    } else {
      chip(0, 0, w * .35, d * .3, top, 1.1, part.id === 'mpu6050' ? 'MPU' : '4056');
      for (let i = 0; i < 8; i++) passive((i % 2 ? 1 : -1) * w * .31, -d / 2 + 5 + Math.floor(i / 2) * 3.3, top);
      if (part.id === 'tp4056') usb(0, -d / 2 - .5, top);
    }
    headers(top);
  } else if (part.id.startsWith('resistor-') || part.id === 'diode-1n4007') {
    const diode = part.id.startsWith('diode');
    slab(-.28, -d / 2 - 3, .56, d + 6, -.25, .5, METAL, .08);
    slab(-w / 2, -d * .26, w, d * .52, -h * .3, h * .75, diode ? CHIP : '#b3a18a', Math.min(1.3, w / 2));
    const colours = diode ? ['#b6b9b2'] : part.id === 'resistor-220' ? ['#a47964', '#a47964', '#514b41', '#b7a276'] : part.id === 'resistor-10k' ? ['#675e4d', '#4b5149', '#a47964', '#b7a276'] : ['#675e4d', '#4b5149', '#a47c61', '#b7a276'];
    colours.forEach((colour, i) => slab(-w / 2 -.015, -d * .22 + i * d * .12, w + .03, .55, h * .45, .05, colour, .05));
  } else if (part.id === 'led-red' || part.id === 'rgb-led') {
    const count = part.id === 'rgb-led' ? 4 : 2;
    for (let i = 0; i < count; i++) slab(-2.3 + i * 4.6 / Math.max(1, count - 1), -.23, .46, .46, z0 - 4, 5, METAL, .05);
    cyl(0, 0, w / 2, z0 + 1, 1, '#b5a89b');
    cyl(0, 0, w * .43, z0 + 2, h * .59, part.id === 'led-red' ? '#a67f76' : '#bac4b8');
    cyl(0, 0, w * .32, z0 + h * .78, h * .2, part.id === 'led-red' ? '#bc9588' : '#d3d9cf');
  } else if (part.id === 'photoresistor') {
    cyl(0, 0, 3.4, -.8, 1.6, '#bba48c');
    const pts: k.Plane[] = [];
    for (let i = 0; i < 7; i++) pts.push([-2.3 + i * .77, i % 2 ? 1.9 : -1.9]);
    onTop(pts, .83, '#796d5c', .45);
    for (const x of [-2, 2]) slab(x -.25, -.25, .5, .5, -6, 5.2, METAL, .05);
  } else if (part.id === 'push-button') {
    slab(-w / 2, -d / 2, w, d, z0, 2.5, CHIP, .7);
    slab(-w / 2 + .4, -d / 2 + .4, w - .8, d - .8, z0 + 2.5, .8, METAL, .5);
    cyl(0, 0, 3.4, z0 + 3.3, h - 3.3, '#595f58');
    for (const [x, y] of k.corners({ x: -w / 2, y: -d / 2, w, d, r: 0 }, 1.8)) screw(x, y, z0 + 3.32, .7);
    for (const x of [-w / 2 - 1.5, w / 2 -.5]) for (const y of [-d / 3, d / 3]) slab(x, y, 2, .8, z0, .5, METAL, .1);
  } else if (part.id === 'potentiometer') {
    slab(-w / 2, -d / 2, w, d, z0, 4.2, '#899a8e', 1.5);
    cyl(0, 0, 3.6, z0 + 4.2, h - 4.2, '#b1b6a9');
    onTop([[-2.6, 0], [2.6, 0]], z0 + h + .02, CHIP, .7);
    for (let i = 0; i < 3; i++) slab(-3.5 + i * 3.5, d / 2, .7, 3, z0, .5, METAL, .05);
  } else if (part.id === 'piezo-buzzer') {
    cyl(0, 0, w / 2, z0, h, '#4e5b53');
    cyl(0, 0, w * .22, z0 + h + .02, .02, '#263c33');
    label('+', -w * .35, -d * .18, z0 + h + .04, 2.5, '#b6c4b5');
    for (const x of [-2, 2]) slab(x -.25, -.25, .5, .5, z0 - 4, 4, METAL, .05);
  } else if (part.id === 'sg90-servo') {
    slab(-w / 2, -d / 2, w, d, z0, h - 6, '#81968a', 1.5);
    for (const x of [-w / 2 - 4, w / 2]) { slab(x, -d / 2, 4, d, z0 + 3, 2, '#758a7c', .5); screw(x + 2, 0, z0 + 5); }
    slab(-w / 2 + 1, -d / 2 + 1, w - 2, d - 2, z0 + h - 6, 3, '#738a7c', 1);
    cyl(3, 0, 3, z0 + h - 3, 3, METAL);
    slab(-w * .43, -1.5, w * .86, 3, z0 + h, 1, '#dedfd6', 1.4);
    screw(3, 0, z0 + h + 1, .9);
  } else if (part.id === 'water-pump') {
    cyl(0, 0, w / 2, z0, h - 4, '#b9c5b6');
    cyl(0, 0, w * .35, z0 + h - 4, 4, '#8ca18e');
    cyl(0, 0, 2.8, z0 + h, 7, '#a7baa5');
    for (const [x, y] of [[-6, 0], [6, 0]]) screw(x!, y!, z0 + h - 3.9, 1.1);
  } else if (part.id === 'battery-9v' || part.id === 'lipo-37v' || part.id === 'supply-5v') {
    slab(-w / 2, -d / 2, w, d, z0, h, part.id === 'lipo-37v' ? '#bcc1b5' : '#a4ae9a', 2.5);
    slab(-w / 2 + 1, -d / 2 + 1, w - 2, d - 2, z0 + h, .08, '#cbd0c3', 2);
    const title = part.id === 'battery-9v' ? '9 V' : part.id === 'lipo-37v' ? '3.7 V  500 mAh' : '5 V / 1 A';
    label(title, -w / 2 + 4, 0, z0 + h + .12, Math.min(3.3, w / 9), '#6c7864');
    if (part.id === 'battery-9v') {
      for (const x of [-6, 6]) cyl(x, -d / 2 + 4, x < 0 ? 2.8 : 2, z0 + h + .1, 2.1, METAL);
    } else if (part.id === 'lipo-37v') slab(-3.5, -d / 2 - 3, 7, 3.6, z0 + h / 2, 3, '#dbddd1', .4);
    else { slab(-8, -d / 2 - 3, 16, 4, z0 + 2, 5, '#586851', 1); for (let i = 0; i < 6; i++) line(k.planOutline({ x: -w / 2 + 3, y: d / 2 - 12 + i * 1.6, w: w - 6, d: .6, r: .3 }, z0 + h + .15, P), '#a1ac96', .18, [0, d / 2 - 10, z0 + h + .15]); }
  } else if (part.id === 'enclosure-bottom' || part.id === 'enclosure-top') {
    const top = part.id === 'enclosure-top';
    // Open tray / open display bezel: electronics stay visible while editing.
    const thickness = top ? 2.5 : 2;
    if (!top) slab(-w / 2, -d / 2, w, d, z0, 1.6, '#dce0d4', 4);
    const wallZ = top ? z0 : z0 + 1.6;
    const wallH = top ? h : h - 1.6;
    for (const yy of [-d / 2, d / 2 - thickness]) slab(-w / 2, yy, w, thickness, wallZ, wallH, '#dce0d4', 1);
    for (const xx of [-w / 2, w / 2 - thickness]) slab(xx, -d / 2 + thickness, thickness, d - 2 * thickness, wallZ, wallH, '#dce0d4', 1);
    for (const [x, y] of k.corners({ x: -w / 2, y: -d / 2, w, d, r: 0 }, 5)) { cyl(x, y, 2.1, wallZ, wallH, '#c4ccbc'); cyl(x, y, .8, wallZ + wallH, .04, '#7e8f76'); }
    if (top) for (let i = 0; i < 7; i++) slab(w / 2 - 5, -d / 2 + 10 + i * 3, 2, 1, z0 + h, .04, '#a9b69f', .5);
  } else if (part.id === 'screw-m3') {
    cyl(0, 0, 1.5, z0, h - 2, '#a3ad9b');
    for (let i = 0; i < 7; i++) line(k.ring(0, 0, 1.52, z0 + i * .8, P), '#6c7f61', .2, [0, 0, z0 + i * .8]);
    cyl(0, 0, 2.5, z0 + h - 2, 2, '#c1c8b5');
    onTop([[-1.5, 0], [1.5, 0]], z0 + h + .02, '#63765a', .6);
  } else if (part.id === 'wristband') {
    slab(-w / 2, -d / 2, w, d, z0, h, '#abb5a3', 5);
    for (let i = 0; i < 28; i++) onTop([[-w / 2 + 2, -d / 2 + 4 + i * 2.9], [w / 2 - 2, -d / 2 + 4 + i * 2.9]], z0 + h + .02, '#84957c', .3, .55);
    slab(-w / 2 - 1, d / 2 - 9, w + 2, 8, z0 + h, 1.2, '#687c60', 2);
    slab(-w / 2 + 2, d / 2 - 7, w - 4, 4, z0 + h + 1.21, .02, '#acb7a2', 1);
  } else if (part.id === 'usb-cable') {
    // The cable is a bundled USB connection; separate net routes are driven by the project.
    slab(-w / 2, -d * .15, w, d * .48, z0, h * .65, '#717d70', 2);
    slab(-w * .36, -d * .4, w * .72, d * .32, z0 + .5, h * .5, METAL, .6);
    slab(-w * .27, -d * .41, w * .54, .5, z0 + 1.1, h * .28, '#4b584a', .3);
    for (const x of [-2.2, 2.2]) slab(x -.6, -d * .33, 1.2, 2, z0 + h * .52, .1, '#879480', .15);
    for (let i = 0; i < 5; i++) slab(-w * .38, d * .16 + i * 1.1, w * .76, .5, z0 + h * .65, .16, '#566753', .2);
  } else if (part.id === 'jumper-wires') {
    for (let i = 0; i < 5; i++) {
      const y = -d / 2 + 2 + i * 2.6;
      onTop([[-w / 2 + 5, y], [-w / 2 + 10, y - 1.6], [w / 2 - 7, y - 1.6], [w / 2 - 3, y]], z0 + h / 2 + i * .1, ['#9b8275', '#778b80', '#bdab79', '#667a74', '#939b8b'][i], .75);
      for (const x of [-w / 2, w / 2 - 5]) { slab(x, y - .8, 5, 1.6, z0 + 1, 2, CHIP, .3); slab(x + 5, y -.2, 2, .4, z0 + 1.6, .6, GOLD, .03); }
    }
  } else {
    // A readable detailed generic module for future catalog additions.
    const top = pcb(); chip(0, 0, w * .42, d * .35, top, Math.max(.6, h * .2));
    for (let i = 0; i < 6; i++) passive((i % 2 ? -1 : 1) * w * .32, -d * .28 + Math.floor(i / 2) * d * .2, top);
    headers(top);
  }

  marks.sort((a, b) => (supportLevel.get(a.key) ?? 0) - (supportLevel.get(b.key) ?? 0) || a.depth - b.depth || a.key - b.key);
  // All kit solids use closed M/L polygon paths. Their actual projected
  // vertices include pin tips and connectors beyond the catalog body box.
  const vertices = marks.flatMap(mark => {
    const values = (mark.kind === 'solid' ? mark.paths.fill : mark.kind === 'line' ? mark.path : '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const points: k.Flat[] = [];
    for (let i = 0; i + 1 < values.length; i += 2) points.push([values[i], values[i + 1]]);
    return points;
  });
  const left = Math.min(...vertices.map(p => p[0])) - 1.5, right = Math.max(...vertices.map(p => p[0])) + 1.5;
  const upper = Math.min(...vertices.map(p => p[1])) - 1.5, lower = Math.max(...vertices.map(p => p[1])) + 1.5;
  const hitBounds = { x: left, y: upper, width: right - left, height: lower - upper };
  return { marks, silhouette: k.slabOf({ x: -w / 2 - 2.8, y: -d / 2 - 2.8, w: w + 5.6, d: d + 5.6, r: 3 }, z0 - .3, h + .6, P, 6).outline, microParts, transform: orientation.transform, hitBounds };
}

/** Project uses y-up; Anatomy uses z-up. */
export const toAnatomy = ([x, y, z]: Vec3): k.Point3 => [x, -z, y];

/** Euler XYZ matches the existing Three.js pin-anchor convention. */
export function rotateXYZ(point: Vec3, degrees: Vec3): Vec3 {
  const [a, b, c] = degrees.map(v => v * Math.PI / 180);
  const [x, y, z] = point;
  // Three.js Euler XYZ applies the matrix Rx · Ry · Rz to column vectors.
  const xz = x * Math.cos(c) - y * Math.sin(c), yz = x * Math.sin(c) + y * Math.cos(c);
  const xy = xz * Math.cos(b) + z * Math.sin(b), zy = -xz * Math.sin(b) + z * Math.cos(b);
  return [xy, yz * Math.cos(a) - zy * Math.sin(a), yz * Math.sin(a) + zy * Math.cos(a)];
}

/** Re-express the world camera in the part frame, preserving all XYZ rotations.
 * Anatomy then renders real extrusions in that camera; a 2D roll puts them back
 * into the project view. Wire anchors use the same Euler matrix. */
export function partCamera(projection: k.Projection, rotation: Vec3): { projection: k.Projection; transform: string } {
  const c = k.cameraOf(projection);
  const dot = (a: k.Point3, b: k.Point3) => a.reduce((n, v, i) => n + v * b[i], 0);
  const axes = [[1, 0, 0], [0, 0, -1], [0, 1, 0]].map(v => toAnatomy(rotateXYZ(v as Vec3, rotation)));
  const worldRight: k.Point3 = [c.sinA, -c.cosA, 0];
  const worldDown: k.Point3 = [c.cosA * c.sinE, c.sinA * c.sinE, -c.cosE];
  const worldView: k.Point3 = [c.cosA * c.cosE, c.sinA * c.cosE, c.sinE];
  const view = axes.map(axis => dot(axis, worldView));
  const azimuth = Math.atan2(view[1], view[0]);
  const elevation = Math.asin(Math.max(-1, Math.min(1, view[2])));
  const right: k.Point3 = [Math.sin(azimuth), -Math.cos(azimuth), 0];
  const down: k.Point3 = [Math.cos(azimuth) * Math.sin(elevation), Math.sin(azimuth) * Math.sin(elevation), -Math.cos(elevation)];
  const actualRight = axes.map(axis => dot(axis, worldRight)) as k.Point3;
  const actualDown = axes.map(axis => dot(axis, worldDown)) as k.Point3;
  const vals = [dot(actualRight, right), dot(actualDown, right), dot(actualRight, down), dot(actualDown, down)].map(n => Math.abs(n) < 1e-10 ? 0 : Number(n.toFixed(8)));
  return { projection: { origin: [0, 0], scale: 1, azimuth: azimuth * 180 / Math.PI, elevation: elevation * 180 / Math.PI }, transform: `matrix(${vals.join(' ')} 0 0)` };
}
