import {it,expect} from 'vitest';
import {fitVideoFrame} from './useVideoLayout';
it('keeps intrinsic aspect ratio across fullscreen, portrait and ultrawide sizes',()=>{
 for(const [vw,vh] of [[1920,1080],[1440,1080],[2560,1080],[1080,1920]]){
  for(const [w,h] of [[1280,720],[1920,1080],[390,844],[844,390],[800,1000],[3440,1440]]){
   const r=fitVideoFrame(w,h,vw,vh)!;
   expect(r.width/r.height).toBeCloseTo(vw/vh,8);expect(r.width).toBeLessThanOrEqual(w+0.001);expect(r.height).toBeLessThanOrEqual(h+0.001);
   expect(r.left*2+r.width).toBeCloseTo(w);expect(r.top*2+r.height).toBeCloseTo(h);
  }
 }
});
it('ignores transient zero or invalid sizes during fullscreen transitions',()=>{
 for(const values of [[0,720,1920,1080],[1280,0,1920,1080],[1280,720,0,0],[NaN,720,1920,1080]])expect(fitVideoFrame(...values as [number,number,number,number])).toBeNull();
});
