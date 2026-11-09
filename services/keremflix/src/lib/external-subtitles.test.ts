import {it,expect} from 'vitest';
import {mkdtemp,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {externalSubtitleMatch,externalSubtitles,readExternalSubtitle,subtitleTextToVtt} from './external-subtitles';
it('recognizes suffix languages, case variants and forced subtitles',()=>{
 expect(externalSubtitleMatch('The Odyssey.mp4','The Odyssey_TR.srt',false)).toEqual({language:'tr',forced:false});
 expect(externalSubtitleMatch('Film.MKV','FILM.EN.VTT',false)?.language).toBe('en');
 expect(externalSubtitleMatch('Film.mp4','Film_TR.forced.srt',false)).toEqual({language:'tr',forced:true});
 expect(externalSubtitleMatch('Release.1080p.mp4','Film_Türkçe.srt',true)?.language).toBe('tr');
 expect(externalSubtitleMatch('Episode01.mp4','Episode02_TR.srt',false)).toBeNull();
 expect(externalSubtitleMatch('Film.mp4','Film.srt',false)?.language).toBe('und');
});
it('discovers new sidecars without a library scan and ignores symlinks and other episodes',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'kf-ext-list-'));
 try{
 const video=path.join(dir,'Episode01.mp4');await writeFile(video,'');await writeFile(path.join(dir,'Episode02.mp4'),'');
 await writeFile(path.join(dir,'Episode01_TR.srt'),'1\n00:00:00,000 --> 00:00:01,000\nMerhaba\n');await writeFile(path.join(dir,'Episode02_TR.srt'),'other');
 let files=await externalSubtitles(video);expect(files).toHaveLength(1);expect(files[0].label).toBe('Türkçe');expect(files[0].filename).toBe('Episode01_TR.srt');
 await writeFile(path.join(dir,'Episode01_EN.VTT'),'WEBVTT\n');await symlink(path.join(dir,'Episode02_TR.srt'),path.join(dir,'Episode01_DE.srt'));
 files=await externalSubtitles(video);expect(files.map(s=>s.language)).toEqual(['tr','en']);
 expect(await readExternalSubtitle(video,files[0])).toContain('Merhaba');
 await rm(path.join(dir,'Episode01_EN.VTT'));expect(await externalSubtitles(video)).toHaveLength(1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
it('lists all subtitle files in a single-film folder and changes the revision after edits',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'kf-ext-movie-'));
 try{const video=path.join(dir,'Long.Release.Name.mp4');await writeFile(video,'');await writeFile(path.join(dir,'Film_TR.srt'),'first');await writeFile(path.join(dir,'Film_EN.srt'),'english');
 const before=await externalSubtitles(video);expect(before.map(s=>s.language)).toEqual(['tr','en']);expect(before[0].id).toMatch(/^[a-f0-9]{24}$/);
 await writeFile(path.join(dir,'Film_TR.srt'),'changed subtitle content');const after=await externalSubtitles(video);expect(after[0].id).toBe(before[0].id);expect(after[0].version).not.toBe(before[0].version);
 }finally{await rm(dir,{recursive:true,force:true});}
});
it('converts SRT timings and preserves Turkish UTF-8, UTF-16 and Windows-1254 text',()=>{
 const srt='\uFEFF1\r\n00:00:01,000 --> 00:00:02,500\r\n<i>Türkçe: ş ı İ</i>\r\n';
 const vtt=subtitleTextToVtt(Buffer.from(srt),'SRT');expect(vtt).toContain('WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.500');expect(vtt).toContain('<i>Türkçe: ş ı İ</i>');
 expect(subtitleTextToVtt(Buffer.from('\uFEFFTürkçe','utf16le'),'.srt')).toContain('Türkçe');
 expect(subtitleTextToVtt(Buffer.from([0xfe,0x20,0xfd,0x20,0xdd]),'.srt')).toContain('ş ı İ');
 expect(subtitleTextToVtt(Buffer.from('WEBVTT\n\n00:01.000 --> 00:02.000\nHello'),'.vtt')).not.toContain('WEBVTT\n\nWEBVTT');
});
