/**
 * Adapted from PranavAchar01/etch @ c548129ec5ed13f59f76b0a852a5dd03b728825b:
 * deploy/etch-app/js/editor/build-anim/parts3d.js (partMaterial, instance, setFade).
 * Original implementation by the Etch authors. Imported with user-stated permission.
 * Each placed part owns its materials; geometries and textures remain shared.
 */
import * as THREE from 'three';
import type { Vec3 } from './types';
export const ETCH_MODELS: Record<string, {
    file: string;
    rotation?: [
        number,
        number,
        number
    ];
}> = {
    'raspberry-pi-pico': { file: 'Module__RaspberryPi_Pico_Common_THT.glb' },
    'led-red': { file: 'LED_THT__LED_D5.0mm.glb' },
    'rgb-led': { file: 'LED_THT__LED_D5.0mm-4_RGB_Wide_Pins.glb' },
    'push-button': { file: 'Button_Switch_THT__SW_PUSH_6mm.glb' },
    'piezo-buzzer': { file: 'Buzzer_Beeper__Buzzer_12x9.5RM7.6.glb' },
    'photoresistor': { file: 'OptoDevice__R_LDR_5.0x4.1mm_P3mm_Vertical.glb' },
    'diode-1n4007': { file: 'Diode_THT__D_DO-41_SOD81_P10.16mm_Horizontal.glb', rotation: [0, Math.PI / 2, 0] },
    'esp32-wroom-module': { file: 'RF_Module__ESP32-WROOM-32.glb' },
    ...Object.fromEntries(['resistor-220', 'resistor-1k', 'resistor-10k'].map(id => [id, {
            file: 'Resistor_THT__R_Axial_DIN0207_L6.3mm_D2.5mm_P10.16mm_Horizontal.glb',
            rotation: [0, Math.PI / 2, 0] as [
                number,
                number,
                number
            ],
        }])),
};

/** Pad-plane positions after the exact same centering/rotation as EtchModel.
 * Footprint pad coordinates and bounds are retained in public/etch-parts/index.json.
 * Module variants rendered procedurally continue to use their library anchors. */
export function etchPinPosition(id: string, pin: string): Vec3 | null {
    if (id === 'raspberry-pi-pico') {
        if (pin === 'USB') return [0, 2, -25.2];
        const left: Record<string, number> = { GP0: 0, GP1: 1, GND: 2, GP2: 3, GP3: 4, GP4: 5, GP5: 6, GP6: 8, GP7: 9, GP8: 10, GP9: 11, GP10: 13, GP11: 14, GP12: 15, GP13: 16, GP14: 18, GP15: 19 };
        const right: Record<string, number> = { VSYS: 1, '3V3': 4, GP28: 6, GP27: 8, GP26: 9, GP22: 11, GP21: 13, GP20: 14, GP19: 15, GP18: 16, GP17: 18, GP16: 19 };
        if (pin in left) return [-8.89, 3, left[pin] * 2.54 - 23.48];
        if (pin in right) return [8.89, 3, right[pin] * 2.54 - 23.48];
        return null;
    }
    const pad = (x: number, y: number, z: number, center: Vec3, rotate = false): Vec3 => {
        const v = new THREE.Vector3(x - center[0], y - center[1], z - center[2]);
        if (rotate) v.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
        return v.toArray() as Vec3;
    };
    if (id === 'led-red') {
        if (pin === 'CATHODE') return pad(0, 0, 0, [1.47, 4.55, 0]);
        if (pin === 'ANODE') return pad(2.54, 0, 0, [1.47, 4.55, 0]);
    }
    if (id === 'rgb-led') {
        const x: Record<string, number> = { R: 0, CATHODE: 2.159, G: 4.318, B: 6.477 };
        if (pin in x) return pad(x[pin], 0, 0, [3.25, 4, 0]);
    }
    if (id.startsWith('resistor-') && (pin === 'A' || pin === 'B')) return pad(pin === 'A' ? 0 : 10.16, 0, 0, [5.08, -.25, 0], true);
    if (id === 'diode-1n4007' && (pin === 'ANODE' || pin === 'CATHODE')) return pad(pin === 'CATHODE' ? 0 : 10.16, 0, 0, [5.08, .355, 0], true);
    if (id === 'push-button' && (pin === 'A' || pin === 'B')) return pad(pin === 'A' ? 0 : 6.5, 0, 0, [3.15, .4, 2.25]);
    if (id === 'piezo-buzzer' && (pin === 'PLUS' || pin === 'MINUS')) return pad(pin === 'PLUS' ? 0 : 7.6, 0, 0, [3.8, 3.265, 0]);
    if (id === 'photoresistor' && (pin === 'A' || pin === 'B')) return pad(pin === 'A' ? 0 : 3, 0, 0, [1.5, .5, 0]);
    return null;
}
type PartMaterial = THREE.MeshStandardMaterial & {
    color?: THREE.Color;
    map?: THREE.Texture | null;
};
/** Etch's STEP material conversion: unsaturated, light surfaces render as metal. */
export function etchPartMaterial(src: THREE.Material): THREE.MeshStandardMaterial {
    const source = src as PartMaterial;
    const color = source.color ? source.color.clone() : new THREE.Color(.2, .2, .2);
    const opacity = source.opacity ?? 1;
    const max = Math.max(color.r, color.g, color.b), min = Math.min(color.r, color.g, color.b);
    const metal = source.metalness > .5 || (max > .35 && max - min < .12 && !source.map);
    return new THREE.MeshStandardMaterial({ color, map: source.map || null, metalness: metal ? .6 : .05,
        roughness: metal ? .36 : .48, transparent: opacity < 1, opacity });
}
/** Adaptation of Etch's instance(): independent materials preserve individual fade. */
export function etchModelInstance(template: THREE.Object3D) {
    const object = template.clone(true), materials: THREE.MeshStandardMaterial[] = [];
    object.traverse(child => {
        if (!(child instanceof THREE.Mesh))
            return;
        const convert = (source: THREE.Material) => {
            const material = etchPartMaterial(source);
            material.userData.baseOpacity = material.opacity;
            material.userData.baseTransparent = material.transparent;
            material.userData.baseColor = material.color.clone();
            materials.push(material);
            return material;
        };
        child.material = Array.isArray(child.material) ? child.material.map(convert) : convert(child.material);
        child.castShadow = true;
        child.receiveShadow = true;
    });
    return { object, materials };
}
/** Etch's setFade(), preserving a source material's own transparency. */
export function setEtchFade(materials: THREE.Material[], opacity: number) {
    for (const material of materials) {
        const base = material.userData.baseOpacity ?? 1;
        const transparent = opacity < .999 || material.userData.baseTransparent;
        if (material.transparent !== transparent) {
            material.transparent = transparent;
            material.depthWrite = !transparent || opacity > .6;
            material.needsUpdate = true;
        }
        material.opacity = base * opacity;
    }
}
