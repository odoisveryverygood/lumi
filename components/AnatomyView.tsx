'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as k from '@/vendor/anatomy/iso-kit';
import { makeHardwareArt, rotateXYZ, toAnatomy } from '@/lib/anatomy/geometry';
import { assemblyPaintOrder } from '@/lib/anatomy/painting';
import { PART_MAP } from '@/lib/library';
import type { AssemblyMode, LibraryPart, PartInstance, Project, Vec3, ViewMode } from '@/lib/types';
export interface SceneProps {
  project: Project; mode: AssemblyMode; explodeAmount: number; view: ViewMode;
  selectedId: string | null; hoveredId: string | null; hiddenIds: string[]; isolatedId: string | null;
  stepIndex: number; completedSteps: number; highlightedWire: string | null;
  onSelect: (id: string | null) => void; onHover: (id: string | null) => void;
  cameraAction: { type: 'home' | 'fit' | 'in' | 'out'; nonce: number } | null; ambient?: boolean;
}
import HardwareArt from './anatomy/HardwareArt';
import styles from './anatomy/AnatomyView.module.css';

export interface AnatomyViewProps extends Omit<SceneProps, 'cameraAction'> {
  cameraAction?: SceneProps['cameraAction'];
  tool?: 'select' | 'move' | 'rotate';
  onTransform?: (id: string, position: Vec3, rotation: Vec3) => void;
  showWires?: boolean;
  showLabels?: boolean;
  showEnclosure?: boolean;
  colorOverrides?: Record<string, string>;
}
const WIDTH = 1000, HEIGHT = 720;
const WIRE_COLOURS = { red: '#ac7d72', black: '#4e5a55', yellow: '#b49e66', blue: '#729698', green: '#7d9680', white: '#b5bcb0', orange: '#b08d69' };
const libFor = (part: PartInstance): LibraryPart => { const base = PART_MAP[part.libraryId] ?? fallback(part); return part.size || part.colour ? { ...base, size: part.size ?? base.size, colour: part.colour ?? base.colour } : base; };
const fallback = (part: PartInstance): LibraryPart => ({ id: part.libraryId, name: part.label, category: 'passive', whatItIs: part.role, model: { fallback: 'pcb' }, size: [20, 5, 20], colour: '#829587', pins: [], voltage: { min: 0, max: 5 }, currentMa: 0, priceUsd: 0, buyUrl: '', alternatives: [] });
const plus = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const distance = (a: Vec3, b: Vec3) => Math.hypot(...a.map((v, i) => v - b[i]));

export default function AnatomyView({ project, mode, explodeAmount, view, selectedId, hoveredId, hiddenIds, isolatedId, stepIndex, completedSteps, highlightedWire, onSelect, onHover, cameraAction, tool = 'select', onTransform, showWires = true, showLabels = true, showEnclosure = true, colorOverrides, ambient = false }: AnatomyViewProps) {
  const svg = useRef<SVGSVGElement>(null);
  const objects = useRef(new Map<string, SVGGElement>());
  const wireObjects = useRef(new Map<string, SVGPathElement>());
  const positions = useRef<Record<string, Vec3>>({});
  const drag = useRef<{ id: string | null; start: k.Flat; origin: Vec3; pan: k.Flat; moved: boolean; last?: Vec3; rotation?: Vec3 } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<k.Flat>([0, 0]);
  const [dragging, setDragging] = useState(false);
  const [rotationPreview, setRotationPreview] = useState<{ id: string; rotation: Vec3 } | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const patternId = useId().replace(/:/g, '');
  const currentStep = project.buildSteps[stepIndex];
  const activePartIds = mode === 'build' ? currentStep?.partIds ?? [] : [];
  const activeWireIds = mode === 'build' ? currentStep?.connectionIds ?? [] : [];
  const completedParts = useMemo(() => new Set(project.buildSteps.slice(0, completedSteps).flatMap(step => step.partIds)), [project.buildSteps, completedSteps]);
  const placedParts = useMemo(() => new Set(project.buildSteps.slice(0, stepIndex + 1).flatMap(step => step.partIds)), [project.buildSteps, stepIndex]);
  const placedWires = useMemo(() => new Set(project.buildSteps.slice(0, stepIndex + 1).flatMap(step => step.connectionIds)), [project.buildSteps, stepIndex]);
  const visibleParts = useMemo(() => project.parts.filter(part => !hiddenIds.includes(part.id) && (!isolatedId || isolatedId === part.id) && (showEnclosure || PART_MAP[part.libraryId]?.category !== 'enclosure')), [project.parts, hiddenIds, isolatedId, showEnclosure]);
  const targets = useMemo(() => Object.fromEntries(visibleParts.map(part => {
    let amount = mode === 'exploded' ? explodeAmount : 0;
    if (mode === 'build' && !placedParts.has(part.id) && !completedParts.has(part.id)) amount = .88;
    const offset = part.explodeDirection.map(v => v * part.explodeDistance * amount) as Vec3;
    return [part.id, plus(part.assembledPosition, offset)];
  })), [visibleParts, mode, explodeAmount, placedParts, completedParts]);
  const projection = useMemo(() => {
    const corners = visibleParts.flatMap(part => {
      const lib = libFor(part);
      const pos = targets[part.id];
      return [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => toAnatomy(plus(pos, rotateXYZ([x * lib.size[0] / 2, y * lib.size[1] / 2, z * lib.size[2] / 2], part.rotation))))));
    });
    if (!corners.length) corners.push([-55, -42, 0], [55, 42, 80]);
    const fit = k.fitProjection(corners, WIDTH, HEIGHT, { pad: mode === 'exploded' ? 100 : 130, headroom: 25, azimuth: view === 'flat' ? 90 : 48, elevation: view === 'top' || view === 'flat' ? 89.99 : 34 });
    // Preserve room for a cable loop above the highest header.
    return { ...fit, scale: Math.min(4.2, Math.max(.35, fit.scale)) };
  }, [visibleParts, targets, view, mode]);
  const art = useMemo(() => Object.fromEntries(visibleParts.map(part => [part.id, makeHardwareArt(libFor(part), { ...projection, scale: 1 }, rotationPreview?.id === part.id ? rotationPreview.rotation : part.rotation, colorOverrides?.[part.id])])), [visibleParts, projection, rotationPreview, colorOverrides]);
  const wires = useMemo(() => project.connections.filter(connection => visibleParts.some(p => p.id === connection.from.partId) && visibleParts.some(p => p.id === connection.to.partId)), [project.connections, visibleParts]);
  const sortedParts = useMemo(() => assemblyPaintOrder(visibleParts, targets, projection), [visibleParts, targets, projection]);
  const partMap = useMemo(() => Object.fromEntries(project.parts.map(p => [p.id, p])), [project.parts]);

  const wirePath = useCallback((connection: typeof wires[number], poses: Record<string, Vec3>, index: number) => {
    const anchor = (partId: string, pin: string): Vec3 => {
      const part = partMap[partId];
      const library = PART_MAP[part.libraryId];
      const terminal = library?.pins.find(p => p.name.toLowerCase() === pin.toLowerCase());
      const local = terminal?.position ?? [0, (library?.size[1] ?? 5) / 2, 0];
      return plus(poses[partId] ?? part.assembledPosition, rotateXYZ(local as Vec3, drag.current?.id === partId && drag.current.rotation ? drag.current.rotation : part.rotation));
    };
    const from = anchor(connection.from.partId, connection.from.pin), to = anchor(connection.to.partId, connection.to.pin);
    const lift = Math.min(35, 9 + distance(from, to) * .15) + index % 4 * 1.6;
    const side = (index % 3 - 1) * 2;
    const points = Array.from({ length: 33 }, (_, i): k.Flat => {
      const t = i / 32, u = 1 - t;
      const point: Vec3 = [u * from[0] + t * to[0] + side * Math.sin(Math.PI * t), u * from[1] + t * to[1] + lift * 4 * t * u, u * from[2] + t * to[2]];
      return k.iso(toAnatomy(point), projection);
    });
    return k.pathOf(points);
  }, [partMap, projection]);

  const paint = useCallback(() => {
    for (const part of visibleParts) {
      const node = objects.current.get(part.id), point = positions.current[part.id] ?? targets[part.id];
      if (node) {
        const [x, y] = k.iso(toAnatomy(point), projection);
        node.setAttribute('transform', `translate(${x} ${y}) scale(${projection.scale})`);
      }
    }
    wires.forEach((wire, i) => wireObjects.current.get(wire.id)?.setAttribute('d', wirePath(wire, positions.current, i)));
  }, [visibleParts, targets, projection, wires, wirePath]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update(); mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // A single time-based animation clock. Static geometry never rebuilds per frame.
  useEffect(() => {
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(.06, Math.max(.001, (now - last) / 1000)); last = now;
      let settling = false;
      for (const part of visibleParts) {
        const target = targets[part.id];
        if (!positions.current[part.id] || reducedMotion) positions.current[part.id] = [...target];
        if (drag.current?.id === part.id) continue;
        const current = positions.current[part.id];
        const ease = 1 - Math.exp(-dt * 7.5);
        if (distance(current, target) > .015) {
          settling = true;
          positions.current[part.id] = current.map((v, i) => v + (target[i] - v) * ease) as Vec3;
        } else positions.current[part.id] = [...target];
      }
      paint();
      if (settling) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targets, visibleParts, paint, reducedMotion]);

  useEffect(() => {
    if (!cameraAction) return;
    if (cameraAction.type === 'in') setZoom(v => Math.min(3.5, v * 1.2));
    else if (cameraAction.type === 'out') setZoom(v => Math.max(.35, v / 1.2));
    else { setZoom(1); setPan([0, 0]); }
  }, [cameraAction]);

  useEffect(() => {
    const node = svg.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => { if (ambient) return; event.preventDefault(); setZoom(v => Math.min(3.5, Math.max(.35, v * Math.exp(-event.deltaY * .001)))); };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, [ambient]);

  const svgPoint = (event: ReactPointerEvent): k.Flat => {
    const rect = svg.current!.getBoundingClientRect();
    // Use the SVG CTM so letterboxing and responsive viewport ratios are correct.
    const matrix = svg.current!.getScreenCTM();
    if (matrix) { const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()); return [point.x, point.y]; }
    return [(event.clientX - rect.left) * WIDTH / rect.width, (event.clientY - rect.top) * HEIGHT / rect.height];
  };
  const begin = (event: ReactPointerEvent, id: string | null) => {
    if (ambient || event.button !== 0) return;
    event.stopPropagation();
    const part = id ? partMap[id] : null;
    if (id) onSelect(id);
    drag.current = { id, start: svgPoint(event), origin: part ? [...(positions.current[id!] ?? part.assembledPosition)] : [0, 0, 0], pan: [...pan], moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: ReactPointerEvent) => {
    const state = drag.current;
    if (!state) return;
    if (state.id && tool === 'select') return;
    const point = svgPoint(event), dx = point[0] - state.start[0], dy = point[1] - state.start[1];
    if (Math.hypot(dx, dy) < 3 && !state.moved) return;
    state.moved = true;
    setDragging(true);
    if (!state.id) { setPan([state.pan[0] + dx, state.pan[1] + dy]); return; }
    if (!onTransform || tool === 'select' || mode === 'build') return;
    if (tool === 'rotate') {
      const original = partMap[state.id].rotation;
      state.rotation = [original[0], original[1] + Math.round(dx / 3) * 5, original[2]];
      // Show the angle immediately; commit once on release so undo stays useful.
      const node = objects.current.get(state.id);
      node?.setAttribute('data-rotation-preview', String(Math.round(state.rotation[1])));
      setRotationPreview({ id: state.id, rotation: state.rotation });
      paint();
      return;
    }
    const cam = k.cameraOf(projection);
    const factor = cam.k * zoom;
    const sx = dx / factor, sy = dy / (factor * Math.max(.12, cam.sinE));
    const worldX = sx * cam.sinA + sy * cam.cosA;
    const worldZ = sx * cam.cosA - sy * cam.sinA;
    const next: Vec3 = [state.origin[0] + worldX, state.origin[1], state.origin[2] + worldZ];
    state.last = next; positions.current[state.id] = next;
    paint();
  };
  const finish = (event: ReactPointerEvent, cancelled = false) => {
    const state = drag.current;
    if (!state) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null; setDragging(false); setRotationPreview(null);
    if (state.id && !cancelled && onTransform && mode !== 'build') {
      const part = partMap[state.id];
      if (state.rotation) onTransform(state.id, part.assembledPosition, state.rotation);
      else if (state.last) {
        // The drag operates on the displayed pose; preserve the explode offset.
        const delta = state.last.map((v, i) => v - state.origin[i]);
        onTransform(state.id, part.assembledPosition.map((v, i) => Math.round((v + delta[i]) * 10) / 10) as Vec3, part.rotation);
      }
    } else if (!state.id && !state.moved) onSelect(null);
    if (cancelled && state.id) { positions.current[state.id] = [...targets[state.id]]; paint(); }
  };
  const focusedPart = visibleParts.find(part => part.id === hoveredId) ?? visibleParts.find(part => part.id === selectedId);
  const focusedLibrary = focusedPart ? PART_MAP[focusedPart.libraryId] : undefined;
  const selected = focusedPart && !ambient;
  const totalDetail = visibleParts.reduce((sum, part) => sum + (art[part.id]?.microParts ?? 0), 0);

  return <div className={`${styles.viewport} ${dragging ? styles.dragging : ''}`} data-tool={tool} data-view={view} data-renderer="anatomy" data-solid-count={totalDetail}>
    <svg ref={svg} className={styles.svg} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label={`${project.name}, interactive hardware assembly. Select individual parts to inspect and edit. Drag the background to pan and scroll to zoom.`}
      onPointerDown={event => begin(event, null)} onPointerMove={move} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)}>
      <defs><pattern id={`dots-${patternId}`} width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="#c9d1c8" /></pattern><filter id={`shadow-${patternId}`} x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="9" /></filter></defs>
      <rect width={WIDTH} height={HEIGHT} fill={`url(#dots-${patternId})`} opacity=".6" pointerEvents="none" />
      <g transform={`translate(${WIDTH / 2 + pan[0]} ${HEIGHT / 2 + pan[1]}) scale(${zoom}) translate(${-WIDTH / 2} ${-HEIGHT / 2})`}>
        <ellipse cx={WIDTH / 2} cy={HEIGHT * .69} rx="205" ry="34" fill="#9ca997" opacity=".12" filter={`url(#shadow-${patternId})`} pointerEvents="none" />
        {sortedParts.map(part => {
          const library = libFor(part);
          const target = positions.current[part.id] ?? targets[part.id];
          const [x, y] = k.iso(toAnatomy(target), projection);
          const active = selectedId === part.id || hoveredId === part.id || activePartIds.includes(part.id);
          const future = mode === 'build' && !placedParts.has(part.id) && !completedParts.has(part.id);
          const dimmed = Boolean(isolatedId && isolatedId !== part.id);
          return <g key={part.id} ref={node => { if (node) objects.current.set(part.id, node); else objects.current.delete(part.id); }} transform={`translate(${x} ${y}) scale(${projection.scale})`} className={styles.part} data-part-id={part.id} data-library-id={part.libraryId} data-selected={selectedId === part.id ? 'true' : undefined} data-active={active ? 'true' : undefined} opacity={future ? .16 : dimmed ? .1 : 1}
            role={ambient ? undefined : 'button'} tabIndex={ambient ? -1 : 0} aria-label={`${part.label}: ${library.name}. ${part.role}`} aria-pressed={selectedId === part.id}
            onFocus={() => !ambient && onHover(part.id)} onBlur={() => !ambient && onHover(null)} onPointerEnter={() => !ambient && !drag.current && onHover(part.id)} onPointerLeave={() => !ambient && !drag.current && onHover(null)} onPointerDown={event => begin(event, part.id)}
            onKeyDown={event => { if (ambient) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(selectedId === part.id ? null : part.id); } if (event.key === 'Escape') onSelect(null); if (onTransform && tool === 'move' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); const amount = event.shiftKey ? 5 : 1; const delta: Vec3 = [event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0, 0, event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0]; onTransform(part.id, plus(part.assembledPosition, delta), part.rotation); } }}>
            <g transform={art[part.id].transform} data-orientation="">
              <rect className={styles.hitTarget} data-part-hit="" {...art[part.id].hitBounds} rx="2" />
              <HardwareArt art={art[part.id]} />
              {active && <path className={styles.selection} d={art[part.id].silhouette} fill="none" pointerEvents="none" strokeWidth={1.2 / projection.scale} />}
            </g>
          </g>;
        })}
        {showWires && <g className={styles.wires} pointerEvents="none">{wires.map((wire, index) => {
          const active = wire.id === highlightedWire || activeWireIds.includes(wire.id);
          const future = mode === 'build' && !placedWires.has(wire.id);
          return <path key={wire.id} pathLength={1} className={mode === 'build' && activeWireIds.includes(wire.id) ? styles.wireEntering : undefined} ref={node => { if (node) wireObjects.current.set(wire.id, node); else wireObjects.current.delete(wire.id); }} data-wire-id={wire.id} d={wirePath(wire, positions.current, index)} fill="none" stroke={active ? '#2563eb' : WIRE_COLOURS[wire.wireColor]} strokeWidth={active ? 2.6 : 1.55} opacity={future ? .07 : active ? 1 : .83} strokeLinecap="round" strokeLinejoin="round"><title>{wire.from.pin} → {wire.to.pin}: {wire.purpose}</title></path>;
        })}</g>}
      </g>
      {!visibleParts.length && <text x={WIDTH / 2} y={HEIGHT / 2} textAnchor="middle" fill="#8b958c" fontSize="14">All parts are hidden. Show a part in the component tree.</text>}
    </svg>
    {selected && showLabels && <div className={styles.partReadout}><span className={styles.reference}>{focusedPart.label}</span><div><strong>{focusedLibrary?.name ?? focusedPart.libraryId}</strong><span>{focusedLibrary?.size.join(' × ')} mm{tool === 'move' ? ' · Drag to move on the work plane' : tool === 'rotate' ? ' · Drag to rotate' : ' · Selected for inspection'}</span></div></div>}
  </div>;
}
