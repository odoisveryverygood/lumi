'use client';
import { useMemo } from 'react';
import { ChevronRight, Eye, EyeOff, Layers3 } from 'lucide-react';
import type { DeviceDocument, DevicePart } from '@/lib/studio/types';
import PartThumbnail from './PartThumbnail';
export default function AssemblyTree({ document, search, selectedId, hiddenIds, highlightedIds, scene, onSelect, onHover, onHide, onFocus }: {
  document: DeviceDocument; search: string; selectedId: string | null; hiddenIds: string[]; highlightedIds: string[]; scene?: unknown;
  onSelect: (id: string) => void; onHover: (id: string | null) => void; onHide: (id: string) => void; onFocus: (ids: string[]) => void;
}) {
  const groups = useMemo(() => {
    const visible = document.parts.filter(p => `${p.name} ${p.category} ${p.role}`.toLowerCase().includes(search.toLowerCase()));
    if (document.assemblies?.length) {
      const assemblies = document.assemblies;
      const depth = (id: string): number => { let n = 0, current = assemblies.find(a => a.id === id); const seen = new Set<string>(); while (current?.parentId && !seen.has(current.id)) { seen.add(current.id); n++; current = assemblies.find(a => a.id === current?.parentId); } return n; };
      const owners = new Map(visible.map(part => { const candidates = assemblies.filter(a => a.partIds.includes(part.id)).sort((a, b) => depth(b.id) - depth(a.id)); return [part.id, part.assemblyId || candidates[0]?.id]; }));
      const rows = assemblies.map(a => ({ id: a.id, name: a.name, parentId: a.parentId, parts: visible.filter(p => owners.get(p.id) === a.id) }));
      const rest = visible.filter(p => !owners.get(p.id));
      if (rest.length) rows.push({ id: 'ungrouped', name: 'Other components', parentId: undefined, parts: rest });
      return rows;
    }
    return Array.from(new Set(visible.map(p => p.category))).map(category => ({ id: category, name: category, parentId: undefined, parts: visible.filter(p => p.category === category) }));
  }, [document, search]);
  function row(part: DevicePart) {
    return <div key={part.id} className={'ds-part-row' + (selectedId === part.id ? ' is-selected' : '') + (highlightedIds.includes(part.id) ? ' is-highlighted' : '') + (hiddenIds.includes(part.id) ? ' is-hidden' : '')} onMouseEnter={() => onHover(part.id)} onMouseLeave={() => onHover(null)}><button className="ds-part-select" onClick={() => onSelect(part.id)}><PartThumbnail part={part} scene={scene}/><span><strong>{part.name}</strong><small>{part.specs.Type || part.specs.Interface || part.category}</small></span></button><button className="ds-part-eye" aria-label={`${hiddenIds.includes(part.id) ? 'Show' : 'Hide'} ${part.name}`} onClick={() => onHide(part.id)}>{hiddenIds.includes(part.id) ? <EyeOff size={13}/> : <Eye size={13}/>}</button></div>;
  }
  function descendants(id: string, seen = new Set<string>()): DevicePart[] { if (seen.has(id)) return []; seen.add(id); const group = groups.find(g => g.id === id); return [...(group?.parts || []), ...groups.filter(g => g.parentId === id).flatMap(g => descendants(g.id, seen))]; }
  function renderGroup(group: typeof groups[number], nested = false): React.ReactNode {
    const children = groups.filter(g => g.parentId === group.id), members = descendants(group.id);
    if (!members.length && !children.some(child => descendants(child.id).length)) return null;
    return <details className={'ds-assembly-group' + (nested ? ' ds-assembly-child' : '')} key={`${document.id}-${group.id}-${!!search}`} open={search ? true : members.length < 30 || !group.parts.length ? true : undefined}><summary><ChevronRight size={12}/><Layers3 size={13}/><span>{group.name}</span><small>{members.length}</small></summary>{members.length > 0 && <button className="ds-focus-assembly" onClick={() => onFocus(members.map(p => p.id))}>Show this assembly<ChevronRight size={11}/></button>}{group.parts.map(row)}{children.map(child => renderGroup(child, true))}</details>;
  }
  const roots = groups.filter(g => !g.parentId || !groups.some(parent => parent.id === g.parentId));
  return <>{roots.map(group => renderGroup(group))}{!groups.some(g => g.parts.length) && <p className="ds-empty">No matching components.</p>}</>;
}
