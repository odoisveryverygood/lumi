import type { Vec3 } from './types';

export interface HardwareReference {
  id: string; name: string; kind: 'battery' | 'radio'; size: Vec3;
  sourceUrl: string; manufacturer: string; sourceDimensions: string;
  capacityMah?: number; facts: string[]; geometryNote?:string; extraSourceUrl?:string;
}

/** Manufacturer product pages checked 2026-10-21. Size maps their envelope to X/Y/Z, Y up.
 * Envelope geometry is ours; these are not imported manufacturer CAD models. */
export const hardwareCatalog: readonly HardwareReference[] = [
  { id:'adafruit-1317', name:'Adafruit 150 mAh LiPo', kind:'battery', size:[26.02,3.8,19.75], capacityMah:150,
    sourceUrl:'https://www.adafruit.com/product/1317', manufacturer:'Adafruit', sourceDimensions:'19.75 × 26.02 × 3.8 mm',
    facts:['3.7 V nominal; 150 mAh stated capacity','Manufacturer limits charge current to 150 mA or less','Lead and connector routing are outside the checked cell envelope'] },
  { id:'adafruit-1578', name:'Adafruit 500 mAh LiPo', kind:'battery', size:[36,4.75,29], capacityMah:500,
    sourceUrl:'https://www.adafruit.com/product/1578', manufacturer:'Adafruit', sourceDimensions:'29 × 36 × 4.75 mm',
    facts:['3.7 V nominal; 500 mAh stated capacity','Lead and connector routing are outside the checked cell envelope'] },
  { id:'adafruit-4062', name:'Feather nRF52840 Express', kind:'radio', size:[51,7.2,23],
    sourceUrl:'https://www.adafruit.com/product/4062', manufacturer:'Adafruit', sourceDimensions:'51 × 23 × 7.2 mm, without headers',
    facts:['Bluetooth Low Energy and native USB','Built-in LiPo charging; Micro USB connector','Keyboard firmware, matrix interface and retained USB adapter require engineering'] },
  { id:'seeed-xiao-sense', name:'XIAO nRF52840 Sense', kind:'radio', size:[22.482,4.46,17.78],
    sourceUrl:'https://wiki.seeedstudio.com/XIAO_BLE/#seeed-studio-xiao-nrf52840-sense',manufacturer:'Seeed Studio',sourceDimensions:'22.482 × 17.78 × 4.46 mm · published CAD envelope',
    facts:['Envelope measured from the manufacturer-linked XIAO-nRF52840 v15.step; includes protrusions beyond the 21 × 17.8 mm PCB','Bluetooth Low Energy, USB-C and integrated LiPo charging','Manufacturer documents approximately 50/100 mA selectable charge current; wiring and firmware remain unverified','Source model: https://files.seeedstudio.com/wiki/XIAO-BLE/seeed-studio-xiao-nrf52840-3d-model.zip'] },
  { id:'nice-nano',name:'nice!nano BLE controller',kind:'radio',size:[33.52,3.2,18],manufacturer:'Nice Keyboards',sourceUrl:'https://nicekeyboards.com/docs/nice-nano/',sourceDimensions:'33.52 × 18 mm community footprint; 3.2 mm manufacturer height',geometryNote:'Height is manufacturer specified. Horizontal envelope comes from a community KiCad drawing, including its USB outline; it requires manufacturer CAD verification.',extraSourceUrl:'https://github.com/jmding8/keebee.pretty/blob/26253f88830cb92343deba76620c228f0e8a0c58/nice_nano.kicad_mod',facts:['Manufacturer specifies 3.2 mm total thickness and integrated 3.7 V lithium charging','The drawing spans X -19.55 to 13.97 mm including USB, Y -9 to 9 mm; it is a community footprint, not manufacturer CAD','No headers, wires, sockets or mounting hardware are included; these require engineering','Existing RP2040 matrix interface, power tree, retained USB adapter and firmware are unverified'] },
] as const;

export function hardwareById(id: string): HardwareReference {
  const item = hardwareCatalog.find(item => item.id === id);
  if (!item) throw new Error('Select a component from the sourced hardware catalog.');
  return item;
}
