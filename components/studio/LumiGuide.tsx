'use client';
import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {ArrowUpRight,ArrowUp,LoaderCircle,MessageCircle,Volume2,VolumeX,X} from 'lucide-react';
import LumiFace from './LumiFace';
import VoiceInput from '../VoiceInput';
import {type GuideAnchor} from '@/lib/studio/lumi-motion';
import {useLumiPet} from './useLumiPet';

export type LumiGuideHandle={pointTo:(anchor:GuideAnchor|null)=>void};
type Props={forceMotion:boolean;partId?:string;partName?:string;partRole?:string;answer:string;answerKey:number;busy:boolean;progress:string;error?:string;rightInset:number;leftInset:number;gallery:boolean;hidden:boolean;onAsk:(text:string)=>void;onCancel:()=>void;onConversation:()=>void;tell:(text:string)=>void};
const readable=(text:string)=>text.replace(/[*`#]/g,'').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').trim();

const LumiGuide=forwardRef<LumiGuideHandle,Props>(function LumiGuide(props,ref){
  const [open,setOpen]=useState(false),[draft,setDraft]=useState(''),[bubble,setBubble]=useState(true),[muted,setMuted]=useState(true),[question,setQuestion]=useState('');
  const actor=useRef<HTMLDivElement>(null),leader=useRef<SVGPathElement>(null),dot=useRef<SVGCircleElement>(null),anchor=useRef<GuideAnchor|null>(null);
  const lastSpeech=useRef(-1),previousPart=useRef(props.partName),input=useRef<HTMLInputElement>(null);
  useImperativeHandle(ref,()=>({pointTo:value=>{anchor.current=value;}}),[]);
  const pet=useLumiPet({...props,open,guideKey:`${props.partId||props.partName||''}:${props.answerKey}`},actor,leader,dot,anchor);
  useEffect(()=>{setBubble(true);const timer=setTimeout(()=>setBubble(false),11000);return()=>clearTimeout(timer);},[props.answerKey,props.partName]);
  useEffect(()=>{if(open)input.current?.focus();},[open]);
  useEffect(()=>{if(previousPart.current!==props.partName){previousPart.current=props.partName;setBubble(true);}},[props.partName]);
  useEffect(()=>{
    if(muted||props.busy||!props.answer||lastSpeech.current===props.answerKey||!('speechSynthesis'in window))return;
    lastSpeech.current=props.answerKey;const speech=new SpeechSynthesisUtterance(readable(props.answer).slice(0,900));speech.rate=1.04;speech.pitch=1.25;window.speechSynthesis.speak(speech);
    return()=>window.speechSynthesis.cancel();
  },[props.answerKey,props.answer,props.busy,muted]);
  function ask(text:string){if(!text.trim()||props.busy)return;setQuestion(text.trim());setDraft('');setBubble(true);props.onAsk(text.trim());}
  const excerpt=readable(props.answer);const speech=props.busy?'Let me look a little closer…':props.error|| (props.partName?`${props.partName}. ${props.partRole||'Let’s explore this part together.'}`:'Hi, I’m Lumi. Pick a part. Let’s see what makes it work.');
  return <div className="lumi-guide-layer" hidden={props.hidden} data-animated={pet.animations} data-state={props.busy?'thinking':props.answer?'explaining':'curious'}>
    <svg className="lumi-pointer" aria-hidden="true"><path ref={leader}/><circle ref={dot} r="4"/></svg>
    <div ref={actor} className="lumi-actor" data-side="left" data-open={open} data-dragging={pet.dragging} data-emotion={pet.emotion} style={{transform:'translate3d(calc(100vw - 110px),calc(100vh - 220px),0)'}}>
      {bubble&&!open&&!pet.dragging&&<div className="lumi-whisper" role="status"><span>{props.busy?'ONE LITTLE MOMENT':props.partName?'LET’S LOOK HERE':'YOUR LITTLE SPARK OF CURIOSITY'}</span><p>{props.answer&&props.answerKey>0&&!props.busy?excerpt.slice(0,155)+(excerpt.length>155?'…':''):speech}</p><button onClick={()=>setOpen(true)}>Ask Lumi <ArrowUpRight size={12}/></button></div>}
      <span className="lumi-pet-sparkles" aria-hidden="true"><i>✦</i><i>✧</i><i>✦</i><i>·</i><i>✧</i></span>
      <button className="lumi-pet" {...pet.bindings} aria-describedby="lumi-pet-help" title="Drag to move · click to talk · arrow keys to nudge" aria-label={open?'Close Lumi conversation':'Talk to Lumi'} aria-expanded={open} onClick={()=>{if(pet.consumeDragClick())return;setOpen(value=>!value);}}><LumiFace/><span className="lumi-pet-label">{pet.dragging?'wheee!':props.busy?'thinking…':'lumi'}<MessageCircle size={10}/></span></button>
    </div>
    <span id="lumi-pet-help" className="lumi-sr-only">Drag Lumi anywhere. Arrow keys move 12 pixels; Shift moves 40. Click to talk. Lumi automatically guides you when you select a part or receive an answer.</span>
    <span className="lumi-sr-only" role="status">{pet.notice}</span>
    {open&&<section className="lumi-chat" role="dialog" aria-modal="false" aria-label="Talk to Lumi" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setOpen(false);}}}>
      <header><LumiFace small/><div><strong>lumi<span>AI COMPANION</span></strong><small>{props.busy?'Thinking with Gemini…':props.partName?`Exploring ${props.partName}`:'A little light on how things work.'}</small></div><button aria-label={muted?'Enable Lumi voice':'Mute Lumi voice'} title={muted?'Read answers aloud':'Mute voice'} onClick={()=>setMuted(value=>!value)}>{muted?<VolumeX size={15}/>:<Volume2 size={15}/>}</button><button aria-label="Close Lumi panel" onClick={()=>setOpen(false)}><X size={16}/></button></header>
      <div className="lumi-chat-body" aria-live="polite">{question&&<p className="lumi-question">{question}</p>}{props.busy?<p className="lumi-reply"><LoaderCircle size={15} className="ds-spin"/>{props.progress||'Looking at the parts and their connections…'}</p>:<p className="lumi-reply">{props.error||excerpt||speech}</p>}
        {!props.busy&&<div className="lumi-prompts"><button onClick={()=>ask(props.partName?`How does the ${props.partName} work? Show me its connections.`:'Show me how the main parts work together.')}>{props.partName?'Explain this part':'Show me how it works'}<ArrowUpRight size={12}/></button><button onClick={()=>{setOpen(false);props.onConversation();}}>Open full conversation<ArrowUpRight size={12}/></button></div>}
      </div>
      <form onSubmit={event=>{event.preventDefault();ask(draft);}}><input ref={input} aria-label="Ask Lumi about this object" placeholder="A question. A change. A little curiosity…" value={draft} onChange={event=>setDraft(event.target.value)} disabled={props.busy}/><VoiceInput shortcut={false} disabled={props.busy} onText={setDraft} onSubmit={ask} tell={props.tell}/>{props.busy?<button type="button" onClick={props.onCancel}>Stop</button>:<button type="submit" aria-label="Send to Lumi" disabled={!draft.trim()}><ArrowUp size={17}/></button>}</form><footer><i/>Gemini · works with the parts in your scene</footer>
    </section>}
  </div>;
});
export default LumiGuide;
