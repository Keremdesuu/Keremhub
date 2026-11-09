import assert from 'node:assert/strict';
import {createVideoGestures as flix} from '../src/components/useVideoGestures';
import {createVideoGestures as archive} from '../../xxxkerem/components/useVideoGestures';
for(const [name,create] of [['flix',flix],['archive',archive]] as const){
 let now=0,id=0,visible=true,taps=0,seeks=0;const jobs=new Map<number,{at:number,fn:()=>void}>();
 const clock={now:()=>now,later:(fn:()=>void,ms:number)=>{jobs.set(++id,{at:now+ms,fn});return id;},clear:(key:unknown)=>{jobs.delete(key as number);}};
 const advance=(ms:number)=>{now+=ms;for(const [key,j]of [...jobs])if(j.at<=now){jobs.delete(key);j.fn();}};
 const p={id:1,x:20,y:20,right:false};const video={paused:false,ended:false,playbackRate:1};
 const g=create({video:()=>video,wake:()=>{visible=true},visible:()=>visible,tap:shown=>{visible=!shown;taps++},seek:()=>{seeks++},hold:()=>{}},clock);
 const tap=()=>{g.down(p);advance(30);g.up(p);g.cancel();};
 tap();assert(visible);advance(320);assert(!visible);assert.equal(taps,1);
 tap();assert(visible);advance(320);assert(visible);assert.equal(taps,2);
 tap();advance(100);tap();advance(400);assert(visible);assert.equal(seeks,1);assert.equal(taps,2);
 g.down(p);advance(500);g.up(p);advance(400);assert(visible);assert.equal(taps,2);
 tap();g.reset();advance(400);assert(visible);assert.equal(taps,2);
 video.paused=true;tap();advance(320);assert(!visible);assert(video.paused);
 console.log(name,'CONTROL_TAPS_OK: hide, reveal, double tap, hold, control priority, paused video');
}
