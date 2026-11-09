import {beforeAll,afterAll,it,expect} from 'vitest';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {probeAudio,streamAudio} from './audio';
import {normalizeAudioLanguage,preferredAudioStream} from './audio-language';
let dir:string,file:string;
beforeAll(async()=>{dir=await mkdtemp(path.join(tmpdir(),'kf-audio-'));file=path.join(dir,'test.mka');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=2','-f','lavfi','-i','sine=frequency=880:duration=2','-map','0:a','-map','1:a','-c:a','aac','-metadata:s:a:0','language=eng','-metadata:s:a:1','language=tur','-disposition:a:0','default','-disposition:a:1','0',file]);});
afterAll(async()=>{await rm(dir,{recursive:true,force:true});});
it('matches stored ISO language variants without guessing unlabelled tracks',async()=>{
 const {streams}=await probeAudio(file);expect(streams.map(s=>s.label)).toEqual(['İngilizce','Türkçe']);expect(streams[0].isDefault).toBe(true);
 expect(preferredAudioStream(streams,'tr-TR')?.index).toBe(1);expect(preferredAudioStream(streams,'tur')?.index).toBe(1);expect(preferredAudioStream(streams,'de')).toBeNull();expect(preferredAudioStream(streams,'und')).toBeNull();expect(normalizeAudioLanguage('EN_us')).toBe('en');
});
it('streams only the requested audio from the selected time',async()=>{
 const body=await streamAudio(file,1,0.5,new AbortController().signal);const mp3=Buffer.from(await new Response(body).arrayBuffer());const output=path.join(dir,'out.mp3');await writeFile(output,mp3);
 const info=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-of','json',output]).toString());expect(info.streams).toHaveLength(1);expect(info.streams[0].codec_type).toBe('audio');expect(Number(info.streams[0].duration)).toBeGreaterThan(1.3);expect(Number(info.streams[0].duration)).toBeLessThan(1.8);
 const pcm=execFileSync('ffmpeg',['-v','error','-i',output,'-t','1','-ac','1','-ar','48000','-f','f32le','pipe:1']);
 const energy=(frequency:number)=>{let real=0,imag=0;for(let i=4800;i<Math.min(43200,pcm.length/4);i++){const sample=pcm.readFloatLE(i*4),phase=2*Math.PI*frequency*i/48000;real+=sample*Math.cos(phase);imag+=sample*Math.sin(phase);}return real*real+imag*imag;};
 expect(energy(880)).toBeGreaterThan(energy(440)*100);

},15000);
it('does not launch conversion for a cancelled request',async()=>{const ctl=new AbortController();ctl.abort();await expect(streamAudio(file,0,0,ctl.signal)).rejects.toThrow('Aborted');});
