const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

test('bridge preserves ranges, isolates routes and forwards progress JSON', async t => {
  let received;
  const upstream = http.createServer((req, res) => {
    if (req.url === '/keremflix/api/stream/7') {
      assert.equal(req.headers.range, 'bytes=2-5');
      res.writeHead(206, { 'content-type':'video/mp4', 'Content-Range': 'bytes 2-5/10', 'Accept-Ranges': 'bytes', 'Content-Length': 4 }); res.end('2345');
    } else if (req.url === '/keremflix/api/progress') {
      let body = ''; req.on('data', chunk => { body += chunk; }); req.on('end', () => { received = JSON.parse(body); res.end('{"ok":true}'); });
    } else if (req.url === '/keremflix/api/mobile/home') res.end('{}');
    else { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  process.env.KEREMFLIX_UPSTREAM = 'http://127.0.0.1:' + upstream.address().port + '/keremflix/';
  const { createServer } = require('../server/bridge.cjs');
  const bridge = createServer(); await new Promise(resolve => bridge.listen(0, '127.0.0.1', resolve));
  t.after(() => { bridge.closeAllConnections(); bridge.close(); upstream.closeAllConnections(); upstream.close(); });
  const base = 'http://127.0.0.1:' + bridge.address().port;
  const stream = await fetch(base + '/api/stream/7', { headers: { Range: 'bytes=2-5' } });
  assert.equal(stream.status, 206); assert.equal(stream.headers.get('content-range'), 'bytes 2-5/10'); assert.equal(stream.headers.get('access-control-allow-origin'), '*'); assert.equal(await stream.text(), '2345');
  const rawHeaders = await new Promise((resolve,reject) => http.get(base + '/api/stream/7',{headers:{Range:'bytes=2-5'}},response=>{response.resume();resolve(response.rawHeaders);}).on('error',reject));
  assert.ok(rawHeaders.includes('Content-Length'), 'Samsung AVPlay requires canonical HTTP media header names for seeking');
  assert.ok(rawHeaders.includes('Content-Range'));
  assert.ok(rawHeaders.includes('Content-Type'));
  const body = { episodeId: 7, seconds: 42, duration: 100 };
  assert.equal((await fetch(base + '/api/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).status, 200);
  assert.deepEqual(received, body);
  assert.equal((await fetch(base + '/api/scan', { method: 'POST' })).status, 405);
  assert.equal((await fetch(base + '/api/progress')).status, 405);
  assert.equal((await fetch(base + '/api/mobile/home', { method: 'OPTIONS' })).status, 204);
  assert.equal((await fetch(base + '/server/bridge.cjs')).status, 404);
  assert.equal((await fetch(base + '/health')).status, 200);
  assert.match(await (await fetch(base)).text(), /<title>Keremflix<\/title>/);
});
