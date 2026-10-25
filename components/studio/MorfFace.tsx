import type {MorfMode} from '@/lib/studio/morf-character';
import type {MorfShape} from '@/lib/studio/morf-shape';

/**
 * Morf is a shape-shifter. Without an object it is a soft blob; as parts arrive it
 * re-forms into a miniature silhouette of the object on screen, one cell per part.
 * Pure SVG and CSS: no model download, canvas or render loop.
 */
export default function MorfFace({small=false,mode='idle',shape}:{small?:boolean;mode?:MorfMode;shape?:MorfShape}){
 const phase=shape?.phase??'blob',progress=shape?.progress??0,built=shape?.built??0;
 // Cells assemble in document order up to the built count; the rest stay inside the blob.
 let shown=0;const cells=(shape?.cells??[]).map(c=>({...c,on:false}));
 for(const id of shape?.cells.map(c=>c.id)??[]){const index=shape!.cells.findIndex(c=>c.id===id);if(shown<built&&index>=0){cells[index].on=true;shown++;}}
 const top=cells.filter(c=>c.on).sort((a,b)=>a.y-b.y)[0];
 const eyeX=top?Math.max(22,Math.min(78,top.x+top.w/2)):50,eyeY=top?Math.max(18,top.y+Math.min(top.h*.45,10)):46;
 const blobScale=phase==='formed'?.18:phase==='forming'?1-progress*.75:1;
 return <span className={`morf-character${small?' morf-character--small':''}`} data-mode={mode} data-phase={phase} aria-hidden="true" style={{['--morf-progress' as string]:progress}}>
  <span className="morf-character-shadow"/>
  <svg className="morf-body" viewBox="0 0 100 100" focusable="false">
   <defs><radialGradient id="morf-skin" cx="38%" cy="32%" r="75%"><stop offset="0" stopColor="#fff4d6"/><stop offset=".55" stopColor="#f3c86b"/><stop offset="1" stopColor="#c98b2a"/></radialGradient></defs>
   <g className="morf-blob" style={{transform:`translate(50px,${phase==='formed'?82:58}px) scale(${blobScale})`}}>
    <path className="morf-blob-skin" d="M-30,-8 C-30,-30 -12,-38 2,-36 C20,-34 32,-22 30,-4 C28,14 18,30 0,30 C-18,30 -30,14 -30,-8 Z" fill="url(#morf-skin)"/>
    <path className="morf-blob-gloss" d="M-18,-22 C-10,-30 2,-30 8,-26 C2,-22 -8,-18 -14,-10 C-18,-14 -20,-18 -18,-22 Z" fill="#fff" opacity=".45"/>
   </g>
   <g className="morf-cells">{cells.map((c,i)=><rect key={c.id} className="morf-cell" data-on={c.on} x={c.x} y={c.y} width={c.w} height={c.h} rx={Math.min(3,c.w/4,c.h/4)} fill={c.color} style={{transitionDelay:`${Math.min(600,i*35)}ms`,transformOrigin:'50px 60px'}}><title>{c.name}</title></rect>)}</g>
   <g className="morf-eyes" style={{transform:`translate(${eyeX}px,${eyeY}px)`}}>
    <ellipse className="morf-eye-ring" cx="0" cy="0" rx="13" ry="7.5" fill="#fffdf4" opacity=".9"/>
    <circle className="morf-eye morf-eye--l" cx="-5.5" cy="0" r="2.6" fill="#2b2a28"/><circle className="morf-eye morf-eye--r" cx="5.5" cy="0" r="2.6" fill="#2b2a28"/>
    <path className="morf-mouth" d="M-3,5 Q0,7.5 3,5" stroke="#2b2a28" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
   </g>
   <rect className="morf-scan" x="6" y="0" width="88" height="2" rx="1" fill="#efa345" opacity="0"/>
   <g className="morf-probe"><line x1="50" y1="60" x2="92" y2="40" stroke="#c98b2a" strokeWidth="1.6" strokeLinecap="round"/><circle cx="92" cy="40" r="2.4" fill="#efa345"/></g>
  </svg>
 </span>;
}
