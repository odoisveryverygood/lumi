/** Public, sanitized measurements. Never put prompts, headers or credentials here. */
export type InferenceTier = 'standard' | 'priority';
export type InferenceMetrics = {
  transport: 'generateContent' | 'interactions';
  requestedTier: InferenceTier;
  servedTier: InferenceTier | 'unknown';
  durationMs: number;
  firstTokenMs: number | null;
  inputTokens?: number;
  outputTokens?: number;
  thinkingTokens?: number;
  cachedTokens?: number;
  estimatedCostUsd?: number;
};

type Usage = Record<string, unknown>;
type Content = { type?: string; text?: string };
type Interaction = { status?: string; service_tier?: string; usage?: Usage; steps?: { type?: string; content?: Content[] }[] };
export class InteractionProtocolError extends Error {}

export function inferenceTier(value: unknown): InferenceTier | 'unknown' {
  return value === 'standard' || value === 'priority' ? value : 'unknown';
}

export function usageMetrics(usage: Usage | undefined, legacy = false): Partial<InferenceMetrics> {
  if (!usage) return {};
  const fields = legacy
    ? { inputTokens: 'promptTokenCount', outputTokens: 'candidatesTokenCount', thinkingTokens: 'thoughtsTokenCount', cachedTokens: 'cachedContentTokenCount' }
    : { inputTokens: 'total_input_tokens', outputTokens: 'total_output_tokens', thinkingTokens: 'total_thought_tokens', cachedTokens: 'total_cached_tokens' };
  const result: Partial<InferenceMetrics> = {};
  for (const [target, source] of Object.entries(fields)) {
    const value = usage[source];
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) result[target as keyof typeof fields] = value;
  }
  return result;
}

/** Published Argon token prices; estimate only, not the account balance or an invoice. */
export function estimateArgonCost(metrics: InferenceMetrics, model: string, now = new Date()): number | undefined {
  if (model !== 'gemini-4-argon' || metrics.inputTokens === undefined || metrics.outputTokens === undefined) return;
  const multiplier = metrics.servedTier === 'priority' || (metrics.servedTier === 'unknown' && metrics.requestedTier === 'priority') ? 1.8 : 1;
  const priceChange = now >= new Date('2026-12-01T00:00:00Z') ? 2 : 1;
  const cached = Math.min(metrics.inputTokens, metrics.cachedTokens || 0);
  return Math.round(((metrics.inputTokens - cached) * 2 + cached * .1 + (metrics.outputTokens + (metrics.thinkingTokens || 0)) * 10) * multiplier * priceChange) / 1_000_000;
}

function completedText(value: Interaction) {
  if (value.status !== 'completed') throw new InteractionProtocolError('Gemini did not finish the response. Your current object is unchanged.');
  return (value.steps || []).filter(step => step.type === 'model_output').flatMap(step => step.content || []).filter(item => item.type === 'text').map(item => item.text || '').join('');
}

/** Reads current Interactions SSE. Thoughts/tool arguments never become visible text. */
export async function readInteraction(response: Response, onPartial?: (text: string) => void, signal?: AbortSignal) {
  let tier = inferenceTier(response.headers.get('x-gemini-service-tier'));
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    const value = await response.json() as Interaction;
    return { text: completedText(value), usage: value.usage, tier: tier === 'unknown' ? inferenceTier(value.service_tier) : tier };
  }
  if (!response.body) throw new InteractionProtocolError('Gemini returned an empty stream.');
  const reader = response.body.getReader(), decoder = new TextDecoder(), steps = new Map<number, string>();
  let buffer = '', text = '', bytes = 0, complete = false, usage: Usage | undefined;
  const consume = (frame: string) => {
    const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n').trim();
    if (!data || data === '[DONE]') return;
    let event: { event_type?: string; index?: number; step?: {type?:string}; delta?: Content; interaction?: Interaction; metadata?: {total_usage?:Usage} };
    try { event = JSON.parse(data); } catch { throw new InteractionProtocolError('Gemini returned an unreadable stream.'); }
    if (event.event_type === 'error' || event.event_type === 'interaction.failed' || event.event_type === 'interaction.cancelled') throw new InteractionProtocolError('Gemini could not complete this response.');
    if (event.metadata?.total_usage) usage = event.metadata.total_usage;
    if (event.event_type === 'step.start' && typeof event.index === 'number') steps.set(event.index, event.step?.type || '');
    if (event.event_type === 'step.delta' && event.delta?.type === 'text' && typeof event.index === 'number' && steps.get(event.index) === 'model_output') {
      text += event.delta.text || '';
      if (text.length > 240_000) throw new InteractionProtocolError('The response exceeds the object size limit.');
      onPartial?.(text);
    }
    if (event.event_type === 'interaction.completed') {
      const value = event.interaction;
      if (!value || value.status !== 'completed') throw new InteractionProtocolError('Gemini did not finish the response. Your current object is unchanged.');
      if (!text && value.steps) { text = completedText(value); if (text) onPartial?.(text); }
      usage = value.usage || usage;
      if (tier === 'unknown') tier = inferenceTier(value.service_tier);
      complete = true;
    }
  };
  try {
    while (true) {
      signal?.throwIfAborted();
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 2_000_000) throw new InteractionProtocolError('The response exceeds the stream size limit.');
      buffer += decoder.decode(chunk.value, {stream:true});
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        consume(buffer.slice(0, boundary.index)); buffer = buffer.slice(boundary.index + boundary[0].length);
      }
      if (complete) break;
    }
    buffer += decoder.decode();
    if (buffer.trim()) consume(buffer);
    if (!complete) throw new InteractionProtocolError('The connection ended before Gemini completed the response.');
    return {text, usage, tier};
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
