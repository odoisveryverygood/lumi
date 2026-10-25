'use client';
import {useEffect,useRef,useState,type KeyboardEvent,type PointerEvent,type RefObject} from 'react';
import {guidePosition,type GuideAnchor} from '@/lib/studio/lumi-motion';
import {clampPet,isPetDrag,PET_STORAGE_KEY,readPetMemory,rememberPet,restorePet,type PetMemory,type PetPoint} from '@/lib/studio/lumi-pet';

type Options={forceMotion:boolean;open:boolean;guideKey:string;busy:boolean;hidden:boolean;gallery:boolean;rightInset:number;leftInset:number;answerKey:number};
type Drag={id:number;start:PetPoint;origin:PetPoint;offset:PetPoint;moved:boolean};
type Emotion='idle'|'wave'|'happy'|'land'|'look';

/** High-frequency position stays outside React; only deliberate pet actions render. */
export function useLumiPet(options:Options,actor:RefObject<HTMLDivElement|null>,leader:RefObject<SVGPathElement|null>,dot:RefObject<SVGCircleElement|null>,anchor:RefObject<GuideAnchor|null>){
  const [dragging,setDragging]=useState(false);
  const [emotion,setEmotion]=useState<Emotion>('idle');
  const [notice,setNotice]=useState('Drag me anywhere. Click to talk.');
  const memory=useRef<PetMemory>({version:1,home:null,mode:'guide',motion:null});
  const current=useRef(options);current.current=options;
  const position=useRef<PetPoint>({x:0,y:0});
  // A drop wins until a new selected part or answer calls for automatic guidance.
  const placedFor=useRef<string|null>(null);
  const drag=useRef<Drag|null>(null),suppressClick=useRef(false);
  const reactionTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const lastActivity=useRef(0),lastAnswer=useRef(options.answerKey);
  const animations=true;
  const animationsRef=useRef(animations);animationsRef.current=animations;

  function save(){try{localStorage.setItem(PET_STORAGE_KEY,JSON.stringify(memory.current));}catch{/* Placement still works when browser storage is unavailable. */}}
  function react(emote:Emotion){
    if(reactionTimer.current)clearTimeout(reactionTimer.current);
    setEmotion(emote);lastActivity.current=performance.now();
    reactionTimer.current=setTimeout(()=>setEmotion('idle'),emote==='look'?2100:1800);
  }
  function place(point:PetPoint){position.current=clampPet(point,innerWidth,innerHeight);memory.current.home=rememberPet(position.current,innerWidth,innerHeight);placedFor.current=current.current.guideKey;save();}

  useEffect(()=>{
    try{const saved=readPetMemory(localStorage.getItem(PET_STORAGE_KEY));if(saved)memory.current={...saved,mode:'guide',motion:null};}catch{/* Use the default dock. */}
    const p=current.current;
    position.current=memory.current.home?restorePet(memory.current.home,innerWidth,innerHeight):guidePosition(null,innerWidth,innerHeight,p.rightInset,p.leftInset);
    lastActivity.current=performance.now();
    return()=>{if(reactionTimer.current)clearTimeout(reactionTimer.current);};
  },[]);
  useEffect(()=>{if(options.answerKey!==lastAnswer.current){lastAnswer.current=options.answerKey;if(options.answerKey>0)react('happy');}},[options.answerKey]);
  useEffect(()=>{
    const timer=setInterval(()=>{
      const p=current.current;
      if(!animationsRef.current||p.hidden||p.busy||p.open||drag.current||document.hidden||performance.now()-lastActivity.current<5500)return;
      const sequence:Emotion[]=['look','wave'];react(sequence[Math.floor(Math.random()*sequence.length)]);
    },6500);
    return()=>clearInterval(timer);
  },[]);
  useEffect(()=>{
    let frame=0,previous=performance.now(),hop=1;
    const pointer=(event:globalThis.PointerEvent)=>{
      const {x,y}=position.current;
      actor.current?.style.setProperty('--look-x',`${Math.max(-3,Math.min(3,(event.clientX-x)/100))}px`);
      actor.current?.style.setProperty('--look-y',`${Math.max(-2,Math.min(2,(event.clientY-y)/130))}px`);
    };
    window.addEventListener('pointermove',pointer,{passive:true});
    const tick=(now:number)=>{
      const dt=Math.min(.05,(now-previous)/1000);previous=now;
      const p=current.current,m=memory.current,a=p.gallery?null:anchor.current;
      if(p.hidden||document.hidden){frame=requestAnimationFrame(tick);return;}
      const manuallyPlaced=placedFor.current===p.guideKey;
      const guiding=!!a?.visible&&!manuallyPlaced&&!p.busy&&!drag.current;
      const animate=animationsRef.current;
      let target=guiding?guidePosition(a,innerWidth,innerHeight,Math.max(p.rightInset,p.open?380:0),p.leftInset):m.home?restorePet(m.home,innerWidth,innerHeight):p.gallery&&innerWidth<650?{x:innerWidth-55,y:Math.min(innerHeight*.5,420)}:guidePosition(null,innerWidth,innerHeight,p.rightInset,p.leftInset);
      if(p.rightInset>0&&!manuallyPlaced)target=clampPet({...target,x:Math.min(target.x,innerWidth-p.rightInset-85)},innerWidth,innerHeight);
      const pos=position.current,distance=Math.hypot(target.x-pos.x,target.y-pos.y);
      if(drag.current?.moved){hop=1;}
      else if(!drag.current){
        if(distance>70&&hop>=1)hop=0;
        hop=Math.min(1,hop+dt*1.7);
        const ease=animate?1-Math.exp(-dt*7):1;
        position.current=clampPet({x:pos.x+(target.x-pos.x)*ease,y:pos.y+(target.y-pos.y)*ease},innerWidth,innerHeight);
      }
      position.current=clampPet(position.current,innerWidth,innerHeight);
      const {x,y}=position.current;
      const jump=animate&&!drag.current?Math.sin(hop*Math.PI)*38:0;
      const el=actor.current;
      if(el){
        el.style.transform=`translate3d(${x-36}px,${y-36-jump}px,0)`;
        el.dataset.moving=String(!drag.current&&distance>7);el.dataset.side=x>innerWidth*.5?'left':'right';el.dataset.high=String(y<300);
        el.style.setProperty('--pet-tilt',`${drag.current?.moved?Math.max(-15,Math.min(15,(x-drag.current.origin.x)/12)):0}deg`);
      }
      const show=guiding&&!p.hidden&&!p.open;
      leader.current?.setAttribute('d',show?`M${x},${y-jump+5}Q${x+8},${a!.y-32} ${a!.x},${a!.y}`:'');
      if(dot.current){dot.current.setAttribute('cx',String(a?.x||0));dot.current.setAttribute('cy',String(a?.y||0));dot.current.style.opacity=show?'1':'0';}
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('pointermove',pointer);};
  },[actor,anchor,dot,leader]);

  function onPointerDown(event:PointerEvent<HTMLButtonElement>){
    if(!event.isPrimary||event.button!==0)return;
    const point={x:event.clientX,y:event.clientY};
    drag.current={id:event.pointerId,start:point,origin:{...position.current},offset:{x:point.x-position.current.x,y:point.y-position.current.y},moved:false};
    suppressClick.current=false;event.currentTarget.setPointerCapture(event.pointerId);lastActivity.current=performance.now();
  }
  function onPointerMove(event:PointerEvent<HTMLButtonElement>){
    const d=drag.current;if(!d||d.id!==event.pointerId)return;
    if(!d.moved&&!isPetDrag(d.start,{x:event.clientX,y:event.clientY}))return;
    if(!d.moved){d.moved=true;setDragging(true);setEmotion('idle');}
    event.preventDefault();position.current=clampPet({x:event.clientX-d.offset.x,y:event.clientY-d.offset.y},innerWidth,innerHeight);
  }
  function finish(event:PointerEvent<HTMLButtonElement>,cancel=false){
    const d=drag.current;if(!d||d.id!==event.pointerId)return;
    drag.current=null;setDragging(false);
    if(d.moved){
      suppressClick.current=true;
      if(cancel)position.current=d.origin;
      else{place(position.current);react('land');setNotice('New spot saved. Click to chat. I’ll guide you automatically when you explore another part.');}
    }
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function onKeyDown(event:KeyboardEvent<HTMLButtonElement>){
    if(event.key===' '||event.key==='Enter'){event.stopPropagation();return;}
    const delta=event.shiftKey?40:12;
    const moves:Record<string,PetPoint>={ArrowLeft:{x:-delta,y:0},ArrowRight:{x:delta,y:0},ArrowUp:{x:0,y:-delta},ArrowDown:{x:0,y:delta}};
    const step=moves[event.key];if(!step)return;
    event.preventDefault();event.stopPropagation();place({x:position.current.x+step.x,y:position.current.y+step.y});setNotice('Lumi moved. This spot is saved.');
  }
  function consumeDragClick(){if(!suppressClick.current)return false;suppressClick.current=false;return true;}
  return {animations,dragging,emotion,notice,consumeDragClick,
    bindings:{onPointerDown,onPointerMove,onPointerUp:(e:PointerEvent<HTMLButtonElement>)=>finish(e),onPointerCancel:(e:PointerEvent<HTMLButtonElement>)=>finish(e,true),onLostPointerCapture:(e:PointerEvent<HTMLButtonElement>)=>finish(e,true),onKeyDown}};
}
