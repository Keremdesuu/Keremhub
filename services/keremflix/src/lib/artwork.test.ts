import {it,expect,vi} from 'vitest';
import sharp from 'sharp';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
it('uses uncropped portrait artwork in wide slots and caches its source',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'keremflix-art-'));process.env.KEREMFLIX_ART_CACHE=temp;
 const portrait=await sharp({create:{width:200,height:300,channels:3,background:'#ef3020'}}).jpeg().toBuffer();
 const fetch=vi.fn(async()=>new Response(new Uint8Array(portrait),{headers:{'Content-Type':'image/jpeg'}}));vi.stubGlobal('fetch',fetch);
 try{
  const {renderArtwork}=await import('./artwork');
  const sources={posterUrl:'https://image.tmdb.org/test-portrait.jpg',backdropUrl:'https://image.tmdb.org/test-portrait.jpg'};
  for(const [role,width,height] of [['poster',400,600],['card',640,360],['hero',1600,900]] as const){
   const output=await renderArtwork(sources,role),m=await sharp(output).metadata();expect(m.width).toBe(width);expect(m.height).toBe(height);
   if(role==='card'){
    const raw=await sharp(output).raw().toBuffer();const centre=raw[(180*640+320)*3];const edge=raw[(180*640+10)*3];expect(centre).toBeGreaterThan(edge*1.8);
   }
  }
  expect(fetch).toHaveBeenCalledTimes(1);
 }finally{vi.unstubAllGlobals();delete process.env.KEREMFLIX_ART_CACHE;await rm(temp,{recursive:true,force:true});}
});

it('preserves both edges of ultrawide artwork in landscape cards',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'keremflix-wide-'));process.env.KEREMFLIX_ART_CACHE=temp;vi.resetModules();
 const wide=await sharp({create:{width:600,height:200,channels:3,background:'#888888'}}).composite([{input:await sharp({create:{width:50,height:200,channels:3,background:'#ff0000'}}).png().toBuffer(),left:0,top:0},{input:await sharp({create:{width:50,height:200,channels:3,background:'#0000ff'}}).png().toBuffer(),left:550,top:0}]).png().toBuffer();
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(new Uint8Array(wide),{headers:{'Content-Type':'image/png'}})));
 try{const {renderArtwork}=await import('./artwork');const result=await renderArtwork({posterUrl:null,backdropUrl:'https://image.tmdb.org/test-wide.png'},'card');const {data,info}=await sharp(result).raw().toBuffer({resolveWithObject:true});
 const pixel=(x:number,y:number)=>Array.from(data.subarray((y*info.width+x)*info.channels,(y*info.width+x)*info.channels+3));
 const left=pixel(10,180),right=pixel(630,180);expect(left[0]).toBeGreaterThan(200);expect(left[2]).toBeLessThan(40);expect(right[2]).toBeGreaterThan(200);expect(right[0]).toBeLessThan(40);
 }finally{vi.unstubAllGlobals();delete process.env.KEREMFLIX_ART_CACHE;await rm(temp,{recursive:true,force:true});}
});

it('fills anime banners instead of letterboxing while retaining the existing movie treatment',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'keremflix-anime-'));process.env.KEREMFLIX_ART_CACHE=temp;vi.resetModules();
 const banner=await sharp({create:{width:1200,height:200,channels:3,background:'#f02020'}}).png().toBuffer();vi.stubGlobal('fetch',vi.fn(async()=>new Response(new Uint8Array(banner),{headers:{'Content-Type':'image/png'}})));
 try{const {renderArtwork}=await import('./artwork');const sources={posterUrl:null,backdropUrl:'https://s4.anilist.co/test-banner.png'};
 const anime=await renderArtwork({...sources,kind:'ANIME'},'hero');const plain=await renderArtwork(sources,'hero');const movie=await renderArtwork({...sources,kind:'MOVIE'},'hero');expect(movie.equals(plain)).toBe(true);
 const a=await sharp(anime).raw().toBuffer(),p=await sharp(plain).raw().toBuffer();const offset=(20*1600+800)*3;expect(a[offset]).toBeGreaterThan(200);expect(p[offset]).toBeLessThan(160);
 }finally{vi.unstubAllGlobals();delete process.env.KEREMFLIX_ART_CACHE;await rm(temp,{recursive:true,force:true});}
});
