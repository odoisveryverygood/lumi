import {describe,expect,it} from 'vitest';
import {clampPet,isPetDrag,readPetMemory,rememberPet,restorePet} from '../lib/studio/lumi-pet';

describe('movable Lumi pet',()=>{
  it('keeps the pet reachable at each edge of a phone and a desktop',()=>{
    for(const [width,height] of [[390,844],[1440,900]]){
      const a=clampPet({x:-900,y:-900},width,height),b=clampPet({x:9000,y:9000},width,height);
      expect(a.x).toBe(55);expect(a.y).toBe(112);
      expect(b.x+55).toBeLessThanOrEqual(width);expect(b.y+85).toBeLessThanOrEqual(height);
    }
  });
  it('round trips a saved spot and adapts it to a different screen',()=>{
    const saved=rememberPet({x:900,y:450},1200,900);
    expect(restorePet(saved,1200,900)).toEqual({x:900,y:450});
    expect(restorePet(saved,390,844)).toEqual({x:292.5,y:422});
    expect(restorePet({x:1,y:0},390,844)).toEqual({x:335,y:112});
  });
  it('distinguishes a click from dragging with mouse or touch jitter',()=>{
    expect(isPetDrag({x:100,y:100},{x:103,y:104})).toBe(false);
    expect(isPetDrag({x:100,y:100},{x:106,y:100})).toBe(true);
    expect(isPetDrag({x:100,y:100},{x:94,y:95})).toBe(true);
  });
  it('rejects corrupt, future, and invalid persisted coordinates and settings',()=>{
    for(const raw of [null,'oops','{}','null',JSON.stringify({version:2,home:null,mode:'guide',motion:null}),JSON.stringify({version:1,home:{x:5,y:.5},mode:'stay',motion:true}),JSON.stringify({version:1,mode:'stay',motion:true}),JSON.stringify({version:1,home:null,mode:'teleport',motion:true}),JSON.stringify({version:1,home:null,mode:'guide',motion:'yes'})])expect(readPetMemory(raw)).toBeNull();
    const p={version:1,home:{x:.7,y:.4},mode:'stay',motion:false};
    expect(readPetMemory(JSON.stringify(p))).toEqual(p);
    expect(readPetMemory('{"version":1,"home":null,"mode":"guide","motion":null}')).toEqual({version:1,home:null,mode:'guide',motion:null});
  });
});
