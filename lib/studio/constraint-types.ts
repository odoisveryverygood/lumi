import {z} from 'zod';
const id=z.string().min(1).max(100).regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/);
const ids=z.array(id).min(1).max(100).refine(a=>new Set(a).size===a.length,'Repeated part reference');
const common={evidence:z.string().trim().min(3).max(600)};
const gap=z.number().finite().min(0).max(100);
export const designGoalSchema=z.discriminatedUnion('kind',[
 z.object({...common,kind:z.literal('preserve'),partIds:ids,scope:z.enum(['shape','shape-and-placement']).default('shape-and-placement')}).strict(),
 z.object({...common,kind:z.literal('inside'),partId:id,containerId:id,clearanceMm:gap.default(0)}).strict(),
 z.object({...common,kind:z.literal('separate'),partId:id,otherId:id,clearanceMm:gap.default(0)}).strict(),
 z.object({...common,kind:z.literal('dimension'),partId:id,axis:z.enum(['x','y','z']),maximumMm:z.number().finite().positive().max(5000)}).strict(),
 z.object({...common,kind:z.literal('access'),partId:id,axis:z.enum(['x','y','z']),direction:z.union([z.literal(-1),z.literal(1)]),distanceMm:gap.optional()}).strict(),
]);
const placement=z.object({partId:id,containerId:id}).strict();
export const designGoalPlanSchema=z.object({goals:z.array(designGoalSchema).max(12),unverified:z.array(z.object({evidence:z.string().trim().min(3).max(600),reason:z.string().trim().min(5).max(600)}).strict()).max(12),releaseContainment:z.array(placement.extend({evidence:z.string().trim().min(3).max(600)}).strict()).max(2000).optional()}).strict();
export const designContractSchema=designGoalPlanSchema.extend({version:z.literal(1),request:z.string().min(3).max(4000),baselineHash:z.string().regex(/^[a-f0-9]{64}$/),hash:z.string().regex(/^[a-f0-9]{64}$/),model:z.string().min(1).max(150),retainedPlacements:z.array(placement).max(2000).optional()}).strict();
export type DesignGoal=z.infer<typeof designGoalSchema>;
export type DesignGoalPlan=z.infer<typeof designGoalPlanSchema>;
export type DesignContract=z.infer<typeof designContractSchema>;
export const constraintFailure=(check:{status:string;required?:boolean})=>check.status==='fail'||check.required===true&&check.status==='info';
