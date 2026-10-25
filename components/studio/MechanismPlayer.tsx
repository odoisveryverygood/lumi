'use client';
import { Pause, Play, RotateCcw, X } from 'lucide-react';
import type { DeviceMechanism, MechanismPlayback } from '@/lib/studio/types';
export default function MechanismPlayer({ mechanism, playback, onChange, onClose }: {
  mechanism: DeviceMechanism; playback: MechanismPlayback;
  onChange: (patch: Partial<MechanismPlayback>) => void; onClose: () => void;
}) {
  const stage = [...mechanism.stages].reverse().find(s => s.at <= playback.progress) || mechanism.stages[0];
  return <section className="ds-mechanism-player" aria-label="Mechanism explanation">
    <div className="ds-mechanism-heading"><span><i/>LIVE EXPLANATION</span><button aria-label="Close mechanism explanation" onClick={onClose}><X size={15}/></button></div>
    <div className="ds-mechanism-copy"><h3>{stage?.title || mechanism.name}</h3><p>{stage?.description || mechanism.description}</p></div>
    <div className="ds-mechanism-timeline"><button aria-label={playback.playing ? 'Pause mechanism' : playback.progress >= 1 ? 'Replay mechanism' : 'Play mechanism'} onClick={() => onChange({ playing: !playback.playing, ...(playback.progress >= 1 ? { progress: 0 } : {}), nonce: playback.nonce + 1 })}>{playback.playing ? <Pause size={15}/> : playback.progress >= 1 ? <RotateCcw size={15}/> : <Play size={15}/>}</button><input aria-label="Mechanism progress" type="range" min={0} max={1} step={.005} value={playback.progress} onChange={e => onChange({ progress: Number(e.target.value), playing: false, nonce: playback.nonce + 1 })}/><output>{Math.round(playback.progress * 100)}%</output></div>
    <div className="ds-mechanism-stages">{mechanism.stages.map((s, i) => <button key={i} className={stage === s ? 'is-active' : ''} aria-label={`Show stage: ${s.title}`} onClick={() => onChange({ progress: s.at, playing: false, nonce: playback.nonce + 1 })}>{i + 1}</button>)}<span>{mechanism.name}</span></div>
  </section>;
}
