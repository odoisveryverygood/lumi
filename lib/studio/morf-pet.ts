export type PetPoint = {x:number;y:number};
export type PetMode = 'guide'|'stay'|'roam';
export type PetMemory = {version:1;home:PetPoint|null;mode:PetMode;motion:boolean|null};
// Stable key keeps the companion's saved position across the Morf rename.
export const PET_STORAGE_KEY='lumi.pet.v1';
export const DRAG_THRESHOLD=6;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

/** The full pet and its action button must remain reachable, including after resize. */
export function clampPet(point:PetPoint,width:number,height:number):PetPoint{
  return {x:clamp(point.x,Math.min(55,width/2),Math.max(55,width-55)),y:clamp(point.y,Math.min(112,height/2),Math.max(112,height-85))};
}
export function rememberPet(point:PetPoint,width:number,height:number):PetPoint{
  const safe=clampPet(point,width,height);
  return {x:safe.x/Math.max(1,width),y:safe.y/Math.max(1,height)};
}
export function restorePet(point:PetPoint,width:number,height:number):PetPoint{
  return clampPet({x:point.x*width,y:point.y*height},width,height);
}
export function isPetDrag(start:PetPoint,current:PetPoint){return Math.hypot(current.x-start.x,current.y-start.y)>=DRAG_THRESHOLD;}
export function readPetMemory(raw:string|null):PetMemory|null{
  if(!raw)return null;
  try{
    const p=JSON.parse(raw);
    if(p?.version!==1||!['guide','stay','roam'].includes(p.mode)||!(p.motion===null||typeof p.motion==='boolean'))return null;
    const h=p.home;
    if(h!==null&&(!h||!Number.isFinite(h.x)||!Number.isFinite(h.y)||h.x<0||h.x>1||h.y<0||h.y>1))return null;
    return {version:1,home:h===null?null:{x:h.x,y:h.y},mode:p.mode,motion:p.motion};
  }catch{return null;}
}
