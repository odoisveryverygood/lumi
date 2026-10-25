'use client';
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useLoader } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ETCH_MODELS, etchModelInstance, setEtchFade } from '@/lib/etch-models';
import type { LibraryPart } from '@/lib/types';
const GOLD = '#cda45e';
const CHIP = '#222b2e';
const SILVER = '#aab1b5';
export type DisplayMode = 'heart' | 'weather' | 'plant' | 'distance' | 'general';
class CadBoundary extends Component<{
    children: ReactNode;
    fallback: ReactNode;
}, {
    failed: boolean;
}> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
/** Real footprint models from Etch, in original dimensions, converted metres → mm. */
function EtchModel({ id, opacity, colour, module = false }: {
    id: string;
    opacity: number;
    colour?: string;
    module?: boolean;
}) {
    const model = ETCH_MODELS[id];
    const gltf = useLoader(GLTFLoader, `/etch-parts/${model.file}`, loader => loader.setMeshoptDecoder(MeshoptDecoder));
    const placed = useMemo(() => {
        const placed = etchModelInstance(gltf.scene);
        placed.object.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(placed.object);
        const center = box.getCenter(new THREE.Vector3());
        // Upstream footprint origins are pad-based. Centre x/z without distorting geometry.
        placed.object.position.set(-center.x, module ? -box.min.y : -center.y, -center.z);
        return placed;
    }, [gltf, module]);
    useLayoutEffect(() => {
        setEtchFade(placed.materials, opacity);
        for (const material of placed.materials) {
            if (material.userData.baseColor instanceof THREE.Color)
                material.color.copy(material.userData.baseColor);
            if (colour && material.metalness < .4 && !material.map)
                material.color.set(colour);
        }
    }, [placed, opacity, colour]);
    useEffect(() => () => placed.materials.forEach(material => material.dispose()), [placed]);
    return <group scale={1000} rotation={model.rotation}><primitive object={placed.object}/></group>;
}
function EtchCad({ id, opacity, fallback, colour, module = false }: {
    id: string;
    opacity: number;
    fallback: ReactNode;
    colour?: string;
    module?: boolean;
}) {
    return <CadBoundary fallback={fallback}><Suspense fallback={fallback}><EtchModel id={id} opacity={opacity} colour={colour} module={module}/></Suspense></CadBoundary>;
}
function Box({ size, position = [0, 0, 0], colour, opacity = 1, metalness = 0, roughness = .5, radius = 0, emissive }: {
    size: [
        number,
        number,
        number
    ];
    position?: [
        number,
        number,
        number
    ];
    colour: string;
    opacity?: number;
    metalness?: number;
    roughness?: number;
    radius?: number;
    emissive?: string;
}) {
    const material = <meshStandardMaterial color={colour} transparent={opacity < 1} opacity={opacity} roughness={roughness} metalness={metalness} emissive={emissive || '#000000'} emissiveIntensity={emissive ? .7 : 0} depthWrite={opacity > .3}/>;
    return radius ? <RoundedBox args={size} radius={Math.min(radius, ...size.map(v => v / 2))} smoothness={2} position={position} castShadow receiveShadow>{material}</RoundedBox> : <mesh position={position} castShadow receiveShadow><boxGeometry args={size}/>{material}</mesh>;
}
function Cylinder({ position, radius, height, colour, opacity = 1, rotation = [0, 0, 0], metalness = 0 }: {
    position: [
        number,
        number,
        number
    ];
    radius: number;
    height: number;
    colour: string;
    opacity?: number;
    rotation?: [
        number,
        number,
        number
    ];
    metalness?: number;
}) {
    return <mesh position={position} rotation={rotation} castShadow><cylinderGeometry args={[radius, radius, height, 20]}/><meshStandardMaterial color={colour} roughness={.45} metalness={metalness} transparent={opacity < 1} opacity={opacity} depthWrite={opacity > .3}/></mesh>;
}
function RepeatedBoxes({ positions, size, colour, opacity }: {
    positions: [
        number,
        number,
        number
    ][];
    size: [
        number,
        number,
        number
    ];
    colour: string;
    opacity: number;
}) {
    const ref = useRef<THREE.InstancedMesh>(null);
    useLayoutEffect(() => {
        if (!ref.current)
            return;
        const matrix = new THREE.Matrix4();
        positions.forEach((position, i) => { matrix.makeTranslation(...position); ref.current!.setMatrixAt(i, matrix); });
        ref.current.instanceMatrix.needsUpdate = true;
        ref.current.computeBoundingSphere();
    }, [positions]);
    return <instancedMesh ref={ref} args={[undefined, undefined, positions.length]}><boxGeometry args={size}/><meshStandardMaterial color={colour} transparent={opacity < 1} opacity={opacity} roughness={.7} depthWrite={opacity > .3}/></instancedMesh>;
}
function Label({ text, position, width, height = 2.8, colour = '#e5eee8', opacity = 1, background }: {
    text: string;
    position: [
        number,
        number,
        number
    ];
    width: number;
    height?: number;
    colour?: string;
    opacity?: number;
    background?: string;
}) {
    const texture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 768;
        canvas.height = 128;
        const ctx = canvas.getContext('2d')!;
        if (background) {
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, 768, 128);
        }
        ctx.fillStyle = colour;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '600 64px ui-monospace, SFMono-Regular, monospace';
        ctx.fillText(text, 384, 67, 730);
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }, [text, colour, background]);
    useEffect(() => () => texture.dispose(), [texture]);
    return <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[width, height]}/><meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} polygonOffset polygonOffsetFactor={-1}/></mesh>;
}
function MountHoles({ width, depth, y, opacity }: {
    width: number;
    depth: number;
    y: number;
    opacity: number;
}) {
    return <>{[-1, 1].flatMap(x => [-1, 1].map(z => <group key={`${x}${z}`} position={[x * (width / 2 - 2.5), y, z * (depth / 2 - 2.5)]}><mesh rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[1.15, .35, 6, 16]}/><meshStandardMaterial color={GOLD} metalness={.7} transparent={opacity < 1} opacity={opacity}/></mesh><Cylinder position={[0, -.1, 0]} radius={.75} height={.3} colour="#18372e" opacity={opacity}/></group>))}</>;
}
function SurfaceParts({ width, depth, y, opacity, seed = 0 }: {
    width: number;
    depth: number;
    y: number;
    opacity: number;
    seed?: number;
}) {
    return <>{Array.from({ length: 10 }, (_, i) => {
            const x = Math.sin(i * 7.41 + seed) * width * .32;
            const z = Math.cos(i * 4.2 + seed) * depth * .32;
            return <group key={i} position={[x, y, z]}><Box size={[i % 2 ? 1.1 : 2.2, .65, .95]} colour={i % 3 ? '#b7aa86' : '#303335'} opacity={opacity}/><Box size={[.35, .68, 1]} position={[-(i % 2 ? .55 : 1.1), 0, 0]} colour={SILVER} opacity={opacity} metalness={.8}/><Box size={[.35, .68, 1]} position={[(i % 2 ? .55 : 1.1), 0, 0]} colour={SILVER} opacity={opacity} metalness={.8}/></group>;
        })}</>;
}
function Pcb({ part, opacity, children }: {
    part: LibraryPart;
    opacity: number;
    children?: React.ReactNode;
}) {
    const [w, , d] = part.size;
    return <><Box size={[w, 1.6, d]} colour={part.colour} opacity={opacity} radius={1}/><MountHoles width={w} depth={d} y={.86} opacity={opacity}/>{children}</>;
}
function HeaderPins({ part, opacity }: {
    part: LibraryPart;
    opacity: number;
}) {
    return <>{part.pins.map((pin, i) => <group key={`${pin.name}-${i}`} position={pin.position}><Box size={[1.9, 1.3, 1.9]} position={[0, -.4, 0]} colour="#1e262b" opacity={opacity}/><Box size={[.65, 3.5, .65]} position={[0, .9, 0]} colour={GOLD} opacity={opacity} metalness={.8} roughness={.3}/></group>)}</>;
}
function Microcontroller({ part, opacity }: {
    part: LibraryPart;
    opacity: number;
}) {
    const [w, , d] = part.size;
    const esp = part.id.includes('esp32');
    const uno = part.id.includes('uno');
    const pico = part.id.includes('pico');
    const chipW = esp ? w * .64 : w * .37;
    return <Pcb part={part} opacity={opacity}>
    {!esp && <Box size={[chipW, 1.2, d * .28]} position={[0, 1.5, -d * .03]} colour={CHIP} opacity={opacity} metalness={.1} radius={.45}/>}
    {esp && <><group position={[0, .85, -d * .14]}><EtchCad id="esp32-wroom-module" opacity={opacity} module fallback={<><Box size={[chipW, 2.5, d * .4]} position={[0, 2.1, d * .11]} colour="#bac0bf" opacity={opacity} metalness={.7} radius={.45}/><Box size={[w * .7, .1, d * .16]} position={[0, .9, -d * .25]} colour="#202a24" opacity={opacity}/></>}/></group><Label text="ESP32-WROOM" position={[0, 4.02, -d * .06]} width={w * .52} height={2} opacity={opacity} colour="#566158"/></>}
    {!esp && <><Label text={pico ? 'RP2040' : uno ? 'ATMEGA328P' : 'ATMEGA328'} position={[0, 2.14, -d * .01]} width={chipW * .88} height={1.7} opacity={opacity}/>{[-1, 1].flatMap(side => Array.from({ length: 8 }, (_, i) => <Box key={`${side}-${i}`} size={[1.1, .3, .5]} position={[side * (chipW / 2 + .5), 1.15, d * -.14 + i * d * .037]} colour={SILVER} metalness={.8} opacity={opacity}/>))}</>}
    <Box size={[uno ? 12 : w * .34, uno ? 10 : 3, uno ? 13 : 5.5]} position={[uno ? -w * .25 : 0, uno ? 5.7 : 2, d / 2 - 2]} colour={SILVER} opacity={opacity} metalness={.8} radius={.35}/>
    <Box size={[uno ? 9 : w * .25, uno ? 6.3 : 1.65, .35]} position={[uno ? -w * .25 : 0, uno ? 5.7 : 2, d / 2 + (uno ? 4.6 : .8)]} colour="#333c3e" opacity={opacity} radius={.2}/>
    {uno && <><Box size={[9, 9, 13]} position={[w * .29, 5, d * .39]} colour="#2e3532" opacity={opacity} radius={.8}/><Cylinder position={[w * .29, 5, d * .49]} radius={2.7} height={4} rotation={[Math.PI / 2, 0, 0]} colour="#a7b0aa" metalness={.8} opacity={opacity}/><Cylinder position={[w * .29, 5, d * .52]} radius={1.7} height={1} rotation={[Math.PI / 2, 0, 0]} colour="#1f2823" opacity={opacity}/><Label text="UNO  R3" position={[0, .91, -d * .38]} width={w * .4} height={4} opacity={opacity}/></>}
    <Box size={[3.5, 1.7, 4]} position={[-w * .29, 1.6, d * .29]} colour="#aeb1a9" opacity={opacity} radius={.5}/>
    <Cylinder position={[-w * .29, 2.65, d * .29]} radius={1} height={.6} colour="#343a38" opacity={opacity}/>
    <SurfaceParts width={w * .75} depth={d * .7} y={1.3} opacity={opacity}/>
    <Box size={[1.5, .8, 1]} position={[w * .3, 1.5, d * .28]} colour="#74b891" emissive={opacity > .6 ? '#40bf86' : undefined} opacity={opacity}/>
    <Label text={esp ? 'DEVKIT  V1.0' : pico ? 'Raspberry Pi Pico' : 'ARDUINO'} position={[0, .88, -d * .31]} width={w * .76} height={2.1} opacity={opacity}/>
    <HeaderPins part={part} opacity={opacity}/>
  </Pcb>;
}
function Display({ part, opacity }: {
    part: LibraryPart;
    opacity: number;
    live?: boolean;
    displayMode?: DisplayMode;
}) {
    const [w, , d] = part.size;
    const lcd = part.id.includes('lcd');
    return <Pcb part={part} opacity={opacity}>
        <Box size={[w * .88, 1.6, d * .74]} position={[0, 1.7, -d * .05]} colour="#262e35" opacity={opacity} radius={.5} />
        <Box size={[w * .77, .08, d * .61]} position={[0, 2.55, -d * .05]} colour={lcd ? '#9cbe77' : '#101b23'} opacity={opacity} radius={.3} />
        <Label text={lcd ? 'FIRMWARE PREVIEW' : 'PREVIEW'} position={[0, 2.65, -d * .14]} width={w * .65} height={lcd ? 3 : 3.5} colour={lcd ? '#324330' : '#a5bac7'} opacity={opacity} />
        <Label text="CONNECT HARDWARE" position={[0, 2.66, d * .08]} width={w * .64} height={lcd ? 2.7 : 1.6} colour={lcd ? '#324330' : '#7d909f'} opacity={opacity} />
        {!lcd && <Label text="OFFLINE" position={[0, 2.66, d * .23]} width={w * .28} height={1.25} colour="#617483" opacity={opacity} />}
        <HeaderPins part={part} opacity={opacity} />
    </Pcb>;
}
function Breadboard({ part, opacity }: {
    part: LibraryPart;
    opacity: number;
}) {
    const [w, h, d] = part.size;
    const holes = useMemo(() => {
        const positions: [
            number,
            number,
            number
        ][] = [];
        const cols = Math.min(28, Math.floor(w / 2.54) - 2);
        for (let c = 0; c < cols; c++)
            for (let r = 0; r < 10; r++)
                positions.push([(c - (cols - 1) / 2) * 2.54, h / 2 + .05, (r < 5 ? r - 5 : r - 4) * 2.54]);
        return positions;
    }, [w, h]);
    return <><Box size={[w, h, d]} colour="#f4f1e8" opacity={opacity} radius={1.4}/><Box size={[w - 4, .2, 2.1]} position={[0, h / 2 + .08, 0]} colour="#dcd8cb" opacity={opacity}/>
    <RepeatedBoxes positions={holes} size={[.88, .11, .88]} colour="#9b9d94" opacity={opacity}/>
    {[-1, 1].flatMap(side => [0, 1].map(row => <group key={`${side}-${row}`}><Box size={[w - 5, .12, .22]} position={[0, h / 2 + .09, side * (d / 2 - 4 - row * 3.2)]} colour={row ? '#de795e' : '#72a0b9'} opacity={opacity}/>{Array.from({ length: Math.min(24, Math.floor(w / 3)) }, (_, i) => <Box key={i} size={[.8, .12, .8]} position={[(i - 11.5) * 2.8, h / 2 + .1, side * (d / 2 - 5.5 - row * 3.2)]} colour="#9b9d94" opacity={opacity}/>)}</group>))}
    <Label text="a   b   c   d   e         f   g   h   i   j" position={[-w * .41, h / 2 + .2, 0]} width={d * .67} height={1.4} colour="#aaa99d" opacity={opacity}/>
  </>;
}
function Sensor({ part, opacity }: {
    part: LibraryPart;
    opacity: number;
}) {
    const [w, h, d] = part.size;
    if (part.id === 'soil-moisture')
        return <><Box size={[w, 1.6, d]} colour={part.colour} opacity={opacity} radius={2}/>{[-1, 1].map(side => <Box key={side} size={[w * .32, .15, d * .61]} position={[side * w * .23, .88, d * .12]} colour="#a98c47" opacity={opacity} radius={1}/>)}<Box size={[w * .45, 1.2, 7]} position={[0, 1.5, -d * .34]} colour={CHIP} opacity={opacity}/><Label text="CAPACITIVE SOIL" position={[0, .95, -d * .2]} width={w * .8} height={2.2} opacity={opacity}/><HeaderPins part={part} opacity={opacity}/></>;
    if (part.id === 'dht22')
        return <>
            <Box size={[w, h - 1.5, d]} position={[0, -.75, 0]} colour="#d8dcd8" radius={.8} opacity={opacity} />
            <Box size={[w - 2.2, .2, d * .74]} position={[0, h / 2 - 1.5, -d * .045]} colour="#404b4a" opacity={opacity} />
            {[-1, 1].map(side => <group key={side}>
                <Box size={[1.1, 1.5, d]} position={[side * (w / 2 - .55), h / 2 - .75, 0]} colour="#e5e8e2" opacity={opacity} radius={.2} />
                <Box size={[w - 2.2, 1.5, 1.4]} position={[0, h / 2 - .75, side * (d / 2 - .7)]} colour="#e5e8e2" opacity={opacity} radius={.15} />
                {Array.from({ length: 7 }, (_, i) => <Box key={i} size={[.12, h * .48, .85]} position={[side * (w / 2 + .03), .25, (i - 3) * 2.3 - 1]} colour="#616c68" opacity={opacity} />)}
            </group>)}
            {Array.from({ length: 9 }, (_, i) => <Box key={i} size={[w - 2.2, 1.5, .85]} position={[0, h / 2 - .75, -d * .36 + i * d * .073]} colour="#e8ebe5" opacity={opacity} radius={.14} />)}
            <Box size={[w - 2.2, 1.5, d * .23]} position={[0, h / 2 - .75, d * .365]} colour="#e5e8e2" opacity={opacity} />
            <Label text="DHT22" position={[0, h / 2 + .03, d * .365]} width={w * .65} height={2.1} colour="#77847d" opacity={opacity} />
            <HeaderPins part={part} opacity={opacity} />
        </>;
    if (part.id === 'pir-motion')
        return <Pcb part={part} opacity={opacity}><mesh position={[0, 2, 0]} castShadow><sphereGeometry args={[Math.min(w, d) * .4, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]}/><meshStandardMaterial color="#edf0e7" flatShading transparent opacity={opacity}/></mesh><HeaderPins part={part} opacity={opacity}/></Pcb>;
    return <Pcb part={part} opacity={opacity}>
    {part.id === 'hc-sr04' ? <>{[-1, 1].map(side => <group key={side} position={[side * w * .28, h / 2, 0]}><Cylinder position={[0, 0, 0]} radius={d * .37} height={h} colour={SILVER} opacity={opacity} metalness={.7}/><Cylinder position={[0, h / 2 + .1, 0]} radius={d * .3} height={.3} colour="#344144" opacity={opacity}/>{[.55, .73, .9].map(r => <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, h / 2 + .3, 0]}><torusGeometry args={[d * .3 * r, .14, 5, 20]}/><meshStandardMaterial color="#9caaa8" metalness={.8} transparent opacity={opacity}/></mesh>)}</group>)}</> : part.id === 'max30102' ? <><Box size={[w * .47, 2.4, d * .42]} position={[0, 2, 0]} colour="#c1b9ae" metalness={.7} opacity={opacity} radius={.5}/><Box size={[w * .36, .25, d * .29]} position={[0, 3.3, 0]} colour="#28171e" opacity={opacity} radius={.4}/><Box size={[2.8, .3, 3]} position={[-w * .07, 3.5, 0]} colour="#9d2e41" emissive={opacity > .6 ? '#d3384b' : undefined} opacity={opacity}/><Box size={[1.6, .3, 3]} position={[w * .1, 3.5, 0]} colour="#2e3938" opacity={opacity}/></> : <><Box size={[w * .38, 1.3, d * .32]} position={[0, 1.5, 0]} colour={CHIP} opacity={opacity}/><SurfaceParts width={w * .8} depth={d * .8} y={1.2} opacity={opacity}/></>}
    <HeaderPins part={part} opacity={opacity}/>
    <Label text={part.id.toUpperCase()} position={[0, .92, -d * .36]} width={w * .75} height={1.9} opacity={opacity}/>
  </Pcb>;
}
function Enclosure({ part, opacity }: {
    part: LibraryPart;
    opacity: number;
}) {
    const [w, h, d] = part.size;
    const lid = part.id.includes('top');
    const colour = '#d5dbd2';
    return <>
    <Box size={[w, 1.6, d]} position={[0, -h / 2 + .8, 0]} colour={colour} radius={.65} opacity={opacity}/>
    {[-1, 1].map(side => <group key={side}><Box size={[w, h, 1.8]} position={[0, 0, side * (d / 2 - .9)]} colour={colour} opacity={opacity} radius={.7}/><Box size={[1.8, h, d - 3.6]} position={[side * (w / 2 - .9), 0, 0]} colour={colour} opacity={opacity} radius={.7}/></group>)}
    {[-1, 1].flatMap(x => [-1, 1].map(z => <group key={`${x}${z}`} position={[x * (w / 2 - 5), 0, z * (d / 2 - 5)]}><Cylinder position={[0, 0, 0]} radius={2.3} height={h * .95} colour="#c2cabc" opacity={opacity}/><Cylinder position={[0, h / 2 + .01, 0]} radius={.9} height={.12} colour="#7a897b" opacity={opacity}/></group>))}
    {lid ? <><Box size={[w * .35, .13, d * .25]} position={[w * .19, -h / 2 + 1.68, -d * .12]} colour="#a6b7ab" opacity={opacity} radius={1}/>{Array.from({ length: 7 }, (_, i) => <Box key={i} size={[w * .25, .1, 1]} position={[-w * .21, -h / 2 + 1.69, (i - 3) * 3]} colour="#849588" opacity={opacity}/>)}<Label text="PART / EXPLODE" position={[0, -h / 2 + 1.73, d * .28]} width={w * .35} height={3} colour="#8c9c8b" opacity={opacity}/></> : <><Box size={[1, 3.6, 10]} position={[-w / 2, 1.2, d * .2]} colour="#7c8c80" opacity={opacity}/><Label text="01  /  FOUNDATION" position={[0, -h / 2 + 1.7, d * .3]} width={w * .36} height={2.6} colour="#91a08f" opacity={opacity}/></>}
  </>;
}
function Power({ part, opacity }: {
    part: LibraryPart;
    opacity: number;
}) {
    const [w, h, d] = part.size;
    if (part.id === 'supply-5v')
        return <><Box size={[w, h, d]} colour="#424a47" radius={3} opacity={opacity}/><Box size={[w * .78, .2, d * .5]} position={[0, h / 2 + .1, 0]} colour="#6c7770" opacity={opacity} radius={1}/><Label text="5V  /  1A" position={[0, h / 2 + .25, -d * .08]} width={w * .56} height={5} opacity={opacity}/><Label text="REGULATED DC" position={[0, h / 2 + .25, d * .1]} width={w * .56} height={2.3} opacity={opacity}/><Cylinder position={[0, 0, d * .57]} radius={2} height={d * .2} rotation={[Math.PI / 2, 0, 0]} colour="#333c37" opacity={opacity}/>{[-1, 1].map(side => <Box key={side} size={[3.5, 1.5, 10]} position={[side * 7, -h * .15, -d * .55]} colour={SILVER} metalness={.8} opacity={opacity}/>)}</>;
    if (part.id === 'tp4056')
        return <Pcb part={part} opacity={opacity}><Box size={[w * .38, 2.7, d * .2]} position={[0, 2, d * .43]} colour={SILVER} metalness={.8} opacity={opacity}/><Box size={[5, 1.3, 6]} position={[0, 1.5, 0]} colour={CHIP} opacity={opacity}/><HeaderPins part={part} opacity={opacity}/></Pcb>;
    if (part.id.includes('usb'))
        return <><Box size={[w * .4, h, d * .65]} colour="#d1d7d2" opacity={opacity} radius={1}/><Box size={[w * .3, h * .6, d * .3]} position={[0, 0, -d * .42]} colour={SILVER} metalness={.8} opacity={opacity}/><Box size={[w * .18, h * .6, d * .6]} position={[0, 0, d * .55]} colour="#c2c9c2" opacity={opacity} radius={.8}/><Label text="USB" position={[0, h / 2 + .04, 0]} width={w * .28} height={2} colour="#829184" opacity={opacity}/></>;
    return <><Box size={[w, h, d]} colour={part.id.includes('lipo') ? '#b6bfc0' : '#343d41'} opacity={opacity} radius={1.8} metalness={.35}/><Box size={[w * .97, .15, d * .64]} position={[0, h / 2 + .1, 0]} colour={part.id.includes('lipo') ? '#dadbd1' : '#c3a16e'} opacity={opacity}/><Label text={part.id.includes('lipo') ? 'LiPo  3.7V' : '9V  /  POWER'} position={[0, h / 2 + .22, 0]} width={w * .83} height={3.5} colour={part.id.includes('lipo') ? '#526b64' : '#f2ead7'} opacity={opacity}/>{[-1, 1].map(side => <Cylinder key={side} position={[side * w * .22, h / 2 + 1.3, -d * .35]} radius={1.8} height={2.3} colour={SILVER} metalness={.7} opacity={opacity}/>)}</>;
}
function Passive({ part, opacity }: {
    part: LibraryPart;
    opacity: number;
}) {
    const [w, h, d] = part.size;
    if (part.id === 'photoresistor')
        return <><Cylinder position={[0, 0, 0]} radius={w / 2} height={h * .6} colour="#c89e69" opacity={opacity}/><mesh position={[0, h * .31, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[w * .36, .32, 5, 20]}/><meshStandardMaterial color="#814d36" transparent opacity={opacity}/></mesh>{Array.from({ length: 5 }, (_, i) => <Box key={i} size={[w * .57, .1, .28]} position={[0, h * .32, (i - 2) * .75]} colour="#754a34" opacity={opacity}/>)}<HeaderPins part={part} opacity={opacity}/></>;
    if (part.id.includes('screw'))
        return <><Cylinder position={[0, -h * .17, 0]} radius={w * .26} height={h * .7} colour={SILVER} metalness={.9} opacity={opacity}/><Cylinder position={[0, h * .25, 0]} radius={w / 2} height={h * .2} colour={SILVER} metalness={.9} opacity={opacity}/><Box size={[w * .7, .12, .5]} position={[0, h * .35 + .05, 0]} colour="#56615e" opacity={opacity}/><Box size={[.5, .12, w * .7]} position={[0, h * .35 + .07, 0]} colour="#56615e" opacity={opacity}/></>;
    if (part.id.includes('resistor') || part.id.includes('diode'))
        return <><Cylinder position={[0, 0, 0]} radius={Math.min(h, w) * .46} height={d * .55} colour={part.id.includes('diode') ? '#293035' : '#c8b99b'} rotation={[Math.PI / 2, 0, 0]} opacity={opacity}/>{[-1, 1].map(side => <Box key={side} size={[.55, .55, d * .3]} position={[0, 0, side * d * .36]} colour={SILVER} metalness={.8} opacity={opacity}/>)}{(part.id.includes('diode') ? [.17] : [-.17, -.07, .05, .17]).map((z, i) => <Cylinder key={i} position={[0, 0, d * z]} radius={Math.min(h, w) * .48} height={d * .04} colour={part.id.includes('diode') ? '#d0d4c8' : ['#a2513c', '#734f37', '#34332a', GOLD][i]} rotation={[Math.PI / 2, 0, 0]} opacity={opacity}/>)}</>;
    return <Box size={[w, h, d]} colour={part.colour} opacity={opacity} radius={1}/>;
}
function Output({ part, opacity }: {
    part: LibraryPart;
    opacity: number;
}) {
    const [w, h, d] = part.size;
    if (part.id === 'potentiometer')
        return <><Cylinder position={[0, -h * .22, 0]} radius={w / 2} height={h * .5} colour="#6e99b1" opacity={opacity}/><Cylinder position={[0, h * .18, 0]} radius={w * .18} height={h * .5} colour={SILVER} metalness={.75} opacity={opacity}/><Box size={[w * .3, .3, .6]} position={[0, h * .45, 0]} colour="#546361" opacity={opacity}/><HeaderPins part={part} opacity={opacity}/></>;
    if (part.id === 'water-pump')
        return <><Cylinder position={[0, 0, -d * .07]} radius={w * .43} height={d * .58} rotation={[Math.PI / 2, 0, 0]} colour="#b5c7c5" opacity={opacity}/><Cylinder position={[0, 0, d * .26]} radius={w * .5} height={d * .19} rotation={[Math.PI / 2, 0, 0]} colour="#d5ded9" opacity={opacity}/><Cylinder position={[w * .38, h * .24, d * .23]} radius={2.8} height={w * .5} rotation={[0, 0, Math.PI / 2]} colour="#d4ddd7" opacity={opacity}/><Cylinder position={[0, 0, d * .42]} radius={3} height={d * .19} rotation={[Math.PI / 2, 0, 0]} colour="#d4ddd7" opacity={opacity}/><Label text="5V DC" position={[0, w * .43 + .1, -d * .1]} width={w * .6} height={3} colour="#607e76" opacity={opacity}/><HeaderPins part={part} opacity={opacity}/></>;
    if (part.id.includes('led'))
        return <><Cylinder position={[0, -h * .13, 0]} radius={w * .48} height={h * .4} colour={part.id === 'rgb-led' ? '#e2e9e3' : '#bd3e42'} opacity={opacity * .9}/><mesh position={[0, h * .07, 0]} castShadow><sphereGeometry args={[w * .48, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]}/><meshStandardMaterial color={part.id === 'rgb-led' ? '#c3d6c6' : '#d85053'} emissive="#d34d4f" emissiveIntensity={.4} transparent opacity={opacity * .85}/></mesh><HeaderPins part={part} opacity={opacity}/></>;
    if (part.id.includes('buzzer'))
        return <><Cylinder position={[0, 0, 0]} radius={w / 2} height={h} colour="#293230" opacity={opacity}/><Cylinder position={[0, h / 2 + .1, 0]} radius={w * .11} height={.2} colour="#0b1512" opacity={opacity}/><Label text="+" position={[w * .24, h / 2 + .15, 0]} width={2} height={2} opacity={opacity}/><HeaderPins part={part} opacity={opacity}/></>;
    if (part.id.includes('servo'))
        return <><Box size={[w, h * .75, d]} colour="#2b6792" opacity={opacity * .95} radius={1}/><Cylinder position={[0, h * .45, -d * .18]} radius={3} height={4} colour="#e3e2d4" opacity={opacity}/><Box size={[w * 1.5, 1.5, 3.5]} position={[0, h * .63, -d * .18]} colour="#e3e2d4" opacity={opacity} radius={.7}/><Label text="SG90" position={[0, h * .38, d * .2]} width={w * .7} height={3} opacity={opacity}/></>;
    if (part.id.includes('button'))
        return <><Box size={[w, h * .55, d]} colour="#9da5a0" opacity={opacity} radius={.5}/><Cylinder position={[0, h * .35, 0]} radius={w * .28} height={h * .5} colour="#3e5353" opacity={opacity}/><HeaderPins part={part} opacity={opacity}/></>;
    if (part.id.includes('relay'))
        return <Pcb part={part} opacity={opacity}><Box size={[w * .7, h * .8, d * .57]} position={[0, h * .4, 0]} colour="#316a9b" opacity={opacity} radius={.6}/><Label text="SRD  5V DC" position={[0, h * .81, 0]} width={w * .62} height={2.7} opacity={opacity}/><HeaderPins part={part} opacity={opacity}/></Pcb>;
    return <><Box size={[w, h, d]} colour={part.colour} opacity={opacity} radius={1}/><HeaderPins part={part} opacity={opacity}/></>;
}
function ProceduralPartModel({ part, opacity = 1, live = false, displayMode = 'general' }: {
    part: LibraryPart;
    opacity?: number;
    live?: boolean;
    displayMode?: DisplayMode;
}) {
    if (part.id === 'wristband')
        return <><Box size={[part.size[0], part.size[1], part.size[2]]} colour="#768f86" radius={1} opacity={opacity}/><Box size={[part.size[0] * .84, .2, part.size[2] * .3]} position={[0, part.size[1] / 2 + .1, part.size[2] * .24]} colour="#536f62" opacity={opacity} radius={1}/><Box size={[part.size[0] * 1.2, 3, 4]} position={[0, 1, -part.size[2] * .4]} colour="#c2cbbd" metalness={.5} opacity={opacity}/><Label text="LOOP / STRAP" position={[0, part.size[1] / 2 + .2, 0]} width={part.size[0] * .8} height={2.4} opacity={opacity}/></>;
    if (part.id === 'jumper-wires')
        return <>{Array.from({ length: 7 }, (_, i) => <group key={i} position={[(i - 3) * 3.5, 0, 0]}><Box size={[1.2, 1.2, part.size[2]]} colour={['#c77d68', '#d3b366', '#738e80', '#7091a0', '#a7a691', '#535d5c', '#b9b9aa'][i]} opacity={opacity} radius={.5}/>{[-1, 1].map(side => <group key={side}><Box size={[2.3, 3, 3.5]} position={[0, .3, side * part.size[2] / 2]} colour="#303b36" opacity={opacity}/><Box size={[.65, .65, 4]} position={[0, .3, side * (part.size[2] / 2 + 3.3)]} colour={GOLD} metalness={.8} opacity={opacity}/></group>)}</group>)}</>;
    if (part.category === 'enclosure')
        return part.id.includes('screw') ? <Passive part={part} opacity={opacity}/> : <Enclosure part={part} opacity={opacity}/>;
    if (part.category === 'microcontroller')
        return <Microcontroller part={part} opacity={opacity}/>;
    if (part.category === 'display')
        return <Display part={part} opacity={opacity} live={live} displayMode={displayMode}/>;
    if (part.id === 'breadboard')
        return <Breadboard part={part} opacity={opacity}/>;
    if (part.category === 'sensor')
        return <Sensor part={part} opacity={opacity}/>;
    if (part.category === 'power' || part.id.includes('usb'))
        return <Power part={part} opacity={opacity}/>;
    if (part.category === 'passive' || part.id.includes('screw'))
        return <Passive part={part} opacity={opacity}/>;
    if (['output', 'input'].includes(part.category))
        return <Output part={part} opacity={opacity}/>;
    return <><Box size={part.size} colour={part.colour} opacity={opacity} radius={.7}/><HeaderPins part={part} opacity={opacity}/></>;
}
export default function PartModel(props: {
    part: LibraryPart;
    opacity?: number;
    live?: boolean;
    displayMode?: DisplayMode;
    colour?: string;
}) {
    const opacity = props.opacity ?? 1;
    const fallback = <ProceduralPartModel {...props} part={props.colour ? { ...props.part, colour: props.colour } : props.part}/>;
    if (ETCH_MODELS[props.part.id])
        return <EtchCad id={props.part.id} colour={props.colour} opacity={opacity} fallback={fallback}/>;
    return fallback;
}
