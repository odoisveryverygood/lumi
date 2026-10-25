import { z } from 'zod';
import { askProject, checkOrigin, readJsonBody, RequestError, requestErrorResponse } from '@/lib/ai';
import { projectSchema, validateProject } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 120;

const inputSchema = z.object({ project: projectSchema, question: z.string().trim().min(2).max(2500), partId: z.string().max(100).optional(), stepIndex: z.number().int().min(1).max(100).optional() });

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const parsed = inputSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) throw new RequestError(400, parsed.error.issues[0]?.message || 'Provide a valid project and question.');
    if (!validateProject(parsed.data.project).valid) throw new RequestError(400, 'This project contains inconsistent wiring or build steps. Open a valid project before asking about it.');
    if (parsed.data.partId && !parsed.data.project.parts.some(part => part.id === parsed.data.partId)) throw new RequestError(400, 'That component is not part of this project.');
    if (parsed.data.stepIndex !== undefined && !parsed.data.project.buildSteps.some(step => step.index === parsed.data.stepIndex)) throw new RequestError(400, 'That build step is not part of this project.');
    return Response.json(await askProject(parsed.data, request.signal), { headers: { 'cache-control': 'no-store' } });
  } catch (error) { return requestErrorResponse(error); }
}
