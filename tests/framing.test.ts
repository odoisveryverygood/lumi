import { describe, expect, it } from 'vitest';
import { sceneFrame } from '@/lib/studio/framing';

describe('object framing around contextual controls', () => {
  it('places a gallery object in the open space beside the introduction', () => {
    const frame = sceneFrame(1280, 652, { gallery: true });
    expect(frame.left).toBeGreaterThan(500);
    expect(1280 - frame.left - frame.right).toBeGreaterThan(550);
    expect(frame.bottom).toBeGreaterThan(200);
  });
  it('reserves space for either a component card or a detailed inspector', () => {
    const card = sceneFrame(1280, 652, { contextPanel: 'part' });
    const inspector = sceneFrame(1280, 652, { contextPanel: 'inspector' });
    expect(card.right).toBeGreaterThanOrEqual(320);
    expect(inspector.right).toBeGreaterThan(card.right);
    expect(1280 - inspector.left - inspector.right).toBeGreaterThan(700);
  });
  it('keeps phone geometry above the component card and conversation dock', () => {
    const frame = sceneFrame(390, 786, { contextPanel: 'part' });
    expect(frame.bottom).toBeGreaterThanOrEqual(350);
    expect(786 - frame.top - frame.bottom).toBeGreaterThan(200);
    expect(390 - frame.left - frame.right).toBeGreaterThan(300);
  });
  it('leaves a usable object region on a short phone viewport', () => {
    const frame = sceneFrame(360, 510, { gallery: true });
    expect(510 - frame.top - frame.bottom).toBeGreaterThanOrEqual(100);
    expect(360 - frame.left - frame.right).toBeGreaterThan(250);
  });
});
