import assert from 'node:assert/strict';
import {createVideoGestures as flix} from '../src/components/useVideoGestures';
import {createVideoGestures as archive} from '../../xxxkerem/components/useVideoGestures';
for (const [name,create] of [['keremflix',flix],['xxxkerem',archive]] as const) {
 let now=0, next=0;const timers=new Map<number,{at:number,fn:()=>void}>();
 const clock={now:()=>now,later:(fn:()=>void,ms:number)=>{const id=++next;timers.set(id,{at:now+ms,fn});return id;},clear:(id:unknown)=>{timers.delete(id as number);}};
 const advance=(ms:number)=>{now+=ms;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn();}};
 const video={paused:false,ended:false,playbackRate:1.5};const seeks:number[]=[];let wakes=0,holding=false;
 const g=create({video:()=>video,wake:()=>wakes++,seek:n=>seeks.push(n),hold:on=>holding=on},clock);
 const p=(right=false,x=right?250:50)=>({id:1,x,y:50,right});
 const tap=(right=false)=>{g.down(p(right));advance(40);g.up(p(right));g.cancel();};
 tap();assert.equal(wakes,2);assert.deepEqual(seeks,[]);assert.equal(video.paused,false);
 advance(100);tap();assert.deepEqual(seeks,[-10]);assert.equal(video.playbackRate,1.5);
 g.reset();tap(true);advance(100);tap(true);assert.deepEqual(seeks,[-10,10]);
 g.reset();tap();advance(100);tap(true);assert.equal(seeks.length,2);
 g.reset();g.down(p());advance(450);assert.equal(video.playbackRate,2);assert(holding);g.up(p());assert.equal(video.playbackRate,1.5);assert(!holding);assert.equal(seeks.length,2);
 g.down(p());advance(450);g.cancel();assert.equal(video.playbackRate,1.5);
 g.down(p());advance(200);g.move(p(false,100));advance(300);g.up(p(false,100));assert.equal(video.playbackRate,1.5);assert.equal(seeks.length,2);
 video.paused=true;g.down(p());advance(600);g.up(p());assert.equal(video.playbackRate,1.5);assert(video.paused);
 video.paused=false;g.down(p());advance(450);g.reset();assert.equal(video.playbackRate,1.5);assert(!holding);
 console.log(name,'GESTURES_OK: reveal only, double tap directions, hold, restore, cancel, movement, paused, cleanup');
}
