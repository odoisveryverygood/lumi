import * as k from '@/vendor/anatomy/iso-kit';
import { PART_MAP } from '@/lib/library';
import type { PartInstance, Vec3 } from '@/lib/types';
import { rotateXYZ, toAnatomy } from './geometry';

/** Assemblies carried on a broad surface must paint after that surface.
 * Centre-only depth sorting incorrectly puts the front half of a breadboard
 * on top of an entire controller above it. Establish vertical support edges
 * using real rotated footprints, then depth-sort independent assemblies. */
export function assemblyPaintOrder(parts: PartInstance[], poses: Record<string, Vec3>, projection: k.Projection): PartInstance[] {
  const boundsAt = (positions: Record<string, Vec3>) => new Map(parts.map(part => {
    const size = PART_MAP[part.libraryId]?.size ?? [20, 5, 20];
    const position = positions[part.id] ?? part.assembledPosition;
    const corners = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => {
      const rotated = rotateXYZ([x * size[0] / 2, y * size[1] / 2, z * size[2] / 2], part.rotation);
      return rotated.map((v, i) => v + position[i]);
    })));
    return [part.id, {
      minX: Math.min(...corners.map(p => p[0])), maxX: Math.max(...corners.map(p => p[0])),
      minY: Math.min(...corners.map(p => p[1])), maxY: Math.max(...corners.map(p => p[1])),
      minZ: Math.min(...corners.map(p => p[2])), maxZ: Math.max(...corners.map(p => p[2])),
    }] as const;
  }));
  const bounds = boundsAt(poses);
  const restBounds = boundsAt({});
  const overlaps = (a: { minX: number; maxX: number; minZ: number; maxZ: number }, b: typeof a) => Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > .5 && Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ) > .5;
  const after = new Map(parts.map(part => [part.id, new Set<string>()]));
  const incoming = new Map(parts.map(part => [part.id, 0]));
  for (const lower of parts) for (const upper of parts) {
    if (lower.id === upper.id) continue;
    const a = bounds.get(lower.id)!, b = bounds.get(upper.id)!;
    const restA = restBounds.get(lower.id)!, restB = restBounds.get(upper.id)!;
    // A supported assembly keeps its painting relation when it spreads
    // laterally during an explode, as long as it remains above its support.
    const restSupported = overlaps(restA, restB) && restA.minY < restB.minY && restA.maxY <= restB.minY + .6;
    const overlap = overlaps(a, b) || restSupported;
    if (overlap && a.minY < b.minY && a.maxY <= b.minY + .6) {
      after.get(lower.id)!.add(upper.id);
      incoming.set(upper.id, incoming.get(upper.id)! + 1);
    }
  }
  const compare = (a: PartInstance, b: PartInstance) => k.depthOf(toAnatomy(poses[a.id] ?? a.assembledPosition), projection) - k.depthOf(toAnatomy(poses[b.id] ?? b.assembledPosition), projection);
  const ready = parts.filter(part => incoming.get(part.id) === 0).sort(compare);
  const result: PartInstance[] = [];
  const byId = new Map(parts.map(part => [part.id, part]));
  while (ready.length) {
    const next = ready.shift()!;
    result.push(next);
    for (const id of after.get(next.id)!) {
      incoming.set(id, incoming.get(id)! - 1);
      if (incoming.get(id) === 0) { ready.push(byId.get(id)!); ready.sort(compare); }
    }
  }
  // Vertical edges are acyclic by construction; keep a safe deterministic fallback.
  if (result.length < parts.length) result.push(...parts.filter(part => !result.includes(part)).sort(compare));
  return result;
}
