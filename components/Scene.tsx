'use client';
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef, type MutableRefObject, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { GizmoHelper, GizmoViewcube, Grid, OrbitControls, OrthographicCamera, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { PART_MAP } from '@/lib/library';
import { etchPinPosition } from '@/lib/etch-models';
import type { AssemblyMode, Connection, LibraryPart, PartInstance, Project, Vec3, ViewMode } from '@/lib/types';
import PartModel, { type DisplayMode } from './PartModel';
const SCALE = .035;
const WIRE_COLORS: Record<Connection['wireColor'], string> = { red: '#c95c51', black: '#43443d', yellow: '#a57919', blue: '#3279b7', green: '#40855a', white: '#8a8071', orange: '#bc753a' };
type Positions = MutableRefObject<Record<string, THREE.Vector3>>;
type Rotations = MutableRefObject<Record<string, THREE.Euler>>;
type Objects = MutableRefObject<Record<string, THREE.Group>>;
type Drag = MutableRefObject<{
    id: string | null;
    until: number;
}>;
type OrbitControlsImpl = ComponentRef<typeof OrbitControls>;
export interface SceneProps {
    project: Project;
    mode: AssemblyMode;
    explodeAmount: number;
    view: ViewMode;
    selectedId: string | null;
    hoveredId: string | null;
    hiddenIds: string[];
    isolatedId: string | null;
    stepIndex: number;
    completedSteps: number;
    highlightedWire: string | null;
    onSelect: (id: string | null) => void;
    onHover: (id: string | null) => void;
    cameraAction: {
        type: 'home' | 'fit' | 'in' | 'out';
        nonce: number;
    } | null;
    ambient?: boolean;
    tool?: 'select' | 'move' | 'rotate';
    onTransform?: (id: string, position: Vec3, rotation: Vec3) => void;
    showWires?: boolean;
    showLabels?: boolean;
    showEnclosure?: boolean;
    colorOverrides?: Record<string, string>;
    /** Screen position of the active wire's midpoint, for the companion to point at. */
    onActiveWireAnchor?: (anchor: { x: number; y: number; visible: boolean } | null) => void;
}
class SceneBoundary extends Component<{
    children: ReactNode;
}, {
    failed: boolean;
    attempt: number;
}> {
    state = { failed: false, attempt: 0 };
    static getDerivedStateFromError() { return { failed: true }; }
    render() {
        if (this.state.failed)
            return <div style={{ display: 'grid', placeContent: 'center', height: '100%', minHeight: 250, background: '#fff9ed', textAlign: 'center', padding: 24, color: '#7d6547', gap: 12 }}><strong>The 3D view needs a fresh start.</strong><span style={{ fontSize: 12, maxWidth: 290 }}>Your project is saved. Restart the view to reconnect to your graphics hardware.</span><button onClick={() => this.setState(state => ({ failed: false, attempt: state.attempt + 1 }))} style={{ border: '1px solid #d9b98c', color: '#75512a', background: '#f9e2be', borderRadius: 6, padding: '9px 15px', cursor: 'pointer', font: 'inherit', fontSize: 12 }}>Restart 3D view</button></div>;
        return <div key={this.state.attempt} style={{ width: '100%', height: '100%' }}>{this.props.children}</div>;
    }
}
function getLibrary(id: string): LibraryPart | undefined { return PART_MAP[id]; }
function fallbackPart(instance: PartInstance): LibraryPart {
    return { id: instance.libraryId, name: instance.label, category: 'passive', whatItIs: instance.role, size: [20, 5, 20], colour: '#718d80', model: { fallback: 'box' }, pins: [], voltage: { min: 0, max: 5 }, currentMa: 0, priceUsd: 0, buyUrl: '', alternatives: [] };
}
function explodedPosition(part: PartInstance, amount: number): THREE.Vector3 {
    return new THREE.Vector3(...part.assembledPosition).addScaledVector(new THREE.Vector3(...part.explodeDirection), part.explodeDistance * amount);
}
function partAmount(props: Pick<SceneProps, 'mode' | 'explodeAmount'>, done: boolean, active: boolean) {
    return props.mode === 'assembled' ? 0 : props.mode === 'exploded' ? props.explodeAmount : done ? 0 : active ? .3 : .62;
}
function PartLabel({ text, position }: {
    text: string;
    position: Vec3;
}) {
    const label = useMemo(() => {
        const canvas = document.createElement('canvas'), context = canvas.getContext('2d')!;
        context.font = '500 24px '+getComputedStyle(document.body).fontFamily;
        canvas.width = Math.min(900, Math.ceil(context.measureText(text).width) + 28);
        canvas.height = 48;
        context.fillStyle = '#fffaf0';
        context.strokeStyle = '#d7bb93';
        context.beginPath();
        context.roundRect(1, 1, canvas.width - 2, 46, 5);
        context.fill();
        context.stroke();
        context.font = '500 24px '+getComputedStyle(document.body).fontFamily;
        context.fillStyle = '#715434';
        context.textBaseline = 'middle';
        context.fillText(text, 14, 25, canvas.width - 28);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        return { texture, aspect: canvas.width / canvas.height };
    }, [text]);
    useEffect(() => () => label.texture.dispose(), [label]);
    return <sprite position={position} scale={[4.5 * label.aspect, 4.5, 1]} renderOrder={20} raycast={() => { }}><spriteMaterial map={label.texture} transparent opacity={.98} depthTest={false} depthWrite={false}/></sprite>;
}
/** Adapted directly from Etch's board-viewer.js outline(ref), commit c548129e.
 * Original Etch authors. A hard edge pass plus a faint pass behind the component.
 * Selection lines never enter picking. */
function HardOutline({ target, selected, hovered, active }: {
    target: MutableRefObject<THREE.Group | null>;
    selected: boolean;
    hovered: boolean;
    active: boolean;
}) {
    const lines = useRef<THREE.LineSegments[]>([]), meshes = useRef<THREE.Mesh[]>([]);
    const front = useMemo(() => new THREE.LineBasicMaterial({ color: '#c28b47', transparent: true, opacity: .85, depthTest: true, depthWrite: false }), []);
    const back = useMemo(() => new THREE.LineBasicMaterial({ color: '#c28b47', transparent: true, opacity: .12, depthTest: false, depthWrite: false }), []);
    const enabled = selected || hovered || active;
    const clear = () => { lines.current.forEach(line => { line.removeFromParent(); line.geometry.dispose(); }); lines.current = []; meshes.current = []; };
    useFrame(() => {
        if (!target.current)
            return;
        if (!enabled) {
            for (const line of lines.current)
                line.visible = false;
            return;
        }
        const current: THREE.Mesh[] = [];
        target.current.traverse(child => { if (child instanceof THREE.Mesh && !(child instanceof THREE.InstancedMesh) && !child.userData.excludeOutline && child.geometry.attributes.position?.count < 30000)
            current.push(child); });
        if (current.length !== meshes.current.length || current.some((mesh, i) => mesh !== meshes.current[i])) {
            clear();
            meshes.current = current;
            for (const mesh of current) {
                const geometry = new THREE.EdgesGeometry(mesh.geometry, 32);
                const a = new THREE.LineSegments(geometry, front), b = new THREE.LineSegments(geometry, back);
                a.renderOrder = 5;
                b.renderOrder = 6;
                a.raycast = b.raycast = () => { };
                mesh.add(a, b);
                lines.current.push(a, b);
            }
        }
        front.color.set(active ? '#738950' : '#c28b47');
        front.opacity = selected ? .85 : .5;
        for (const line of lines.current)
            line.visible = true;
    });
    useEffect(() => () => { clear(); front.dispose(); back.dispose(); }, [front, back]);
    return null;
}
function Part({ instance, library, targetPosition, positions, rotations, objects, drag, selected, hovered, opacity, showLabel, active, live, displayMode, colour }: {
    instance: PartInstance;
    library: LibraryPart;
    targetPosition: THREE.Vector3;
    positions: Positions;
    rotations: Rotations;
    objects: Objects;
    drag: Drag;
    selected: boolean;
    hovered: boolean;
    opacity: number;
    showLabel: boolean;
    active: boolean;
    live: boolean;
    displayMode: DisplayMode;
    colour?: string;
}) {
    const root = useRef<THREE.Group>(null), model = useRef<THREE.Group>(null), initial = useRef(targetPosition.clone());
    useLayoutEffect(() => {
        if (!root.current)
            return;
        objects.current[instance.id] = root.current;
        root.current.rotation.set(...instance.rotation.map(THREE.MathUtils.degToRad) as Vec3);
        return () => { delete objects.current[instance.id]; delete positions.current[instance.id]; delete rotations.current[instance.id]; };
    }, [instance.id, objects, positions, rotations]);
    useLayoutEffect(() => { if (root.current && drag.current.id !== instance.id)
        root.current.rotation.set(...instance.rotation.map(THREE.MathUtils.degToRad) as Vec3); }, [instance.rotation, drag, instance.id]);
    useFrame((_, delta) => {
        if (!root.current)
            return;
        if (drag.current.id !== instance.id && !(selected && performance.now() < drag.current.until))
            root.current.position.lerp(targetPosition, 1 - Math.exp(-delta * 8));
        positions.current[instance.id] = root.current.position;
        rotations.current[instance.id] = root.current.rotation;
    });
    return <group ref={root} position={initial.current} userData={{ partId: instance.id }}>
    <group ref={model} name="component-geometry"><PartModel part={library} opacity={opacity} live={live} displayMode={displayMode} colour={colour}/></group>
    <HardOutline target={model} selected={selected} hovered={hovered} active={active}/>
    {showLabel && <PartLabel position={[0, library.size[1] / 2 + 6, 0]} text={`${instance.label} · ${library.name.split('(')[0].trim()}`}/>}
  </group>;
}
/** Native canvas picking adapted from Etch board-viewer.js hit()/pointerup.
 * The six-pixel threshold separates clicks from orbiting. Only component meshes
 * are picked, excluding wires, grid, labels and selection helpers. */
function ComponentPicker({ objects, drag, onSelect, onHover, disabled }: {
    objects: Objects;
    drag: Drag;
    onSelect: SceneProps['onSelect'];
    onHover: SceneProps['onHover'];
    disabled: boolean;
}) {
    const { camera, gl } = useThree();
    useEffect(() => {
        if (disabled)
            return;
        const canvas = gl.domElement, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
        const down = { x: 0, y: 0, t: 0, pointer: -1 };
        let hovered: string | null = null;
        const hit = (event: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
            ray.setFromCamera(ndc, camera);
            for (const h of ray.intersectObjects(Object.values(objects.current), true)) {
                if (!(h.object instanceof THREE.Mesh))
                    continue;
                let node: THREE.Object3D | null = h.object;
                while (node) {
                    if (node.userData.partId)
                        return node.userData.partId as string;
                    node = node.parent;
                }
            }
            return null;
        };
        const pointerDown = (e: PointerEvent) => { down.x = e.clientX; down.y = e.clientY; down.t = performance.now(); down.pointer = e.pointerId; };
        const pointerUp = (e: PointerEvent) => {
            if (e.button !== 0 || down.pointer !== e.pointerId || drag.current.id || performance.now() < drag.current.until || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || performance.now() - down.t > 600)
                return;
            const rect = canvas.getBoundingClientRect();
            if (rect.right - e.clientX < 112 && rect.bottom - e.clientY < 120)
                return; // view cube
            onSelect(hit(e));
        };
        const pointerMove = (e: PointerEvent) => { if (e.buttons || drag.current.id)
            return; const next = hit(e); if (next !== hovered) {
            hovered = next;
            onHover(next);
            canvas.style.cursor = next ? 'pointer' : 'grab';
        } };
        const leave = () => { hovered = null; onHover(null); canvas.style.cursor = 'grab'; };
        canvas.addEventListener('pointerdown', pointerDown);
        canvas.addEventListener('pointerup', pointerUp);
        canvas.addEventListener('pointermove', pointerMove);
        canvas.addEventListener('pointerleave', leave);
        return () => { canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointermove', pointerMove); canvas.removeEventListener('pointerleave', leave); };
    }, [camera, gl, objects, drag, onSelect, onHover, disabled]);
    return null;
}
/** Projected selection dimensions adapted from Etch editor/selection.js. */
function SelectionDimensions({ object, enabled }: {
    object: THREE.Group | null;
    enabled: boolean;
}) {
    const { camera, size, gl } = useThree(), svg = useRef<SVGSVGElement | null>(null), edges = useRef<SVGLineElement[]>([]), labels = useRef<SVGTextElement[]>([]);
    useLayoutEffect(() => {
        // Managed imperatively outside the R3F tree to avoid nested React DOM roots
        // during part hide/isolate and camera changes. Cleanup is safe if detached.
        const namespace = 'http://www.w3.org/2000/svg', overlay = document.createElementNS(namespace, 'svg');
        overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:3';
        overlay.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < 12; i++) {
            const line = document.createElementNS(namespace, 'line');
            line.setAttribute('stroke', '#bf925c');
            line.setAttribute('stroke-opacity', '.45');
            line.setAttribute('stroke-width', '1');
            line.setAttribute('stroke-dasharray', '3 3');
            overlay.append(line);
            edges.current.push(line);
        }
        for (let i = 0; i < 3; i++) {
            const label = document.createElementNS(namespace, 'text');
            label.setAttribute('text-anchor', i ? 'start' : 'middle');
            label.setAttribute('fill', '#795a35');
            label.setAttribute('font-size', '10');
            label.setAttribute('font-family', getComputedStyle(document.body).fontFamily);
            label.setAttribute('paint-order', 'stroke');
            label.setAttribute('stroke', '#fffaf0');
            label.setAttribute('stroke-width', '4');
            label.setAttribute('stroke-linejoin', 'round');
            overlay.append(label);
            labels.current.push(label);
        }
        svg.current = overlay;
        gl.domElement.parentElement?.append(overlay);
        return () => { overlay.remove(); svg.current = null; edges.current = []; labels.current = []; };
    }, [gl]);
    useLayoutEffect(() => { if (svg.current) {
        svg.current.setAttribute('width', String(size.width));
        svg.current.setAttribute('height', String(size.height));
        svg.current.style.display = object && enabled ? 'block' : 'none';
    } }, [size, object, enabled]);
    useFrame(() => {
        if (!svg.current || !object || !enabled)
            return;
        const box = new THREE.Box3().setFromObject(object.getObjectByName('component-geometry') || object), a = box.min, b = box.max;
        if (box.isEmpty())
            return;
        const point = (x: number, y: number, z: number) => { const p = new THREE.Vector3(x, y, z).project(camera); return { x: (p.x + 1) / 2 * size.width, y: (1 - p.y) / 2 * size.height, behind: p.z > 1 || p.z < -1 }; };
        const corners = [[a.x, a.y, a.z], [b.x, a.y, a.z], [b.x, a.y, b.z], [a.x, a.y, b.z], [a.x, b.y, a.z], [b.x, b.y, a.z], [b.x, b.y, b.z], [a.x, b.y, b.z]].map(p => point(...p as Vec3));
        svg.current.style.visibility = corners.some(p => p.behind) ? 'hidden' : 'visible';
        [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(([from, to], i) => {
            const el = edges.current[i];
            if (!el)
                return;
            el.setAttribute('x1', String(corners[from].x));
            el.setAttribute('y1', String(corners[from].y));
            el.setAttribute('x2', String(corners[to].x));
            el.setAttribute('y2', String(corners[to].y));
        });
        const dimensions = [b.x - a.x, b.z - a.z, b.y - a.y], locations = [point((a.x + b.x) / 2, a.y, b.z), point(b.x, a.y, (a.z + b.z) / 2), point(b.x, (a.y + b.y) / 2, a.z)];
        locations.forEach((p, i) => { const el = labels.current[i]; if (!el)
            return; el.setAttribute('x', String(p.x + (i ? 12 : 0))); el.setAttribute('y', String(p.y + (i ? 0 : 18))); el.textContent = `${(dimensions[i] / SCALE).toFixed(1)} mm`; });
    });
    return null;
}
function wirePoint(part: PartInstance, pin: string, positions: Record<string, THREE.Vector3>, rotations: Record<string, THREE.Euler>): THREE.Vector3 {
    const library = getLibrary(part.libraryId), pinInfo = library?.pins.find(p => p.name.toLowerCase() === pin.toLowerCase());
    return new THREE.Vector3(...(etchPinPosition(part.libraryId, pin) || pinInfo?.position || [0, (library?.size[1] || 6) / 2, 0])).applyEuler(rotations[part.id] || new THREE.Euler(...part.rotation.map(THREE.MathUtils.degToRad) as Vec3)).add(positions[part.id] || new THREE.Vector3(...part.assembledPosition));
}

/** A cached two-point guide preserves the assembled location while parts separate. */
function ExplodeLeader({ instance, positions, enabled }: { instance: PartInstance; positions: Positions; enabled: boolean }) {
    const guide = useMemo(() => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
        const material = new THREE.LineDashedMaterial({ color: '#8993a2', transparent: true, opacity: .34, dashSize: 1.4, gapSize: 1.1, depthWrite: false });
        const line = new THREE.Line(geometry, material);
        line.raycast = () => {};
        line.frustumCulled = false;
        return line;
    }, []);
    const lastStart = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));
    const lastEnd = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));
    useFrame(() => {
        const end = positions.current[instance.id];
        if (!enabled || !end) { guide.visible = false; return; }
        const [x, y, z] = instance.assembledPosition;
        const distance = (end.x - x) ** 2 + (end.y - y) ** 2 + (end.z - z) ** 2;
        guide.visible = distance > .25;
        if (!guide.visible) return;
        if (lastStart.current.x === x && lastStart.current.y === y && lastStart.current.z === z && lastEnd.current.distanceToSquared(end) < .001) return;
        lastStart.current.set(x, y, z); lastEnd.current.copy(end);
        const attribute = guide.geometry.getAttribute('position');
        attribute.setXYZ(0, x, y, z); attribute.setXYZ(1, end.x, end.y, end.z); attribute.needsUpdate = true;
        guide.computeLineDistances();
    });
    useEffect(() => () => { guide.geometry.dispose(); guide.material.dispose(); }, [guide]);
    return <primitive object={guide} />;
}

function Wire({ connection, from, to, positions, rotations, active, focused, opacity, index, animateIn, report }: {
    connection: Connection;
    from: PartInstance;
    to: PartInstance;
    positions: Positions;
    rotations: Rotations;
    active: boolean;
    focused: boolean;
    opacity: number;
    index: number;
    animateIn: boolean;
    report?: (anchor: { x: number; y: number; visible: boolean }) => void;
}) {
    const { camera, gl } = useThree(), frames = useRef(0);
    const mesh = useRef<THREE.Mesh>(null), endpoints = useRef<(THREE.Mesh | null)[]>([null, null]), signal = useRef<THREE.Mesh>(null);
    const curve = useRef(new THREE.CubicBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(0, 1, 0)));
    const last = useRef(new THREE.Vector3(Infinity, Infinity, Infinity)), lastEnd = useRef(new THREE.Vector3(Infinity, Infinity, Infinity)), progress = useRef(animateIn ? .01 : 1);
    const lastRadius = useRef(.38);
    const material = useMemo(() => new THREE.MeshStandardMaterial({ color: WIRE_COLORS[connection.wireColor], roughness: .65, metalness: .08, transparent: true, opacity }), [connection.wireColor]);
    useEffect(() => { progress.current = animateIn ? .01 : 1; }, [animateIn]);
    useEffect(() => () => material.dispose(), [material]);
    useFrame(({ clock }, delta) => {
        if (!mesh.current)
            return;
        const start = wirePoint(from, connection.from.pin, positions.current, rotations.current), end = wirePoint(to, connection.to.pin, positions.current, rotations.current);
        const moved = start.distanceToSquared(last.current) > .005 || end.distanceToSquared(lastEnd.current) > .005, animating = progress.current < 1;
        progress.current = Math.min(1, progress.current + delta * 1.8);
        const radius = active || focused ? .55 : .38;
        if (moved || animating || radius !== lastRadius.current) {
            lastRadius.current = radius;
            last.current.copy(start);
            lastEnd.current.copy(end);
            const distance = start.distanceTo(end), lift = Math.min(23, 5 + distance * .17) + index % 3 * 1.8, side = (index % 3 - 1) * 2;
            curve.current = new THREE.CubicBezierCurve3(start, start.clone().add(new THREE.Vector3(side, lift, 0)), end.clone().add(new THREE.Vector3(side, lift, 0)), end);
            const partial = progress.current < 1 ? new THREE.CatmullRomCurve3(Array.from({ length: 20 }, (_, i) => curve.current.getPoint(i / 19 * progress.current))) : curve.current;
            mesh.current.geometry.dispose();
            mesh.current.geometry = new THREE.TubeGeometry(partial, 32, radius, 6, false);
            endpoints.current[0]?.position.copy(start);
            endpoints.current[1]?.position.copy(end);
        }
        if (report && frames.current++ % 6 === 0) { const mid = curve.current.getPoint(.5).multiplyScalar(SCALE).project(camera); const rect = gl.domElement.getBoundingClientRect(); report({ x: rect.left + (mid.x + 1) / 2 * rect.width, y: rect.top + (1 - mid.y) / 2 * rect.height, visible: mid.z < 1 && Math.abs(mid.x) < 1.2 && Math.abs(mid.y) < 1.2 }); }
        material.opacity = THREE.MathUtils.damp(material.opacity, opacity, 7, delta);
        material.emissive.set(active || focused ? WIRE_COLORS[connection.wireColor] : '#000000');
        material.emissiveIntensity = focused ? .38 : active ? .22 : 0;
        if (signal.current) {
            signal.current.visible = (focused || active) && opacity > .4 && progress.current >= 1;
            const phase = connection.signalDirection === 'both' ? .5 - Math.cos(clock.elapsedTime * 1.15 + index * .4) * .5 : (clock.elapsedTime * .18 + index * .13) % 1;
            curve.current.getPoint(connection.signalDirection === 'to-from' ? 1 - phase : phase, signal.current.position);
        }
    });
    return <group><mesh ref={mesh} material={material} raycast={() => { }}><tubeGeometry args={[curve.current, 2, .38, 5, false]}/></mesh>{[0, 1].map(i => <mesh key={i} ref={el => { endpoints.current[i] = el; }} raycast={() => { }}><sphereGeometry args={[.65, 8, 6]}/><meshStandardMaterial color={WIRE_COLORS[connection.wireColor]} transparent opacity={opacity}/></mesh>)}<mesh ref={signal} visible={false} raycast={() => {}}><sphereGeometry args={[.62, 8, 6]} /><meshBasicMaterial color="#e6f0ff" transparent opacity={.9} depthWrite={false} /></mesh></group>;
}
function CameraRig(props: SceneProps & {
    controls: MutableRefObject<OrbitControlsImpl | null>;
    userCameraRevision: number;
    visible: PartInstance[];
}) {
    const { project, mode, stepIndex, completedSteps, view, explodeAmount, cameraAction, ambient, controls, userCameraRevision, visible } = props;
    const { camera, size } = useThree(), destination = useRef<THREE.Vector3 | null>(null), target = useRef(new THREE.Vector3());
    const bounds = useMemo(() => {
        const box = new THREE.Box3();
        visible.forEach(part => { const center = explodedPosition(part, mode === 'assembled' ? 0 : mode === 'exploded' ? Math.max(.5, explodeAmount) : .4), extent = new THREE.Vector3(...(getLibrary(part.libraryId)?.size || [20, 8, 20])).multiplyScalar(.58); box.expandByPoint(center.clone().add(extent)); box.expandByPoint(center.clone().sub(extent)); });
        if (box.isEmpty())
            box.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(140, 100, 100));
        return box;
    }, [project, mode, view, props.showEnclosure, props.isolatedId, props.hiddenIds]);
    const fit = () => {
        const center = bounds.getCenter(new THREE.Vector3()).multiplyScalar(SCALE), dimensions = bounds.getSize(new THREE.Vector3()).multiplyScalar(SCALE), aspect = Math.max(.5, size.width / size.height);
        const direction = view === 'top' ? new THREE.Vector3(0, 1, .001).normalize() : new THREE.Vector3(.95, 1.15, 1.3).normalize();
        const span = Math.max(dimensions.y * .85 + dimensions.z * .75, Math.max(dimensions.x, dimensions.z) / Math.max(.7, aspect), 2.5), distance = span / (2 * Math.tan(THREE.MathUtils.degToRad(34) / 2)) * 1.32;
        if (camera instanceof THREE.OrthographicCamera) {
            const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize(), up = direction.clone().cross(right).normalize();
            const projectedWidth = Math.abs(right.x) * dimensions.x + Math.abs(right.y) * dimensions.y + Math.abs(right.z) * dimensions.z;
            const projectedHeight = Math.abs(up.x) * dimensions.x + Math.abs(up.y) * dimensions.y + Math.abs(up.z) * dimensions.z;
            camera.zoom = Math.min(size.width / Math.max(2, projectedWidth * 1.3), size.height / Math.max(2, projectedHeight * 1.3));
            camera.updateProjectionMatrix();
        }
        target.current.copy(center);
        destination.current = center.clone().addScaledVector(direction, distance);
    };
    useEffect(() => { fit(); }, [project.id, view, size.width, size.height, camera.uuid]);
    useEffect(() => { if (mode !== 'build')
        fit(); }, [mode, props.showEnclosure, props.isolatedId]);
    useEffect(() => { if (userCameraRevision)
        destination.current = null; }, [userCameraRevision]);
    useEffect(() => {
        if (!cameraAction)
            return;
        if (cameraAction.type === 'fit' || cameraAction.type === 'home')
            fit();
        else {
            const currentTarget = controls.current?.target || target.current;
            if (camera instanceof THREE.OrthographicCamera) {
                camera.zoom *= cameraAction.type === 'in' ? 1.25 : .8;
                camera.updateProjectionMatrix();
            }
            destination.current = camera.position.clone().sub(currentTarget).multiplyScalar(cameraAction.type === 'in' ? .78 : 1.28).add(currentTarget);
            target.current.copy(currentTarget);
        }
    }, [cameraAction]);
    useEffect(() => { if (mode !== 'build' || view !== '3d')
        return; const step = project.buildSteps[stepIndex]; if (!step?.camera)
        return; destination.current = new THREE.Vector3(...step.camera.position).multiplyScalar(SCALE); target.current = new THREE.Vector3(...step.camera.target).multiplyScalar(SCALE); if (destination.current.distanceTo(target.current) < 5)
        destination.current.copy(target.current).add(new THREE.Vector3(4, 5, 6)); }, [stepIndex, mode, view, project.id]);
    useEffect(() => { if (mode === 'build' && completedSteps >= project.buildSteps.length)
        fit(); }, [completedSteps]);
    useFrame((_, delta) => { const orbit = controls.current; if (!orbit)
        return; if (destination.current) {
        camera.position.lerp(destination.current, 1 - Math.exp(-delta * 5));
        orbit.target.lerp(target.current, 1 - Math.exp(-delta * 5));
        orbit.update();
        if (camera.position.distanceToSquared(destination.current) < .00001 && orbit.target.distanceToSquared(target.current) < .00001)
            destination.current = null;
    } if (ambient) {
        const offset = camera.position.clone().sub(orbit.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), delta * .035);
        camera.position.copy(orbit.target).add(offset);
        orbit.update();
    } });
    return null;
}
function World(props: SceneProps) {
    const { project, mode, selectedId, hoveredId, hiddenIds, isolatedId, stepIndex, completedSteps, highlightedWire, ambient, onSelect, onHover, tool = 'select', showWires = true, showLabels = true, showEnclosure = false, colorOverrides } = props;
    const controls = useRef<OrbitControlsImpl>(null), objects = useRef<Record<string, THREE.Group>>({}), positions = useRef<Record<string, THREE.Vector3>>({}), rotations = useRef<Record<string, THREE.Euler>>({}), drag = useRef({ id: null as string | null, until: 0 });
    const [dragging, setDragging] = useState(false), [selectedObject, setSelectedObject] = useState<THREE.Group | null>(null), [userCameraRevision, setUserCameraRevision] = useState(0);
    const doneParts = useMemo(() => new Set(project.buildSteps.slice(0, completedSteps).flatMap(s => s.partIds)), [project, completedSteps]), doneWires = useMemo(() => new Set(project.buildSteps.slice(0, completedSteps).flatMap(s => s.connectionIds)), [project, completedSteps]);
    const activeStep = project.buildSteps[stepIndex], visible = project.parts.filter(p => !hiddenIds.includes(p.id) && (!isolatedId || isolatedId === p.id) && (showEnclosure || getLibrary(p.libraryId)?.category !== 'enclosure'));
    const activeFocus = hoveredId || selectedId;
    const partners = new Set(activeFocus ? [activeFocus, ...project.connections.filter(c => c.from.partId === activeFocus || c.to.partId === activeFocus).flatMap(c => [c.from.partId, c.to.partId])] : []);
    const displayMode: DisplayMode = project.parts.some(p => p.libraryId === 'max30102') ? 'heart' : project.parts.some(p => p.libraryId === 'dht22') ? 'weather' : project.parts.some(p => p.libraryId === 'soil-moisture') ? 'plant' : project.parts.some(p => p.libraryId === 'hc-sr04') ? 'distance' : 'general';
    const baseY = Math.min(0, ...visible.map(p => p.assembledPosition[1] - (getLibrary(p.libraryId)?.size[1] || 8) / 2)) * SCALE - .05;
    useLayoutEffect(() => { setSelectedObject(selectedId && visible.some(p => p.id === selectedId) ? objects.current[selectedId] || null : null); }, [selectedId, project.id, hiddenIds, isolatedId, showEnclosure]);
    return <>
    {props.view !== '3d' && <OrthographicCamera makeDefault position={[0, 20, .001]} zoom={50} near={.01} far={200}/>}
    <color attach="background" args={['#fffaf0']}/><ambientLight intensity={1.15}/><hemisphereLight args={['#fff6ed', '#cbbca5', 1.4]}/>
    <directionalLight position={[8, 14, 7]} intensity={3.1} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={12} shadow-camera-bottom={-10} shadow-bias={-.001} shadow-normalBias={.025}/>
    <directionalLight position={[-7, 6, -4]} intensity={1.9} color="#e7e9de"/><directionalLight position={[0, 4, -8]} intensity={1} color="#ffe1ca"/>
    <Grid position={[0, baseY, 0]} args={[100, 100]} cellSize={.35} cellThickness={.45} cellColor="#cbbda8" sectionSize={1.75} sectionThickness={.75} sectionColor="#bca98b" fadeDistance={26} fadeStrength={1.8} infiniteGrid raycast={() => { }}/>
    <group scale={SCALE}>
      {visible.map(instance => <ExplodeLeader key={`leader:${project.id}:${instance.id}`} instance={instance} positions={positions} enabled={!ambient && mode === 'exploded' && props.explodeAmount > .1} />)}
      {visible.map(instance => { const base = getLibrary(instance.libraryId) || fallbackPart(instance), library = instance.size || instance.colour ? { ...base, size: instance.size ?? base.size, colour: instance.colour ?? base.colour } : base, done = mode === 'build' && doneParts.has(instance.id), active = mode === 'build' && !!activeStep?.partIds.includes(instance.id) && !done, ghost = mode === 'build' && !done && !active; return <Part key={`${project.id}:${instance.id}`} instance={instance} library={library} targetPosition={explodedPosition(instance, partAmount(props, done, active))} positions={positions} rotations={rotations} objects={objects} drag={drag} selected={selectedId === instance.id} hovered={hoveredId === instance.id} active={active} opacity={ghost ? .14 : activeFocus && !partners.has(instance.id) ? .4 : 1} live={mode === 'build' && completedSteps >= project.buildSteps.length} displayMode={displayMode} colour={colorOverrides?.[instance.id]} showLabel={!ambient && showLabels && (hoveredId === instance.id || selectedId === instance.id || active)}/>; })}
      {showWires && project.connections.map((connection, index) => { const from = visible.find(p => p.id === connection.from.partId), to = visible.find(p => p.id === connection.to.partId); if (!from || !to || mode === 'build' && !doneWires.has(connection.id) && !activeStep?.connectionIds.includes(connection.id))
        return null; const active = highlightedWire === connection.id || mode === 'build' && !!activeStep?.connectionIds.includes(connection.id), related = activeFocus === from.id || activeFocus === to.id; return <Wire key={`${project.id}:${connection.id}`} connection={connection} from={from} to={to} positions={positions} rotations={rotations} active={active} focused={related} opacity={active ? 1 : activeFocus && !related ? .15 : related ? 1 : .7} index={index} animateIn={mode === 'build' && !!activeStep?.connectionIds.includes(connection.id)} report={active && props.onActiveWireAnchor && (highlightedWire === connection.id || activeStep?.connectionIds[0] === connection.id) ? props.onActiveWireAnchor : undefined}/>; })}
    </group>
    <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.09} minDistance={1.3} maxDistance={75} maxPolarAngle={Math.PI * .88} enableRotate={props.view === '3d'} enabled={!ambient && !dragging} enablePan={!ambient} onStart={() => setUserCameraRevision(v => v + 1)}/>
    <CameraRig {...props} controls={controls} userCameraRevision={userCameraRevision} visible={visible}/><ComponentPicker objects={objects} drag={drag} onSelect={onSelect} onHover={onHover} disabled={!!ambient}/>
    {!ambient && selectedObject && selectedId && tool !== 'select' && props.onTransform && <TransformControls object={selectedObject} mode={tool === 'move' ? 'translate' : 'rotate'} space="world" size={.85} onMouseDown={() => { drag.current.id = selectedId; setDragging(true); setUserCameraRevision(v => v + 1); }} onMouseUp={() => {
                const instance = project.parts.find(p => p.id === selectedId);
                if (instance) {
                    const done = mode === 'build' && doneParts.has(instance.id), active = mode === 'build' && !!activeStep?.partIds.includes(instance.id) && !done, explosion = new THREE.Vector3(...instance.explodeDirection).multiplyScalar(instance.explodeDistance * partAmount(props, done, active));
                    const position = selectedObject.position.clone().sub(explosion).toArray().map(v => Math.round(v * 100) / 100) as Vec3, rotation = [selectedObject.rotation.x, selectedObject.rotation.y, selectedObject.rotation.z].map(v => Math.round(THREE.MathUtils.radToDeg(v) * 100) / 100) as Vec3;
                    props.onTransform?.(instance.id, position, rotation);
                }
                drag.current.id = null;
                drag.current.until = performance.now() + 180;
                setDragging(false);
            }}/>}
    {!ambient && <SelectionDimensions object={selectedObject} enabled={tool === 'select'}/>}
    {!ambient && <GizmoHelper alignment="bottom-right" margin={[56, 62]}><GizmoViewcube color="#fff6e5" hoverColor="#f6d19c" textColor="#80603c" strokeColor="#dbc6a8" opacity={.94}/></GizmoHelper>}
  </>;
}
export default function Scene(props: SceneProps) {
    return <div className="assembly-scene" style={{ width: '100%', height: '100%', position: 'relative' }} role="img" aria-label={`Interactive three-dimensional ${props.project.name}. Click a component to inspect it. Drag empty space to orbit. Use Move and Rotate to edit selected parts.`}><SceneBoundary><Canvas camera={{ position: [8, 10, 12], fov: 34, near: .05, far: 200 }} shadows dpr={[1, 1.6]} gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }} fallback={<div style={{ padding: 28, fontSize: 13, color: '#80694e' }}>This browser cannot start WebGL. Your project, code and build instructions remain available. Try a browser with hardware acceleration enabled.</div>}><Suspense fallback={null}><World {...props}/></Suspense></Canvas></SceneBoundary></div>;
}
