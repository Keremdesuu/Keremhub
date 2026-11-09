// Read-only proxy for UI tests. Every write is handled in memory, never forwarded.
import http from 'node:http';
import assert from 'node:assert/strict';
const base=process.env.KEREMHUB_URL||'http://192.168.1.240';
const catalogue=await (await fetch(base+'/keremflix/api/mobile/home?kind=MOVIE')).json();
const movie=catalogue.hero||catalogue.recent?.[0];
assert.ok(movie?.id,'No movie available for read-only playback test');
const detail=await (await fetch(base+'/keremflix/api/mobile/title/'+movie.id)).json();
assert.ok(detail.title && detail.episodes.length);
const realTitleId=detail.title.id,realEpisodeId=detail.episodes[0].id;
detail.title.id=98;detail.title.kind='MOVIE';detail.title.firstEpisodeId=10514;detail.episodes[0].id=10514;
let matched=false,reset=false;const writes=[];
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  try{
    if(url.pathname==='/test-state')return json({matched,reset,writes});
    if(url.pathname==='/test-reset'){matched=false;reset=false;writes.length=0;return json({ok:true});}
    if(req.method!=='GET'&&req.method!=='HEAD'){
      let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw||'{}');writes.push({method:req.method,path:url.pathname,body});
      if(url.pathname==='/keremflix/api/metadata/98'&&req.method==='POST'){assert.equal(body.tmdbId,12345);matched=true;return json({ok:true});}
      if(url.pathname==='/keremflix/api/progress'&&req.method==='DELETE'){assert.equal(body.titleId,98);reset=true;return json({ok:true});}
      return json({error:'Unexpected write blocked by test proxy'},400);
    }
    if(url.pathname==='/keremflix/api/metadata/98')return json({results:[{id:12345,title:'Doğru Film',originalTitle:'Correct Movie',year:2001,posterUrl:detail.title.posterUrl}]});
    if(url.pathname==='/keremflix/api/mobile/title/98'){
      const result=structuredClone(detail);result.title.resumeEpisodeId=10514;for(const ep of result.episodes){ep.seconds=120;ep.duration=600;}if(matched)result.title.title='Doğru Film';if(reset){result.title.resumeEpisodeId=null;for(const ep of result.episodes){ep.seconds=0;ep.duration=0;}}
      return json(result);
    }
    if(url.pathname.startsWith('/keremflix/api/subtitle/')){res.writeHead(404);return res.end();}
    if(url.pathname.startsWith('/keremflix/api/subtitles/')){
      if(url.searchParams.get('stream')==='3')return json({error:'Fixture subtitle conversion failed'},500);
      if(url.searchParams.has('stream')){res.writeHead(200,{'Content-Type':'text/vtt'});return res.end('WEBVTT\n\n00:00:00.000 --> 05:00:00.000\nBirinci satır\nİkinci satır\n\n');}
      return json({streams:[{index:2,label:'tur · #3',language:'tur',supported:true},{index:3,label:'eng · #4',language:'eng',supported:true},{index:4,label:'PGS',language:'und',supported:false}]});
    }
    const headers={};if(req.headers.range)headers.Range=req.headers.range;
    const path=req.url.replace('/api/stream/10514','/api/stream/'+realEpisodeId).replace('/api/artwork/98/','/api/artwork/'+realTitleId+'/');
    const upstream=await fetch(base+path,{method:req.method,headers,signal:AbortSignal.timeout(30000)});
    res.writeHead(upstream.status,Object.fromEntries([...upstream.headers].filter(([key])=>['content-type','content-range','accept-ranges'].includes(key))));
    if(upstream.body){for await(const chunk of upstream.body){if(res.destroyed)break;res.write(chunk);}}res.end();
  }catch(error){if(!res.headersSent)json({error:error.message},500);else res.destroy();}
});
server.listen(18765,'127.0.0.1',()=>console.log('Fixture ready on 18765; all upstream writes blocked'));
