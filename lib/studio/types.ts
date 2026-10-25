import type { Vec3 } from '@/lib/types';
export type { Vec3 } from '@/lib/types';
export type Solid = {
  kind: 'box' | 'cylinder' | 'sphere' | 'torus';
  position: Vec3;
  size: Vec3;
  rotation?: Vec3;
  color?: string;
  metalness?: number;
  roughness?: number;
};
export interface DevicePart {
  id: string;
  name: string;
  category: string;
  description: string;
  role: string;
  position: Vec3;
  rotation: Vec3;
  size: Vec3;
  explode: Vec3;
  color: string;
  solids: Solid[];
  specs: Record<string, string>;
  connections: { partId: string; label: string }[];
  sourceUrl?: string;
  notes?: string;
  assetNode?: string;
  /** Centered millimetre geometry tessellated from a cited source CAD file. */
  mesh?: { positions:number[]; indices:number[]; colors?:number[] };
  catalogRef?: {id:string};
  /** Child origin as a normalized point in its parent's local geometry bounds. */
  attachment?: {parentId:string;anchor:Vec3;rotation:Vec3};
  assemblyId?: string;
}
export interface DeviceStep { title: string; description: string; partIds: string[]; }
export interface DeviceAssembly { id:string; name:string; parentId?:string; partIds:string[]; }
export interface DeviceRelationship { id:string; from:string; to:string; type:'mechanical'|'electrical'|'data'|'contains'; description:string; }
export interface DeviceMechanism {
  id:string;
  name:string;
  description:string;
  duration:number;
  motion?:'press-release'|'linear';
  /** Translation and XYZ-degree rotation deltas from each part's resting pose. */
  tracks:{partId:string;translation?:Vec3;rotation?:Vec3;scale?:Vec3}[];
  stages:{at:number;title:string;description:string;partIds:string[]}[];
}
export type SceneAction =
  | {type:'focus'|'highlight'|'isolate';partIds:string[]}
  | {type:'explode';amount:number}
  | {type:'view';view:'perspective'|'top'|'front'}
  | {type:'animate';mechanismId:string};
export interface MechanismPlayback {mechanismId:string;playing:boolean;progress:number;nonce:number;}
export interface ConversationCheck {level:'info'|'warning'|'pass';message:string;}
export interface DeviceConversationResponse {
  performance?: import('../inference').InferenceMetrics;
  answer:string;
  actions:SceneAction[];
  suggestions?:string[];
  document?:DeviceDocument;
  model?:string;
  checks?:ConversationCheck[];
}
export interface DeviceDocument {
  version: 1;
  id: string;
  name: string;
  description: string;
  provenance: string;
  parts: DevicePart[];
  steps: DeviceStep[];
  source: 'curated' | 'gemini' | 'import';
  model?: string;
  assemblies?:DeviceAssembly[];
  relationships?:DeviceRelationship[];
  mechanisms?:DeviceMechanism[];
  capabilities?:string[];
  designBrief?:string;
  review?:import('./quality-types').QualityReport;
}
export interface DeviceSceneProps {
  showcase?:boolean;
  forceMotion?:boolean;
  onShowcaseStop?:()=>void;
  guidePartId?:string|null;
  onGuideAnchor?:(anchor:import('./lumi-motion').GuideAnchor|null)=>void;
  document: DeviceDocument;
  reviewMode?: boolean;
  collisionRegions?: { position:Vec3; size:Vec3 }[];
  measurement?: { from:Vec3; to:Vec3; label:string; detail?:string; tone:'pass'|'fail'|'info' };
  selectedId: string | null;
  hoveredId: string | null;
  hiddenIds: string[];
  isolatedId: string | null;
  explode: number;
  view: 'perspective' | 'top' | 'front';
  tool: 'select' | 'move' | 'rotate';
  labels: boolean;
  cameraCommand: { type: 'fit' | 'home' | 'in' | 'out'; nonce: number };
  buildStep: number | null;
  importedScene?: unknown;
  viewportBottomInset?:number;
  presentation?:'studio'|'gallery';
  contextPanel?:'part'|'inspector'|'dialogue'|null;
  partsOpen?:boolean;
  highlightedIds?:string[];
  focusCommand?:{partIds:string[];nonce:number};
  mechanismPlayback?:MechanismPlayback;
  onMechanismProgress?:(progress:number)=>void;
  onMechanismComplete?:()=>void;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onTransform: (id: string, position: Vec3, rotation: Vec3) => void;
}
