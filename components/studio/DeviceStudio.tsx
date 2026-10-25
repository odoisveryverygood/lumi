'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Box, Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Cpu, Crosshair, Expand, Eye, EyeOff, FilePlus2, Focus, Grip, Layers3, LoaderCircle, Maximize2, MessageCircle, MousePointer2, Move3d, PanelLeft, Pause, Play, Plus, Redo2, RotateCcw, RotateCw, Search, Send, Settings2, Share2, Sparkles, Undo2, Upload, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { DeviceDocument, DevicePart, Vec3, SceneAction, MechanismPlayback } from '@/lib/studio/types';
import { desktopComputer } from '@/lib/studio/desktop';
import { validateSceneActions } from '@/lib/studio/interaction';
import { appendGenerationParts } from '@/lib/studio/generation-progress';
import { readDeviceResponse } from '@/lib/studio/response';
import { validateDeviceDocument as validateLocalDocument } from '@/lib/studio/validation';
import { decodeAsset, download, encodeAsset, loadAsset, storeAsset } from '@/lib/studio/storage';
import VoiceInput from '@/components/VoiceInput';
import './studio.css';
import PartThumbnail from './PartThumbnail';
import ConversationPanel, { type ConversationEntry } from './ConversationPanel';
import MechanismPlayer from './MechanismPlayer';
import AssemblyTree from './AssemblyTree';
import RelationshipInspector from './RelationshipInspector';
import ObjectGallery from './ObjectGallery';
import {appendCatalogPart,catalogJsonReplacer} from '@/lib/studio/catalog';
import type {ObjectReference} from '@/lib/studio/object-catalog';
const PartsLibrary=dynamic(()=>import('./PartsLibrary'),{ssr:false});
import ComponentSpotlight from './ComponentSpotlight';
import DesignReviewPanel, { type DesignPreview } from './DesignReviewPanel';
import { supportsRedesign, type DesignCheck } from '@/lib/studio/redesign';
import {connectedPartIds} from '@/lib/studio/relationships';
import MorfGuide, {type MorfGuideHandle} from './MorfGuide';
import MorfFace from './MorfFace';
import type {GuideAnchor} from '@/lib/studio/morf-motion';
import {resolveAttachments,mountParts} from '@/lib/studio/attachments';
import {improveWithVisualReview,requiresVisualReview,type QualityProgress} from '@/lib/studio/quality-client';
import {qualityFingerprint} from '@/lib/studio/quality-fingerprint';
import {canApplyReviewDraft} from '@/lib/studio/review-acceptance';
import type {QualityReport} from '@/lib/studio/quality-types';
import QualityPanel from './QualityPanel';
import {poseMotion} from '@/lib/studio/motion-pose';
import type {MotionFinding} from '@/lib/studio/motion-types';
const DeviceScene = dynamic(() => import('./DeviceScene'), { ssr: false, loading: () => <div className="ds-loading"><Layers3 size={30}/><span>Preparing the assembly…</span></div> });
type Snapshot = { document: DeviceDocument; scene?: unknown; asset?: ArrayBuffer };
type ChatMessage = ConversationEntry;
const STORAGE_KEY = 'partexplode-studio-v1';
function restoreConversation(raw: unknown, document: DeviceDocument): ConversationEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-24).flatMap(value => {
    if (!value || !['user','assistant'].includes(value.role) || typeof value.text !== 'string') return [];
    const actions = Array.isArray(value.actions) ? value.actions.slice(0,12).flatMap((action: unknown) => { try { return validateSceneActions([action],document); } catch { return []; } }) : [];
    const suggestions = Array.isArray(value.suggestions) ? value.suggestions.filter((v: unknown) => typeof v === 'string').slice(0,6).map((v: string) => v.slice(0,240)) : [];
    return [{role:value.role,text:value.text.slice(0,20000),actions,suggestions}];
  });
}

function IconButton({ title, children, active, disabled, onClick }: { title: string; children: ReactNode; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button type="button" className={'ds-icon' + (active ? ' is-active' : '')} aria-label={title} title={title} aria-pressed={active} disabled={disabled} onClick={onClick}>{children}</button>;
}
function NumberVector({ label, value, onChange, unit,disabled=false }: { label: string; value: Vec3; onChange: (value: Vec3) => void; unit: string;disabled?:boolean }) {
  return <fieldset className="ds-vector" disabled={disabled}><legend>{label}<span>{unit}</span></legend><div>{value.map((n, i) => <label key={i}><span>{['X', 'Y', 'Z'][i]}</span><input aria-label={`${label} ${['X', 'Y', 'Z'][i]}`} type="number" step="1" min={-2000} max={2000} value={Math.round(n * 10) / 10} onChange={e => { if (e.target.value === '') return; const next: Vec3 = [...value]; next[i] = Math.max(-2000, Math.min(2000, Number(e.target.value))); onChange(next); }}/></label>)}</div></fieldset>;
}
function ComponentName({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <input aria-label="Component name" className="ds-name-input" value={draft} maxLength={100} disabled={disabled} onChange={e => setDraft(e.target.value)} onBlur={() => { const name = draft.trim(); if (name) { if (name !== value) onSave(name); } else setDraft(value); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(value); e.currentTarget.blur(); } }}/>;
}
function ComponentFinish({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const normalize = (text: string) => text.length === 4 ? '#' + text.slice(1).split('').map(c => c + c).join('') : text;
  return <label className="ds-color-field"><span>Finish</span><input aria-label="Component color" type="color" value={normalize(value)} disabled={disabled} onChange={e => onSave(e.target.value)}/><input aria-label="Finish hex" type="text" maxLength={7} value={draft} disabled={disabled} spellCheck={false} onChange={e => setDraft(e.target.value)} onBlur={() => { if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(draft.trim())) { const color = normalize(draft.trim()); if (color !== value) onSave(color); } else setDraft(value); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(value); e.currentTarget.blur(); } }}/></label>;
}
export default function DeviceStudio() {
  const [snapshot, setSnapshot] = useState<Snapshot>({ document: desktopComputer });
  const { document: doc, scene, asset } = snapshot;
  const latest = useRef(snapshot); latest.current = snapshot;
  const [selectedId, setSelectedId] = useState<string | null>(null), [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]), [isolatedId, setIsolatedId] = useState<string | null>(null);
  const [explode, setExplode] = useState(.38), [view, setView] = useState<'perspective' | 'top' | 'front'>('perspective');
  const [tool, setTool] = useState<'select' | 'move' | 'rotate'>('select'), [labels, setLabels] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [focusCommand, setFocusCommand] = useState({ partIds: [] as string[], nonce: 0 });
  const [mechanismPlayback, setMechanismPlayback] = useState<MechanismPlayback | null>(null);
  const presentation = useRef({hiddenIds, isolatedId, explode, view, labels}); presentation.current = {hiddenIds, isolatedId, explode, view, labels};
  const mechanismRestore = useRef<typeof presentation.current | null>(null);
  const stopMechanism = useCallback(() => { setMechanismPlayback(null); setHighlightedIds([]); const saved = mechanismRestore.current; mechanismRestore.current = null; if (saved) { setFocusCommand(old => ({partIds:[],nonce:old.nonce+1})); setHiddenIds(saved.hiddenIds); setIsolatedId(saved.isolatedId); setExplode(saved.explode); setView(saved.view); setLabels(saved.labels); } }, []);
  const [cameraCommand, setCameraCommand] = useState<{ type: 'fit' | 'home' | 'in' | 'out'; nonce: number }>({ type: 'home', nonce: 0 });
  const [panel, setPanel] = useState<'overview' | 'part' | 'chat' | 'design'>('overview'), [leftOpen, setLeftOpen] = useState(false), [rightOpen, setRightOpen] = useState(false);
  const [search, setSearch] = useState(''), [prompt, setPrompt] = useState(''), [newPrompt, setNewPrompt] = useState('');
  const [newOpen, setNewOpen] = useState(false), [exportOpen, setExportOpen] = useState(false), [helpOpen, setHelpOpen] = useState(false);
  const [libraryOpen,setLibraryOpen]=useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]), [busy, setBusy] = useState(false), [busyAction, setBusyAction] = useState('');
  const morf=useRef<MorfGuideHandle>(null),designAgent=useRef<{ask:(text:string)=>void;cancel:()=>void}|null>(null);
  const [motionOverride,setMotionOverride]=useState(false);
  useEffect(()=>{const preference=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>{if(preference.matches)setShowcaseMotion(false);};update();preference.addEventListener('change',update);return()=>preference.removeEventListener('change',update);},[]);
  const [morfAnswer,setMorfAnswer]=useState(''),[morfAnswerKey,setMorfAnswerKey]=useState(0),[showcaseMotion,setShowcaseMotion]=useState(true);
  const morfReply=useCallback((text:string)=>{setMorfAnswer(text);setMorfAnswerKey(value=>value+1);},[]);
  const morfAnchor=useCallback((anchor:GuideAnchor|null)=>morf.current?.pointTo(anchor),[]);
  const connectDesignAgent=useCallback((agent:{ask:(text:string)=>void;cancel:()=>void}|null)=>{designAgent.current=agent;},[]);
  const stopShowcase=useCallback(()=>setShowcaseMotion(false),[]);
  const toggleShowcase=()=>{if(showcaseMotion)setShowcaseMotion(false);else{setMotionOverride(true);setShowcaseMotion(true);}};
  const [generationPreview,setGenerationPreview]=useState<DeviceDocument|null>(null);
  const [qualityDraft,setQualityDraft]=useState<DeviceDocument|null>(null),[qualityOpen,setQualityOpen]=useState(false),[qualityBrief,setQualityBrief]=useState(''),[qualityReport,setQualityReport]=useState<QualityReport|undefined>(),[qualityProgress,setQualityProgress]=useState<QualityProgress|null>(null),[savedReviewHash,setSavedReviewHash]=useState(''),[draftReady,setDraftReady]=useState(false);
  const pendingQuality=useRef(false);pendingQuality.current=!!qualityDraft;
  useEffect(()=>{let alive=true;void qualityFingerprint(doc).then(hash=>{if(alive)setSavedReviewHash(hash);});return()=>{alive=false;};},[doc]);
  const [generationParts,setGenerationParts]=useState<string[]>([]);
  const [aiProgress, setAIProgress] = useState(''), [aiError, setAIError] = useState(''), [elapsed, setElapsed] = useState(0);
  useEffect(() => { if (!busy) return; const started = Date.now(); setElapsed(0); const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000); return () => clearInterval(timer); }, [busy]);
  const [notice, setNotice] = useState(''), [ready, setReady] = useState(false), [saveStatus, setSaveStatus] = useState('Saved on this device');
  const [buildStep, setBuildStep] = useState<number | null>(null), [playing, setPlaying] = useState(false);
  const [model, setModel] = useState<string | null>(null), [aiAvailable, setAIAvailable] = useState(false), [aiStatusReady, setAIStatusReady] = useState(false);
  const [dialogueHeight,setDialogueHeight]=useState(130);
  const [designPreview, setDesignPreview] = useState<DesignPreview | null>(null);
  const [dialogueSelectedId,setDialogueSelectedId]=useState<string|null>(null),[evidenceOpen,setEvidenceOpen]=useState(false);
  const dialogueActive=panel==='design'&&!newOpen;
  const [motionInspection,setMotionInspection]=useState<DeviceDocument|null>(null);
  useEffect(()=>setMotionInspection(null),[doc,qualityDraft,generationPreview]);
  const displayed=motionInspection||qualityDraft||generationPreview||designPreview?.document||doc;
  const visibleDocument=useRef(doc);visibleDocument.current=displayed;
  const previewIdentity=useRef<DeviceDocument|null>(null);
  const previewDesign = useCallback((value:DesignPreview|null)=>{setDesignPreview(value);if(value&&previewIdentity.current!==value.document){previewIdentity.current=value.document;setSelectedId(null);setTool('select');setExplode(0);setHiddenIds([]);setIsolatedId(null);setLabels(false);setHighlightedIds(value.emphasize?['wireless-battery','wireless-controller']:[]);setFocusCommand(old=>({partIds:value.emphasize?['wireless-battery','wireless-controller','keyboard-case-base']:[],nonce:old.nonce+1}));if(!value.emphasize)setCameraCommand(old=>({type:'fit',nonce:old.nonce+1}));}},[]);
  const designBusy = useCallback((value: boolean) => { if(value){stopMechanism();setShowcaseMotion(false);setAIProgress('Looking at the object and its documents…');}setBusy(value); setBusyAction(value ? 'redesign' : ''); }, [stopMechanism]);
  const inspectDesignCheck=useCallback((check:DesignCheck)=>{const focus=check.partIds.filter(id=>!['keyboard-case-base','keyboard-case-frame','keyboard-pcb'].includes(id));setExplode(0);setView('perspective');setHiddenIds([]);setIsolatedId(null);setLabels(false);setHighlightedIds(focus.length?focus:check.partIds);setFocusCommand(old=>({partIds:focus.length?focus:check.partIds,nonce:old.nonce+1}));},[]);
  const history = useRef<{ past: Snapshot[]; future: Snapshot[] }>({ past: [], future: [] });
  const [, refreshHistory] = useState(0), fileInput = useRef<HTMLInputElement>(null), chatEnd = useRef<HTMLDivElement>(null), noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const busyRef = useRef(false); busyRef.current = busy;
  const tell = useCallback((text: string) => { setNotice(text); if (noticeTimer.current) clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setNotice(''), 7000); }, []);
  const commit = useCallback((next: Snapshot) => { try { next = { ...next, document: validateLocalDocument(next.document) }; } catch (error) { tell(error instanceof Error ? error.message : 'This change is invalid.'); return false; } history.current.past.push(latest.current); if (history.current.past.length > 35) history.current.past.shift(); history.current.future = []; latest.current = next; setSnapshot(next); refreshHistory(n => n + 1); return true; }, [tell]);
  const undo = useCallback(() => { const prev = history.current.past.pop(); if (!prev) return;morfReply('Undid the last assembly change. Your object is back to the previous version.'); history.current.future.push(latest.current); const same = prev.document.id === latest.current.document.id; setMessages(old => same ? [...old, {role:'assistant',text:'Undid the last assembly change. The object now shows the previous version.'}] : []); latest.current = prev; setSnapshot(prev); setSelectedId(id => same && prev.document.parts.some(p => p.id === id) ? id : null); if (!same) { setSearch(''); setRightOpen(false); setPanel('overview'); setExplode(prev.document.source === 'import' ? 0 : .76); setLabels(prev.document.source !== 'import'); } setHiddenIds([]); setIsolatedId(null); setHoveredId(null); setPlaying(false); setBuildStep(null); mechanismRestore.current = null; setMechanismPlayback(null); setHighlightedIds([]); setCameraCommand(old => ({type:'fit',nonce:old.nonce+1})); refreshHistory(n => n + 1); }, [morfReply]);
  const redo = useCallback(() => { const next = history.current.future.pop(); if (!next) return;morfReply('Restored the assembly change.'); history.current.past.push(latest.current); const same = next.document.id === latest.current.document.id; setMessages(old => same ? [...old, {role:'assistant',text:'Restored the assembly change.'}] : []); latest.current = next; setSnapshot(next); setSelectedId(id => same && next.document.parts.some(p => p.id === id) ? id : null); if (!same) { setSearch(''); setRightOpen(false); setPanel('overview'); setExplode(next.document.source === 'import' ? 0 : .76); setLabels(next.document.source !== 'import'); } setHiddenIds([]); setIsolatedId(null); setHoveredId(null); setPlaying(false); setBuildStep(null); mechanismRestore.current = null; setMechanismPlayback(null); setHighlightedIds([]); setCameraCommand(old => ({type:'fit',nonce:old.nonce+1})); refreshHistory(n => n + 1); }, [morfReply]);
  const updatePart = useCallback((id: string, update: Partial<DevicePart>) => { if (busyRef.current||pendingQuality.current||motionInspection) return; const prev=latest.current;try{const next={...prev.document,parts:prev.document.parts.map(p=>p.id===id?{...p,...update,...(update.color&&!update.solids?{solids:p.solids.map(solid=>solid.color?.toLowerCase()===p.color.toLowerCase()?{...solid,color:update.color}:solid)}:{})}:p)};commit({...prev,document:resolveAttachments(prev.document,next,update.position||update.rotation?[id]:[])});}catch(error){tell(error instanceof Error?error.message:'The mounted component could not be updated.');} }, [commit,tell,motionInspection]);
  const transform = useCallback((id: string, position: Vec3, rotation: Vec3) => { stopMechanism(); updatePart(id, { position, rotation }); }, [updatePart, stopMechanism]);
  const select = useCallback((id: string | null) => { setShowcaseMotion(false);setMorfAnswer('');setSelectedId(id); setHighlightedIds([]); if (id) { stopMechanism(); setPanel('part'); setRightOpen(false); setLeftOpen(false); } }, [stopMechanism]);
  const selected = displayed.parts.find(p => p.id === selectedId), hovered = displayed.parts.find(p => p.id === hoveredId);
  const camera = (type: 'fit' | 'home' | 'in' | 'out') => setCameraCommand(old => ({ type, nonce: old.nonce + 1 }));
  const openOverview = () => { setPanel('overview'); setRightOpen(true); setLeftOpen(false); };
  const openDesign = () => { if (busyRef.current) return; stopMechanism(); setSelectedId(null); setHiddenIds([]); setIsolatedId(null); setBuildStep(null); setExplode(0); setPanel('design'); setRightOpen(false);setDialogueSelectedId(null); setLeftOpen(false); setNewOpen(false); };
  const openGallery = () => { if (busyRef.current||pendingQuality.current) return;setMorfAnswer(''); stopMechanism(); setSelectedId(null); setLeftOpen(false); setRightOpen(false); setAIError(''); setNewOpen(true); };
  const resetView = () => { mechanismRestore.current = null; setHiddenIds([]); setIsolatedId(null); setBuildStep(null); setPlaying(false); setMechanismPlayback(null); setHighlightedIds([]); setSelectedId(null); setView('perspective'); setExplode(.38); camera('home'); };
  const openDesktop = () => { if (busy) return;setMorfAnswer(''); commit({ document: desktopComputer }); setMessages([]); setSearch(''); setLabels(false); setRightOpen(false); setLeftOpen(false); resetView(); setNewOpen(false); };
  const applySceneActions = useCallback((actions: SceneAction[]) => {
    const document = visibleDocument.current, valid = new Set(document.parts.map(p => p.id));
    if (!actions.some(a => a.type === 'animate')) stopMechanism();
    setTool('select'); setBuildStep(null); setPlaying(false);
    for (const action of actions) {
      if (action.type === 'focus' || action.type === 'highlight' || action.type === 'isolate') {
        const ids = action.partIds.filter(id => valid.has(id)); if (!ids.length) continue;
        setHighlightedIds(ids); setHiddenIds(old => old.filter(id => !ids.includes(id))); setIsolatedId(null);
        if (action.type === 'focus') { if(dialogueActive)setDialogueSelectedId(ids[0]);else setSelectedId(ids[0]); setFocusCommand(old => ({ partIds: ids, nonce: old.nonce + 1 })); }
        if (action.type === 'isolate') { setHiddenIds(document.parts.filter(p => !ids.includes(p.id)).map(p => p.id)); setFocusCommand(old => ({ partIds: ids, nonce: old.nonce + 1 })); }
      } else if (action.type === 'explode') setExplode(Math.min(1, Math.max(0, action.amount)));
      else if (action.type === 'view') setView(action.view);
      else if (action.type === 'animate') {
        const mechanism = document.mechanisms?.find(m => m.id === action.mechanismId); if (!mechanism) continue;
        const ids = mechanism.tracks.map(t => t.partId);
        if (!mechanismRestore.current) mechanismRestore.current = { ...presentation.current };
        const visible = new Set([...ids, ...mechanism.stages.flatMap(s => s.partIds)]);
        setSelectedId(null); setExplode(0); setHiddenIds(document.parts.filter(p => !visible.has(p.id)).map(p => p.id)); setIsolatedId(null); setView('perspective'); setLabels(true); setHighlightedIds(ids);
        setFocusCommand(old => ({ partIds: [...visible], nonce: old.nonce + 1 }));
        setMechanismPlayback(old => ({ mechanismId: mechanism.id, playing: true, progress: 0, nonce: (old?.nonce || 0) + 1 }));
      }
    }
  }, [stopMechanism,dialogueActive]);
  const focusParts = (partIds: string[]) => applySceneActions([{ type: 'focus', partIds }]);
  const mechanismProgress = useCallback((progress: number) => setMechanismPlayback(old => old ? { ...old, progress } : null), []);
  const mechanismComplete = useCallback(() => setMechanismPlayback(old => old ? { ...old, playing: false, progress: 1 } : null), []);
  const guidePart=displayed.parts.find(part=>part.id===(highlightedIds[0]||(dialogueActive?dialogueSelectedId:selectedId)));
  const activeMechanism = doc.mechanisms?.find(m => m.id === mechanismPlayback?.mechanismId);
  async function openKeyboard(explain = false) {
    if (busyRef.current) return;setMorfAnswer('');
    try{const {loadCorneReference}=await import('@/lib/studio/corne');const reference=await loadCorneReference();
    commit({document:reference});setMessages([]);setSearch('');resetView();setExplode(0);setLabels(false);setRightOpen(false);setLeftOpen(false);setNewOpen(false);setPanel('design');setDialogueSelectedId(null);visibleDocument.current=reference;
    if(explain&&reference.mechanisms?.[0])applySceneActions([{type:'animate',mechanismId:reference.mechanisms[0].id}]);
    }catch(error){tell(error instanceof Error?error.message:'Could not open the source keyboard.');}
  }

  const toggleHidden = (id: string) => setHiddenIds(old => old.includes(id) ? old.filter(item => item !== id) : [...old, id]);
  useEffect(() => {
    let alive = true;
    const baseline = latest.current;
    async function boot() {
      try {
        const hash = location.hash.slice(1);
        if(new URLSearchParams(location.search).get('example')==='motion-fan'){const {createMotionFan}=await import('@/lib/studio/motion-fan');const reference=createMotionFan();if(alive&&latest.current===baseline){latest.current={document:reference};setSnapshot(latest.current);setExplode(0);setLabels(false);setQualityBrief(reference.designBrief!);setQualityOpen(true);window.history.replaceState(null,'',location.pathname);}if(alive)setReady(true);return;}
        if(new URLSearchParams(location.search).get('example')==='corne'){
          const {loadCorneReference}=await import('@/lib/studio/corne');const reference=await loadCorneReference();
          if(alive&&latest.current===baseline){latest.current={document:reference};setSnapshot(latest.current);setExplode(0);setLabels(false);setPanel('design');window.history.replaceState(null,'',location.pathname);}
          if(alive)setReady(true);return;
        }
        if (new URLSearchParams(location.search).get('example') === 'keyboard') {
          const { mechanicalKeyboard } = await import('@/lib/studio/keyboard');
          if (alive && latest.current === baseline) { latest.current = { document: mechanicalKeyboard }; setSnapshot(latest.current); setExplode(.45); setLabels(false); window.history.replaceState(null, '', location.pathname); }
          if (alive) setReady(true); return;
        }
        let saved = localStorage.getItem(STORAGE_KEY);
        if (hash.startsWith('device=')) { saved = decodeURIComponent(hash.slice(7)); window.history.replaceState(null, '', location.pathname); }
        if (!saved && alive) setNewOpen(true);
        if (saved) {
          const raw = JSON.parse(saved);
          const { validateDeviceDocument } = await import('@/lib/studio/validation');
          const value = validateDeviceDocument(raw.document || raw);
          setMessages(restoreConversation(raw.conversation,value));
          if (value.source === 'import') {
            const buffer = raw.asset ? decodeAsset(raw.asset) : await loadAsset(value.id);
            if (!buffer) throw new Error('Your imported model is missing. Reimport the GLB or open your exported project.');
            const { importDeviceGLB } = await import('@/lib/studio/import'); const result = await importDeviceGLB(buffer, value.name);
            const parts = value.parts.map(p => ({ ...p, assetNode: result.document.parts.find(q => q.id === p.id)?.assetNode }));
            if (alive && latest.current === baseline) { const next = { document: { ...value, parts }, scene: result.scene, asset: buffer }; latest.current = next; setSnapshot(next); setExplode(0); setLabels(false); }
          } else if (alive && latest.current === baseline) { latest.current = { document: value }; setSnapshot({ document: value }); }
        }
      } catch (error) { if (alive) tell(error instanceof Error ? error.message : 'Could not restore the last project. Your desktop example is ready.'); }
      if (alive) setReady(true);
    }
    void boot();
    fetch('/api/status').then(r => r.json()).then(status => { if (alive) { setModel(status.model); setAIAvailable(status.available); setAIStatusReady(true); } }).catch(() => { if (alive) setAIStatusReady(true); });
    return () => { alive = false; request.current?.abort(); if (noticeTimer.current) clearTimeout(noticeTimer.current); };
  }, [tell]);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ document: doc, conversation: messages.slice(-24) },catalogJsonReplacer)); setSaveStatus('Saved on this device'); } catch { setSaveStatus('Export to save a copy'); } }, 350);
    return () => clearTimeout(timer);
  }, [doc, ready, messages]);
  useEffect(()=>{
    if(!ready||draftReady)return;let alive=true;
    void (async()=>{try{const raw=localStorage.getItem('lumi-review-draft-v1');if(raw){const saved=JSON.parse(raw);if(saved.baselineHash===await qualityFingerprint(latest.current.document)){const candidate=validateLocalDocument(saved.document);if(alive){setQualityDraft(candidate);setQualityReport(candidate.review);setQualityBrief(candidate.review?.request||candidate.designBrief||candidate.description);setQualityOpen(true);setNewOpen(false);}}}}catch{/* A malformed draft never replaces the saved object. */}finally{if(alive)setDraftReady(true);}})();return()=>{alive=false;};
  },[ready,draftReady]);
  useEffect(()=>{
    if(!draftReady)return;let alive=true;
    if(!qualityDraft){try{localStorage.removeItem('lumi-review-draft-v1');}catch{}return;}
    void qualityFingerprint(doc).then(baselineHash=>{if(!alive)return;try{localStorage.setItem('lumi-review-draft-v1',JSON.stringify({baselineHash,document:qualityDraft},catalogJsonReplacer));setSaveStatus('Review draft saved separately');}catch{setSaveStatus('Use the draft, then export to keep a copy');}});
    return()=>{alive=false;};
  },[qualityDraft,doc,draftReady]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);
  useEffect(() => {
    if (!playing || buildStep === null) return;
    const timer = setTimeout(() => { if (buildStep >= doc.steps.length) setPlaying(false); else setBuildStep(buildStep + 1); }, 4500);
    return () => clearTimeout(timer);
  }, [playing, buildStep, doc.steps.length]);
  useEffect(() => {
    function down(event: KeyboardEvent) {
      if (event.key === 'Escape' && newOpen && !busy) { setNewOpen(false); return; }
      if ((event.target as HTMLElement).closest('input,textarea,select,[contenteditable]') || document.querySelector('[role="dialog"]')) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (!busy && !pendingQuality.current && !designPreview) event.shiftKey ? redo() : undo(); }
      if (event.key === 'Escape') { setSelectedId(null); setIsolatedId(null); setRightOpen(false); setLeftOpen(false); setNewOpen(false); setTool('select'); stopMechanism(); }
      if (buildStep !== null && ['ArrowRight', 'ArrowLeft'].includes(event.key)) { event.preventDefault(); setBuildStep(n => Math.max(0, Math.min(doc.steps.length, (n ?? 0) + (event.key === 'ArrowRight' ? 1 : -1)))); }
    }
    window.addEventListener('keydown', down); return () => window.removeEventListener('keydown', down);
  }, [undo, redo, busy, buildStep, doc.steps.length, stopMechanism, newOpen, designPreview]);
  useEffect(() => {
    if (!exportOpen && !helpOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('.device-studio [role="dialog"]');
    const selector = 'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href]';
    const timer = setTimeout(() => { (dialog?.querySelector<HTMLElement>('textarea') || dialog?.querySelector<HTMLElement>(selector))?.focus(); }, 0);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { request.current?.abort(); setNewOpen(false); setExportOpen(false); setHelpOpen(false); }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(selector));
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', keydown);
    return () => { clearTimeout(timer); window.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [exportOpen, helpOpen]);
  function openQuality(){setQualityBrief(qualityDraft?.review?.request||doc.review?.request||doc.designBrief||doc.description);setQualityReport(qualityDraft?.review||doc.review);setQualityOpen(true);setRightOpen(false);setLeftOpen(false);}
  async function reviewCandidate(document:DeviceDocument,brief:string,signal:AbortSignal,importedScene?:unknown,baseline:DeviceDocument=document){
    setSaveStatus('Review candidate · saved object preserved');setBusyAction('review');setQualityOpen(true);setQualityBrief(brief.trim());setQualityReport(undefined);setQualityProgress(null);setNewOpen(false);setRightOpen(false);setLeftOpen(false);setSelectedId(null);setHighlightedIds([]);setHiddenIds([]);setIsolatedId(null);setExplode(0);setView('perspective');setLabels(false);setBuildStep(null);setGenerationPreview(document);camera('fit');
    const reviewed=await improveWithVisualReview(document,brief,signal,progress=>{setQualityProgress(progress);setAIProgress(progress.message);setGenerationPreview(progress.document);},importedScene,{},baseline);setQualityReport(reviewed.report);return reviewed;
  }
  function useQualityDraft(){if(busyRef.current||!qualityDraft||!canApplyReviewDraft(qualityDraft.review,!!qualityDraft.mechanisms?.some(m=>m.verification)))return;const previous=latest.current;if(commit({document:qualityDraft,...(qualityDraft.parts.some(p=>p.assetNode)?{scene:previous.scene,asset:previous.asset}:{})})){setQualityDraft(null);setGenerationPreview(null);setQualityReport(qualityDraft.review);setSelectedId(null);setMessages(old=>[...old,{role:'assistant',text:'Used the inspected draft. Its review findings and unverified limits are saved with the object.'}]);tell('Draft applied as one change. Undo restores the previous object.');}}
  function discardQualityDraft(){if(busyRef.current)return;setMotionInspection(null);setQualityDraft(null);setGenerationPreview(null);setQualityReport(doc.review);setQualityProgress(null);setQualityOpen(false);setSelectedId(null);setHiddenIds([]);setIsolatedId(null);camera('fit');tell('Returned to the saved object.');}
  async function runCurrentReview(){
    if(busyRef.current||qualityBrief.trim().length<3)return;if(designPreview){tell('Apply or discard the Design Lab proposal before starting a general review.');return;}
    busyRef.current=true;setBusy(true);setShowcaseMotion(false);stopMechanism();const controller=new AbortController();request.current=controller;const start=qualityDraft||latest.current.document;
    try{const reviewed=await reviewCandidate(start,qualityBrief,controller.signal,scene,start.id===latest.current.document.id?latest.current.document:start);if(controller.signal.aborted)return;if(reviewed.report.status==='reviewed'&&!reviewed.report.motionMechanismId){const previous=latest.current;commit({document:reviewed.document,...(reviewed.document.parts.some(p=>p.assetNode)?{scene:previous.scene,asset:previous.asset}:{})});setQualityDraft(null);tell('Rendered views reviewed. The report is saved; physical engineering remains unverified.');}else{setQualityDraft(reviewed.document);tell('Review draft retained. Your saved object is unchanged.');}}
    catch(error){if(!controller.signal.aborted)tell(error instanceof Error?error.message:'The visual review failed.');else tell('Review cancelled. The saved object is unchanged.');}
    finally{setGenerationPreview(null);setBusy(false);setBusyAction('');busyRef.current=false;request.current=null;}
  }
  async function openMotionFan(){if(busyRef.current||pendingQuality.current)return;const {createMotionFan}=await import('@/lib/studio/motion-fan');const reference=createMotionFan();if(commit({document:reference})){stopMechanism();setMotionInspection(null);setQualityReport(undefined);setQualityProgress(null);setQualityBrief(reference.designBrief!);setQualityOpen(true);setNewOpen(false);setExplode(0);setSelectedId(null);setHiddenIds([]);setIsolatedId(null);camera('fit');}}
  async function measureCurrentMotion(){if(busyRef.current)return;busyRef.current=true;setBusy(true);setBusyAction('review');stopMechanism();setMotionInspection(null);const controller=new AbortController();request.current=controller;
    try{const {measureMotionLocally}=await import('@/lib/studio/motion-client');const result=await measureMotionLocally(qualityDraft||doc,qualityBrief,controller.signal,p=>{setQualityProgress(p);setAIProgress(p.message);});if(!controller.signal.aborted){setQualityDraft(result.document);setQualityReport(result.report);tell('Local measurements ready. No Gemini request was made.');}}
    catch(error){tell(controller.signal.aborted?'Measurement cancelled; original retained.':error instanceof Error?error.message:'Measurement failed.');}finally{busyRef.current=false;setBusy(false);setBusyAction('');request.current=null;}}
  function inspectMotionPose(finding:MotionFinding,number:number){const report=qualityReport??doc.review,round=report?.rounds.find(r=>r.number===number),json=round?.motionProject??report?.baselineProject;if(!json)return;try{const original=validateLocalDocument(JSON.parse(json)),mechanism=original.mechanisms?.find(m=>m.id===finding.mechanismId);if(!mechanism)return;stopMechanism();setMotionInspection(poseMotion(original,mechanism,finding.angleDeg));setExplode(0);setHiddenIds([]);setIsolatedId(null);setSelectedId(null);setHighlightedIds(finding.partIds);setFocusCommand(old=>({partIds:finding.partIds,nonce:old.nonce+1}));tell(`Inspecting recorded attempt ${number}, ${finding.angleDeg}°. Saved geometry is unchanged.`);}catch(error){tell(error instanceof Error?error.message:'Could not reopen this recorded pose.');}}
  function exportMotionEvidence(){const report=qualityReport??doc.review;if(!report)return;const retained=qualityDraft||doc;download(`${retained.id}-motion.part.json`,JSON.stringify({document:{...retained,review:report}},catalogJsonReplacer,2));}
  function setPartMount(id:string,parentId:string|null){if(busyRef.current||pendingQuality.current)return;try{const previous=latest.current;commit({...previous,document:validateLocalDocument(mountParts(previous.document,[{partId:id,parentId}]))});tell(parentId?'Mount saved. This component follows its parent’s transforms and resize.':'Component detached; its current placement is preserved.');}catch(error){tell(error instanceof Error?error.message:'This mount could not be saved.');}}
  async function runAI(action: 'ask' | 'edit' | 'generate' | 'converse', text: string, viaMorf=false) {
    if (!text.trim() || busyRef.current) return;
    if(pendingQuality.current){tell('Use the review draft or return to the saved object before starting another change.');setQualityOpen(true);return;}
    if (designPreview) { tell('Apply the design proposal or switch back to the assistant before editing.'); return; }
    busyRef.current = true;setShowcaseMotion(false);
    const requestStarted=performance.now();setGenerationParts([]);setGenerationPreview(null);if(action==='generate'){setDesignPreview(null);setSelectedId(null);setHiddenIds([]);setIsolatedId(null);setLabels(false);setHighlightedIds([]);setHoveredId(null);setBuildStep(null);}
    setBusy(true); setBusyAction(action); setAIError(''); setAIProgress('Connecting to Gemini…'); if(action!=='generate')setPrompt(''); setPlaying(false); stopMechanism();
    if (action !== 'generate') { setPanel('chat'); setRightOpen(!viaMorf);if(viaMorf)setNewOpen(false); setMessages(old => [...old, { role: 'user', text }]); }
    const controller = new AbortController(); request.current = controller;
    const deadline = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), 285_000);
    try {
      const response = await fetch('/api/device', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/x-ndjson' }, body: JSON.stringify({ action, prompt: text, ...(action !== 'generate' ? { document: {...latest.current.document,review:undefined}, history: messages.slice(-10).map(({role,text}) => ({role,text:text.slice(0,8000)})), ...(selectedId ? { partId: selectedId } : {}) } : {}) },catalogJsonReplacer), signal: controller.signal });
      let result = await readDeviceResponse(response, progress => { setAIProgress(progress.message);if(progress.resetGeneration){setGenerationPreview(null);setGenerationParts([]);}if(progress.partNames)setGenerationParts(progress.partNames);if(action==='generate'&&progress.newParts?.length){const incoming=progress.newParts;setGenerationPreview(previous=>{try{return appendGenerationParts(previous,incoming);}catch{return previous;}});} if (progress.model) setModel(progress.model); }); if (controller.signal.aborted) return;
      if (result.model) setModel(result.model);
      if (result.document) {
        let next=validateLocalDocument(result.document);const previous=latest.current;
        if(action==='generate'||requiresVisualReview(previous.document,next)){
          const reviewed=await reviewCandidate(next,text,controller.signal,next.parts.some(p=>p.assetNode)?previous.scene:undefined,action==='generate'?next:previous.document);if(controller.signal.aborted)return;
          next=reviewed.document;result={...result,document:next,answer:reviewed.report.status==='reviewed'?`Created ${next.name}. I inspected the assembled, top and exploded renders against your request. Open Review to see the images, findings and measured checks. Physical fit and operation remain unverified.`:result.answer};
          if(reviewed.report.status!=='reviewed'){setQualityDraft(next);setGenerationPreview(null);setNewOpen(false);tell('Review draft retained. Your saved object is unchanged; inspect the findings before using it.');return;}
        }
        commit({ document: next, ...(next.parts.some(p => p.assetNode) ? { scene: previous.scene, asset: previous.asset } : {}) });
        setBuildStep(null); setHiddenIds([]); setIsolatedId(null); setHoveredId(null); setHighlightedIds([]);
        if (action === 'generate') { setMessages([]); setPrompt(''); setSelectedId(null); setPanel('chat'); setRightOpen(true); setNewOpen(false); setExplode(.45); setLabels(false); camera('fit');tell(`Created ${next.parts.length} custom components in ${Math.round((performance.now()-requestStarted)/1000)}s. Each part is selectable and editable.`); }
        else { setSelectedId(id => next.parts.some(p => p.id === id) ? id : null); tell('Assembly updated. You can undo the complete change.'); }
      }
      const answer = result.answer || (action === 'generate' ? 'Your object is ready. Click a part, ask a question, or describe a change.' : 'Updated the assembly.');
      const entry: ChatMessage = { role: 'assistant', text: answer, actions: result.actions || [], suggestions: result.suggestions || [], checks: result.checks || [] };
      setMessages(old => [...old, entry]);morfReply(answer);
      if (result.actions?.length) applySceneActions(result.actions);
    } catch (error) {
      const timedOut = controller.signal.reason?.name === 'TimeoutError';
      if (!controller.signal.aborted || timedOut) {
        const text = timedOut ? 'Gemini did not finish in time. Your current object and description are preserved. Retry the same request.' : error instanceof Error ? error.message : 'The request failed. Try again.';
        setAIError(text); tell(text); if (action !== 'generate') setMessages(old => [...old, { role: 'assistant', text }]);
      } else {tell('Request cancelled. Your current object is unchanged.');morfReply('Cancelled. Your current object is unchanged.');}
    }
    finally { setGenerationPreview(null);clearTimeout(deadline); busyRef.current = false; setBusy(false); setBusyAction(''); request.current = null; }
  }
  async function openRealBoard() {
    if (busy) return;
    setBusy(true); setBusyAction('import');
    try {
      const { loadStackChan } = await import('@/lib/studio/stack-chan');
      const result = await loadStackChan();
      await storeAsset(result.document.id, result.asset); commit(result);
      mechanismRestore.current = null; setMechanismPlayback(null); setHighlightedIds([]); setSelectedId(null); setHoveredId(null); setHiddenIds([]); setIsolatedId(null); setBuildStep(null); setPlaying(false); setMessages([]); setSearch(''); setPanel('overview'); setNewOpen(false); setRightOpen(false); setExplode(0); setLabels(false); camera('home');
      tell('Opened the real Stack Chan KiCad board. Each complete component is independently editable.');
    } catch (error) { tell(error instanceof Error ? error.message : 'Could not open the example board.'); }
    finally { setBusy(false); setBusyAction(''); }
  }
  async function importFile(file: File) {
    if (busy) return;
    setBusy(true); setBusyAction('import');
    let importedConversation: ConversationEntry[] = [];
    try {
      if (file.size > 36_000_000) throw new Error('Choose a GLB under 25 MB or a project under 36 MB.');
      const { importDeviceGLB } = await import('@/lib/studio/import');
      if (/\.glb$/i.test(file.name)) {
        const buffer = await file.arrayBuffer(); const result = await importDeviceGLB(buffer, file.name.replace(/\.glb$/i, ''));
        await storeAsset(result.document.id, buffer); commit({ document: result.document, scene: result.scene, asset: buffer });
      } else {
        const raw = JSON.parse(await file.text()); const { validateDeviceDocument } = await import('@/lib/studio/validation'); const value = validateDeviceDocument(raw.document || raw);
        importedConversation = restoreConversation(raw.conversation,value);
        if (value.source === 'import') {
          if (!raw.asset) throw new Error('This project needs its embedded GLB. Import the original GLB instead.');
          const buffer = decodeAsset(raw.asset); const result = await importDeviceGLB(buffer, value.name);
          const next = { ...value, parts: value.parts.map(p => ({ ...p, assetNode: result.document.parts.find(q => q.id === p.id)?.assetNode })) };
          await storeAsset(next.id, buffer); commit({ document: next, scene: result.scene, asset: buffer });
        } else commit({ document: value });
      }
      mechanismRestore.current = null; setMechanismPlayback(null); setHighlightedIds([]); setSelectedId(null); setHoveredId(null); setHiddenIds([]); setIsolatedId(null); setBuildStep(null); setPlaying(false); setMessages(importedConversation); setSearch(''); setPanel(importedConversation.length ? 'chat' : 'overview'); setRightOpen(importedConversation.length > 0); setView('perspective'); setLabels(latest.current.document.source !== 'import'); setExplode(latest.current.document.source === 'import' ? 0 : .76); setNewOpen(false); camera('home'); tell('Imported. Click any component to inspect and edit it.');
    } catch (error) { tell(error instanceof Error ? error.message : 'Could not open this file.'); }
    finally { setBusy(false); setBusyAction(''); if (fileInput.current) fileInput.current.value = ''; }
  }
  function openLibraryDocument(document:DeviceDocument){
    if(!commit({document}))return;stopMechanism();setMessages([]);setSearch('');setNewOpen(false);setSelectedId(document.parts[0]?.id??null);setHiddenIds([]);setIsolatedId(null);setBuildStep(null);setPlaying(false);setShowcaseMotion(false);setPanel('part');setRightOpen(false);setLeftOpen(false);setExplode(0);setLabels(false);camera('home');morfReply('This is sourced CAD. Select the component to inspect its dimensions, source and license.');
  }
  function addLibraryPart(id:string):boolean{
    try{const previous=latest.current,{document,partId}=appendCatalogPart(previous.document,id);if(!commit({...previous,document}))return false;stopMechanism();setSelectedId(partId);setSearch('');setNewOpen(false);setPanel('part');setRightOpen(false);setLeftOpen(false);setHiddenIds([]);setIsolatedId(null);setBuildStep(null);setPlaying(false);setShowcaseMotion(false);setExplode(0);camera('fit');tell('Added sourced CAD. Move, rotate or recolor it; Undo removes the addition.');morfReply('I added the real catalog part beside your assembly. Its dimensions and source stay attached.');return true;}catch(error){tell(error instanceof Error?error.message:'Could not add this part.');return false;}
  }
  async function openLibraryModel(reference:ObjectReference,buffer:ArrayBuffer,signal:AbortSignal){
    const {importDeviceGLB}=await import('@/lib/studio/import');const result=await importDeviceGLB(buffer,reference.name.slice(0,190));
    signal.throwIfAborted();
    const document={...result.document,provenance:`Smithsonian digitized object, indexed through Objaverse-XL. License CC0-1.0. Source: ${reference.url}. SHA-256: ${reference.sha256}. Original mesh groups; physical scale and internal functions are unverified.`,parts:result.document.parts.map(part=>({...part,sourceUrl:reference.url,specs:{...part.specs,Source:'Smithsonian / Objaverse-XL',License:'CC0-1.0'},notes:part.notes+' Source scanning does not identify internal components.'}))};
    validateLocalDocument(document);await storeAsset(document.id,buffer);signal.throwIfAborted();if(!commit({document,scene:result.scene,asset:buffer}))throw new Error('The model could not be committed.');stopMechanism();setMessages([]);setSearch('');setNewOpen(false);setSelectedId(null);setHoveredId(null);setHiddenIds([]);setIsolatedId(null);setBuildStep(null);setPlaying(false);setPanel('overview');setRightOpen(false);setLeftOpen(false);setExplode(0);setLabels(false);setShowcaseMotion(false);camera('home');tell('Opened the original source model. Its mesh groups are selectable.');morfReply('You are looking at a real digitized object. I can help explore its visible geometry; the scan does not reveal its internal engineering.');
  }
  function exportProject() { download(`${doc.id}.part.json`, JSON.stringify({ document: doc, conversation:messages, ...(asset ? { asset: encodeAsset(asset) } : {}) }, catalogJsonReplacer, 2)); setExportOpen(false); tell('Project exported with editable component data' + (asset ? ' and its original model.' : '.')); }
  async function copyProject() { try { await navigator.clipboard.writeText(JSON.stringify({ document: doc, conversation:messages, ...(asset ? { asset: encodeAsset(asset) } : {}) }, catalogJsonReplacer, 2)); setExportOpen(false); tell('Copied the complete project JSON. Save it as a .json file to reopen it.'); } catch { tell('Clipboard access is unavailable. Use the project download.'); } }
  function exportParts() { const rows = [['ID', 'Part', 'Category', 'Role', 'Specifications', 'Source'], ...doc.parts.map(p => [p.id, p.name, p.category, p.role, Object.entries(p.specs).map(([k, v]) => `${k}: ${v}`).join('; '), p.sourceUrl || ''])]; download(`${doc.id}-parts.csv`, rows.map(row => row.map(value => '"' + value.replaceAll('"', '""') + '"').join(',')).join('\r\n'), 'text/csv'); setExportOpen(false); }
  async function share() {
    try {
      if (asset) { exportProject(); tell('This 3D asset is included in your exported project. Send that file to share it.'); return; }
      const text = JSON.stringify({ document: doc },catalogJsonReplacer); if (text.length > 350_000) { exportProject(); tell('This assembly is large, so I exported a shareable project file.'); return; }
      const url = `${location.origin}${location.pathname}#device=${encodeURIComponent(text)}`;
      await navigator.clipboard.writeText(url); tell('Copied a link containing this assembly. The app must be running for the link to open.');
    } catch { tell('Clipboard access is unavailable. Use Export project to share this assembly.'); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void runAI('converse', prompt); }
  const activeStep = buildStep === null ? undefined : doc.steps[buildStep];
  const keyboard = doc.capabilities?.includes('wired-keyboard') || doc.parts.some(part => part.id === 'switch-stem');
  return <div onClickCapture={event=>{const target=event.target as Element;const label=target.closest('button')?.getAttribute('aria-label');if(label==='Pause object motion'||label==='Play object motion')return;if(target.closest('button,input,textarea,select'))setShowcaseMotion(false);}} className="device-studio flare-experience morf-experience" data-motion-override={motionOverride} data-gallery={newOpen} data-inspector={rightOpen} data-review={qualityOpen} data-selection={!!selected} data-design={dialogueActive} data-evidence={evidenceOpen} style={{'--dialogue-height':`${dialogueHeight}px`} as CSSProperties}>
    <input ref={fileInput} className="ds-hidden-input" aria-label="Import device file" type="file" accept=".glb,.json" onChange={e => { const file = e.target.files?.[0]; if (file) void importFile(file); }}/>
    <header className="ds-header">
      <button className="ds-brand" onClick={openGallery} disabled={busy} aria-label="Morf home"><span><MorfFace small/></span><span className="ds-brand-word">morf<span className="morf-wordmark-dot">.</span></span><span className="ds-brand-edition">IDEAS. IN EVERY DIMENSION.</span></button>
      <span className="ds-header-separator"/><button className="ds-project-name" onClick={openOverview}>{doc.name}<ChevronDown size={14}/></button>
      <nav className="fx-navigation" aria-label="Workspace"><button aria-current={newOpen ? 'page' : undefined} onClick={openGallery} disabled={busy||!!qualityDraft}>Explore</button><button aria-current={!newOpen && !dialogueActive ? 'page' : undefined} onClick={() => {setNewOpen(false);setPanel('overview');}} disabled={busy||!!qualityDraft}>Studio</button><button aria-current={dialogueActive ? 'page' : undefined} onClick={openDesign} disabled={busy||!!qualityDraft} aria-label="Design Lab">Design<span className="fx-lab-word"> Lab</span></button></nav><span className="ds-saved"><i/>{saveStatus}</span>
      <div className="ds-header-actions"><button className="ds-btn ds-subtle morf-review-trigger" aria-label="Review design" disabled={busy} onClick={openQuality}><Eye size={15}/><span>Review</span></button><button className="ds-btn ds-subtle morf-library-trigger" aria-label="Parts library" disabled={busy||!!qualityDraft} onClick={()=>setLibraryOpen(true)}><Box size={15}/><span>Parts library</span></button><button className="ds-btn ds-subtle" aria-label="New device" disabled={busy||!!qualityDraft} onClick={openGallery}><Plus size={15}/><span>New object</span></button><button className="ds-btn ds-subtle ds-import-action" aria-label="Import device" disabled={busy||!!qualityDraft} onClick={() => fileInput.current?.click()}><Upload size={15}/><span>Import</span></button><IconButton title="Share assembly" disabled={busy} onClick={() => void share()}><Share2 size={16}/></IconButton><button className="ds-btn ds-dark" aria-label="Export" disabled={busy||!!qualityDraft} onClick={() => setExportOpen(true)}><ArrowDownToLine size={15}/><span>Export</span></button></div>
    </header>
    <div className="ds-workspace">
      <aside className={'ds-parts-panel' + (leftOpen ? ' ds-open' : '')} aria-label="Assembly parts" inert={!leftOpen}>
        <div className="ds-parts-head"><span>ASSEMBLY</span><button onClick={() => setLeftOpen(false)} aria-label="Close parts panel" className="fx-close-parts"><X size={16}/></button><span className="ds-count">{doc.parts.length}</span></div>
        <div className="ds-parts-project"><span className="ds-machine-icon"><Cpu size={23}/></span><div><strong>{doc.name}</strong><span>{doc.source === 'import' ? 'Imported 3D model' : doc.source === 'gemini' ? 'Gemini design study' : 'Complete device study'}</span></div></div>
        <label className="ds-search"><Search size={15}/><input aria-label="Search assembly parts" placeholder="Find a component…" value={search} onChange={e => setSearch(e.target.value)}/><kbd>⌕</kbd></label>
        <div className="ds-parts-scroll"><AssemblyTree document={doc} search={search} selectedId={selectedId} hiddenIds={hiddenIds} highlightedIds={highlightedIds} scene={scene} onSelect={id => { if(!newOpen&&!busy&&!qualityDraft) { if (dialogueActive) {setDialogueSelectedId(id); setHighlightedIds(id ? [id] : []); if (id) setFocusCommand(old => ({partIds:[id],nonce:old.nonce+1})); } else select(id); } }} onHover={setHoveredId} onHide={toggleHidden} onFocus={focusParts}/></div>
        <div className="ds-library-footer"><button disabled={busy} onClick={() => void openKeyboard()}><Layers3 size={16}/><span>Corne source keyboard<small>Source CAD · explain · redesign</small></span><ArrowRight size={14}/></button><button onClick={() => fileInput.current?.click()}><Upload size={15}/><span>Open a 3D assembly<small>Any device · GLB or project JSON</small></span><ArrowUpRight size={14}/></button><a href="/circuits"><Cpu size={15}/>Circuit workbench<ArrowUpRight size={13}/></a></div>
      </aside>
      <main className="ds-stage" aria-label="Interactive device assembly"><div className="fx-stage-coordinate fx-coordinate-top">MORF / OBJECT STUDY</div><div className="fx-stage-coordinate fx-coordinate-side">A DIFFERENT PERSPECTIVE CHANGES EVERYTHING</div>
        <div className="ds-stage-top"><div className="ds-tools"><IconButton title={showcaseMotion?"Pause object motion":"Play object motion"} active={showcaseMotion} onClick={toggleShowcase}>{showcaseMotion?<Pause size={15}/>:<Play size={15}/>}</IconButton><IconButton title="Show assembly parts" active={leftOpen} onClick={() => setLeftOpen(n => !n)}><PanelLeft size={17}/></IconButton><span className="ds-tool-divider"/><IconButton title="Undo edit" disabled={busy || !!qualityDraft || !!designPreview || !history.current.past.length} onClick={undo}><Undo2 size={16}/></IconButton><IconButton title="Redo edit" disabled={busy || !!qualityDraft || !!designPreview || !history.current.future.length} onClick={redo}><Redo2 size={16}/></IconButton></div><div className="ds-views">{(['perspective', 'top', 'front'] as const).map(v => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{v === 'perspective' ? '3D' : v === 'top' ? 'Top' : 'Front'}</button>)}</div><div className="ds-tools"><IconButton title="Toggle component labels" active={labels} onClick={() => setLabels(!labels)}><Grip size={17}/></IconButton><IconButton title="Device information" active={rightOpen} onClick={() => { setPanel(selected ? 'part' : 'overview'); setRightOpen(n => !n); }}><Settings2 size={17}/></IconButton></div></div>
        <div className="ds-scene"><DeviceScene document={displayed} forceMotion={motionOverride} showcase={ready&&showcaseMotion&&!busy&&!selectedId&&!dialogueActive&&!designPreview&&buildStep===null&&!mechanismPlayback} onShowcaseStop={stopShowcase} guidePartId={guidePart?.id} onGuideAnchor={morfAnchor} reviewMode={designPreview?.emphasize&&!mechanismPlayback} measurement={!mechanismPlayback?designPreview?.measurement:undefined} collisionRegions={!mechanismPlayback?designPreview?.checks.filter(check => check.status === 'fail' && check.region).map(check => check.region!):undefined} selectedId={selectedId} hoveredId={hoveredId} hiddenIds={hiddenIds} isolatedId={isolatedId} explode={explode} view={view} tool={tool} labels={newOpen ? false : labels} partsOpen={leftOpen} cameraCommand={cameraCommand} buildStep={buildStep} importedScene={scene} onSelect={id => { if(!newOpen&&!busy&&!qualityDraft) { if (dialogueActive) {setDialogueSelectedId(id); setHighlightedIds(id ? [id] : []); if (id) setFocusCommand(old => ({partIds:[id],nonce:old.nonce+1})); } else select(id); } }} onHover={setHoveredId} onTransform={transform} highlightedIds={highlightedIds} focusCommand={focusCommand} mechanismPlayback={mechanismPlayback || undefined} onMechanismProgress={mechanismProgress} onMechanismComplete={mechanismComplete} presentation={newOpen ? 'gallery' : 'studio'} contextPanel={newOpen?null:qualityOpen||evidenceOpen||rightOpen?'inspector':dialogueActive?'dialogue':selected?'part':null} viewportBottomInset={newOpen?245:dialogueActive?(dialogueHeight+(activeMechanism?230:100)):activeMechanism||buildStep!==null?300:175}/></div>
        <div className="ds-figure-title" data-long-title={displayed.name.length>42}><span>OBJECT {displayed.source === 'import' ? '/ IMPORTED' : '/ INTERACTIVE STUDY'}<i/>{String(displayed.parts.length).padStart(2, '0')} PARTS</span><h1>{displayed.name.replace(/\s*\/\s*01$/, '')}<em>/ 01</em></h1><p>{activeMechanism?'Educational switch mechanism · source key placement.':designPreview ? designPreview.pending===false?'Measured cutaway · current assembly.':'Review cutaway · upper layers hidden · changes not yet applied.' : buildStep !== null ? 'One component. One connection. One step closer.' : 'A little closer. A lot clearer.'}</p></div>
        <div className="ds-camera-tools"><button className="fx-parts-toggle" aria-label="Browse components" aria-pressed={leftOpen} onClick={() => { setLeftOpen(value => !value); setRightOpen(false); }}><Layers3 size={18}/><span>Parts</span><small>{displayed.parts.length}</small></button><span className="fx-rail-divider"/><IconButton title="Reset camera" onClick={() => camera('home')}><RotateCcw size={17}/></IconButton><IconButton title="Fit assembly" onClick={() => camera('fit')}><Maximize2 size={17}/></IconButton><IconButton title="Zoom in" onClick={() => camera('in')}><ZoomIn size={17}/></IconButton><IconButton title="Zoom out" onClick={() => camera('out')}><ZoomOut size={17}/></IconButton></div>
        {(hiddenIds.length > 0 || isolatedId) && <button className="ds-show-all" onClick={() => { setHiddenIds([]); setIsolatedId(null); }}><Eye size={14}/>{isolatedId ? 'Exit isolation' : `Show ${hiddenIds.length} hidden`}<X size={12}/></button>}
        {selected && <div className="ds-transform-tools">{(['select', 'move', 'rotate'] as const).map(t => <IconButton key={t} title={`${t[0].toUpperCase() + t.slice(1)} component`} active={tool === t} onClick={() => { setBuildStep(null); setTool(t); }}>{t === 'select' ? <MousePointer2 size={16}/> : t === 'move' ? <Move3d size={17}/> : <RotateCw size={17}/>}</IconButton>)}</div>}
        {hovered && !selected && <div className="ds-hover-card"><span style={{ background: hovered.color }}/><strong>{hovered.name}</strong><small>{hovered.role}</small></div>}
        {selected && !dialogueActive && !rightOpen && !activeMechanism && <ComponentSpotlight part={selected} connectionCount={connectedPartIds(doc,selected.id).length} scene={scene} isolated={isolatedId === selected.id} busy={busy} onClose={() => { setSelectedId(null); setTool('select'); }} onExplain={() => void runAI('converse', `How does the ${selected.name} work? Show me its connections.`)} onEdit={() => { setPanel('part'); setRightOpen(true); setLeftOpen(false); }} onIsolate={() => { setIsolatedId(isolatedId === selected.id ? null : selected.id); camera('fit'); }} onFocus={() => focusParts([selected.id])}/>}
        {!selected && !activeMechanism && buildStep === null && !rightOpen && <div className="fx-discover"><span>FOLLOW YOUR CURIOSITY</span><button onClick={() => { setExplode(.85); setLabels(true); camera('fit'); }}><Layers3 size={14}/>Take it apart<ArrowUpRight size={13}/></button>{doc.mechanisms?.[0] && <button onClick={() => applySceneActions([{ type: 'animate', mechanismId: doc.mechanisms![0].id }])}><Play size={14}/>{keyboard ? 'Follow a keypress' : 'See it in motion'}<ArrowUpRight size={13}/></button>}<button onClick={() => { setPanel('chat'); setRightOpen(true); }}><MessageCircle size={14}/>Start a conversation<ArrowUpRight size={13}/></button></div>}
        <div className="ds-stage-bottom">
          {activeMechanism && mechanismPlayback ? <MechanismPlayer mechanism={activeMechanism} playback={mechanismPlayback} onChange={patch => setMechanismPlayback(old => old ? { ...old, ...patch } : null)} onClose={() => { stopMechanism(); camera('fit'); }}/> : buildStep !== null ? <div className="ds-build-card"><div className="ds-build-progress"><i style={{ width: `${Math.min(100, buildStep / doc.steps.length * 100)}%` }}/></div><div className="ds-build-heading"><span>{buildStep >= doc.steps.length ? 'ASSEMBLY COMPLETE' : `STEP ${buildStep + 1} OF ${doc.steps.length}`}</span><button aria-label="Exit assembly guide" onClick={() => { setBuildStep(null); setPlaying(false); setExplode(.76); }}><X size={15}/></button></div><h3>{activeStep?.title || 'Every component, in its place.'}</h3><p>{activeStep?.description || 'Review the selected parts and verify compatibility against their manufacturer documentation before building.'}</p><div className="ds-build-actions"><button disabled={buildStep === 0} onClick={() => setBuildStep(Math.max(0, buildStep - 1))}><ArrowLeft size={15}/>Back</button><button aria-pressed={playing} onClick={() => { if (buildStep >= doc.steps.length) setBuildStep(0); setPlaying(!playing); }}><Play size={13}/>{playing ? 'Pause' : 'Play guide'}</button><button className="ds-dark" disabled={buildStep >= doc.steps.length} onClick={() => setBuildStep(buildStep + 1)}>{buildStep >= doc.steps.length - 1 ? 'Finish' : 'Next'}<ArrowRight size={15}/></button></div></div> : <div className="ds-assembly-control"><div className="ds-modes"><button aria-pressed={explode === 0} onClick={() => { setMechanismPlayback(null); setExplode(0); setTool('select'); }}><Box size={15}/>Assembled</button><button aria-pressed={explode > 0} onClick={() => { setMechanismPlayback(null); setExplode(.76); }}><Layers3 size={15}/>Exploded</button>{doc.mechanisms?.length ? <button onClick={() => applySceneActions([{ type: 'animate', mechanismId: doc.mechanisms![0].id }])}><Play size={14}/>See it work</button> : <button disabled={!doc.steps.length} title={!doc.steps.length ? 'This model has no assembly guide yet' : 'Walk through assembly'} onClick={() => { setMechanismPlayback(null); setBuildStep(0); setPlaying(false); setTool('select'); }}><Play size={14}/>Build guide</button>}</div><label className="ds-explode-slider"><span>Explode</span><input aria-label="Explode assembly" type="range" min="0" max="1" step=".01" value={explode} onChange={e => { setMechanismPlayback(null); setExplode(Number(e.target.value)); }}/><output>{Math.round(explode * 100)}%</output></label></div>}
          <form className="ds-ask-bar" onSubmit={submit}><Sparkles size={19}/><input aria-label="Ask about or edit the device" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={selected ? `Ask about ${selected.name.toLowerCase()}…` : 'Ask your object anything. Or give it a new idea…'} disabled={busy}/><VoiceInput disabled={busy || newOpen} onText={setPrompt} onSubmit={text => void runAI('converse', text)} tell={tell}/>{busy ? <button type="button" className="ds-cancel-request" onClick={() => request.current?.abort()}>Cancel</button> : <button type="button" disabled={!prompt.trim()} onClick={() => void runAI('edit', prompt)} title="Apply your requested edit" className="ds-edit-request">Edit</button>}<button type="submit" disabled={busy || !prompt.trim()} aria-label="Send to object assistant">{busy ? <LoaderCircle size={17} className="ds-spin"/> : <ArrowRight size={18}/>}</button></form>
        </div>
        <div className="ds-stage-footer"><span><i/>{doc.id==='corne-cherry-v4-left'?'Source CAD + labeled illustrations':doc.source==='import'?'Original mesh geometry':'Illustrative geometry'}<span className="ds-footer-hide"> · millimetres</span></span><span>Drag to orbit · scroll to zoom</span><button aria-label="About this workspace" onClick={() => setHelpOpen(true)}><CircleHelp size={15}/></button></div>
        <DesignReviewPanel onAgent={connectDesignAgent} onReply={morfReply} onProgress={setAIProgress} document={doc} visible={dialogueActive} available={aiStatusReady?aiAvailable:null} selectedPartId={dialogueSelectedId} onPreview={previewDesign} onBusy={designBusy} onComposerHeight={setDialogueHeight} onInspect={inspectDesignCheck} onActions={applySceneActions} onKeyboard={()=>void openKeyboard()} onClose={()=>{setPanel('overview');setEvidenceOpen(false);setDesignPreview(null);}} onEvidence={setEvidenceOpen} onUndo={undo} canUndo={!!history.current.past.length} onApply={next=>{commit({document:next});setSelectedId(null);setDesignPreview(null);setExplode(0);tell('Proposal applied. Undo restores the previous assembly.');}}/>
        {busy && !['ask','converse','redesign'].includes(busyAction) && <div className="ds-busy"><div><LoaderCircle size={22} className="ds-spin"/><strong>{busyAction === 'review' ? 'Inspecting your design' : busyAction === 'import' ? 'Opening your model' : busyAction === 'edit' ? 'Updating your assembly' : 'Designing your device'}</strong><span>{busyAction === 'import' ? 'Separating real mesh components…' : `${aiProgress || 'Gemini is working…'} · ${elapsed}s`}</span>{busyAction !== 'import' && <button onClick={() => request.current?.abort()}>Cancel</button>}</div></div>}
      </main>
      <aside className={'ds-inspector' + (rightOpen ? ' ds-open' : '')} aria-label="Component inspector"><div className="ds-inspector-tabs"><button className={panel === 'overview' ? 'is-active' : ''} onClick={() => setPanel('overview')}>Overview</button><button className={panel === 'part' ? 'is-active' : ''} onClick={() => setPanel('part')}>Component</button><button className={panel === 'chat' ? 'is-active' : ''} onClick={() => setPanel('chat')}>Assistant</button><button className={panel === 'design' ? 'is-active' : ''} onClick={openDesign}>Design</button><button className="ds-close-inspector" aria-label="Close inspector" onClick={() => setRightOpen(false)}><X size={15}/></button></div>
        <div className="ds-inspector-scroll">{panel === 'overview' ? <><div className="ds-overview-icon"><Layers3 size={30}/></div><span className="ds-eyebrow">{doc.source === 'import' ? 'YOUR 3D ASSEMBLY' : 'EXPLORE THE INSIDE'}</span><h2>{doc.name}</h2><p className="ds-description">{doc.description}</p><div className="ds-overview-stats"><div><strong>{doc.parts.length}</strong><span>components</span></div><div><strong>{doc.steps.length}</strong><span>assembly steps</span></div></div><div className="ds-panel-section"><h3>A closer look</h3><p>Click any part in the model or the assembly list. Inspect its role, adjust its placement, hide the outer shell, or isolate a component.</p><button className="ds-btn ds-panel-button" disabled={!doc.steps.length} onClick={() => { setBuildStep(0); setRightOpen(false); }}><Play size={14}/>Walk through the build<ArrowRight size={14}/></button></div>{!!doc.mechanisms?.length && <div className="ds-panel-section"><h3>See how it works</h3>{doc.mechanisms.map(m => <button key={m.id} className="ds-mechanism-option" onClick={() => applySceneActions([{ type: 'animate', mechanismId: m.id }])}><Play size={15}/><span><strong>{m.name}</strong><small>{m.description}</small></span><ArrowRight size={14}/></button>)}</div>}<div className="ds-panel-section"><h3>About this model</h3><p>{doc.provenance}</p>{doc.source === 'gemini' && <span className="ds-source-tag"><Sparkles size={12}/>{doc.model || model}</span>}</div><div className="ds-panel-section"><h3>Bring your own hardware</h3><p>Import an assembled GLB to inspect its actual mesh parts. Or describe a device to generate an editable design study.</p><button className="ds-btn ds-panel-button" onClick={() => fileInput.current?.click()}><Upload size={14}/>Import 3D assembly</button></div></> : panel === 'part' ? selected ? <><div className="ds-component-preview"><PartThumbnail part={selected} large scene={scene}/><span>{selected.id}</span></div><div className="ds-component-heading"><span className="ds-eyebrow">{selected.category}</span><ComponentName key={selected.id} value={selected.name} disabled={busy} onSave={name => updatePart(selected.id, { name })}/></div><p className="ds-description">{selected.description}</p><div className="ds-part-actions"><button onClick={() => { void runAI('converse', `How does the ${selected.name} work? Show me the relevant parts.`); }}><MessageCircle size={14}/>Ask</button><button aria-pressed={hiddenIds.includes(selected.id)} onClick={() => toggleHidden(selected.id)}><EyeOff size={14}/>{hiddenIds.includes(selected.id) ? 'Show' : 'Hide'}</button><button aria-pressed={isolatedId === selected.id} onClick={() => { setIsolatedId(isolatedId === selected.id ? null : selected.id); camera('fit'); }}><Focus size={14}/>Isolate</button></div><div className="ds-panel-section"><h3>Role in this device</h3><p>{selected.role}</p></div>{!!doc.mechanisms?.filter(m => m.tracks.some(t => t.partId === selected.id) || m.stages.some(s => s.partIds.includes(selected.id))).length && <div className="ds-panel-section"><h3>Watch it work</h3>{doc.mechanisms.filter(m => m.tracks.some(t => t.partId === selected.id) || m.stages.some(s => s.partIds.includes(selected.id))).map(m => <button key={m.id} className="ds-mechanism-option" onClick={() => applySceneActions([{ type: 'animate', mechanismId: m.id }])}><Play size={14}/>{m.name}<ArrowRight size={13}/></button>)}</div>}<div className="ds-panel-section"><h3>Transform</h3><label className="morf-mount-field"><span>Attached to</span><select aria-label="Component mount parent" disabled={busy||!!qualityDraft||doc.source==='import'} value={selected.attachment?.parentId||''} onChange={e=>setPartMount(selected.id,e.target.value||null)}><option value="">Free component</option>{doc.parts.filter(p=>p.id!==selected.id).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><small>Mounted parts follow their parent’s movement, rotation and resize.</small></label><NumberVector label="Position" unit="mm" disabled={busy||!!qualityDraft} value={selected.position} onChange={position => updatePart(selected.id, { position })}/><NumberVector label="Rotation" unit="deg" disabled={busy||!!qualityDraft} value={selected.rotation} onChange={rotation => updatePart(selected.id, { rotation })}/><ComponentFinish key={selected.id} value={selected.color} disabled={busy||!!qualityDraft} onSave={color => updatePart(selected.id, { color })}/></div><div className="ds-panel-section"><h3>Specifications</h3><dl className="ds-specs">{Object.entries(selected.specs).filter(([key])=>!selected.catalogRef||!['Source SHA-256','Source revision'].includes(key)).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}<div><dt>Envelope</dt><dd>{selected.size.map(n => Math.round(n * 10) / 10).join(' × ')} mm</dd></div></dl></div><RelationshipInspector document={doc} partId={selected.id} onFocus={focusParts}/>{!doc.relationships?.length && selected.connections.length > 0 && <div className="ds-panel-section"><h3>Connected components</h3>{selected.connections.map((connection, index) => { const part = doc.parts.find(p => p.id === connection.partId); return part ? <button className="ds-connection" key={index} onMouseEnter={() => setHoveredId(part.id)} onMouseLeave={() => setHoveredId(null)} onClick={() => select(part.id)}><span><strong>{part.name}</strong><small>{connection.label}</small></span><ChevronRight size={14}/></button> : null; })}</div>}{selected.notes && <div className="ds-note"><CircleHelp size={16}/><p>{selected.notes}</p></div>}{selected.sourceUrl && /^https:\/\//.test(selected.sourceUrl) && <a className="ds-source-link" href={selected.sourceUrl} target="_blank" rel="noreferrer">Reference documentation<ArrowUpRight size={14}/></a>}</> : <div className="ds-empty-selection"><MousePointer2 size={27}/><h3>Select a component</h3><p>Click a part in the assembly to inspect and edit it.</p></div> : panel === 'chat' ? <><ConversationPanel document={doc} entries={messages} model={model} busy={busy} onAsk={text => void runAI('converse', text)} onActions={applySceneActions}/><div ref={chatEnd}/></> : null}</div>
      </aside>
      {newOpen&&<button className="morf-gallery-motion" aria-label={showcaseMotion?'Pause object motion':'Play object motion'} onClick={toggleShowcase}>{showcaseMotion?<Pause size={12}/>:<Play size={12}/>}<span>{showcaseMotion?'Pause motion':'Play opening'}</span></button>}
      {newOpen && <ObjectGallery partNames={generationParts} document={displayed} prompt={newPrompt} model={model} available={aiAvailable} busy={busy} progress={aiProgress} elapsed={elapsed} error={aiError} onPrompt={setNewPrompt} onGenerate={() => void runAI('generate', newPrompt)} onCancel={() => request.current?.abort()} onContinue={() => setNewOpen(false)} onKeyboard={explain => void openKeyboard(explain)} onDesktop={openDesktop} onImport={() => fileInput.current?.click()} onBoard={() => void openRealBoard()} onLibrary={()=>setLibraryOpen(true)}/>}
    </div>
    <MorfGuide forceMotion={motionOverride} ref={morf} partId={guidePart?.id} partName={guidePart?.name} partRole={guidePart?.role} answer={morfAnswer} answerKey={morfAnswerKey} busy={busy} progress={aiProgress} error={aiError} rightInset={qualityOpen?390:rightOpen||evidenceOpen?330:0} leftInset={leftOpen?300:0} gallery={newOpen} hidden={!ready||exportOpen||helpOpen} onAsk={text=>{setShowcaseMotion(false);if(dialogueActive&&supportsRedesign(doc))designAgent.current?.ask(text);else void runAI('converse',text,true);}} onCancel={()=>busyAction==='redesign'?designAgent.current?.cancel():request.current?.abort()} onConversation={()=>{setNewOpen(false);if(!dialogueActive){setPanel('chat');setRightOpen(true);}}} tell={tell}/>
    {qualityOpen&&<QualityPanel motionSupported={!!doc.mechanisms?.some(m=>m.verification)} onMeasure={()=>void measureCurrentMotion()} onOpenFan={()=>void openMotionFan()} onMotionPose={inspectMotionPose} onExportMotion={exportMotionEvidence} report={busyAction==='review'?undefined:qualityReport??doc.review} progress={qualityProgress} busy={busy&&busyAction==='review'} brief={qualityBrief} onBrief={setQualityBrief} onRun={()=>void runCurrentReview()} onCancel={()=>request.current?.abort()} onClose={()=>{setQualityOpen(false);setMotionInspection(null);}} draft={!!qualityDraft||busyAction==='review'} onApply={useQualityDraft} onDiscard={discardQualityDraft} onFocus={ids=>{setHighlightedIds(ids);setFocusCommand(old=>({partIds:ids,nonce:old.nonce+1}));}} stale={!qualityDraft&&!!(qualityReport??doc.review)&&!!savedReviewHash&&((qualityReport??doc.review)!.finalHash!==savedReviewHash||(qualityReport??doc.review)!.request!==qualityBrief)}/>}
    {libraryOpen&&<PartsLibrary assemblyName={doc.name} onClose={()=>setLibraryOpen(false)} onAdd={addLibraryPart} onOpen={openLibraryDocument} onOpenModel={openLibraryModel}/>}
    {!ready && <div className="ds-restore-overlay" role="status"><LoaderCircle size={22} className="ds-spin"/><span>Opening your workspace…</span></div>}
    {notice && <div className="ds-toast" role="status"><CheckCircle2 size={17}/><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={14}/></button></div>}
    {exportOpen && <div className="ds-modal-backdrop" onClick={() => setExportOpen(false)}><section className="ds-modal ds-small-modal" role="dialog" aria-modal="true" aria-labelledby="ds-export-heading" onClick={e => e.stopPropagation()}><button className="ds-modal-close" aria-label="Close export" onClick={() => setExportOpen(false)}><X size={18}/></button><span className="ds-eyebrow">TAKE IT WITH YOU</span><h2 id="ds-export-heading">Export your assembly</h2><p>Save the component data, transformations and assembly guide.</p><button className="ds-export-option" onClick={exportProject}><Box size={23}/><span><strong>Editable project</strong><small>JSON{asset ? ' + embedded GLB' : ''} · reopen in Morf</small></span><ArrowDownToLine size={17}/></button><button className="ds-export-option" onClick={exportParts}><Layers3 size={23}/><span><strong>Component list</strong><small>CSV · parts, specifications and sources</small></span><ArrowDownToLine size={17}/></button><button className="ds-export-option" onClick={() => { setExportOpen(false); window.print(); }}><ArrowUpRight size={23}/><span><strong>Assembly guide</strong><small>Print or save as PDF</small></span><ArrowDownToLine size={17}/></button><button className="ds-copy-project" onClick={() => void copyProject()}>Copy project JSON</button></section></div>}
    {helpOpen && <div className="ds-modal-backdrop" onClick={() => setHelpOpen(false)}><section className="ds-modal ds-small-modal" role="dialog" aria-modal="true" aria-labelledby="ds-help-heading" onClick={e => e.stopPropagation()}><button className="ds-modal-close" aria-label="Close help" onClick={() => setHelpOpen(false)}><X size={18}/></button><h2 id="ds-help-heading">Explore, understand, edit.</h2><p>Drag to orbit. Scroll to zoom. Click a component for its details. Move and rotate it using the tool bar or exact values in the inspector. Undo with ⌘Z. Escape clears the selection.</p><p>Use Assembled, Exploded, or scrub the slider. Build guide walks through the assembly in order; arrow keys move between steps.</p><p>GLB imports preserve actual geometry, split by mesh. Gemini generates illustrative device studies. Manufacturer CAD, electrical compatibility, and physical fit still require verification.</p><p>Explore the assembly tree and use the assistant to focus, highlight, separate or animate components. Changes update the object and can be undone. Drawing and interaction references: <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noreferrer">Anatomy</a> and <a href="https://github.com/PranavAchar01/etch" target="_blank" rel="noreferrer">Etch</a>.</p></section></div>}
    <article className="ds-print-guide"><h1>{doc.name}</h1><p>{doc.description}</p><p>{doc.provenance}</p><h2>Components</h2>{doc.parts.map(p => <section key={p.id}><h3>{p.name}</h3><p>{p.role}</p><p>{Object.entries(p.specs).map(([key, value]) => `${key}: ${value}`).join(' · ')}</p></section>)}<h2>Assembly guide</h2>{doc.steps.map((step, i) => <section key={i}><h3>{i + 1}. {step.title}</h3><p>{step.description}</p></section>)}</article>
  </div>;
}
