'use client';
import { ArrowUpRight, Check, Focus, Layers3, LoaderCircle, Play, Sparkles } from 'lucide-react';
import MorfFace from './MorfFace';
import type { DeviceDocument, SceneAction } from '@/lib/studio/types';

export interface ConversationEntry {
  role: 'user' | 'assistant';
  text: string;
  actions?: SceneAction[];
  suggestions?: string[];
  checks?: { level: 'info' | 'warning' | 'pass'; message: string }[];
}
function Answer({ text }: { text: string }) {
  return <div className="ds-answer">{text.split('\n').map((line, i) => {
    const bullet = /^\s*[-*]\s/.test(line), content = line.replace(/^\s*[-*]\s/, '').replace(/^#{1,4}\s/, '');
    return <div key={i} className={bullet ? 'ds-answer-bullet' : content ? 'ds-answer-line' : 'ds-answer-space'}>{content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, j) => part.startsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : part.startsWith('`') ? <code key={j}>{part.slice(1, -1)}</code> : part)}</div>;
  })}</div>;
}
export default function ConversationPanel({ document, entries, model, busy, onAsk, onActions }: {
  document: DeviceDocument; entries: ConversationEntry[]; model: string | null; busy: boolean;
  onAsk: (text: string) => void; onActions: (actions: SceneAction[]) => void;
}) {
  const keyboard = document.capabilities?.includes('wired-keyboard') || document.parts.some(p => p.id === 'switch-stem');
  const prompts = keyboard ? ['Show what happens when I press a key.', 'What connects the keys to the computer?', 'Make this wireless.'] : ['Show how the main components connect.', 'Explain the selected component and show me its neighbors.', 'Which parts could I change, and what would that affect?'];
  return <div className="ds-chat" aria-label="Object conversation">
    <div className="ds-chat-intro"><span><MorfFace small/></span><div className="ds-conversation-kicker">A CONVERSATION WITH YOUR OBJECT</div><h2>Every part has a purpose.</h2><p>Answers point to real parts in this scene. Describe a change to edit the assembly.</p><small><i/>{model || 'Gemini'}</small></div>
    {entries.length === 0 && <div className="ds-chat-suggestions">{prompts.map(text => <button disabled={busy} key={text} onClick={() => onAsk(text)}>{text}<ArrowUpRight size={14}/></button>)}</div>}
    <div aria-live="polite" aria-relevant="additions text">{entries.map((entry, i) => <div className={'ds-message ds-' + entry.role} key={i}>
      {entry.role === 'assistant' && <span><MorfFace small/>MORF</span>}
      <Answer text={entry.text}/>
      {!!entry.actions?.length && <div className="ds-scene-actions">{entry.actions.filter(a => a.type !== 'highlight').map((action, index) => <button key={index} onClick={() => onActions([action])} disabled={busy}>
        {action.type === 'animate' ? <Play size={12}/> : action.type === 'explode' ? <Layers3 size={12}/> : <Focus size={12}/>}
        {action.type === 'animate' ? document.mechanisms?.find(m => m.id === action.mechanismId)?.name || 'Play explanation' : action.type === 'focus' ? 'Show these parts' : action.type === 'isolate' ? 'Inspect these parts' : action.type === 'explode' ? action.amount ? 'Separate layers' : 'Assemble' : 'Change view'}
      </button>)}</div>}
      {!!entry.checks?.length && <details className="ds-model-notes"><summary>Model notes</summary><div className="ds-conversation-checks">{entry.checks.map((check, index) => <div key={index} className={'ds-check-' + check.level}>{check.level === 'pass' ? <Check size={12}/> : <span>i</span>}{check.message}</div>)}</div></details>}
      {!!entry.suggestions?.length && <div className="ds-followup-prompts">{entry.suggestions.map(text => <button disabled={busy} key={text} onClick={() => onAsk(text)}>{text}<ArrowUpRight size={11}/></button>)}</div>}
    </div>)}</div>
    {busy && <div className="ds-chat-thinking" role="status"><LoaderCircle size={14} className="ds-spin"/>Understanding the parts and connections…</div>}
  </div>;
}
