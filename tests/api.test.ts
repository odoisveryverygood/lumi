import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIError, askProject, checkOrigin, createProject, getAIStatus, getModels, readJsonBody, RequestError, validateEditableProject } from '../lib/ai';
import { demoProjects } from '../lib/projects';
import { editableProjectSchema, projectSchema, validateProject } from '../lib/validation';
import type { Project } from '../lib/types';
import { POST as generateRoute } from '../app/api/project/route';
import { POST as askRoute } from '../app/api/ask/route';

let testKeyIndex = 0;
const modelList = (names = ['gemini-4-argon', 'gemini-3.1-pro-preview', 'gemini-2.5-flash']) => Response.json({ models: names.map(name => ({ name: `models/${name}`, supportedGenerationMethods: ['generateContent'] })) });
const answerPayload = (text: string) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] });
const answer = (text: string) => new Response(`data: ${JSON.stringify(answerPayload(text))}\n\n`, { headers: { 'content-type': 'text/event-stream' } });
const plainAnswer = (text: string) => Response.json(answerPayload(text));
const request = (path: string, body: unknown, extraHeaders: Record<string, string> = {}) => new Request(`http://localhost:3000${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', ...extraHeaders }, body: JSON.stringify(body) });

beforeEach(() => { vi.stubEnv('GEMINI_API_KEY', `test-only-key-${++testKeyIndex}`); vi.stubEnv('GEMINI_MODEL', ''); vi.stubEnv('GEMINI_TRANSPORT','generateContent');vi.stubEnv('GEMINI_SERVICE_TIER','standard'); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Gemini model selection and data provenance', () => {
  it('discovers Gemini 4 first, without exposing the key in status', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(modelList()); vi.stubGlobal('fetch', fetcher);
    expect(await getAIStatus()).toEqual({ configured: true, available: true, provider: 'gemini', model: 'gemini-4-argon' });
    expect(JSON.stringify(await getAIStatus())).not.toContain('test-only-key');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not silently use a Flash model when Pro is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(modelList(['gemini-2.5-flash'])));
    await expect(getModels()).rejects.toMatchObject({ code: 'model_unavailable' });
  });
  it('honors an explicit strong model override', async () => {
    vi.stubEnv('GEMINI_MODEL', 'models/gemini-3.1-pro-preview');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(modelList()));
    expect(await getModels()).toEqual(['gemini-3.1-pro-preview']);
  });
  it('returns validated Gemini JSON, with actual model provenance', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(modelList()).mockResolvedValueOnce(answer(JSON.stringify(demoProjects[0])));
    vi.stubGlobal('fetch', fetcher);
    const stages: number[] = [];
    const result = await createProject({ prompt: 'Build a heart rate tracker', skillLevel: 'beginner', action: 'generate' }, event => stages.push(event.stage));
    expect(result.source).toBe('gemini'); expect(result.model).toBe('gemini-4-argon');
    expect(result.project.parts.length).toBeGreaterThan(2); expect(stages[0]).toBe(0); expect(stages.at(-1)).toBe(4); expect(stages).toContain(3);
    const generationUrl = fetcher.mock.calls[1][0] as string;
    expect(generationUrl).toContain('gemini-4-argon:streamGenerateContent?alt=sse'); expect(generationUrl).not.toContain('key=');
  });
  it('repairs nonexistent pin references before delivering a project', async () => {
    const invalid = structuredClone(demoProjects[0]); invalid.connections[0].from.pin = 'INVENTED_PIN';
    const fetcher = vi.fn().mockResolvedValueOnce(modelList()).mockResolvedValueOnce(answer(JSON.stringify(invalid))).mockResolvedValueOnce(answer(JSON.stringify(demoProjects[0])));
    vi.stubGlobal('fetch', fetcher);
    const events: string[] = [];
    const result = await createProject({ prompt: 'Build a heart rate tracker', skillLevel: 'beginner', action: 'generate' }, event => events.push(event.message));
    expect(result.source).toBe('gemini'); expect(fetcher).toHaveBeenCalledTimes(3);
    expect(events.some(event => event.includes('repairing'))).toBe(true);
    const repairBody = JSON.parse(fetcher.mock.calls[2][1].body);
    expect(repairBody.contents[0].parts[0].text).toContain('INVENTED_PIN');
  });
  it('does not silently downgrade an unavailable Argon model', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(modelList()).mockResolvedValueOnce(new Response('', { status: 404 })).mockResolvedValueOnce(answer(JSON.stringify(demoProjects[0])));
    vi.stubGlobal('fetch', fetcher);
    const result = await createProject({ prompt: 'Build a heart rate tracker', skillLevel: 'beginner', action: 'generate' }, () => {});
    expect(result.model).toBeUndefined();expect(result.source).toBe('demo');expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('labels an offline example explicitly and does not imply live generation', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const result = await createProject({ prompt: 'a weather station', skillLevel: 'beginner', action: 'generate' }, () => {});
    expect(result.source).toBe('demo'); expect(result.model).toBeUndefined(); expect(result.message).toContain('built-in'); expect(result.message).toContain('not an AI-generated');
  });
  it('never substitutes an unrelated demo when an edit fails', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    await expect(createProject({ prompt: 'a heart rate tracker', skillLevel: 'beginner', project: demoProjects[0], request: 'Change controller to ESP32', action: 'edit' }, () => {})).rejects.toBeInstanceOf(AIError);
  });
  it('bounds repair attempts and clearly labels the final fallback', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(modelList()).mockImplementation(() => Promise.resolve(answer('{"id":"incomplete"}'))); vi.stubGlobal('fetch', fetcher);
    const result = await createProject({ prompt: 'a weather station', skillLevel: 'beginner', action: 'generate' }, () => {});
    expect(fetcher).toHaveBeenCalledTimes(4); expect(result.source).toBe('demo'); expect(result.message).toContain('two repair attempts');
  });
  it('keeps raw provider error bodies and possible secrets out of responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('secret=DO-NOT-LEAK', { status: 500 })));
    const status = await getAIStatus(); expect(status.available).toBe(false); expect(JSON.stringify(status)).not.toContain('DO-NOT-LEAK');
  });
});

describe('project Q&A', () => {
  it('answers with Gemini using project and selected part context', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(modelList()).mockResolvedValueOnce(plainAnswer('Use the GND pin shown in the wiring list.')); vi.stubGlobal('fetch', fetcher);
    const result = await askProject({ project: demoProjects[0], question: 'Where does ground connect?', partId: demoProjects[0].parts[0].id });
    expect(result.source).toBe('gemini'); expect(result.model).toBe('gemini-4-argon');
    expect(JSON.parse(fetcher.mock.calls[1][1].body).contents[0].parts[0].text).toContain(demoProjects[0].parts[0].id);
  });
  it('labels offline factual project-data answers', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const result = await askProject({ project: demoProjects[0], question: 'What is this part?', partId: demoProjects[0].parts[0].id });
    expect(result.source).toBe('project-data'); expect(result.answer).toContain(demoProjects[0].parts[0].label); expect(result.model).toBeUndefined();
  });
  it('reports a saved step instead of fabricating a live answer offline', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const step = demoProjects[0].buildSteps[0];
    const result = await askProject({ project: demoProjects[0], question: 'Help with this step', stepIndex: step.index });
    expect(result.source).toBe('project-data'); expect(result.answer).toContain(step.instructions);
  });
});

describe('real provider streaming', () => {
  it('decodes split CRLF SSE frames and publishes library IDs while they arrive', async () => {
    const projectText = JSON.stringify(demoProjects[0]);
    const chunks = [projectText.slice(0, projectText.indexOf('connections')), projectText.slice(projectText.indexOf('connections'))];
    const sse = chunks.map(text => `data: ${JSON.stringify(answerPayload(text))}\r\n\r\n`).join('') + 'data: [DONE]\r\n\r\n';
    const encoded = new TextEncoder().encode(sse);
    const stream = new ReadableStream({ start(controller) { for (let offset = 0; offset < encoded.length; offset += 37) controller.enqueue(encoded.slice(offset, offset + 37)); controller.close(); } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(modelList()).mockResolvedValueOnce(new Response(stream, { headers: { 'content-type': 'text/event-stream' } })));
    const events: { stage: number; parts?: string[] }[] = [];
    const result = await createProject({ prompt: 'Build a heart rate tracker', skillLevel: 'beginner', action: 'generate' }, event => events.push(event));
    expect(result.source).toBe('gemini');
    expect(events.some(event => event.stage === 1 && event.parts?.includes(demoProjects[0].parts[0].libraryId))).toBe(true);
    expect(events.flatMap(event => event.parts || []).every(id => demoProjects[0].parts.some(part => part.libraryId === id))).toBe(true);
  });
  it('rejects oversized streamed output with a clear limit message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(modelList()).mockResolvedValueOnce(answer('x'.repeat(240_001))));
    const result = await createProject({ prompt: 'Build a weather station', skillLevel: 'beginner', action: 'generate' }, () => {});
    expect(result.source).toBe('demo'); expect(result.message).toContain('output limit');
  });
  it('rejects malformed provider SSE instead of labeling it as generated', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(modelList()).mockResolvedValueOnce(new Response('data: {bad-json}\n\n')));
    const result = await createProject({ prompt: 'Build a weather station', skillLevel: 'beginner', action: 'generate' }, () => {});
    expect(result.source).toBe('demo'); expect(result.message).toContain('malformed response stream');
  });
  it('handles provider error frames without exposing their raw body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(modelList()).mockResolvedValueOnce(new Response('data: {"error":{"code":500,"message":"secret=NEVER-RETURN"}}\n\n')));
    const result = await createProject({ prompt: 'Build a weather station', skillLevel: 'beginner', action: 'generate' }, () => {});
    expect(result.source).toBe('demo'); expect(result.message).toContain('could not complete'); expect(result.message).not.toContain('NEVER-RETURN');
  });
  it('cancels an in-progress stream without substituting an example', async () => {
    const abort = new AbortController();
    const cancel = vi.fn();
    const prefix = `data: ${JSON.stringify(answerPayload('{"parts":[{"libraryId":"esp32-devkit"}'))}\n\n`;
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(prefix)); }, cancel });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(modelList()).mockResolvedValueOnce(new Response(stream)));
    await expect(createProject({ prompt: 'Build a weather station', skillLevel: 'beginner', action: 'generate' }, event => { if (event.parts?.length) abort.abort(); }, abort.signal)).rejects.toMatchObject({ code: 'aborted' });
    expect(cancel).toHaveBeenCalled();
  });
});

describe('HTTP request boundaries', () => {
  it('rejects cross-origin requests and malformed origins', () => {
    expect(() => checkOrigin(request('/api/project', {}, { origin: 'https://evil.test' }))).toThrow(RequestError);
    expect(() => checkOrigin(request('/api/project', {}, { origin: 'null' }))).toThrow(RequestError);
    expect(() => checkOrigin(request('/api/project', {}))).not.toThrow();
  });
  it('accepts the actual browser Host when Next canonicalizes the request URL', () => {
    expect(() => checkOrigin(request('/api/project', {}, { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000', 'sec-fetch-site': 'same-origin' }))).not.toThrow();
    expect(() => checkOrigin(request('/api/ask', {}, { host: '127.0.0.1:3000', origin: 'http://localhost:3000' }))).not.toThrow();
  });
  it('retains the browser-facing port and protocol boundary', () => {
    expect(() => checkOrigin(request('/api/project', {}, { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3001' }))).toThrow(RequestError);
    expect(() => checkOrigin(request('/api/project', {}, { host: '127.0.0.1:3000', origin: 'https://127.0.0.1:3000' }))).toThrow(RequestError);
    expect(() => checkOrigin(request('/api/project', {}, { host: '127.0.0.1:3000', origin: 'http://evil.test:3000' }))).toThrow(RequestError);
  });
  it('rejects cross-site fetches even with spoofed matching Host and Origin headers', () => {
    expect(() => checkOrigin(request('/api/project', {}, { host: 'evil.test:3000', origin: 'http://evil.test:3000', 'sec-fetch-site': 'cross-site' }))).toThrow(RequestError);
    expect(() => checkOrigin(new Request('http://localhost:3000/api/project', { headers: { 'sec-fetch-site': 'cross-site' } }))).toThrow(RequestError);
    expect(() => checkOrigin(request('/api/project', {}, { host: '127.0.0.1:3000/evil', origin: 'http://127.0.0.1:3000' }))).toThrow(RequestError);
  });
  it('serves actual-host project generation through the route with mocked Gemini', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(modelList()).mockResolvedValueOnce(answer(JSON.stringify(demoProjects[0]))));
    const response = await generateRoute(request('/api/project', { prompt: 'Build a heart rate tracker' }, { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000', 'sec-fetch-site': 'same-origin' }));
    expect(response.status).toBe(200);
    const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
    expect(events.at(-1).source).toBe('gemini');
  });
  it('serves actual-host project Q&A through the route with mocked Gemini', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(modelList()).mockResolvedValueOnce(plainAnswer('Connect the display to GPIO21 and GPIO22 at3.3V.')));
    const response = await askRoute(request('/api/ask', { project: demoProjects[0], question: 'Which display pins?' }, { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000', 'sec-fetch-site': 'same-origin' }));
    expect(response.status).toBe(200); expect((await response.json()).source).toBe('gemini');
  });
  it('rejects declared oversized JSON bodies before reading', async () => {
    await expect(readJsonBody(request('/api/project', {}, { 'content-length': '9000000' }))).rejects.toMatchObject({ status: 413 });
  });
  it('rejects streamed oversized bodies even without content-length', async () => {
    await expect(readJsonBody(request('/api/project', { text: 'x'.repeat(100) }), 20)).rejects.toMatchObject({ status: 413 });
  });
  it('returns a 400 before streaming for incomplete edit requests', async () => {
    const response = await generateRoute(request('/api/project', { prompt: 'Build a tracker', action: 'edit' }));
    expect(response.status).toBe(400);
  });
  it('streams a final explicitly labeled example when the server has no key', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const response = await generateRoute(request('/api/project', { prompt: 'Build a weather station' }));
    expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
    expect(events[0].type).toBe('stage'); expect(events.at(-1).type).toBe('complete'); expect(events.at(-1).source).toBe('demo');
  });
  it('rejects questions targeting nonexistent parts', async () => {
    const response = await askRoute(request('/api/ask', { project: demoProjects[0], question: 'What is this?', partId: 'does-not-exist' }));
    expect(response.status).toBe(400);
  });
  it('rejects invalid pin maps before sending project questions to the model', async () => {
    const invalid = structuredClone(demoProjects[0]); invalid.connections[0].from.pin = 'NONEXISTENT_PIN';
    const response = await askRoute(request('/api/ask', { project: invalid, question: 'Is this wired correctly?' }));
    expect(response.status).toBe(400);
  });
  it('rejects inconsistent current projects before attempting an edit', async () => {
    const invalid = structuredClone(demoProjects[0]); invalid.connections[0].from.pin = 'NONEXISTENT_PIN';
    const response = await generateRoute(request('/api/project', { project: invalid, prompt: 'Build a tracker', action: 'edit', request: 'Add an alarm buzzer' }));
    expect(response.status).toBe(400);
  });
});


describe('repairing manual project drafts', () => {
  const brokenGroundDraft = () => {
    const project = structuredClone(demoProjects[0]);
    project.connections = project.connections.filter(connection => connection.id !== 'sensor-gnd');
    project.buildSteps.forEach(step => { step.connectionIds = step.connectionIds.filter(id => id !== 'sensor-gnd'); });
    return project;
  };
  it('lets a structurally valid missing-ground draft reach Gemini through the HTTP route', async () => {
    const project = brokenGroundDraft();
    expect(projectSchema.safeParse(project).success).toBe(true);
    expect(validateProject(project).valid).toBe(false);
    const fetcher = vi.fn().mockResolvedValueOnce(modelList()).mockResolvedValueOnce(answer(JSON.stringify(demoProjects[0])));
    vi.stubGlobal('fetch', fetcher);
    const response = await generateRoute(request('/api/project', { prompt: project.prompt, skillLevel: project.skillLevel, action: 'edit', request: 'Repair all wiring and build steps', project }));
    expect(response.status).toBe(200);
    const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
    const result = events.at(-1);
    expect(result.type).toBe('complete'); expect(result.source).toBe('gemini'); expect(validateProject(result.project).valid).toBe(true);
    expect(result.project.connections.some((connection: { id: string }) => connection.id === 'sensor-gnd')).toBe(true);
    const sent = JSON.parse(fetcher.mock.calls[1][1].body).contents[0].parts[0].text;
    expect(sent).toContain('editable project draft'); expect(sent).toContain('needs a ground connection');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('accepts a known one-component zero-wire draft for repair without weakening final validation', async () => {
    const project = structuredClone(demoProjects[0]);
    project.parts = [project.parts.find(part => part.id === 'mcu')!];
    project.connections = [];
    project.buildSteps.forEach(step => { step.partIds = step.partIds.filter(id => id === 'mcu'); step.connectionIds = []; });
    expect(projectSchema.safeParse(project).success).toBe(false);
    expect(editableProjectSchema.safeParse(project).success).toBe(true);
    expect(() => validateEditableProject(project)).not.toThrow();
    const fetcher = vi.fn().mockResolvedValueOnce(modelList()).mockResolvedValueOnce(answer(JSON.stringify(demoProjects[0])));
    vi.stubGlobal('fetch', fetcher);
    const response = await generateRoute(request('/api/project', { prompt: project.prompt, skillLevel: project.skillLevel, action: 'edit', request: 'Restore this tracker with the necessary sensor and wiring', project }));
    expect(response.status).toBe(200);
    const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
    expect(events.at(-1).source).toBe('gemini'); expect(validateProject(events.at(-1).project).valid).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('allows draft voltage and build-coverage defects without silently accepting them as final output', async () => {
    const project = structuredClone(demoProjects[0]);
    project.connections.find(connection => connection.id === 'sensor-power')!.from.pin = '5V';
    project.buildSteps[0].partIds = [];
    expect(() => validateEditableProject(project)).not.toThrow();
    expect(validateProject(project).valid).toBe(false);
    const fetcher = vi.fn().mockResolvedValueOnce(modelList()).mockImplementation(() => Promise.resolve(answer(JSON.stringify(project))));
    vi.stubGlobal('fetch', fetcher);
    await expect(createProject({ prompt: project.prompt, skillLevel: project.skillLevel, action: 'edit', request: 'Repair this draft', project }, () => {})).rejects.toMatchObject({ code: 'invalid_output' });
    expect(fetcher).toHaveBeenCalledTimes(4); // One model list and exactly three fully checked attempts.
  });
  it('rejects invented catalog entries, pins and references before any provider request', async () => {
    const mutations: ((project: Project) => void)[] = [
      project => { project.parts[0].libraryId = 'invented-controller'; },
      project => { project.parts[0].libraryId = 'constructor'; },
      project => { project.parts[0].libraryId = 'toString'; },
      project => { project.connections[0].from.pin = 'NONEXISTENT_PIN'; },
      project => { project.connections[0].to.partId = 'missing-part'; },
      project => { project.buildSteps[0].partIds.push('missing-part'); },
      project => { project.buildSteps[0].connectionIds.push('missing-wire'); },
      project => { project.parts[1].id = project.parts[0].id; },
      project => { project.connections[1].id = project.connections[0].id; },
    ];
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    for (const mutate of mutations) {
      const project = structuredClone(demoProjects[0]); mutate(project);
      const response = await generateRoute(request('/api/project', { prompt: project.prompt, skillLevel: project.skillLevel, action: 'edit', request: 'Repair this project', project }));
      expect(response.status).toBe(400);
      await expect(createProject({ prompt: project.prompt, skillLevel: project.skillLevel, action: 'edit', request: 'Repair this project', project }, () => {})).rejects.toMatchObject({ status: 400 });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects malformed draft shapes and non-finite positions before any provider request', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const malformed = structuredClone(demoProjects[0]); malformed.parts[0].assembledPosition = [0, NaN, 0];
    for (const project of [{}, malformed]) {
      const response = await generateRoute(request('/api/project', { prompt: 'Repair my tracker', skillLevel: 'beginner', action: 'edit', request: 'Repair this project', project }));
      expect(response.status).toBe(400);
      expect(() => validateEditableProject(project)).toThrow(RequestError);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('bounds direct edit requests and requires an actual draft', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    for (const edit of [
      { request: 'x'.repeat(2501), project: demoProjects[0] },
      { request: '  ', project: demoProjects[0] },
      { request: 'Repair the wiring', project: undefined },
    ]) await expect(createProject({ prompt: 'Repair my tracker', skillLevel: 'beginner', action: 'edit', ...edit }, () => {})).rejects.toMatchObject({ status: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('returns independent parsed data while retaining exact source bytes', () => {
    const project = brokenGroundDraft(), before = structuredClone(project);
    const parsed = validateEditableProject(project);
    expect(parsed).not.toBe(project); expect(parsed.code.source).toBe(project.code.source);
    parsed.parts[0].label = 'Changed'; expect(project).toEqual(before);
  });
});
