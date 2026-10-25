import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateText } from '../lib/ai';

let keyIndex = 0;
beforeEach(() => {
  vi.stubEnv('GEMINI_TRANSPORT','generateContent');vi.stubEnv('GEMINI_SERVICE_TIER','standard');
  vi.stubEnv('GEMINI_API_KEY', `timeout-test-key-${++keyIndex}`);
  vi.stubEnv('GEMINI_MODEL', '');
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(Response.json({ models: [{ name: 'models/gemini-4-argon', supportedGenerationMethods: ['generateContent'] }] }))
    .mockResolvedValueOnce(Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'A bounded response.' }] } }] })));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('bounded Gemini generation timeout', () => {
  it('preserves the existing90second default', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    expect((await generateText('System', 'User')).text).toBe('A bounded response.');
    expect(timeout.mock.calls.map(call => call[0])).toEqual([15_000, 90_000]);
  });
  it.each([
    [240_000, 240_000], [500_000, 240_000], [1_000, 10_000], [-1, 10_000],
    [120_000.8, 120_000], [Number.NaN, 90_000], [Number.POSITIVE_INFINITY, 90_000],
  ])('bounds explicit timeout %s to %s milliseconds', async (override, expected) => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    await generateText('System', 'User', { timeoutMs: override });
    expect(timeout.mock.calls.map(call => call[0])).toEqual([15_000, expected]);
  });
  it('keeps the deadline on a stalled body after response headers and cancels the stream',async()=>{
    const deadline=new AbortController(),realTimeout=AbortSignal.timeout.bind(AbortSignal),cancel=vi.fn();
    vi.spyOn(AbortSignal,'timeout').mockImplementation(ms=>ms===10_000?deadline.signal:realTimeout(ms));
    const fetcher=vi.fn().mockResolvedValueOnce(Response.json({models:[{name:'models/gemini-4-argon',supportedGenerationMethods:['generateContent']}]}))
      .mockResolvedValueOnce(new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('data: {"candidates":[{"content":{"parts":[{"text":"partial"}]}}]}\n\n'));},cancel})));
    vi.stubGlobal('fetch',fetcher);const partial=vi.fn();
    const pending=generateText('System','User',{timeoutMs:10000,onPartial:partial});
    await vi.waitFor(()=>expect(partial).toHaveBeenCalledWith('partial'));
    deadline.abort(new DOMException('Deadline','TimeoutError'));
    await expect(pending).rejects.toMatchObject({code:'timeout'});expect(cancel).toHaveBeenCalledTimes(1);
  });
});
