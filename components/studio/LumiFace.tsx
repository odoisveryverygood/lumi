export default function LumiFace({small=false}:{small?:boolean}){
  return <span className={`lumi-face${small?' lumi-face-small':''}`} aria-hidden="true">
    <span className="lumi-body"><span className="lumi-arm lumi-arm-left"/><span className="lumi-arm lumi-arm-right"/><span className="lumi-shine"/><span className="lumi-eyes"><i><b/></i><i><b/></i></span><span className="lumi-cheek lumi-cheek-left"/><span className="lumi-cheek lumi-cheek-right"/><span className="lumi-smile"/></span><span className="lumi-sleep-marks">z<span>z</span></span><span className="lumi-ground-shadow"/>
  </span>;
}
