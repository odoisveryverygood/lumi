export type GuideAnchor = { x:number; y:number; visible:boolean };
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const smooth=(t:number)=>{const x=clamp(t,0,1);return x*x*(3-2*x);};

/** Presentation only: the document and its editable transforms never change. */
export function showcaseFrame(elapsedMs:number,explode:number,reducedMotion=false){
  if(reducedMotion)return {scale:1,explode,rotating:false,complete:true};
  return {scale:.12+.88*(1-Math.pow(1-clamp(elapsedMs/1250,0,1),3)),explode:explode*smooth((elapsedMs-850)/1900),rotating:elapsedMs>=3200,complete:elapsedMs>=2750};
}

/** Place the guide beside its subject, away from the main composer and drawers. */
export function guidePosition(anchor:GuideAnchor|null,width:number,height:number,rightInset=0,leftInset=0){
  const mobile=width<650;
  const left=mobile?48:Math.min(leftInset+75,width*.4),right=Math.max(left,width-rightInset-78);
  const bottom=Math.max(120,height-(mobile?205:185));
  const x=anchor?.visible?anchor.x+72:right;
  const y=anchor?.visible?anchor.y-54:bottom;
  return {x:clamp(x,left,right),y:clamp(y,Math.min(245,bottom-10),bottom)};
}
