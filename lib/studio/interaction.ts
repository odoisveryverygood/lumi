import { z } from 'zod';
import type { ConversationCheck, DeviceConversationResponse, DeviceDocument, SceneAction } from './types';
import { deviceAssemblySchema, deviceCapabilitiesSchema, deviceDocumentSchema, deviceMechanismSchema, devicePartSchema, deviceRelationshipSchema, deviceStepSchema, validateDeviceDocument } from './validation';
import {canonicalCatalogGeometry,expandCatalogWire} from './catalog';
import {resolveAttachments} from './attachments';

const id=z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/);
const ids=z.array(id).min(1).max(2000).refine(values=>new Set(values).size===values.length,'Do not repeat component IDs');
export const sceneActionSchema=z.discriminatedUnion('type',[
  z.object({type:z.literal('focus'),partIds:ids}).strict(),
  z.object({type:z.literal('highlight'),partIds:ids}).strict(),
  z.object({type:z.literal('isolate'),partIds:ids}).strict(),
  z.object({type:z.literal('explode'),amount:z.number().finite().min(0).max(1)}).strict(),
  z.object({type:z.literal('view'),view:z.enum(['perspective','top','front'])}).strict(),
  z.object({type:z.literal('animate'),mechanismId:id}).strict(),
]);
export const conversationReplySchema=z.object({
  answer:z.string().trim().min(1).max(8000),actions:z.array(sceneActionSchema).max(12).default([]),
  suggestions:z.array(z.string().trim().min(1).max(240)).max(6).optional(),
});
const partPatchSchema=devicePartSchema.omit({id:true,assetNode:true,sourceUrl:true,mesh:true,catalogRef:true,attachment:true}).partial().strict().refine(patch=>Object.keys(patch).length>0,'Each update needs at least one changed property');
const additionSchema=z.preprocess((value,ctx)=>{try{if(value&&typeof value==='object'&&'mesh'in value&&'solids'in value&&'specs'in value&&'size'in value&&canonicalCatalogGeometry(value as DeviceDocument['parts'][number]))return value;return expandCatalogWire(value);}catch(error){ctx.addIssue({code:'custom',message:error instanceof Error?error.message:'Invalid catalog part'});return z.NEVER;}},devicePartSchema.strict()).refine(part=>!part.assetNode&&(part.catalogRef?canonicalCatalogGeometry(part):!part.mesh&&!part.sourceUrl),'New components need procedural solids or a canonical catalog reference');
export const deviceTransactionSchema=z.object({
  updates:z.array(z.object({partId:id,patch:partPatchSchema}).strict()).max(100).default([]),
  addParts:z.array(additionSchema).max(60).default([]),
  removePartIds:z.array(id).max(100).default([]),
  mounts:z.array(z.object({partId:id,parentId:id.nullable()}).strict()).max(60).default([]),
  name:z.string().trim().min(1).max(200).optional(),description:z.string().trim().min(1).max(8000).optional(),
  assemblies:z.array(deviceAssemblySchema).max(200).optional(),relationships:z.array(deviceRelationshipSchema).max(4000).optional(),mechanisms:z.array(deviceMechanismSchema).max(40).optional(),capabilities:deviceCapabilitiesSchema.optional(),steps:z.array(deviceStepSchema).max(60).optional(),
}).strict().refine(value=>value.updates.length+value.addParts.length+value.removePartIds.length+value.mounts.length>0||['name','description','assemblies','relationships','mechanisms','capabilities','steps'].some(key=>value[key as keyof typeof value]!==undefined),'Return at least one actual change');
export type DeviceEditTransaction=z.infer<typeof deviceTransactionSchema>;
export const conversationPlanSchema=conversationReplySchema.extend({
  intent:z.enum(['ask','edit']),operation:z.enum(['patch','keyboard-wireless']).optional(),transaction:deviceTransactionSchema.optional(),
}).strict().superRefine((plan,context)=>{
  if(plan.intent==='ask'&&(plan.operation!==undefined||plan.transaction!==undefined))context.addIssue({code:'custom',message:'Questions must not include edit operations'});
  if(plan.intent==='edit'&&(!plan.operation||plan.operation==='patch'&&!plan.transaction||plan.operation==='keyboard-wireless'&&plan.transaction))context.addIssue({code:'custom',message:'Edits require either a patch transaction or keyboard-wireless operation, not both'});
});

export function validateSceneActions(input:unknown,document:DeviceDocument):SceneAction[] {
  const actions=z.array(sceneActionSchema).max(12).parse(input);
  const partIds=new Set(document.parts.map(part=>part.id)),mechanismIds=new Set(document.mechanisms?.map(item=>item.id)??[]);
  for(const action of actions){
    if('partIds'in action)for(const partId of action.partIds)if(!partIds.has(partId))throw new Error(`Scene action references unknown component ${partId}`);
    if(action.type==='animate'&&!mechanismIds.has(action.mechanismId))throw new Error(`Scene action references unknown mechanism ${action.mechanismId}`);
  }
  return actions;
}
export function validateConversationResponse(input:unknown,document:DeviceDocument):DeviceConversationResponse {
  const reply=conversationReplySchema.parse(input);return {...reply,actions:validateSceneActions(reply.actions,document)};
}

/** Apply all edits to a clone, then validate the complete result before returning. */
export function applyDeviceTransaction(document:DeviceDocument,input:unknown,options:{selectedPartId?:string;restrictToSelected?:boolean}={}):DeviceDocument {
  const current=validateDeviceDocument(document),transaction=deviceTransactionSchema.parse(input);
  const known=new Set(current.parts.map(part=>part.id)),removed=new Set(transaction.removePartIds),updated=new Set<string>(),added=new Set<string>();
  if(removed.size!==transaction.removePartIds.length)throw new Error('A transaction cannot remove the same component twice');
  for(const partId of removed)if(!known.has(partId))throw new Error(`Cannot remove unknown component ${partId}`);
  for(const update of transaction.updates){if(!known.has(update.partId))throw new Error(`Cannot update unknown component ${update.partId}`);if(updated.has(update.partId)||removed.has(update.partId))throw new Error('A component cannot be updated twice or updated and removed in one transaction');updated.add(update.partId);}
  for(const part of transaction.addParts){if(known.has(part.id)||added.has(part.id))throw new Error(`New component ID already exists: ${part.id}`);added.add(part.id);}
  if(options.restrictToSelected&&(!options.selectedPartId||transaction.updates.some(u=>u.partId!==options.selectedPartId)||transaction.removePartIds.some(id=>id!==options.selectedPartId)||transaction.mounts.some(m=>m.partId!==options.selectedPartId&&!added.has(m.partId))))throw new Error('A selected-part edit cannot update, delete or remount unrelated components. Attached descendants follow their parent automatically.');
  const imported=current.source==='import'||current.parts.some(part=>part.assetNode);
  if(imported){
    const allowed=new Set(['name','description','role','position','rotation','explode','color','notes']);
    if(!options.selectedPartId)throw new Error('Select an imported component before editing its appearance or transforms');
    if(!transaction.updates.length||transaction.updates.some(update=>update.partId!==options.selectedPartId||Object.keys(update.patch).some(key=>!allowed.has(key)))||transaction.addParts.length||removed.size||transaction.mounts.length||['name','description','assemblies','relationships','mechanisms','capabilities','steps'].some(key=>transaction[key as keyof typeof transaction]!==undefined))throw new Error('Imported edits preserve original geometry, IDs and relationships and may only change the selected component’s appearance, transforms or description');
  }
  if(!imported)for(const update of transaction.updates){
    const previous=current.parts.find(part=>part.id===update.partId)!;
    if(previous.catalogRef&&(update.patch.solids||update.patch.size))throw new Error('Catalog parts preserve their source geometry and dimensions. Replace the part to use a custom design.');
    if(update.patch.size?.some((value,index)=>value!==previous.size[index])&&!update.patch.solids)throw new Error('A resize must update actual solids together with size; size alone is metadata and does not change rendered geometry');
  }
  const next=structuredClone(current);
  next.parts=next.parts.filter(part=>!removed.has(part.id));
  for(const update of transaction.updates){
    const target=next.parts.find(part=>part.id===update.partId)!,oldColor=target.color;
    Object.assign(target,update.patch);
    if(update.patch.color&&!update.patch.solids)target.solids=target.solids.map(solid=>solid.color?.toLowerCase()===oldColor.toLowerCase()?{...solid,color:update.patch.color}:solid);
  }
  next.parts.push(...structuredClone(transaction.addParts));
  if(removed.size){
    for(const part of next.parts)part.connections=part.connections.filter(connection=>!removed.has(connection.partId));
    next.steps=next.steps.map(step=>({...step,partIds:step.partIds.filter(id=>!removed.has(id))}));
    if(next.assemblies)next.assemblies=next.assemblies.map(assembly=>({...assembly,partIds:assembly.partIds.filter(id=>!removed.has(id))}));
    if(next.relationships)next.relationships=next.relationships.filter(relationship=>!removed.has(relationship.from)&&!removed.has(relationship.to));
    if(next.mechanisms)next.mechanisms=next.mechanisms.map(mechanism=>({...mechanism,tracks:mechanism.tracks.filter(track=>!removed.has(track.partId)),stages:mechanism.stages.map(stage=>({...stage,partIds:stage.partIds.filter(id=>!removed.has(id))}))})).filter(mechanism=>mechanism.tracks.length>0);
  }
  for(const key of ['name','description','assemblies','relationships','mechanisms','capabilities','steps'] as const)if(transaction[key]!==undefined)Object.assign(next,{[key]:structuredClone(transaction[key])});
  const transformed=transaction.updates.filter(u=>u.patch.position||u.patch.rotation).map(u=>u.partId);
  return validateDeviceDocument(resolveAttachments(current,next,transformed,transaction.mounts));
}

export function getConversationChecks(document:DeviceDocument,edited=false):ConversationCheck[] {
  const checks:ConversationCheck[]=[{level:'pass',message:'All component, assembly, relationship and mechanism references passed structural validation.'}];
  if(document.mechanisms?.length)checks.push({level:'info',message:'Motion is an educational illustration with bounded transforms; collisions, forces, tolerances and electrical behavior are not simulated.'});
  if(document.source==='import'||document.parts.some(part=>part.assetNode))checks.push({level:'info',message:'Original imported mesh geometry is preserved. Imported geometry does not establish electrical operation or manufacturing accuracy.'});
  else checks.push({level:'warning',message:'Geometry and specifications are illustrative. Mechanical fit, wiring and physical hardware operation have not been verified.'});
  if(document.capabilities?.includes('wireless-keyboard'))checks.push({level:'warning',message:'Wireless conversion is conceptual. Battery clearance, charging/protection, controller compatibility, firmware and RF behavior require engineering verification.'});
  if(edited)checks.push({level:'pass',message:'The edit was applied transactionally and the resulting document passed validation.'});
  return checks;
}

export function checkedInteraction(input:unknown,document:DeviceDocument,edited=false):DeviceConversationResponse {
  // Also validate the supplied document when helpers are used independently of an API route.
  const checked=deviceDocumentSchema.parse(document);
  return {...validateConversationResponse(input,checked),checks:getConversationChecks(checked,edited)};
}
