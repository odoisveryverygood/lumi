import {z} from 'zod';
import {motionResultSchema} from './motion-types';
import {designContractSchema} from './constraint-types';
const id=z.string().min(1).max(100).regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/),hash=z.string().regex(/^[a-f0-9]{64}$/);
export const requirementSchema=z.object({id,text:z.string().trim().min(1).max(4000)}).strict();
export const requirementsSchema=z.array(requirementSchema).min(1).max(8);
export const reviewViewSchema=z.enum(['assembled','top','exploded']);
export const reviewFrameSchema=z.object({view:reviewViewSchema,renderer:z.enum(['webgl','software']),mimeType:z.literal('image/jpeg'),data:z.string().min(8).max(600000).regex(/^[A-Za-z0-9+/]+={0,2}$/),documentHash:hash,visiblePartIds:z.array(id).max(2000),width:z.number().int().min(100).max(1600),height:z.number().int().min(100).max(1200),framing:z.object({center:z.tuple([z.number().finite().min(-10000).max(10000),z.number().finite().min(-10000).max(10000),z.number().finite().min(-10000).max(10000)]),radius:z.number().finite().min(1).max(20000)}).strict().optional()}).strict();
export const motionFrameSchema=reviewFrameSchema.extend({mechanismId:id,angleDeg:z.number().finite(),frameId:z.string().min(1).max(150),candidateHash:hash}).strict();
export type MotionFrame=z.infer<typeof motionFrameSchema>;
export const motionEvidenceSchema=z.object({result:motionResultSchema,frames:z.array(motionFrameSchema.extend({imageHash:hash})).max(3)}).strict();
export const qualityObservationSchema=z.object({requirementId:id,status:z.enum(['met','issue','unverifiable']),partIds:z.array(id).max(30),view:reviewViewSchema,detail:z.string().trim().min(1).max(800)}).strict();
export const measuredCheckSchema=z.object({id,status:z.enum(['pass','fail','info']),detail:z.string().max(1200),partIds:z.array(id).max(2000),category:z.literal('design').optional(),required:z.boolean().optional(),title:z.string().max(250).optional(),evidence:z.string().max(600).optional(),value:z.number().finite().optional(),unit:z.string().max(30).optional(),limit:z.number().finite().optional(),repairPartIds:z.array(id).max(2000).optional()}).strict();
export const qualityRoundSchema=z.object({number:z.number().int().min(0).max(2),documentHash:hash,model:z.string().min(1).max(150),summary:z.string().max(1600),observations:z.array(qualityObservationSchema).min(1).max(8),checks:z.array(measuredCheckSchema).max(70),frames:z.array(reviewFrameSchema.extend({imageHash:hash})).min(1).max(3),changedPartIds:z.array(id).max(60),repairNote:z.string().max(1600).optional(),rejected:z.boolean().optional(),contractHash:hash.optional(),motion:motionEvidenceSchema.optional(),motionProject:z.string().max(2500000).optional(),motionProvider:z.object({transport:z.string().max(30),thinkingLevel:z.string().max(20),serviceTier:z.string().max(30),requestTimeoutMs:z.number().int().positive(),durationMs:z.number().nonnegative()}).strict().optional()}).strict();
const currentQualityReportSchema=z.object({version:z.literal(1),request:z.string().trim().min(3).max(4000),requirements:requirementsSchema,status:z.enum(['reviewed','needs-attention','incomplete']),initialHash:hash,finalHash:hash,rounds:z.array(qualityRoundSchema).max(3),createdAt:z.string().max(50),limitations:z.array(z.string().max(500)).max(8),error:z.string().max(1600).optional(),contract:designContractSchema.optional(),baselineChecks:z.array(measuredCheckSchema).max(30).optional(),durationMs:z.number().finite().nonnegative().optional(),baselineProject:z.string().max(2500000).optional(),motionMechanismId:id.optional(),unverifiedMotion:motionResultSchema.optional()}).strict();
/** Retired comparison metadata must not prevent an existing project from reopening. */
export const qualityReportSchema=z.preprocess(value=>{
 if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.hasOwn(value,'selection')){
  const {selection:_retired,...report}=value as Record<string,unknown>;return report;
 }
 return value;
},currentQualityReportSchema);
export type QualityRequirement=z.infer<typeof requirementSchema>;
export type ReviewFrame=z.infer<typeof reviewFrameSchema>;
export type QualityObservation=z.infer<typeof qualityObservationSchema>;
export type MeasuredCheck=z.infer<typeof measuredCheckSchema>;
export type QualityRound=z.infer<typeof qualityRoundSchema>;
export type QualityReport=z.infer<typeof qualityReportSchema>;
/** Exact clauses, never model-rewritten goals. The entire original request also stays in every review. */
export function requirementsFromRequest(request:string):QualityRequirement[]{
 const clauses=request.trim().split(/(?:[;\n]+|\.(?:\s|$)|\b(?:and|with|plus)\b)/i).map(t=>t.trim()).filter(t=>t.length>=3);
 const kept=clauses.length?clauses:[request.trim()];if(kept.length>8)kept.splice(7,kept.length-7,kept.slice(7).join('; '));
 return kept.map((text,index)=>({id:`requirement-${index+1}`,text}));
}
