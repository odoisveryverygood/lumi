import { describe, expect, it } from 'vitest';
import { Box3, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { mechanicalKeyboard, convertKeyboardToWireless, KEYBOARD_KEY_IDS } from '../lib/studio/keyboard';
import { deviceDocumentSchema } from '../lib/studio/validation';
import { desktopComputer } from '../lib/studio/desktop';
import type { DeviceDocument, DevicePart } from '../lib/studio/types';

function checked(document: DeviceDocument) { const result = deviceDocumentSchema.safeParse(document); expect(result.success ? [] : result.error.issues).toEqual([]); }

describe('editable mechanical keyboard fixture', () => {
  it('has68 distinct named keycaps, consistent assembly membership and valid complete geometry', () => {
    checked(mechanicalKeyboard);
    expect(KEYBOARD_KEY_IDS).toHaveLength(68);
    expect(new Set(KEYBOARD_KEY_IDS).size).toBe(68);
    const caps=mechanicalKeyboard.parts.filter(part=>part.category==='Keycaps');
    expect(caps.map(part=>part.id)).toEqual(KEYBOARD_KEY_IDS);
    expect(caps.every(part=>Boolean(part.specs.Legend))).toBe(true);
    expect(mechanicalKeyboard.parts.length).toBeLessThan(130);
    expect(mechanicalKeyboard.parts.reduce((n,part)=>n+part.solids.length,0)).toBeLessThanOrEqual(2000);
    expect(mechanicalKeyboard.parts.every(part=>part.solids.length>0)).toBe(true);
  });
  it('returns the spring to the same lower seat during compression and moves the cap with its stem', () => {
    const mechanism=mechanicalKeyboard.mechanisms![0],spring=mechanicalKeyboard.parts.find(part=>part.id==='switch-spring')!;
    const track=mechanism.tracks.find(track=>track.partId===spring.id)!;
    const restBottom=spring.position[1]-spring.size[1]/2;
    const pressedBottom=spring.position[1]+track.translation![1]-spring.size[1]/2*track.scale![1];
    expect(pressedBottom).toBeCloseTo(restBottom,8);
    expect(mechanism.tracks.find(track=>track.partId==='key-esc')?.translation).toEqual([0,-4,0]);
    expect(mechanism.tracks.find(track=>track.partId==='switch-stem')?.translation).toEqual([0,-4,0]);
    expect(mechanism.stages.map(stage=>stage.at)).toEqual([...mechanism.stages.map(stage=>stage.at)].sort((a,b)=>a-b));
  });
  it('shows an open contact gap at rest and a closed mating face when pressed', () => {
    const fixed=mechanicalKeyboard.parts.find(part=>part.id==='switch-contact-fixed')!;
    const moving=mechanicalKeyboard.parts.find(part=>part.id==='switch-contact-moving')!;
    function contactBox(part:DevicePart,pressed:boolean) {
      const solid=part.solids[1],half=new Vector3(...solid.size).multiplyScalar(.5),box=new Box3(half.clone().negate(),half);
      const angle=pressed&&part.id===moving.id?-1.5*Math.PI/180:0;
      const transform=new Matrix4().compose(new Vector3(...part.position),new Quaternion().setFromEuler(new Euler(0,0,angle)),new Vector3(1,1,1));
      const local=new Matrix4().makeTranslation(...solid.position);
      return box.applyMatrix4(transform.multiply(local));
    }
    const fixedFace=contactBox(fixed,false),openFace=contactBox(moving,false),closedFace=contactBox(moving,true);
    expect(openFace.max.x).toBeLessThan(fixedFace.min.x);
    expect(closedFace.intersectsBox(fixedFace)).toBe(true);
  });
});

describe('wireless architecture conversion', () => {
  it('adds four distinct wireless parts and a coherent wireless assembly under the shared schema', () => {
    const converted=convertKeyboardToWireless(mechanicalKeyboard);checked(converted);
    expect(converted.capabilities).toContain('wireless-keyboard');expect(converted.capabilities).not.toContain('wired-keyboard');
    for(const id of ['wireless-battery','wireless-controller','wireless-power-board','wireless-harness'])expect(converted.parts.some(part=>part.id===id)).toBe(true);
    expect(converted.parts.length).toBe(mechanicalKeyboard.parts.length+4);
    expect(converted.steps).toHaveLength(8);
    expect(converted.assemblies?.find(assembly=>assembly.id==='assembly-wireless')?.partIds).toHaveLength(4);
  });
  it('preserves existing geometry, stable IDs and unrelated manual edits without mutating input', () => {
    const original=structuredClone(mechanicalKeyboard);
    const key=original.parts.find(part=>part.id==='key-a')!;key.name='My A key';key.color='#b38d58';key.position=[-90,44,3];
    const housing=original.parts.find(part=>part.id==='keyboard-case-base')!;housing.color='#998877';housing.notes='My custom finish';
    const controller=original.parts.find(part=>part.id==='keyboard-controller')!;controller.position=[100,15,-32];controller.color='#123456';
    const before=structuredClone(original),converted=convertKeyboardToWireless(original);
    expect(original).toEqual(before);
    for(const part of before.parts) {
      const next=converted.parts.find(next=>next.id===part.id)!;
      expect(next.solids).toEqual(part.solids);expect(next.position).toEqual(part.position);expect(next.rotation).toEqual(part.rotation);expect(next.color).toBe(part.color);
      if(!['keyboard-controller','keyboard-usb','keyboard-wired-cable'].includes(part.id))expect(next).toEqual(part);
    }
    expect(converted.mechanisms).toEqual(before.mechanisms);
  });
  it('is idempotent and redirects USB data to the radio while retaining USB charging', () => {
    const once=convertKeyboardToWireless(mechanicalKeyboard),twice=convertKeyboardToWireless(once);
    expect(twice).toEqual(once);
    expect(once.relationships?.some(r=>r.type==='data'&&(r.from==='keyboard-usb'||r.to==='keyboard-usb'))).toBe(false);
    expect(once.relationships?.some(r=>r.from==='keyboard-controller'&&r.to==='wireless-controller'&&r.type==='data')).toBe(true);
    expect(once.parts.find(part=>part.id==='keyboard-usb')?.role).toContain('charging');
    expect(once.parts.find(part=>part.id==='keyboard-wired-cable')?.name).toBe('USB charging cable');
    expect(new Set(once.parts.map(part=>part.id)).size).toBe(once.parts.length);
  });
  it('rejects unsupported devices and incomplete conversions with helpful errors', () => {
    expect(()=>convertKeyboardToWireless(desktopComputer)).toThrow(/mechanical keyboard reference/);
    const partial=structuredClone(mechanicalKeyboard);partial.parts.push({...partial.parts[0],id:'wireless-battery'});
    expect(()=>convertKeyboardToWireless(partial)).toThrow(/partial wireless conversion/);
  });
  it('keeps long valid description/provenance fields within bounds after conversion', () => {
    const edited=structuredClone(mechanicalKeyboard);edited.description='x'.repeat(8000);edited.provenance='y'.repeat(4000);
    const next=convertKeyboardToWireless(edited);checked(next);
    expect(next.description.length).toBeLessThanOrEqual(8000);expect(next.provenance.length).toBeLessThanOrEqual(4000);
  });
});
