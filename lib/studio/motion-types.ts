import {z} from 'zod';

const id=z.string().min(1).max(100).regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/);
const coordinate=z.number().finite().min(-5000).max(5000);
const vector=z.tuple([coordinate,coordinate,coordinate]);
/** Additive, versioned contract. Playback tracks alone never establish a joint. */
export const motionContractSchema=z.object({
 version:z.literal(1),kind:z.literal('revolute'),movingRootId:id,pivotPartId:id,
 pivot:vector,axis:vector.refine(v=>Math.abs(Math.hypot(...v)-1)<1e-6,'Use a unit joint axis'),
 minDeg:z.number().min(-180).max(0),maxDeg:z.number().min(0).max(180),
 stepDeg:z.number().min(1).max(30),clearanceMm:z.number().min(0).max(10),
 allowedEdits:z.array(z.object({partId:id,minPosition:vector,maxPosition:vector}).strict()).max(8),
 contacts:z.array(z.object({partIds:z.tuple([id,id]),reason:z.string().min(1).max(300)}).strict()).max(100),
 provenance:z.string().min(1).max(1500),
}).strict().refine(c=>c.allowedEdits.every(e=>e.minPosition.every((v,i)=>v<=e.maxPosition[i]))&&new Set(c.allowedEdits.map(e=>e.partId)).size===c.allowedEdits.length&&c.minDeg<c.maxDeg&&Math.ceil((c.maxDeg-c.minDeg)/c.stepDeg)+2<=25,'Use a nonempty range with at most 25 sampled poses');
export type MotionContract=z.infer<typeof motionContractSchema>;
export const motionFindingSchema=z.object({
 mechanismId:id,angleDeg:z.number().finite(),phase:z.number().min(0).max(1),
 partIds:z.tuple([id,id]),status:z.enum(['pass','fail','unverified']),
 clearanceMm:z.number().finite().nonnegative().optional(),requiredMm:z.number().nonnegative(),
 measurement:z.enum(['triangle-distance','aabb-lower-bound','unknown']),
 detail:z.string().max(700),frameRefs:z.array(z.string().max(150)).max(3),
}).strict();
export const motionResultSchema=z.object({
 version:z.literal(1),mechanismId:id,status:z.enum(['pass','fail','unverified']),
 contract:motionContractSchema.optional(),checkedAngles:z.array(z.number().finite()).max(25),
 findings:z.array(motionFindingSchema).max(200),minimumClearanceMm:z.number().nonnegative().optional(),
 limitations:z.array(z.string().max(500)).max(8),comparisons:z.number().int().nonnegative(),
}).strict();
export type MotionFinding=z.infer<typeof motionFindingSchema>;
export type MotionResult=z.infer<typeof motionResultSchema>;
