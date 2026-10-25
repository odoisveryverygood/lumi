import {describe,expect,it} from 'vitest';
import {guidePosition,showcaseFrame} from '../lib/studio/morf-motion';
describe('Morf presentation motion',()=>{
  it('grows the object before separating it, then allows a slow orbit',()=>{
    expect(showcaseFrame(0,.6)).toMatchObject({scale:.12,explode:0,rotating:false});
    expect(showcaseFrame(750,.6).explode).toBe(0);
    expect(showcaseFrame(1600,.6).scale).toBe(1);
    expect(showcaseFrame(1600,.6).explode).toBeGreaterThan(0);
    expect(showcaseFrame(2800,.6)).toMatchObject({scale:1,explode:.6,rotating:false,complete:true});
    expect(showcaseFrame(3300,.6).rotating).toBe(true);
  });
  it('respects reduced motion immediately without an automatic orbit',()=>{
    expect(showcaseFrame(0,.45,true)).toEqual({scale:1,explode:.45,rotating:false,complete:true});
  });
  it('keeps the guide away from drawers, the screen edge and the composer',()=>{
    const near=guidePosition({x:1400,y:950,visible:true},1440,1000,330,290);
    expect(near.x).toBeLessThanOrEqual(1032);expect(near.x).toBeGreaterThanOrEqual(365);expect(near.y).toBeLessThanOrEqual(815);
    const phone=guidePosition({x:-500,y:-500,visible:true},390,844);expect(phone.x).toBe(48);expect(phone.y).toBeGreaterThanOrEqual(200);
  });
  it('docks when a part is hidden or outside the rendered view',()=>{
    expect(guidePosition({x:200,y:200,visible:false},1135,828)).toEqual(guidePosition(null,1135,828));
  });
});
