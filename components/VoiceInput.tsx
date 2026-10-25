'use client';
import {useEffect,useRef,useState} from 'react';
import {Mic,MicOff} from 'lucide-react';
interface Recognition {
 lang:string;interimResults:boolean;
 onresult:((event:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;
 onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null;
 start:()=>void;stop:()=>void;abort:()=>void;
}
export default function VoiceInput({disabled,onText,onSubmit,tell,shortcut=true}:{shortcut?:boolean;disabled:boolean;onText:(text:string)=>void;onSubmit:(text:string)=>void;tell:(text:string)=>void}){
 const [recording,setRecording]=useState(false),recognition=useRef<Recognition|null>(null),transcript=useRef(''),sendOnEnd=useRef(false),held=useRef(false);
 const handlers=useRef({disabled,onText,onSubmit,tell});handlers.current={disabled,onText,onSubmit,tell};
 function start(){
  if(handlers.current.disabled||recognition.current)return;
  const api=window as unknown as {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};const Speech=api.SpeechRecognition||api.webkitSpeechRecognition;
  if(!Speech){handlers.current.tell('Voice input is supported in Chrome and Edge. Type your request in this browser.');return;}
  const rec=new Speech();rec.lang='en-US';rec.interimResults=true;transcript.current='';sendOnEnd.current=false;
  rec.onresult=event=>{const text=Array.from(event.results).map(result=>result[0].transcript).join(' ');transcript.current=text;handlers.current.onText(text);};
  rec.onerror=event=>{sendOnEnd.current=false;handlers.current.tell(event.error==='not-allowed'?'Microphone access is blocked in this browser.':'Voice input stopped. Please try again.');};
  rec.onend=()=>{recognition.current=null;setRecording(false);if(sendOnEnd.current&&transcript.current.trim())handlers.current.onSubmit(transcript.current);sendOnEnd.current=false;};
  try{recognition.current=rec;rec.start();setRecording(true);}catch{recognition.current=null;handlers.current.tell('Could not start voice input.');}
 }
 function stop(send:boolean){sendOnEnd.current=send;recognition.current?.stop();}
 const controls=useRef({start,stop});controls.current={start,stop};
 useEffect(()=>{if(!shortcut)return;const down=(event:KeyboardEvent)=>{if(event.code!=='Space'||event.repeat||(event.target as HTMLElement).closest('input,textarea,select,[contenteditable]')||document.querySelector('[role="dialog"]'))return;event.preventDefault();held.current=true;controls.current.start();};const up=(event:KeyboardEvent)=>{if(event.code==='Space'&&held.current){held.current=false;controls.current.stop(true);}};window.addEventListener('keydown',down);window.addEventListener('keyup',up);return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);sendOnEnd.current=false;recognition.current?.abort();};},[shortcut]);
 return <button type="button" className={'voice-button'+(recording?' recording':'')} title={recording?'Stop voice input':'Voice input · hold Space to speak'} aria-label={recording?'Stop voice input':'Voice input'} aria-pressed={recording} disabled={disabled} onClick={()=>recording?stop(false):start()}>{recording?<MicOff size={15}/>:<Mic size={15}/>}</button>;
}
