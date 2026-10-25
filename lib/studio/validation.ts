import { z } from 'zod';
import type { DeviceDocument } from './types';
import {canonicalCatalogGeometry,inflateCatalogDocument} from './catalog';
import {attachmentIssues} from './attachments';
import {qualityReportSchema} from './quality-types';
import {motionContractSchema} from './motion-types';

const text=z.string().trim().min(1);
const id=text.max(100).regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/);
const number=z.number().finite();
const coordinate=number.min(-5000).max(5000);
const vec=z.tuple([coordinate,coordinate,coordinate]);
const size=z.tuple([number.min(.001).max(5000),number.min(.001).max(5000),number.min(.001).max(5000)]);
const scale=z.tuple([number.min(.05).max(20),number.min(.05).max(20),number.min(.05).max(20)]);
const color=z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,'Use a hex colour such as #8a9399');
const partIds=z.array(id).max(2000).refine(values=>new Set(values).size===values.length,'Component references must not repeat');
export const solidSchema=z.object({kind:z.enum(['box','cylinder','sphere','torus']),position:vec,size,rotation:vec.optional(),color:color.optional(),metalness:number.min(0).max(1).optional(),roughness:number.min(0).max(1).optional()});
const meshSchema=z.object({positions:z.array(number.min(-5000).max(5000)).min(9).max(180000),indices:z.array(z.number().int().min(0).max(59999)).min(3).max(300000),colors:z.array(number.min(0).max(1)).max(180000).optional()}).strict().superRefine((mesh,ctx)=>{
  if(mesh.positions.length%3||mesh.indices.length%3||mesh.indices.some(i=>i>=mesh.positions.length/3))ctx.addIssue({code:'custom',message:'Source mesh vertices and triangle indices must be valid triplets.'});
  if(mesh.colors&&mesh.colors.length!==mesh.positions.length)ctx.addIssue({code:'custom',message:'Source mesh colors must match every vertex.'});
});
export const devicePartSchema=z.object({
  id,name:text.max(160),category:text.max(100),description:text.max(2400),role:text.max(2400),position:vec,rotation:vec,size,explode:vec,color,
  solids:z.array(solidSchema).max(2000),specs:z.record(text.max(100),z.string().max(1000)).refine(value=>Object.keys(value).length<=32,'Use at most 32 specifications per component'),
  connections:z.array(z.object({partId:id,label:text.max(500)})).max(100),
  sourceUrl:z.string().url().max(2000).refine(value=>{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password;},'Use an ordinary HTTP documentation URL').optional(),
  notes:z.string().max(5000).optional(),assetNode:text.max(150).optional(),assemblyId:id.optional(),
  mesh:meshSchema.optional(),
  catalogRef:z.object({id}).strict().optional(),
  attachment:z.object({parentId:id,anchor:z.tuple([number.min(-20).max(20),number.min(-20).max(20),number.min(-20).max(20)]),rotation:vec}).strict().optional(),
});
export const deviceStepSchema=z.object({title:text.max(200),description:text.max(4000),partIds});
export const deviceAssemblySchema=z.object({id,name:text.max(160),parentId:id.optional(),partIds});
export const deviceRelationshipSchema=z.object({id,from:id,to:id,type:z.enum(['mechanical','electrical','data','contains']),description:text.max(2000)});
export const deviceMechanismSchema=z.object({
  verification:motionContractSchema.optional(),
  id,name:text.max(160),description:text.max(4000),duration:number.min(.2).max(60),motion:z.enum(['press-release','linear']).optional(),
  tracks:z.array(z.object({partId:id,translation:vec.optional(),rotation:vec.optional(),scale:scale.optional()}).strict().refine(track=>
    track.translation?.some(value=>value!==0)||track.rotation?.some(value=>value!==0)||track.scale?.some(value=>value!==1),
    'Each mechanism track needs a nonzero translation/rotation or a non-identity scale',
  )).min(1).max(2000),
  stages:z.array(z.object({at:number.min(0).max(1),title:text.max(200),description:text.max(2400),partIds})).min(1).max(40),
});
export const deviceCapabilitiesSchema=z.array(text.max(100)).max(100).refine(values=>new Set(values).size===values.length,'Capabilities must not repeat');
const documentShape=z.object({
  version:z.literal(1),id,name:text.max(200),description:text.max(8000),provenance:text.max(4000),parts:z.array(devicePartSchema).min(1).max(2000),steps:z.array(deviceStepSchema).max(60),source:z.enum(['curated','gemini','import']),model:text.max(150).optional(),
  assemblies:z.array(deviceAssemblySchema).max(200).optional(),relationships:z.array(deviceRelationshipSchema).max(4000).optional(),mechanisms:z.array(deviceMechanismSchema).max(40).optional(),capabilities:deviceCapabilitiesSchema.optional(),
  designBrief:text.max(4000).optional(),review:qualityReportSchema.optional(),
  /** Circuits tab edits (wires, added wiring parts, firmware) saved on the shared object. */
  circuit:z.object({version:z.literal(1),connections:z.array(z.any()).max(180).optional(),addedParts:z.array(z.any()).max(60).optional(),code:z.object({filename:text.max(120),source:z.string().max(120000),libraries:z.array(text.max(200)).max(30)}).optional()}).passthrough().optional(),
});
function directedCycle(edges:Map<string,string[]>):boolean {
  const state=new Map<string,number>();
  const visit=(node:string):boolean=>{
    if(state.get(node)===1)return true;if(state.get(node)===2)return false;
    state.set(node,1);for(const next of edges.get(node)??[])if(visit(next))return true;state.set(node,2);return false;
  };
  return [...edges.keys()].some(visit);
}
function referenceChecks(document:z.infer<typeof documentShape>,context:z.RefinementCtx) {
  const ids=new Set(document.parts.map(part=>part.id));
  const issue=(message:string,path:(string|number)[])=>context.addIssue({code:'custom',message,path});
  for(const message of attachmentIssues(document))issue(message,['parts']);
  const checkParts=(values:string[],path:(string|number)[])=>{for(const value of values)if(!ids.has(value))issue(`Unknown component reference: ${value}`,path);};
  if(ids.size!==document.parts.length)issue('Component IDs must be unique',['parts']);
  if(document.parts.reduce((total,part)=>total+part.solids.length,0)>2000)issue('Use at most 2000 procedural solids per document',['parts']);
  if(document.parts.reduce((total,part)=>total+(part.mesh?.positions.length||0),0)>450000)issue('Source mesh budget exceeds 150000 vertices',['parts']);
  document.parts.forEach((part,index)=>{
    if(part.catalogRef&&!canonicalCatalogGeometry(part))issue('Catalog geometry or dimensions do not match the cited source',['parts',index,'catalogRef']);
    if(!part.assetNode&&!part.mesh&&!part.solids.length)issue('Each component needs procedural solids or a source mesh',['parts',index,'solids']);
    for(const connection of part.connections)if(!ids.has(connection.partId)||connection.partId===part.id)issue('Connections must reference another existing component',['parts',index,'connections']);
  });
  document.steps.forEach((step,index)=>checkParts(step.partIds,['steps',index,'partIds']));
  const assemblies=document.assemblies??[],assemblyIds=new Set(assemblies.map(item=>item.id)),ownership=new Map<string,string>(),assemblyEdges=new Map<string,string[]>();
  if(assemblyIds.size!==assemblies.length)issue('Assembly IDs must be unique',['assemblies']);
  assemblies.forEach((assembly,index)=>{
    checkParts(assembly.partIds,['assemblies',index,'partIds']);
    if(assembly.parentId){if(!assemblyIds.has(assembly.parentId)||assembly.parentId===assembly.id)issue('Assembly parents must reference another existing assembly',['assemblies',index,'parentId']);assemblyEdges.set(assembly.id,[assembly.parentId]);}
    for(const partId of assembly.partIds){if(ownership.has(partId))issue('Each component may belong directly to only one assembly',['assemblies',index,'partIds']);ownership.set(partId,assembly.id);}
  });
  if(directedCycle(assemblyEdges))issue('Assembly parent hierarchy must not contain cycles',['assemblies']);
  document.parts.forEach((part,index)=>{if(part.assemblyId&&(!assemblyIds.has(part.assemblyId)||ownership.get(part.id)!==part.assemblyId))issue('Component assemblyId must identify the assembly listing this component',['parts',index,'assemblyId']);});
  const relationships=document.relationships??[],relationshipIds=new Set(relationships.map(item=>item.id)),containsEdges=new Map<string,string[]>();
  if(relationshipIds.size!==relationships.length)issue('Relationship IDs must be unique',['relationships']);
  relationships.forEach((relationship,index)=>{
    if(!ids.has(relationship.from)||!ids.has(relationship.to)||relationship.from===relationship.to)issue('Relationships must reference two distinct existing components',['relationships',index]);
    if(relationship.type==='contains')containsEdges.set(relationship.from,[...(containsEdges.get(relationship.from)??[]),relationship.to]);
  });
  if(directedCycle(containsEdges))issue('Containment relationships must not contain cycles',['relationships']);
  const mechanisms=document.mechanisms??[],mechanismIds=new Set(mechanisms.map(item=>item.id));
  if(mechanismIds.size!==mechanisms.length)issue('Mechanism IDs must be unique',['mechanisms']);
  if(mechanisms.reduce((total,item)=>total+item.tracks.length,0)>4000)issue('Use at most 4000 mechanism tracks per document',['mechanisms']);
  mechanisms.forEach((mechanism,index)=>{
    if(mechanism.verification){const c=mechanism.verification;for(const ref of [c.movingRootId,c.pivotPartId,...c.allowedEdits.map(e=>e.partId),...c.contacts.flatMap(e=>e.partIds)])if(!ids.has(ref))issue('Motion contract references a missing component',['mechanisms',index,'verification']);if(c.movingRootId===c.pivotPartId)issue('A moving joint root needs a distinct fixed pivot',['mechanisms',index,'verification']);}
    const tracked=mechanism.tracks.map(track=>track.partId);checkParts(tracked,['mechanisms',index,'tracks']);
    if(new Set(tracked).size!==tracked.length)issue('A mechanism may track each component only once',['mechanisms',index,'tracks']);
    for(const track of mechanism.tracks){const part=document.parts.find(item=>item.id===track.partId);if(part&&track.translation?.some((delta,axis)=>Math.abs(part.position[axis]+delta)>5000))issue('Mechanism motion exceeds the supported coordinate bounds',['mechanisms',index,'tracks']);}
    mechanism.stages.forEach((stage,stageIndex)=>{checkParts(stage.partIds,['mechanisms',index,'stages',stageIndex,'partIds']);if(stageIndex>0&&stage.at<=mechanism.stages[stageIndex-1].at)issue('Mechanism stages must be in strictly ascending progress order',['mechanisms',index,'stages',stageIndex,'at']);});
  });
}
export const deviceDocumentSchema=documentShape.superRefine(referenceChecks);
export const deviceDocumentInputSchema=z.preprocess((value,ctx)=>{try{return inflateCatalogDocument(value);}catch(error){ctx.addIssue({code:'custom',message:error instanceof Error?error.message:'Invalid catalog reference'});return z.NEVER;}},deviceDocumentSchema);
export const generatedDeviceSchema=documentShape.extend({parts:z.array(devicePartSchema).min(2).max(60),source:z.literal('gemini')}).superRefine((document,context)=>{
  referenceChecks(document,context);
  document.parts.forEach((part,index)=>{if(part.assetNode||part.mesh&&!canonicalCatalogGeometry(part))context.addIssue({code:'custom',message:'Generated concepts must use real procedural solids or canonical catalog geometry, not invented source meshes',path:['parts',index,'assetNode']});});
});
export function validateDeviceDocument(input:unknown):DeviceDocument {
  const result=deviceDocumentInputSchema.safeParse(input);
  if(!result.success)throw new Error(result.error.issues.slice(0,4).map(issue=>`${issue.path.join('.')}: ${issue.message}`).join('; '));
  return result.data;
}
