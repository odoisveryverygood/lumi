import type { DeviceConversationResponse } from './types';
import type { DesignAttempt, DesignConstraints } from './redesign';
import type { InferenceMetrics } from '../inference';
import {catalogJsonReviver} from './catalog';

export type DeviceProgress = { message: string; model?: string;attempt?:DesignAttempt;constraints?:DesignConstraints;partNames?:string[];newParts?:import('./types').DevicePart[];resetGeneration?:boolean;performance?:InferenceMetrics };
export type DeviceStreamEvent =
  | ({ type: 'progress' } & DeviceProgress)
  | { type: 'heartbeat' }
  | { type: 'complete'; result: DeviceConversationResponse }
  | { type: 'error'; error: string };

/** Only complete responses can be committed; validated part progress may feed a transient preview. */
export async function readDeviceResponse<T = DeviceConversationResponse>(response: Response, onProgress: (progress: DeviceProgress) => void): Promise<T> {
  if (!response.ok || !response.headers.get('content-type')?.includes('application/x-ndjson')) {
    let value;
    try { value = JSON.parse(await response.text(),catalogJsonReviver); }
    catch { throw new Error('The server could not finish this request. Please try again.'); }
    if (!response.ok) throw new Error(value.error || 'The request could not be completed.');
    return value;
  }
  if (!response.body) throw new Error('The server returned an empty response. Please try again.');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', received = 0, result: T | undefined;
  const consume = (line: string) => {
    if (!line.trim()) return;
    let event: DeviceStreamEvent;
    try { event = JSON.parse(line,catalogJsonReviver); }
    catch { throw new Error('The connection returned an incomplete response. Please try again.'); }
    if (event.type === 'error') throw new Error(event.error);
    if(event.type==='progress'){const {type:_,...progress}=event;onProgress(progress);}
    if (event.type === 'complete') result = event.result as T;
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > 4_000_000) throw new Error('The generated assembly exceeds the response limit. Try a smaller object.');
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        consume(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) consume(buffer);
    if (!result) throw new Error('The connection ended before the assembly was ready. Your current object is unchanged. Please try again.');
    return result;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
