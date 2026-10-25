import { z } from 'zod';
import { checkOrigin, createProject, readJsonBody, RequestError, requestErrorResponse, safeError, validateEditableProject } from '@/lib/ai';
import { editableProjectSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 300;

const inputSchema = z.object({
  prompt: z.string().trim().min(3).max(3000),
  skillLevel: z.enum(['beginner', 'intermediate']).default('beginner'),
  action: z.enum(['generate', 'edit']).default('generate'),
  request: z.string().trim().min(3).max(2500).optional(),
  project: editableProjectSchema.optional(),
}).superRefine((input, context) => {
  if (input.action === 'edit' && (!input.project || !input.request)) context.addIssue({ code: 'custom', message: 'Editing requires the current project and a change request.' });
});

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const parsed = inputSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) throw new RequestError(400, parsed.error.issues[0]?.message || 'Provide a build prompt and valid project data.');
    if (parsed.data.action === 'edit') parsed.data.project = validateEditableProject(parsed.data.project);
    const encoder = new TextEncoder();
    const abortController = new AbortController();
    if (request.signal.aborted) abortController.abort();
    else request.signal.addEventListener('abort', () => abortController.abort(), { once: true });
    let open = true;
    const stream = new ReadableStream({
      start(controller) {
        const send = (event: object) => { if (open && !abortController.signal.aborted) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); };
        void createProject(parsed.data, send, abortController.signal)
          .then(result => send(result))
          .catch(error => send({ type: 'error', message: safeError(error) }))
          .finally(() => { if (open) { open = false; controller.close(); } });
      },
      cancel() { open = false; abortController.abort(); },
    });
    return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store, no-transform', 'x-accel-buffering': 'no', 'x-content-type-options': 'nosniff' } });
  } catch (error) { return requestErrorResponse(error); }
}
