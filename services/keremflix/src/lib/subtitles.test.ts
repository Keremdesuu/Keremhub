import {it,expect} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {subtitleStreams,extractSubtitle} from './subtitles';
import {needsMetadata} from './metadata-policy';
it('preserves a manual choice even with missing artwork on repair scans',()=>{
 expect(needsMetadata({metaStatus:'manual',posterUrl:null,backdropUrl:null,overview:null},true)).toBe(false);
});
it('discovers multiple embedded subtitles and extracts the selected stream',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'kf-subs-'));
 try{
 await writeFile(path.join(dir,'a.srt'),'1\n00:00:00,000 --> 00:00:01,000\nMerhaba\n');
 await writeFile(path.join(dir,'b.srt'),'1\n00:00:00,000 --> 00:00:01,000\nHello\n');
 const file=path.join(dir,'test.mkv');
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=size=16x16:duration=1','-i',path.join(dir,'a.srt'),'-i',path.join(dir,'b.srt'),'-map','0','-map','1','-map','2','-c:v','libx264','-c:s','srt','-metadata:s:s:0','language=tur','-metadata:s:s:1','language=eng',file]);
 const streams=await subtitleStreams(file);expect(streams).toHaveLength(2);expect(streams.map(s=>s.language)).toEqual(['tur','eng']);expect(streams.every(s=>s.supported)).toBe(true);
 const a=await extractSubtitle(file,streams[0].index);const b=await extractSubtitle(file,streams[1].index);
 expect(a).toContain('WEBVTT');expect(a).toContain('Merhaba');expect(a).not.toContain('Hello');expect(b).toContain('Hello');
 }finally{await rm(dir,{recursive:true,force:true});}
},20000);

it('reuses a persistent subtitle cache after module reload and invalidates changed media',async()=>{
 const {vi}=await import('vitest');const dir=await mkdtemp(path.join(tmpdir(),'kf-sub-cache-'));const old=process.env.SUBTITLE_CACHE_DIR;process.env.SUBTITLE_CACHE_DIR=path.join(dir,'cache');
 try{
  const srt=path.join(dir,'captions.srt');await writeFile(srt,'1\n00:00:00,000 --> 00:00:01,000\nFirst\n');
  const first=await extractSubtitle(srt,0);expect(first).toContain('First');
  vi.resetModules();
  const fresh=await import('./subtitles');const originalPath=process.env.PATH;process.env.PATH='/nonexistent-subtitle-test-bin';try{expect(await fresh.extractSubtitle(srt,0)).toBe(first);}finally{process.env.PATH=originalPath;}
  await writeFile(srt,'1\n00:00:00,000 --> 00:00:01,000\nChanged subtitle\n');
  expect(await fresh.extractSubtitle(srt,0)).toContain('Changed subtitle');
 }finally{if(old===undefined)delete process.env.SUBTITLE_CACHE_DIR;else process.env.SUBTITLE_CACHE_DIR=old;await rm(dir,{recursive:true,force:true});}
},20000);
