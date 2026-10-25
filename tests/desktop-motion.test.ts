import { describe, expect, it } from 'vitest';
import { desktopComputer } from '../lib/studio/desktop';
import { deviceDocumentSchema } from '../lib/studio/validation';

describe('desktop cooling anatomy', () => {
  it('keeps fan frames stationary while moving their separate blades and hubs', () => {
    const device = deviceDocumentSchema.parse(desktopComputer), motion = device.mechanisms!.find(m => m.id === 'pc-cooling-fans')!;
    expect(motion.motion).toBe('linear');
    expect(motion.tracks).toHaveLength(3);
    expect(device.parts.reduce((n, p) => n + p.solids.length, 0)).toBe(1224);
    for (const track of motion.tracks) {
      const rotor = device.parts.find(p => p.id === track.partId)!, frame = device.parts.find(p => p.id === track.partId.replace(/-rotor$/, ''))!;
      expect(rotor.solids).toHaveLength(30);
      expect(rotor.solids.filter(s => s.kind === 'box')).toHaveLength(27);
      expect(frame.solids.some(s => s.kind === 'torus')).toBe(true);
      expect(motion.tracks.some(t => t.partId === frame.id)).toBe(false);
      expect(frame.connections.some(c => c.partId === rotor.id)).toBe(true);
      expect(rotor.position).toEqual(frame.position);
    }
  });
});
