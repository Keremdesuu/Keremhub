'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const APP = path.resolve(__dirname, '../app');
const UPSTREAM = new URL(process.env.KEREMFLIX_UPSTREAM || 'http://127.0.0.1:3200/keremflix/');
const PORT = Number(process.env.PORT || 3210);
const HOST = process.env.HOST || '0.0.0.0';
const DB = process.env.KEREMFLIX_DB || '/home/kerempi/keremflix/data/keremflix.db';
const PREVIEW = process.env.KEREMFLIX_PREVIEW_BACKEND;
const {createSubtitleService}=require('./subtitles.cjs');
const subtitles=createSubtitleService(UPSTREAM);
const ROUTES = /^\/api\/(?:mobile\/(?:home|search|title\/[1-9]\d*)|(?:stream|subtitle)\/[1-9]\d*|artwork\/[1-9]\d*\/(?:card|poster|hero)|progress|list)$/;
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
function catalog(callback) {
  execFile(process.env.PYTHON || 'python3', [path.join(__dirname, 'catalog.py'), DB], { timeout: 15000, maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => {
    if (error) return callback(error);
    try { callback(null, JSON.parse(stdout)); } catch (error) { callback(error); }
  });
}
function createServer() {
  return http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const url = new URL(req.url, 'http://localhost');
    if (PREVIEW && (ROUTES.test(url.pathname) || /^\/api\/tv\/(catalog|list|subtitles\/[1-9]\d*(?:\/\d+)?)$/.test(url.pathname) || url.pathname === '/health')) {
      const headers = {};
      for (const name of ['content-type', 'content-length', 'range']) if (req.headers[name]) headers[name] = req.headers[name];
      const upstream = http.request(new URL(url.pathname + url.search, PREVIEW), {method:req.method,headers,timeout:60000}, incoming => {
        const outgoing = {};
        for (const name of ['content-type','content-length','content-range','accept-ranges','cache-control']) if(incoming.headers[name]) outgoing[name]=incoming.headers[name];
        res.writeHead(incoming.statusCode,outgoing);incoming.pipe(res);incoming.on('error',()=>res.destroy());
      });
      upstream.on('timeout',()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)json(res,502,{error:'Önizleme sunucusuna ulaşılamadı'});else res.destroy();});
      res.on('close',()=>upstream.destroy());req.pipe(upstream);return;
    }
    if (url.pathname === '/health' && req.method === 'GET') {
      const check = http.get(new URL('api/mobile/home', UPSTREAM), { timeout: 12000 }, upstream => {
        upstream.resume(); json(res, upstream.statusCode === 200 ? 200 : 502, { service: 'keremflix-tv', version: 1, upstream: upstream.statusCode === 200 });
      });
      check.on('timeout', () => check.destroy(new Error('timeout')));
      check.on('error', () => { if (!res.headersSent) json(res, 502, { service: 'keremflix-tv', upstream: false }); }); return;
    }
    const embedded = url.pathname.match(/^\/api\/tv\/subtitles\/([1-9]\d*)(?:\/(\d+))?$/);
    if (embedded) {
      if(req.method!=='GET'){json(res,405,{error:'Yöntem desteklenmiyor'});return;}
      const task=embedded[2]===undefined?subtitles.tracks(embedded[1]):subtitles.text(embedded[1],embedded[2]);
      task.then(data=>{
        if(res.destroyed)return;
        if(typeof data!=='string'){json(res,200,{tracks:data});return;}
        res.writeHead(200,{'Content-Type':'text/vtt; charset=utf-8','Cache-Control':'private, max-age=600'});res.end(data);
      }).catch(error=>{if(!res.destroyed)json(res,503,{error:'Gömülü altyazı hazırlanamadı. '+error.message});});return;
    }
    if (/^\/api\/tv\/(catalog|list)$/.test(url.pathname) && req.method === 'GET') {
      catalog((error, data) => {
        if (error) { console.error('Catalog read failed:', error.message); json(res, 503, { error: 'Kitaplık okunamadı' }); return; }
        const kind = url.searchParams.get('kind');
        if (kind && !['MOVIE', 'SERIES', 'ANIME'].includes(kind)) { json(res, 400, { error: 'Geçersiz tür' }); return; }
        data.items = data.items.filter(item => (!kind || item.kind === kind) && (url.pathname !== '/api/tv/list' || item.inList)); json(res, 200, data);
      }); return;
    }
    if (ROUTES.test(url.pathname)) {
      const write = url.pathname === '/api/progress' || url.pathname === '/api/list';
      if (req.method !== (write ? 'POST' : 'GET') && !(req.method === 'HEAD' && !write)) { json(res, 405, { error: 'Yöntem desteklenmiyor' }); return; }
      const headers = {};
      for (const name of ['content-type', 'content-length', 'range', 'if-range']) if (req.headers[name]) headers[name] = req.headers[name];
      const target = new URL(url.pathname.slice(1) + url.search, UPSTREAM);
      const upstream = http.request(target, { method: req.method, headers, timeout: 60000 }, incoming => {
        const outgoing = {};
        // Keep canonical media header spelling: the target's AVPlay freezes on seek
        // with the lower-case headers returned by the upstream Node response.
        const canonical = {'content-type':'Content-Type','content-length':'Content-Length','content-range':'Content-Range','accept-ranges':'Accept-Ranges','cache-control':'Cache-Control'};
        for (const name of Object.keys(canonical)) if (incoming.headers[name]) outgoing[canonical[name]] = incoming.headers[name];
        res.writeHead(incoming.statusCode, outgoing); incoming.pipe(res);
        incoming.on('error', () => res.destroy());
      });
      upstream.on('timeout', () => upstream.destroy(new Error('timeout')));
      upstream.on('error', () => { if (!res.headersSent) json(res, 502, { error: 'Keremflix sunucusuna ulaşılamadı' }); else res.destroy(); });
      res.on('close', () => upstream.destroy());
      req.on('aborted', () => upstream.destroy());
      if (write) {
        let bytes = 0;
        req.on('data', chunk => { bytes += chunk.length; if (bytes > 8192) { upstream.destroy(); req.destroy(); } });
      }
      req.pipe(upstream); return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { json(res, 405, { error: 'Yöntem desteklenmiyor' }); return; }
    const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!['index.html', 'style.css', 'boot.js', 'app.js', 'core.js', 'icon.png','keremflix-icon.png'].includes(relative) && !/^fonts\/((?:bebas-neue-latin(?:-ext)?-400|inter-latin(?:-ext)?-(?:400|500|700))-normal\.woff2?|OFL\.txt|Inter-OFL\.txt)$/.test(relative)) { json(res, 404, { error: 'Bulunamadı' }); return; }
    const file = path.join(APP, relative);
    fs.stat(file, (error, stat) => {
      if (error) { json(res, 404, { error: 'Bulunamadı' }); return; }
      const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.png': 'image/png', '.woff2':'font/woff2', '.woff':'font/woff', '.txt':'text/plain; charset=utf-8' };
      res.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Content-Length': stat.size, 'Cache-Control': 'no-cache' });
      if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
    });
  });
}
if (require.main === module) createServer().listen(PORT, HOST, () => console.log('Keremflix TV: http://' + HOST + ':' + PORT));
module.exports = { createServer };
