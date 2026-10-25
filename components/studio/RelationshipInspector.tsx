'use client';
import { ArrowRight, Cable, Link2 } from 'lucide-react';
import type { DeviceDocument } from '@/lib/studio/types';
export default function RelationshipInspector({ document, partId, onFocus }: { document: DeviceDocument; partId: string; onFocus: (ids: string[]) => void }) {
  const relationships = document.relationships?.filter(r => r.from === partId || r.to === partId) || [];
  if (!relationships.length) return null;
  return <div className="ds-panel-section ds-relationship-inspector"><h3>How it connects</h3>{relationships.map(relationship => {
    const otherId = relationship.from === partId ? relationship.to : relationship.from;
    const other = document.parts.find(p => p.id === otherId); if (!other) return null;
    return <button key={relationship.id} onClick={() => onFocus([partId, otherId])} aria-label={`Trace connection to ${other.name}`}>
      <span className="ds-relationship-type">{relationship.type === 'electrical' || relationship.type === 'data' ? <Cable size={13}/> : <Link2 size={13}/>}<span>{relationship.type}</span></span><strong>{other.name}</strong><small>{relationship.description}</small><span className="ds-trace-link">Show connection<ArrowRight size={11}/></span>
    </button>;
  })}</div>;
}
