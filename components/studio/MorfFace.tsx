import type {MorfMode} from '@/lib/studio/morf-character';

/** Six articulated ceramic plates around a dark chassis. CSS handles all motion. */
export default function MorfFace({small=false,mode='idle'}:{small?:boolean;mode?:MorfMode}){
 return <span className={`morf-character${small?' morf-character--small':''}`} data-mode={mode} aria-hidden="true">
  <span className="morf-character-shadow"/>
  <span className="morf-character-float"><span className="morf-cube">
   <span className="morf-chassis"/>
   <span className="morf-plate morf-plate--back"/>
   <span className="morf-plate morf-plate--bottom"><i/><i/></span>
   <span className="morf-plate morf-plate--left"><span className="morf-panel-vents"><i/><i/><i/></span></span>
   <span className="morf-plate morf-plate--right"><span className="morf-panel-vents"><i/><i/><i/></span><b className="morf-panel-light"/></span>
   <span className="morf-plate morf-plate--top"><span className="morf-panel-mark">m</span><i className="morf-panel-groove"/></span>
   <span className="morf-plate morf-plate--front">
    <i className="morf-screw morf-screw--tl"/><i className="morf-screw morf-screw--tr"/>
    <span className="morf-optic"><span className="morf-optic-track"/><span className="morf-optic-glass"><span className="morf-optic-iris"><i/></span><b className="morf-scan-line"/></span></span>
    <span className="morf-face-indicator"><i/><i/><i/></span><small>01</small>
   </span>
   <span className="morf-probe"><span/><i/></span>
   <span className="morf-lens-arm"><span className="morf-lens"><i/></span></span>
   <span className="morf-foot morf-foot--left"/><span className="morf-foot morf-foot--right"/>
  </span></span>
 </span>;
}
