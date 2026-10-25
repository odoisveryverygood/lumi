'use client';
import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {ArrowUpRight,ArrowUp,LoaderCircle,MessageCircle,Volume2,VolumeX,X} from 'lucide-react';
import MorfFace from './MorfFace';
import {morfActivity} from '@/lib/studio/morf-character';
import {morfShapeLabel,type MorfShape} from '@/lib/studio/morf-shape';
import VoiceInput from '../VoiceInput';
import {type GuideAnchor} from '@/lib/studio/morf-motion';
import {useMorfPet} from './useMorfPet';

export type MorfGuideHandle={pointTo:(anchor:GuideAnchor|null)=>void};
type Props={forceMotion:boolean;shape?:MorfShape;partId?:string;partName?:string;partRole?:string;answer:string;answerKey:number;busy:boolean;progress:string;error?:string;rightInset:number;leftInset:number;gallery:boolean;hidden:boolean;onAsk:(text:string)=>void;onCancel:()=>void;onConversation:()=>void;tell:(text:string)=>void};
const readable=(text:string)=>text.replace(/[*`#]/g,'').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').trim();

const MorfGuide=forwardRef<MorfGuideHandle,Props>(function MorfGuide(props,ref){
  const [open,setOpen]=useState(false),[draft,setDraft]=useState(''),[bubble,setBubble]=useState(true),[muted,setMuted]=useState(true),[question,setQuestion]=useState('');
  const actor=useRef<HTMLDivElement>(null),leader=useRef<SVGPathElement>(null),dot=useRef<SVGCircleElement>(null),anchor=useRef<GuideAnchor|null>(null);
  const lastSpeech=useRef(-1),previousPart=useRef(props.partName),input=useRef<HTMLInputElement>(null);
  useImperativeHandle(ref,()=>({pointTo:value=>{anchor.current=value;}}),[]);
  const pet=useMorfPet({...props,open,guideKey:`${props.partId||props.partName||''}:${props.answerKey}`},actor,leader,dot,anchor);
  useEffect(()=>{setBubble(true);const timer=setTimeout(()=>setBubble(false),11000);return()=>clearTimeout(timer);},[props.answerKey,props.partName]);
  useEffect(()=>{if(open)input.current?.focus();},[open]);
  useEffect(()=>{if(previousPart.current!==props.partName){previousPart.current=props.partName;setBubble(true);}},[props.partName]);
  useEffect(()=>{
    if(muted||props.busy||!props.answer||lastSpeech.current===props.answerKey||!('speechSynthesis'in window))return;
    lastSpeech.current=props.answerKey;const speech=new SpeechSynthesisUtterance(readable(props.answer).slice(0,900));speech.rate=1.04;speech.pitch=1.25;window.speechSynthesis.speak(speech);
    return()=>window.speechSynthesis.cancel();
  },[props.answerKey,props.answer,props.busy,muted]);
  function ask(text:string){if(!text.trim()||props.busy)return;setQuestion(text.trim());setDraft('');setBubble(true);props.onAsk(text.trim());}
  const activity=morfActivity({...props,emotion:pet.emotion,dragging:pet.dragging});
  const excerpt=readable(props.answer);const formed=props.shape?.phase==='formed',forming=props.shape?.phase==='forming';const speech=props.busy?(forming?`Taking shape… ${props.shape!.built} of ${props.shape!.total} parts so far.`:'Unfolding the details…'):props.error|| (props.partName?`${props.partName}. ${props.partRole||'Let’s explore this part together.'}`:formed?`I’ve morphed into ${props.shape!.name.replace(/\s*\/\s*01$/,'')}. Ask me what I’m made of.`:forming?`Still forming: ${props.shape!.built} of ${props.shape!.total} parts in place.`:'I’m Morf. Give me an object and I’ll take its shape.');
  return <div className="morf-guide-layer" hidden={props.hidden} data-animated={pet.animations} data-state={activity.mode}>
    <svg className="morf-pointer" aria-hidden="true"><path ref={leader}/><circle ref={dot} r="4"/></svg>
    <div ref={actor} className="morf-actor" data-side="left" data-open={open} data-dragging={pet.dragging} data-emotion={pet.emotion} style={{transform:'translate3d(calc(100vw - 110px),calc(100vh - 220px),0)'}}>
      {bubble&&!open&&!pet.dragging&&<div className="morf-whisper" role="status"><span>{props.busy?(forming?'TAKING SHAPE':'WORKING THROUGH THE PARTS'):props.partName?'LET’S LOOK HERE':formed?'I AM YOUR OBJECT':'YOUR IDEAS, TAKING SHAPE'}</span><p>{props.answer&&props.answerKey>0&&!props.busy?excerpt.slice(0,155)+(excerpt.length>155?'…':''):speech}</p><button onClick={()=>setOpen(true)}>Ask Morf <ArrowUpRight size={12}/></button></div>}
      
      <button className="morf-pet" {...pet.bindings} aria-describedby="morf-pet-help" title="Drag to move · click to talk · arrow keys to nudge" aria-label={open?'Close Morf conversation':'Talk to Morf'} aria-expanded={open} onClick={()=>{if(pet.consumeDragClick())return;setOpen(value=>!value);}}><MorfFace mode={activity.mode} shape={props.shape}/><span className="morf-pet-label">{forming?morfShapeLabel(props.shape!):activity.label}<MessageCircle size={10}/></span></button>
    </div>
    <span id="morf-pet-help" className="morf-sr-only">Drag Morf anywhere. Arrow keys move 12 pixels; Shift moves 40. Click to talk. Morf automatically guides you when you select a part or receive an answer.</span>
    <span className="morf-sr-only" role="status">{pet.notice}</span>
    {open&&<section className="morf-chat" role="dialog" aria-modal="false" aria-label="Talk to Morf" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setOpen(false);}}}>
      <header><MorfFace small mode={activity.mode} shape={props.shape}/><div><strong>morf<span>DESIGN COMPANION</span></strong><small>{props.busy?'Thinking with Gemini…':props.partName?`Exploring ${props.partName}`:'Understand. Modify. Verify.'}</small></div><button aria-label={muted?'Enable Morf voice':'Mute Morf voice'} title={muted?'Read answers aloud':'Mute voice'} onClick={()=>setMuted(value=>!value)}>{muted?<VolumeX size={15}/>:<Volume2 size={15}/>}</button><button aria-label="Close Morf panel" onClick={()=>setOpen(false)}><X size={16}/></button></header>
      <div className="morf-chat-body" aria-live="polite">{question&&<p className="morf-question">{question}</p>}{props.busy?<p className="morf-reply"><LoaderCircle size={15} className="ds-spin"/>{props.progress||'Looking at the parts and their connections…'}</p>:<p className="morf-reply">{props.error||excerpt||speech}</p>}
        {!props.busy&&<div className="morf-prompts"><button onClick={()=>ask(props.partName?`How does the ${props.partName} work? Show me its connections.`:'Show me how the main parts work together.')}>{props.partName?'Explain this part':'Show me how it works'}<ArrowUpRight size={12}/></button>{formed&&!props.partName&&<button onClick={()=>ask('What are you made of? List your main parts and how they fit together.')}>What are you made of?<ArrowUpRight size={12}/></button>}<button onClick={()=>{setOpen(false);props.onConversation();}}>Open full conversation<ArrowUpRight size={12}/></button></div>}
      </div>
      <form onSubmit={event=>{event.preventDefault();ask(draft);}}><input ref={input} aria-label="Ask Morf about this object" placeholder="Ask a question. Shape an idea…" value={draft} onChange={event=>setDraft(event.target.value)} disabled={props.busy}/><VoiceInput shortcut={false} disabled={props.busy} onText={setDraft} onSubmit={ask} tell={props.tell}/>{props.busy?<button type="button" onClick={props.onCancel}>Stop</button>:<button type="submit" aria-label="Send to Morf" disabled={!draft.trim()}><ArrowUp size={17}/></button>}</form><footer><i/>Gemini · works with the parts in your scene</footer>
    </section>}
  </div>;
});
export default MorfGuide;
