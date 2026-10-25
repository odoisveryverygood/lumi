'use client';
import {poseMotion,partMatrix,motionAngles} from '@/lib/studio/motion-pose';

import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef, type MutableRefObject, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { GizmoHelper, GizmoViewcube, OrbitControls, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import {buildModel,localPartBounds,type GeometryBank} from '@/lib/studio/render-model';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { setEtchFade } from '@/lib/etch-models';
import { sceneFrame } from '@/lib/studio/framing';
import { showcaseFrame } from '@/lib/studio/lumi-motion';
import type { DeviceMechanism, DevicePart, DeviceSceneProps, Solid, Vec3 } from '@/lib/studio/types';
import SoftwareViewport from './SoftwareViewport';

/**
 * The solid-first composition and quiet light treatment follow Anatomy's craft
 * guidance. Picking, independent material fading and hard-edge highlighting are
 * adapted from PranavAchar01/etch, commit c548129ec5ed13f59f76b0a852a5dd03b728825b,
 * deploy/etch-app/js/board-viewer.js and editor/build-anim/parts3d.js.
 * No nested React DOM roots are created inside the canvas.
 */

type Controls = ComponentRef<typeof OrbitControls>;
type Objects = MutableRefObject<Record<string, THREE.Group>>;
type Showcase = MutableRefObject<{active:boolean;started:number;explode:number;scale:number;reduced:boolean}>;
type DragState = MutableRefObject<{ id: string | null; until: number; offset: THREE.Vector3; rotationOffset: THREE.Vector3 }>;
type MotionState = { poses?:Map<string,DevicePart>; mechanism: DeviceMechanism | null; progress: number; envelope: number; stage: number; stageIds: Set<string> };
type Motion = MutableRefObject<MotionState>;

const radians = (values: Vec3): Vec3 => values.map(THREE.MathUtils.degToRad) as Vec3;
const degrees = (values: number[]): Vec3 => values.map(value => Math.round(THREE.MathUtils.radToDeg(value) * 100) / 100) as Vec3;
const rounded = (values: number[]): Vec3 => values.map(value => Math.round(value * 100) / 100) as Vec3;
const svgNS = 'http://www.w3.org/2000/svg';
const focusColor = new THREE.Color('#ff713e');

/** A single physical press, a short hold, and a smooth return to rest. */
function pressEnvelope(progress: number) {
  const t=THREE.MathUtils.clamp(progress,0,1),smooth=(value:number)=>value*value*(3-2*value);
  return t<.34?smooth(t/.34):t<.6?1:1-smooth((t-.6)/.4);
}
function motionWeight(mechanism:DeviceMechanism,progress:number){return mechanism.motion==='linear'?THREE.MathUtils.clamp(progress,0,1):pressEnvelope(progress);}

function MechanismClock({ props, motion, drag }: { props: DeviceSceneProps; motion: Motion; drag: DragState }) {
  const callbacks=useRef({progress:props.onMechanismProgress,complete:props.onMechanismComplete});callbacks.current={progress:props.onMechanismProgress,complete:props.onMechanismComplete};
  const input=useRef({id:'',nonce:-1,progress:-1,playing:false}),published=useRef(-1),notifyAt=useRef(0),completed=useRef(false);
  const mechanism=props.document.mechanisms?.find(item=>item.id===props.mechanismPlayback?.mechanismId)||null;
  useLayoutEffect(()=>{
    const playback=props.mechanismPlayback,previous=input.current;
    if(!playback||!mechanism){motion.current={mechanism:null,progress:0,envelope:0,stage:-1,stageIds:new Set()};input.current={id:'',nonce:-1,progress:-1,playing:false};completed.current=false;return;}
    const reset=previous.id!==playback.mechanismId||previous.nonce!==playback.nonce;
    const external=playback.progress!==previous.progress&&Math.abs(playback.progress-published.current)>.00001;
    if(reset||external){motion.current.progress=THREE.MathUtils.clamp(playback.progress,0,1);completed.current=false;notifyAt.current=0;}
    if(reset||motion.current.mechanism!==mechanism){motion.current.stage=-2;motion.current.stageIds=new Set();}
    motion.current.mechanism=mechanism;motion.current.envelope=motionWeight(mechanism,motion.current.progress);
    if(previous.playing&&!playback.playing&&!external&&!reset){published.current=motion.current.progress;callbacks.current.progress?.(motion.current.progress);}
    input.current={id:playback.mechanismId,nonce:playback.nonce,progress:playback.progress,playing:playback.playing};
  },[props.mechanismPlayback?.mechanismId,props.mechanismPlayback?.nonce,props.mechanismPlayback?.progress,props.mechanismPlayback?.playing,mechanism,motion]);
  useFrame(({clock},delta)=>{
    const state=motion.current;if(!state.mechanism)return;
    if(input.current.playing&&!drag.current.id&&!completed.current)state.progress=Math.min(1,state.progress+Math.min(delta,.1)/Math.max(.2,state.mechanism.duration));
    state.envelope=motionWeight(state.mechanism,state.progress);
    const joint=state.mechanism.verification;state.poses=joint?new Map(poseMotion(props.document,state.mechanism,joint.minDeg+(joint.maxDeg-joint.minDeg)*state.progress).parts.map(p=>[p.id,p])):undefined;
    let stage=-1;for(let i=0;i<state.mechanism.stages.length;i++)if(state.mechanism.stages[i].at<=state.progress)stage=i;
    if(stage!==state.stage){state.stage=stage;state.stageIds=new Set(stage>=0?state.mechanism.stages[stage].partIds:state.mechanism.tracks.map(track=>track.partId));}
    if(input.current.playing&&(clock.elapsedTime>=notifyAt.current||state.progress>=1)&&!completed.current){published.current=state.progress;callbacks.current.progress?.(state.progress);notifyAt.current=clock.elapsedTime+.1;}
    if(input.current.playing&&state.progress>=1&&!completed.current){completed.current=true;callbacks.current.complete?.();}
  },-1);
  return null;
}

class ViewBoundary extends Component<{ children: ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div style={{ height: '100%', display: 'grid', placeContent: 'center', gap: 10, padding: 28, color: '#56616d', background: '#f8f5f0', textAlign: 'center' }}>
      <strong style={{ fontSize: 14 }}>The viewport needs a fresh start.</strong>
      <span style={{ maxWidth: 280, fontSize: 12 }}>Your device is preserved. Restart the viewport to reconnect to the graphics hardware.</span>
      <button type="button" onClick={() => this.setState(value => ({ failed: false, attempt: value.attempt + 1 }))} style={{ justifySelf: 'center', border: '1px solid #d4dbe0', borderRadius: 6, background: '#fff', padding: '8px 13px', color: '#334357', cursor: 'pointer', font: 'inherit', fontSize: 12 }}>Restart viewport</button>
    </div>;
    return <div key={this.state.attempt} style={{ width: '100%', height: '100%' }}>{this.props.children}</div>;
  }
}

function pose(part: DevicePart, amount: number) {
  return new THREE.Vector3(...part.position).addScaledVector(new THREE.Vector3(...part.explode), amount);
}


function fittedPartBox(part: DevicePart, amount: number) {
  const box = localPartBounds(part);
  return box.applyMatrix4(new THREE.Matrix4().compose(pose(part, amount), new THREE.Quaternion().setFromEuler(new THREE.Euler(...radians(part.rotation))), new THREE.Vector3(1, 1, 1)));
}

function mechanismMatrix(part:DevicePart,amount:number,mechanism:DeviceMechanism|null,envelope:number){
  const track=mechanism?.tracks.find(item=>item.partId===part.id),position=pose(part,amount),rotation=radians(part.rotation);
  if(track?.translation)position.addScaledVector(new THREE.Vector3(...track.translation),envelope);
  return new THREE.Matrix4().compose(position,new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0]+THREE.MathUtils.degToRad(track?.rotation?.[0]||0)*envelope,rotation[1]+THREE.MathUtils.degToRad(track?.rotation?.[1]||0)*envelope,rotation[2]+THREE.MathUtils.degToRad(track?.rotation?.[2]||0)*envelope)),new THREE.Vector3(1+((track?.scale?.[0]??1)-1)*envelope,1+((track?.scale?.[1]??1)-1)*envelope,1+((track?.scale?.[2]??1)-1)*envelope));
}

/** Real PBR metals need reflected light as well as the direct key/fill lights.
 * This local room generates a small studio IBL once; it downloads no HDR asset
 * and leaves imported material colors, maps, alpha and PBR properties intact. */
function StudioEnvironment() {
  const { gl, scene } = useThree();
  useLayoutEffect(() => {
    const previous = scene.environment, previousIntensity = scene.environmentIntensity;
    const room = new RoomEnvironment(), generator = new THREE.PMREMGenerator(gl);
    const target = generator.fromScene(room, .05, .1, 100, { size: 128 });
    room.dispose(); generator.dispose();
    scene.environment = target.texture; scene.environmentIntensity = .85;
    return () => {
      if (scene.environment === target.texture) { scene.environment = previous; scene.environmentIntensity = previousIntensity; }
      target.dispose();
    };
  }, [gl, scene]);
  return null;
}


function DevicePartModel({ part, index, target, opacity, selected, hovered, active, highlighted, ghost, pickThrough, bank, objects, drag, motion, track, importedScene, showcase }: {
  part: DevicePart; index: number; target: THREE.Vector3; opacity: number; selected: boolean; hovered: boolean; active: boolean; ghost: boolean;
  highlighted:boolean;pickThrough:boolean;bank: GeometryBank; objects: Objects; drag: DragState; motion:Motion;track?:DeviceMechanism['tracks'][number];importedScene?: unknown;showcase:Showcase;
}) {
  const root = useRef<THREE.Group>(null), initialPosition = useRef(new THREE.Vector3(...part.position));
  const legendLight = !!part.specs.Legend && new THREE.Color(part.color).getHSL({ h: 0, s: 0, l: 0 }).l > .48;
  const model = useMemo(() => buildModel(part, bank, importedScene), [part.id, part.mesh, part.solids, part.specs.Legend, legendLight, bank, part.assetNode, importedScene]);
  const lastTarget = useRef(new THREE.Vector3(...part.position)), waitUntil = useRef(performance.now() + Math.min(.28, index * .014) * 1000);
  const openingTarget=useRef(new THREE.Vector3()),openingOffset=useMemo(()=>new THREE.Vector3(...part.explode),[part.explode]);
  const previousDelta=useRef(new THREE.Vector3()),nextDelta=useRef(new THREE.Vector3()),lastGlow=useRef<boolean|null>(null),baseRotation=useMemo(()=>radians(part.rotation),[part.rotation]);
  useLayoutEffect(() => {
    if (!root.current) return;
    objects.current[part.id] = root.current; root.current.rotation.set(...radians(part.rotation));
    return () => { delete objects.current[part.id]; };
  }, [part.id, objects]);
  useLayoutEffect(() => { if (root.current && drag.current.id !== part.id) root.current.rotation.set(...radians(part.rotation)); }, [part.rotation, part.id, drag]);
  useLayoutEffect(() => {
    setEtchFade(model.materials, opacity);
    model.object.traverse(node=>{if(node instanceof THREE.Mesh)node.castShadow=!pickThrough;});
    for (const material of model.materials) {
      if (!('color' in material) || !(material.color instanceof THREE.Color)) continue;
      if (material.userData.mainColor) material.color.set(part.color);
      else if (material.userData.baseColor instanceof THREE.Color) material.color.copy(material.userData.baseColor);
    }
    lastGlow.current=null;
    if (root.current) root.current.userData.ghost = ghost||pickThrough;
  }, [model, opacity, part.color, part.assetNode, selected, hovered, active, highlighted, ghost,pickThrough]);
  useFrame((_, delta) => {
    if(!root.current)return;
    const glow=highlighted||motion.current.stageIds.has(part.id);
    if(lastGlow.current!==glow){
      for(const material of model.materials)if(material instanceof THREE.MeshStandardMaterial){
        const base=material.userData.baseEmissive instanceof THREE.Color?material.userData.baseEmissive:new THREE.Color();
        material.emissive.copy(base);if(glow)material.emissive.lerp(focusColor,.065);
        material.emissiveIntensity=material.userData.baseEmissiveIntensity??1;
      }
      lastGlow.current=glow;
    }
    model.edges.color.set(selected||hovered||active||glow?'#ff713e':'#273e4a');model.edges.opacity=ghost?.045:selected?.8:hovered?.65:glow?.65:active?.55:.14;
    if (drag.current.id === part.id || selected && performance.now() < drag.current.until) return;
    const verifiedPose=motion.current.poses?.get(part.id);if(verifiedPose){root.current.position.set(...verifiedPose.position);root.current.rotation.set(...radians(verifiedPose.rotation));root.current.scale.set(1,1,1);previousDelta.current.set(0,0,0);return;}
    const destination=showcase.current.active?openingTarget.current.set(...part.position).addScaledVector(openingOffset,showcase.current.explode):target;
    root.current.position.sub(previousDelta.current);
    if (lastTarget.current.distanceToSquared(destination) > .001) {
      if (!showcase.current.active&&lastTarget.current.distanceToSquared(destination) > 2500) waitUntil.current = performance.now() + Math.min(.24, index * .011) * 1000;
      lastTarget.current.copy(destination);
    }
    if (performance.now() >= waitUntil.current) root.current.position.lerp(destination, 1 - Math.exp(-delta * 7));
    const envelope=motion.current.envelope;
    nextDelta.current.set(...(track?.translation||[0,0,0])).multiplyScalar(envelope);root.current.position.add(nextDelta.current);previousDelta.current.copy(nextDelta.current);
    root.current.rotation.set(baseRotation[0]+THREE.MathUtils.degToRad(track?.rotation?.[0]||0)*envelope,baseRotation[1]+THREE.MathUtils.degToRad(track?.rotation?.[1]||0)*envelope,baseRotation[2]+THREE.MathUtils.degToRad(track?.rotation?.[2]||0)*envelope);
    root.current.scale.set(1+((track?.scale?.[0]??1)-1)*envelope,1+((track?.scale?.[1]??1)-1)*envelope,1+((track?.scale?.[2]??1)-1)*envelope);
  });
  useEffect(() => () => { model.materials.forEach(material => material.dispose()); model.edges.dispose(); model.ownedGeometry.forEach(geometry => geometry.dispose());model.textures.forEach(texture=>texture.dispose()); }, [model]);
  return <group ref={root} position={initialPosition.current} userData={{ partId: part.id, ghost:ghost||pickThrough }}><primitive object={model.object} /></group>;
}

function ExplodeLeader({ part, objects, enabled }: { part: DevicePart; objects: Objects; enabled: boolean }) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const material = new THREE.LineDashedMaterial({ color: '#8c9aa5', transparent: true, opacity: .38, dashSize: 2.2, gapSize: 2.3, depthWrite: false, toneMapped: false });
    const object = new THREE.Line(geometry, material); object.raycast = () => {}; object.frustumCulled = false; return object;
  }, []);
  const lastEnd = useRef(new THREE.Vector3(Infinity, Infinity, Infinity)), lastStart = useRef(new THREE.Vector3());
  useFrame(() => {
    const object = objects.current[part.id];
    if (!enabled || !object) { line.visible = false; return; }
    const origin = lastStart.current.set(...part.position);
    line.visible = object.position.distanceToSquared(origin) > 1;
    if (!line.visible || lastEnd.current.distanceToSquared(object.position) < .002) return;
    lastEnd.current.copy(object.position);
    const attribute = line.geometry.getAttribute('position'); attribute.setXYZ(0, ...part.position); attribute.setXYZ(1, ...object.position.toArray() as Vec3); attribute.needsUpdate = true; line.computeLineDistances();
  });
  useEffect(() => () => { line.geometry.dispose(); line.material.dispose(); }, [line]);
  return <primitive object={line} />;
}

/** Schematic relationship overlays appear only for the discussed components. */
function RelationshipPath({ from, to, type, objects, motion, index }: { from:DevicePart;to:DevicePart;type:'electrical'|'data';objects:Objects;motion:Motion;index:number }) {
  const route=useMemo(()=>{
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(33*3),3));
    const material=new THREE.LineDashedMaterial({color:type==='electrical'?'#b6955d':'#548dbd',transparent:true,opacity:.68,dashSize:2.5,gapSize:1.5,depthWrite:false,toneMapped:false});
    const line=new THREE.Line(geometry,material);line.raycast=()=>{};line.frustumCulled=false;return line;
  },[type]);
  const localFrom=useMemo(()=>localPartBounds(from).getCenter(new THREE.Vector3()),[from]),localTo=useMemo(()=>localPartBounds(to).getCenter(new THREE.Vector3()),[to]);
  const start=useRef(new THREE.Vector3()),end=useRef(new THREE.Vector3()),lastStart=useRef(new THREE.Vector3(Infinity,0,0)),lastEnd=useRef(new THREE.Vector3(Infinity,0,0)),point=useRef(new THREE.Vector3());
  const curve=useRef(new THREE.CubicBezierCurve3(new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3())),dot=useRef<THREE.Mesh>(null);
  useFrame(()=>{
    const a=objects.current[from.id],b=objects.current[to.id];route.visible=!!a&&!!b;if(!a||!b)return;
    a.updateWorldMatrix(true,false);b.updateWorldMatrix(true,false);start.current.copy(localFrom).applyMatrix4(a.matrixWorld);end.current.copy(localTo).applyMatrix4(b.matrixWorld);
    if(start.current.distanceToSquared(lastStart.current)>.01||end.current.distanceToSquared(lastEnd.current)>.01){
      lastStart.current.copy(start.current);lastEnd.current.copy(end.current);const lift=Math.min(12,3+start.current.distanceTo(end.current)*.08)+(index%3)*1.3;
      curve.current.v0.copy(start.current);curve.current.v1.copy(start.current).add(new THREE.Vector3(0,lift,0));curve.current.v2.copy(end.current).add(new THREE.Vector3(0,lift,0));curve.current.v3.copy(end.current);
      const attribute=route.geometry.getAttribute('position');for(let i=0;i<=32;i++){curve.current.getPoint(i/32,point.current);attribute.setXYZ(i,point.current.x,point.current.y,point.current.z);}attribute.needsUpdate=true;route.computeLineDistances();
    }
    if(dot.current){dot.current.visible=!!motion.current.mechanism&&motion.current.progress>.1&&motion.current.progress<.95;if(dot.current.visible)curve.current.getPoint((motion.current.progress*2+index*.17)%1,dot.current.position);}
  });
  useEffect(()=>()=>{route.geometry.dispose();route.material.dispose();},[route]);
  return <group><primitive object={route}/><mesh ref={dot} visible={false} raycast={()=>{}}><sphereGeometry args={[.6,8,6]}/><meshBasicMaterial color={type==='electrical'?'#dbb66d':'#68a4d6'} toneMapped={false}/></mesh></group>;
}

/** Etch-style canvas picking: no callout, edge or leader can intercept a solid. */
function Picking({ objects, drag, onSelect, onHover }: { objects: Objects; drag: DragState; onSelect: DeviceSceneProps['onSelect']; onHover: DeviceSceneProps['onHover'] }) {
  const { camera, gl } = useThree();
  const callbacks = useRef({ onSelect, onHover }); callbacks.current = { onSelect, onHover };
  useEffect(() => {
    const canvas = gl.domElement, ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
    const start = { x: 0, y: 0, time: 0, id: -1 }; let hovered: string | null = null;
    const inCube = (event: PointerEvent) => { const rect = canvas.getBoundingClientRect(), y=event.clientY-rect.top; return rect.right-event.clientX<104&&y>58&&y<166; };
    const hit = (event: PointerEvent) => {
      if (inCube(event)) return null;
      const rect = canvas.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2); ray.setFromCamera(pointer, camera);
      for (const intersection of ray.intersectObjects(Object.values(objects.current), true)) {
        if (!(intersection.object instanceof THREE.Mesh)) continue;
        let ancestor: THREE.Object3D | null = intersection.object;
        while (ancestor) {
          if (ancestor.userData.partId) { if (!ancestor.userData.ghost) return ancestor.userData.partId as string; break; }
          ancestor = ancestor.parent;
        }
      }
      return null;
    };
    const down = (event: PointerEvent) => { start.x = event.clientX; start.y = event.clientY; start.time = performance.now(); start.id = event.pointerId; };
    const up = (event: PointerEvent) => {
      if (event.button !== 0 || start.id !== event.pointerId || inCube(event) || drag.current.id || performance.now() < drag.current.until || performance.now() - start.time > 650 || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
      callbacks.current.onSelect(hit(event));
    };
    const move = (event: PointerEvent) => { if (event.buttons || drag.current.id) return; const id = hit(event); if (id !== hovered) { hovered = id; callbacks.current.onHover(id); } canvas.style.cursor = id ? 'pointer' : 'grab'; };
    const leave = () => { hovered = null; callbacks.current.onHover(null); canvas.style.cursor = 'grab'; };
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerleave', leave);
    return () => { canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerleave', leave); };
  }, [camera, gl, objects, drag]);
  return null;
}

type Callout = { id: string; group: SVGGElement; path: SVGPolylineElement; dot: SVGCircleElement; title: SVGTextElement; category: SVGTextElement; lines: string[] };
function Callouts({ parts, objects, selectedId, hoveredId, highlightedIds, enabled, onSelect }: { parts: DevicePart[]; objects: Objects; selectedId: string | null; hoveredId: string | null; highlightedIds?:string[];enabled: boolean; onSelect: DeviceSceneProps['onSelect'] }) {
  const { camera, gl, size } = useThree();
  const svg = useRef<SVGSVGElement | null>(null), entries = useRef<Callout[]>([]);
  const selection = useRef(onSelect); selection.current = onSelect;
  const chosen = useMemo(() => {
    if (!enabled) return [];
    if (selectedId) return parts.filter(part => part.id === selectedId);
    if(highlightedIds?.length)return parts.filter(part=>highlightedIds.includes(part.id)).slice(0,6);
    const meaningful = parts.filter(part=>!/(chassis|fastener|cable|feet|mounting)/i.test(part.category));
    const ranked = [...(meaningful.length ? meaningful : parts)].sort((a,b)=>{
      const score=(part:DevicePart)=>part.size[0]*part.size[1]*part.size[2]*(part.id==='cooler-fins'?4:/shroud|socket|retention|bracket/i.test(part.name)?.2:1);
      return score(b)-score(a);
    });
    // One meaningful assembly per category keeps cooling accessories, screws and
    // large cable envelopes from crowding out the device's main components.
    const categories = new Set<string>(), representatives:DevicePart[]=[];
    for (const part of ranked) if (!categories.has(part.category)) { representatives.push(part);categories.add(part.category); }
    const priority=(part:DevicePart)=>{
      const order=[/compute|motherboard|mainboard/i,/cooling|thermal/i,/graphics|video/i,/memory/i,/storage/i,/power/i];
      const found=order.findIndex(pattern=>pattern.test(part.category));return found<0?6:found;
    };
    representatives.sort((a,b)=>priority(a)-priority(b));
    const largest=representatives.slice(0,6);
    for (const part of ranked) if(largest.length<6&&!largest.includes(part))largest.push(part);
    if (hoveredId && !largest.some(part => part.id === hoveredId)) { const hovered = parts.find(part => part.id === hoveredId); if (hovered) return [hovered, ...largest.slice(0,5)]; }
    return largest;
  }, [parts, selectedId, hoveredId, highlightedIds, enabled]);
  useLayoutEffect(() => {
    const overlay = document.createElementNS(svgNS, 'svg'); overlay.setAttribute('role', 'group'); overlay.setAttribute('aria-label', 'Component callouts'); overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2';
    svg.current = overlay; gl.domElement.parentElement?.append(overlay);
    return () => { overlay.remove(); svg.current = null; entries.current = []; };
  }, [gl]);
  useLayoutEffect(() => {
    const overlay = svg.current; if (!overlay) return;
    overlay.setAttribute('width', String(size.width)); overlay.setAttribute('height', String(size.height)); overlay.replaceChildren(); entries.current = [];
    for (const part of chosen) {
      const group = document.createElementNS(svgNS, 'g'), path = document.createElementNS(svgNS, 'polyline'), dot = document.createElementNS(svgNS, 'circle'), title = document.createElementNS(svgNS, 'text'), category = document.createElementNS(svgNS, 'text');
      const focused = part.id === selectedId || part.id === hoveredId || !!highlightedIds?.includes(part.id);
      group.style.pointerEvents='none';
      // Only the text is a button. A group containing the long leader has a
      // screen-wide bounding box whose centre can land on another 3D part.
      title.setAttribute('role','button'); title.setAttribute('tabindex','0'); title.setAttribute('aria-label',`Select ${part.name}`); title.style.pointerEvents='auto'; title.style.cursor='pointer';
      title.addEventListener('click',event=>{event.stopPropagation();selection.current(part.id);});
      title.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();selection.current(part.id);}});
      title.addEventListener('focus',()=>{path.setAttribute('stroke','#c18d43');title.setAttribute('fill','#946829');});
      title.addEventListener('blur',()=>{path.setAttribute('stroke',focused?'#c19b60':'#b3a18b');title.setAttribute('fill',focused?'#946829':'#76603f');});
      path.style.pointerEvents='none';dot.style.pointerEvents='none';category.style.pointerEvents='none';
      path.setAttribute('fill', 'none'); path.setAttribute('stroke', focused ? '#c19b60' : '#b3a18b'); path.setAttribute('stroke-width', '.85'); path.setAttribute('stroke-linejoin', 'round'); path.setAttribute('opacity', '.8');
      dot.setAttribute('r', '2.1'); dot.setAttribute('fill', focused ? '#c08a3e' : '#ad9169'); dot.setAttribute('stroke', '#fffbf6'); dot.setAttribute('stroke-width', '1.4');
      title.setAttribute('font-family', 'var(--font-lumi), ui-sans-serif, system-ui, sans-serif'); title.setAttribute('font-size', '12'); title.setAttribute('font-weight', '500'); title.setAttribute('fill', focused ? '#946829' : '#76603f'); title.setAttribute('paint-order','stroke'); title.setAttribute('stroke','#f8f5f0'); title.setAttribute('stroke-width','4'); title.setAttribute('stroke-linejoin','round');
      category.setAttribute('font-family','var(--font-lumi), ui-sans-serif, system-ui, sans-serif'); category.setAttribute('font-size','11'); category.setAttribute('fill','#aa8f68'); category.setAttribute('paint-order','stroke'); category.setAttribute('stroke','#f8f5f0'); category.setAttribute('stroke-width','3');
      const names:Record<string,string>={motherboard:'Motherboard','cooler-fins':'CPU heatsink','cooler-base':'Cooler base','cpu-fan':'CPU cooling fan',processor:'Processor','gpu-board':'Graphics card','gpu-heatsink':'GPU heatsink','gpu-shroud':'GPU fan shroud','gpu-fan-left':'GPU fan · left','gpu-fan-right':'GPU fan · right','ram-a':'Memory A','ram-b':'Memory B','m2-ssd':'NVMe storage','power-unit':'Power supply','case-tray':'Chassis tray','case-feet':'Isolation feet',standoffs:'Board standoffs','rear-frame':'Rear I/O frame','front-panel':'Front fascia','left-panel':'Left panel','right-panel':'Right panel','top-frame':'Service rim','front-io':'Front I/O','rear-io':'Rear I/O','power-harness':'Power harness','riser-cable':'PCIe riser',screws:'Captive screws'};
      const short=names[part.id]||part.name.replace(/\bCompact\s+/i,'').replace(/\bProcessor\s+/i,'CPU ').replace(/\s*&\s*heatpipes/i,'').replace(/\s*package$/i,'');
      const lines:string[]=[];let line='';for(const word of short.split(' ')){if(line.length+word.length>20&&line){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);
      for(const [index,text]of lines.entries()){const span=document.createElementNS(svgNS,'tspan');span.textContent=text;span.setAttribute('dy',index?'14':'0');title.append(span);}
      category.textContent = part.category;
      group.append(path,dot,title,category); overlay.append(group); entries.current.push({id:part.id,group,path,dot,title,category,lines});
    }
  }, [chosen, size, selectedId, hoveredId, highlightedIds]);
  useFrame(() => {
    if (!svg.current || !enabled) return;
    const points = entries.current.flatMap(entry => {
      const object = objects.current[entry.id], part = parts.find(p => p.id === entry.id); if (!object || !part) { entry.group.style.display='none'; return []; }
      object.updateWorldMatrix(true,false);
      const point = new THREE.Vector3(0,part.size[1]*.35,0).applyMatrix4(object.matrixWorld).project(camera);
      if (point.z < -1 || point.z > 1) { entry.group.style.display='none'; return []; }
      entry.group.style.display=''; return [{entry,x:(point.x+1)/2*size.width,y:(1-point.y)/2*size.height}];
    });
    const middle=points.length?points.reduce((sum,point)=>sum+point.x,0)/points.length:size.width/2;
    const left = points.filter(point=>point.x<middle), right = points.filter(point=>point.x>=middle);
    const leftLabel=Math.max(62,Math.min(...points.map(point=>point.x))-230),rightLabel=Math.min(size.width-22,Math.max(...points.map(point=>point.x))+230);
    for (const [side,list] of [[-1,left],[1,right]] as const) {
      list.sort((a,b)=>a.y-b.y); let lastY=155;
      list.forEach((point,index)=>{
        const remaining=list.length-index-1, maxY=size.height-66-remaining*54;
        const y=Math.max(lastY+54,Math.min(maxY,point.y)), textX=side<0?leftLabel:rightLabel, textWidth=Math.min(145,Math.max(...point.entry.lines.map(line=>line.length))*6.1), endX=textX-side*(textWidth+7);
        lastY=y;
        const elbowX=point.x+side*17;
        point.entry.path.setAttribute('points',`${point.x.toFixed(1)},${point.y.toFixed(1)} ${elbowX.toFixed(1)},${point.y.toFixed(1)} ${endX.toFixed(1)},${(y-4).toFixed(1)}`);
        point.entry.dot.setAttribute('cx',point.x.toFixed(1)); point.entry.dot.setAttribute('cy',point.y.toFixed(1));
        point.entry.title.setAttribute('x',String(textX)); point.entry.title.setAttribute('y',String(y)); point.entry.title.setAttribute('text-anchor',side<0?'start':'end'); point.entry.title.style.textAnchor=side<0?'start':'end';
        for(const span of Array.from(point.entry.title.children))span.setAttribute('x',String(textX));
        point.entry.category.setAttribute('x',String(textX)); point.entry.category.setAttribute('y',String(y+14*point.entry.lines.length)); point.entry.category.setAttribute('text-anchor',side<0?'start':'end'); point.entry.category.style.textAnchor=side<0?'start':'end';
      });
    }
  });
  return null;
}

/** Screen-space witness attached to measured world coordinates. Text stays readable while orbiting. */
function MeasurementWitness({measurement,props}:{measurement:NonNullable<DeviceSceneProps['measurement']>;props:DeviceSceneProps}){
  const {camera,gl,size}=useThree(),drawing=useRef<{svg:SVGSVGElement;line:SVGPathElement;leader:SVGPathElement;label:SVGGElement}|null>(null);
  useLayoutEffect(()=>{
    const svg=document.createElementNS(svgNS,'svg'),line=document.createElementNS(svgNS,'path'),leader=document.createElementNS(svgNS,'path'),label=document.createElementNS(svgNS,'g'),rect=document.createElementNS(svgNS,'rect');
    svg.setAttribute('role','img');svg.setAttribute('aria-label',`${measurement.label}; ${measurement.detail||''}`);svg.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:4;overflow:hidden';svg.setAttribute('width',String(size.width));svg.setAttribute('height',String(size.height));
    const color=measurement.tone==='fail'?'#dc3e61':'#b48646';
    line.setAttribute('fill','none');line.setAttribute('stroke',color);line.setAttribute('stroke-width','1.5');leader.setAttribute('fill','none');leader.setAttribute('stroke',color);leader.setAttribute('stroke-width','1');leader.setAttribute('stroke-dasharray','3 4');
    rect.setAttribute('width','176');rect.setAttribute('height','55');rect.setAttribute('rx','10');rect.setAttribute('fill','#fffcf9');rect.setAttribute('stroke',color+'55');label.append(rect);
    [measurement.label,measurement.detail||''].forEach((value,index)=>{const text=document.createElementNS(svgNS,'text');text.textContent=value;text.setAttribute('x','13');text.setAttribute('y',String(22+index*17));text.setAttribute('fill',index?'#8a788a':color);text.setAttribute('font-family','var(--font-lumi),system-ui,sans-serif');text.setAttribute('font-size',index?'10':'12');text.setAttribute('font-weight',index?'400':'600');label.append(text);});
    svg.append(leader,line,label);gl.domElement.parentElement?.append(svg);drawing.current={svg,line,leader,label};return()=>{svg.remove();drawing.current=null;};
  },[gl,size,measurement]);
  useFrame(()=>{const el=drawing.current;if(!el)return;const from=new THREE.Vector3(...measurement.from).project(camera),to=new THREE.Vector3(...measurement.to).project(camera);el.svg.style.display=from.z>1||to.z>1?'none':'';
    const a=[(from.x+1)*size.width/2,(1-from.y)*size.height/2],b=[(to.x+1)*size.width/2,(1-to.y)*size.height/2],x=(a[0]+b[0])/2+24,mid=(a[1]+b[1])/2,half=Math.max(18,Math.abs(a[1]-b[1])/2),top=mid-half,bottom=mid+half;
    el.line.setAttribute('d',`M${x-5},${top}H${x+5}M${x},${top}V${bottom}M${x-5},${bottom}H${x+5}`);
    const frame=sceneFrame(size.width,size.height,{contextPanel:props.contextPanel,partsOpen:props.partsOpen,bottomInset:props.viewportBottomInset});const lx=Math.max(frame.left,Math.min(size.width-frame.right-180,x+22)),ly=Math.max(frame.top+25,Math.min(size.height-frame.bottom-65,mid-28));el.label.setAttribute('transform',`translate(${lx} ${ly})`);el.leader.setAttribute('d',`M${a[0]},${a[1]}L${x},${bottom}M${b[0]},${b[1]}L${x},${top}M${x+5},${mid}L${lx},${ly+28}`);
  });return null;
}

function CameraMotion({ props, parts, amounts, controls, manualRevision, autoOrbit }: { props: DeviceSceneProps; parts: DevicePart[]; amounts: Map<string,number>; controls: MutableRefObject<Controls | null>; manualRevision: number;autoOrbit:boolean }) {
  const { camera, size } = useThree();
  const reducedMotion = useRef(false);
  useEffect(() => { const preference = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => { reducedMotion.current = preference.matches; }; update(); preference.addEventListener('change', update); return () => preference.removeEventListener('change', update); }, []);
  const destination=useRef<{position:THREE.Vector3;target:THREE.Vector3;zoom:number}|null>(null),focusedIds=useRef<string[]|null>(null);
  useEffect(()=>{if(autoOrbit)destination.current=null;},[autoOrbit]);
  const mechanism=props.document.mechanisms?.find(item=>item.id===props.mechanismPlayback?.mechanismId)||null;
  const fit=(home=false,ids=focusedIds.current)=>{
    if(!(camera instanceof THREE.OrthographicCamera))return;
    const focused=ids?.length?parts.filter(part=>ids.includes(part.id)):parts;
    const relevant=focused.length?focused:parts,box=new THREE.Box3(),samples:THREE.Vector3[]=[];
    // Fit both rest and full press so the close-up stays steady throughout playback.
    for(const part of relevant){
      const local=localPartBounds(part),levels=mechanism?.verification?motionAngles(mechanism.verification):mechanism?.tracks.some(track=>track.partId===part.id)?[0,1]:[0];
      for(const level of levels){
        const matrix=mechanism?.verification?partMatrix(poseMotion(props.document,mechanism,level).parts.find(p=>p.id===part.id)!):mechanismMatrix(part,amounts.get(part.id)||0,mechanism,level);
        for(const x of[local.min.x,local.max.x])for(const y of[local.min.y,local.max.y])for(const z of[local.min.z,local.max.z]){
          const point=new THREE.Vector3(x,y,z).applyMatrix4(matrix);samples.push(point);box.expandByPoint(point);
        }
      }
    }
    if(box.isEmpty())box.setFromCenterAndSize(new THREE.Vector3(),new THREE.Vector3(220,120,220));
    const center=box.getCenter(new THREE.Vector3()),extent=box.getSize(new THREE.Vector3());
    const direction=props.view==='top'?new THREE.Vector3(0,1,.0001):props.view==='front'?new THREE.Vector3(0,0,1):home?new THREE.Vector3(310,285,360).normalize():camera.position.clone().sub(controls.current?.target||center).normalize();
    if(direction.lengthSq()<.1)direction.set(310,285,360).normalize();
    const right=new THREE.Vector3(0,1,0).cross(direction).normalize(),up=direction.clone().cross(right).normalize(),projected=new THREE.Box2();
    for(const point of samples){const relative=point.clone().sub(center);projected.expandByPoint(new THREE.Vector2(relative.dot(right),relative.dot(up)));}
    if(projected.isEmpty())projected.set(new THREE.Vector2(-110,-60),new THREE.Vector2(110,60));
    const projectedCenter=projected.getCenter(new THREE.Vector2());center.addScaledVector(right,projectedCenter.x).addScaledVector(up,projectedCenter.y);
    const frame=sceneFrame(size.width,size.height,{gallery:props.presentation==='gallery',contextPanel:props.contextPanel,partsOpen:props.partsOpen,bottomInset:props.viewportBottomInset,mechanism:!!props.mechanismPlayback});
    const availableWidth=Math.max(140,size.width-frame.left-frame.right),verticalBudget=Math.max(100,size.height-frame.top-frame.bottom);
    const span=projected.getSize(new THREE.Vector2()),zoom=THREE.MathUtils.clamp(Math.min(availableWidth/Math.max(20,span.x)*.92,verticalBudget/Math.max(20,span.y)*.96),.12,20);
    const desiredCenterX=(frame.left+size.width-frame.right)/2,desiredCenterY=(frame.top+size.height-frame.bottom)/2;
    center.addScaledVector(right,(size.width/2-desiredCenterX)/zoom).addScaledVector(up,-(size.height/2-desiredCenterY)/zoom);
    destination.current={position:center.clone().addScaledVector(direction,Math.max(650,extent.length()*3)),target:center,zoom};
  };
  useEffect(()=>{focusedIds.current=null;fit(true,null);},[props.document.id,props.document.id==='flare-live-generation'?props.document.parts.length:0]);
  useEffect(()=>{fit(true);},[props.view,size.width,size.height]);
  useEffect(()=>{fit(false);},[props.explode,props.buildStep,props.isolatedId,props.hiddenIds.join('|'),props.viewportBottomInset,props.mechanismPlayback?.mechanismId,props.presentation,props.contextPanel,props.partsOpen]);
  useEffect(()=>{if(manualRevision)destination.current=null;},[manualRevision]);
  useEffect(()=>{
    if(!props.focusCommand)return;
    focusedIds.current=props.focusCommand.partIds.length?[...props.focusCommand.partIds]:null;fit(false);
  },[props.focusCommand?.nonce]);
  useEffect(()=>{
    if(props.cameraCommand.type==='fit'||props.cameraCommand.type==='home'){focusedIds.current=null;fit(props.cameraCommand.type==='home',null);}
    else if(camera instanceof THREE.OrthographicCamera)destination.current={position:camera.position.clone(),target:controls.current?.target.clone()||new THREE.Vector3(),zoom:THREE.MathUtils.clamp(camera.zoom*(props.cameraCommand.type==='in'?1.25:.8),.12,20)};
  },[props.cameraCommand.nonce]);
  useFrame((_,delta)=>{
    if(!(camera instanceof THREE.OrthographicCamera)||!destination.current||!controls.current)return;
    const desired=destination.current,factor=reducedMotion.current?1:1-Math.exp(-delta*5);
    camera.position.lerp(desired.position,factor);controls.current.target.lerp(desired.target,factor);camera.zoom=THREE.MathUtils.lerp(camera.zoom,desired.zoom,factor);camera.updateProjectionMatrix();controls.current.update();
    if(camera.position.distanceToSquared(desired.position)<.005&&Math.abs(camera.zoom-desired.zoom)<.0001)destination.current=null;
  });
  return null;
}

function OpeningMotion({state,root,amount,onOrbit,force}:{state:Showcase;root:MutableRefObject<THREE.Group|null>;amount:number;onOrbit:(value:boolean)=>void;force:boolean}){
  const notified=useRef(0);
  useEffect(()=>{const preference=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>{state.current.reduced=preference.matches&&!force;if(preference.matches&&!force)onOrbit(false);};update();preference.addEventListener('change',update);return()=>preference.removeEventListener('change',update);},[state,onOrbit,force]);
  useFrame(()=>{
    const s=state.current;
    if(s.active){const frame=showcaseFrame(performance.now()-s.started,amount,s.reduced);s.scale=frame.scale;s.explode=frame.explode;if(frame.rotating&&notified.current!==s.started){notified.current=s.started;onOrbit(true);}if(frame.complete&&(s.reduced||frame.rotating))s.active=false;}
    root.current?.scale.setScalar(s.active?s.scale:1);
  },-1);
  return null;
}

/** Project the actual rendered component, including motion and imported transforms. */
function GuideProjection({props,objects}:{props:DeviceSceneProps;objects:Objects}){
  const {camera,gl}=useThree(),next=useRef(0),point=useRef(new THREE.Vector3());
  const part=props.document.parts.find(p=>p.id===props.guidePartId);
  const local=useMemo(()=>part?localPartBounds(part).getCenter(new THREE.Vector3()):null,[part]);
  useEffect(()=>()=>props.onGuideAnchor?.(null),[props.onGuideAnchor]);
  useFrame(()=>{
    const now=performance.now();if(now<next.current)return;next.current=now+55;
    const object=part&&objects.current[part.id];
    if(!part||!object||!local||props.hiddenIds.includes(part.id)){props.onGuideAnchor?.(null);return;}
    object.updateWorldMatrix(true,false);point.current.copy(local).applyMatrix4(object.matrixWorld).project(camera);
    const p=point.current,rect=gl.domElement.getBoundingClientRect();props.onGuideAnchor?.({x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2,visible:p.z>=-1&&p.z<=1&&Math.abs(p.x)<1.2&&Math.abs(p.y)<1.2});
  });return null;
}

function DeviceWorld(props:DeviceSceneProps){
  const controls=useRef<Controls>(null),objects=useRef<Record<string,THREE.Group>>({}),drag=useRef({id:null as string|null,until:0,offset:new THREE.Vector3(),rotationOffset:new THREE.Vector3()});
  const motion=useRef<MotionState>({mechanism:null,progress:0,envelope:0,stage:-1,stageIds:new Set()});
  const [selectedObject,setSelectedObject]=useState<THREE.Group|null>(null),[dragging,setDragging]=useState(false),[manualRevision,setManualRevision]=useState(0);
  const openingRoot=useRef<THREE.Group>(null),seenOpenings=useRef(new Set<string>()),opening=useRef({active:false,started:0,explode:0,scale:1,reduced:false}),previousOverride=useRef(false);
  const [orbitReady,setOrbitReady]=useState(false);
  const center=useMemo(()=>{const box=new THREE.Box3();for(const part of props.document.parts)box.union(fittedPartBox(part,0));return box.isEmpty()?new THREE.Vector3():box.getCenter(new THREE.Vector3());},[props.document.id]);
  useLayoutEffect(()=>{
    if(!props.showcase){opening.current.active=false;opening.current.scale=1;setOrbitReady(false);return;}
    opening.current.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches&&!props.forceMotion;
    if(props.forceMotion&&!previousOverride.current)seenOpenings.current.delete(props.document.id);previousOverride.current=!!props.forceMotion;
    if(seenOpenings.current.has(props.document.id)){setOrbitReady(!opening.current.reduced);return;}
    seenOpenings.current.add(props.document.id);opening.current={...opening.current,active:true,started:performance.now(),explode:0,scale:.12};setOrbitReady(false);
  },[props.showcase,props.document.id,props.forceMotion]);
  const stopOpening=()=>{opening.current.active=false;opening.current.scale=1;setOrbitReady(false);setManualRevision(value=>value+1);props.onShowcaseStop?.();};
  const bank=useMemo<GeometryBank>(()=>({shapes:new Map(),edges:new Map()}),[props.document.id]);
  useEffect(()=>()=>{for(const geometry of bank.shapes.values())geometry.dispose();for(const geometry of bank.edges.values())geometry.dispose();},[bank]);
  const parts=useMemo(()=>props.document.parts.filter(part=>!props.hiddenIds.includes(part.id)&&(!props.isolatedId||props.isolatedId===part.id)&&(!props.reviewMode||part.id.startsWith('wireless-')||['keyboard-case-base','keyboard-pcb','keyboard-controller','keyboard-usb','keyboard-dampener'].includes(part.id)||props.highlightedIds?.includes(part.id))),[props.document.parts,props.hiddenIds,props.isolatedId,props.reviewMode,props.highlightedIds]);
  const mechanism=props.document.mechanisms?.find(item=>item.id===props.mechanismPlayback?.mechanismId)||null;
  const tracks=useMemo(()=>new Map(mechanism?.tracks.map(track=>[track.partId,track])||[]),[mechanism]);
  const mechanismContext=useMemo(()=>new Set(mechanism?.stages.flatMap(stage=>stage.partIds)||[]),[mechanism]);
  const highlighted=useMemo(()=>new Set(props.highlightedIds||[]),[props.highlightedIds]);
  const relationships=useMemo(()=>{
    const ids=new Set(props.highlightedIds?.length?props.highlightedIds:props.selectedId?[props.selectedId]:[]),visible=new Set(parts.map(part=>part.id));
    return (props.document.relationships||[]).filter(link=>(link.type==='electrical'||link.type==='data')&&visible.has(link.from)&&visible.has(link.to)&&(ids.has(link.from)||ids.has(link.to))).sort((a,b)=>Number(ids.has(b.from)&&ids.has(b.to))-Number(ids.has(a.from)&&ids.has(a.to))).slice(0,12);
  },[props.document.relationships,props.highlightedIds,props.selectedId,parts]);
  const completed=useMemo(()=>new Set(props.buildStep===null?[]:props.document.steps.slice(0,props.buildStep).flatMap(step=>step.partIds)),[props.document.steps,props.buildStep]);
  const current=useMemo(()=>new Set(props.buildStep===null?[]:props.document.steps[props.buildStep]?.partIds||[]),[props.document.steps,props.buildStep]);
  const amounts=useMemo(()=>new Map(parts.map(part=>[part.id,props.buildStep===null?props.explode:completed.has(part.id)||current.has(part.id)?0:Math.max(.35,props.explode)])),[parts,props.buildStep,props.explode,completed,current]);
  const ground=useMemo(()=>Math.min(...props.document.parts.map(part=>fittedPartBox(part,0).min.y),0)-.4,[props.document.parts]);
  useLayoutEffect(()=>{setSelectedObject(props.selectedId&&parts.some(part=>part.id===props.selectedId)?objects.current[props.selectedId]||null:null);},[props.selectedId,parts,props.document.id]);
  return <>
    <OpeningMotion force={!!props.forceMotion} state={opening} root={openingRoot} amount={props.explode} onOrbit={setOrbitReady}/>
    <MechanismClock props={props} motion={motion} drag={drag}/>
    <StudioEnvironment />
    <ambientLight intensity={1.35} /><hemisphereLight args={['#fff9f0','#c4b09b',1.4]} />
    <directionalLight position={[180,450,270]} intensity={3.0} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-360} shadow-camera-right={360} shadow-camera-top={460} shadow-camera-bottom={-300} shadow-camera-near={1} shadow-camera-far={1500} shadow-bias={-.0003} shadow-normalBias={.35} />
    <directionalLight position={[-300,180,-160]} intensity={1.35} color="#fff0d7" /><directionalLight position={[60,150,-320]} intensity={1.5} color="#ffe4d4" />
    <mesh position={[0,ground,0]} rotation={[-Math.PI/2,0,0]} receiveShadow raycast={()=>{}}><planeGeometry args={[1800,1800]} /><shadowMaterial transparent opacity={.18} depthWrite={false} /></mesh>
    <group ref={openingRoot} position={center}><group position={[-center.x,-center.y,-center.z]}>
    {parts.map((part,index)=>{
      const active=current.has(part.id),ghost=props.buildStep!==null&&!completed.has(part.id)&&!active;
      const reviewGhost=props.reviewMode&&!part.id.startsWith('wireless-')&&!props.highlightedIds?.includes(part.id);
      const cutaway=!!mechanism&&!mechanism.verification&&(tracks.has(part.id)&&!!part.specs.Legend?.trim()||mechanismContext.has(part.id)&&!tracks.has(part.id)&&/housing|enclosure/i.test(part.category+' '+part.name));
      return <DevicePartModel key={`${props.document.id}:${part.id}`} showcase={opening} part={part} index={index} target={pose(part,amounts.get(part.id)||0)} opacity={reviewGhost?(part.id==='keyboard-case-base'?.24:part.id==='keyboard-pcb'?.06:.04):ghost?.09:cutaway?.18:1} selected={props.selectedId===part.id} hovered={props.hoveredId===part.id} active={active} highlighted={highlighted.has(part.id)} ghost={ghost} pickThrough={cutaway||!!reviewGhost} bank={bank} objects={objects} drag={drag} motion={motion} track={tracks.get(part.id)} importedScene={props.importedScene} />;
    })}
    {props.explode === 0 && props.collisionRegions?.map((region,index)=><mesh key={`conflict-${index}`} position={region.position} renderOrder={9} raycast={()=>{}}><boxGeometry args={region.size.map(n=>Math.max(.12,n)) as Vec3}/><meshBasicMaterial color="#ff3c59" transparent opacity={.75} depthTest={false} depthWrite={false}/></mesh>)}
    {relationships.map((link,index)=>{const from=parts.find(part=>part.id===link.from),to=parts.find(part=>part.id===link.to);return from&&to?<RelationshipPath key={link.id} from={from} to={to} type={link.type as 'electrical'|'data'} objects={objects} motion={motion} index={index}/>:null;})}
    {parts.map(part=><ExplodeLeader key={`leader:${props.document.id}:${part.id}`} part={part} objects={objects} enabled={props.buildStep===null&&props.explode>.1} />)}
    </group></group>
    <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.09} autoRotate={!!props.showcase&&orbitReady&&!opening.current.reduced&&props.view==='perspective'} autoRotateSpeed={.5} enabled={!dragging} enableRotate={props.view==='perspective'} minZoom={.12} maxZoom={20} minDistance={80} maxDistance={5000} maxPolarAngle={Math.PI*.86} onStart={stopOpening} />
    <CameraMotion props={props} parts={parts} amounts={amounts} controls={controls} manualRevision={manualRevision} autoOrbit={!!props.showcase&&orbitReady} />
    <Picking objects={objects} drag={drag} onSelect={props.onSelect} onHover={props.onHover} />
    <GuideProjection props={props} objects={objects}/>
    {props.measurement&&props.explode===0&&<MeasurementWitness measurement={props.measurement} props={props}/>}
    <Callouts parts={parts} objects={objects} selectedId={props.selectedId} hoveredId={props.hoveredId} highlightedIds={props.highlightedIds} enabled={props.labels} onSelect={props.onSelect} />
    {selectedObject&&props.selectedId&&props.tool!=='select'&&!props.mechanismPlayback?.playing&&<TransformControls object={selectedObject} mode={props.tool==='move'?'translate':'rotate'} space="world" size={.82} onMouseDown={()=>{
      const part=props.document.parts.find(part=>part.id===props.selectedId);if(!part)return;drag.current.id=part.id;drag.current.offset.copy(selectedObject.position).sub(new THREE.Vector3(...part.position));drag.current.rotationOffset.set(selectedObject.rotation.x-THREE.MathUtils.degToRad(part.rotation[0]),selectedObject.rotation.y-THREE.MathUtils.degToRad(part.rotation[1]),selectedObject.rotation.z-THREE.MathUtils.degToRad(part.rotation[2]));setDragging(true);setManualRevision(value=>value+1);
    }} onMouseUp={()=>{
      const id=drag.current.id;if(id)props.onTransform(id,rounded(selectedObject.position.clone().sub(drag.current.offset).toArray()),degrees([selectedObject.rotation.x-drag.current.rotationOffset.x,selectedObject.rotation.y-drag.current.rotationOffset.y,selectedObject.rotation.z-drag.current.rotationOffset.z]));drag.current.id=null;drag.current.until=performance.now()+180;setDragging(false);
    }} />}
    {props.presentation!=='gallery'&&<GizmoHelper alignment="bottom-right" margin={[57,61]}><GizmoViewcube color="#f5eddf" hoverColor="#f0d6a9" textColor="#a38a61" strokeColor="#dfc9a3" opacity={.75} /></GizmoHelper>}
  </>;
}

export default function DeviceScene(props:DeviceSceneProps){
  const [software,setSoftware]=useState<boolean|null>(null);
  useEffect(()=>{const canvas=document.createElement('canvas');const gl=canvas.getContext('webgl2');if(!gl)setSoftware(true);else{gl.getExtension('WEBGL_lose_context')?.loseContext();setSoftware(false);}},[]);
  return <div className="device-scene" role="group" aria-label={`Interactive three-dimensional ${props.document.name}. Select a component, orbit the device, and use the Move or Rotate tools to edit it.`} style={{width:'100%',height:'100%',position:'relative',isolation:'isolate'}}>
    {software===null?<div className="ds-loading">Preparing the geometry…</div>:software?<SoftwareViewport {...props}/>:<ViewBoundary><Canvas orthographic camera={{position:[380,300,430],zoom:1.5,near:.1,far:6000}} shadows dpr={[1,1.6]} gl={{antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'}} fallback={<SoftwareViewport {...props}/>}><DeviceWorld {...props} /></Canvas></ViewBoundary>}
  </div>;
}
