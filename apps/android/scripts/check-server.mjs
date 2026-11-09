import assert from 'node:assert/strict';

const base = (process.env.KEREMHUB_URL || 'http://192.168.1.240').replace(/\/$/, '');
let passed = 0;
async function json(path, test = () => {}) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  const result = await response.json(); test(result); passed++;
  console.log(`PASS ${path}`); return result;
}
async function binary(path, range = false) {
  const response = await fetch(base + path, { headers: range ? { Range: 'bytes=0-1023' } : {}, signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, range ? 206 : 200, path);
  if (range) assert.match(response.headers.get('content-range') || '', /^bytes 0-1023\//);
  const data = await response.arrayBuffer(); assert.ok(data.byteLength > 0, path);
  if (range) assert.equal(data.byteLength, 1024);
  passed++; console.log(`PASS ${path}${range ? ' (Range)' : ''}`);
}
try {
  const sites = await json('/api/siteler', j => assert.ok(Array.isArray(j) && j.length >= 4));
  await json('/api/durum', j => sites.forEach(s => assert.equal(typeof j[s.id], 'boolean')));
  await json('/api/sistem', j => assert.ok(j.bellekToplam > 0 && Array.isArray(j.diskler)));
  const flix = await json('/keremflix/api/mobile/home', j => assert.ok(Array.isArray(j.recent)));
  await json('/keremflix/api/mobile/search?q=__keremhub_no_match__', j => assert.equal(j.items.length, 0));
  if (flix.hero) {
    const detail = await json(`/keremflix/api/mobile/title/${flix.hero.id}`, j => assert.ok(j.title.id && Array.isArray(j.episodes)));
    await binary(`/keremflix/api/artwork/${flix.hero.id}/hero`);
    if (detail.episodes.length) await binary(`/keremflix/api/stream/${detail.episodes[0].id}`, true);
  }
  const books = await json('/keremkitabevi/api/mobile/home', j => assert.ok(j.total >= 0 && Array.isArray(j.latest)));
  const library = await json('/keremkitabevi/api/mobile/library', j => assert.ok(Array.isArray(j.books) && j.pages >= 1));
  if (library.books.length) {
    const book = library.books[0];
    await json(`/keremkitabevi/api/mobile/books/${book.id}`, j => assert.equal(j.id, book.id));
    await json(`/keremkitabevi/api/mobile/manage?view=book&id=${book.id}`, j => assert.equal(j.book.id, book.id));
    await binary(`/keremkitabevi/api/books/${book.id}/cover`);
  }
  for (const view of ['tracking', 'kobo', 'upload']) await json(`/keremkitabevi/api/mobile/manage?view=${view}`);
  const gallery = await json('/xxxkerem/api/mobile/home', j => assert.ok(Array.isArray(j.profiles) && j.videos && j.photos));
  for (const kind of ['VIDEO', 'IMAGE']) await json(`/xxxkerem/api/mobile/media?kind=${kind}&page=1`, j => assert.ok(Array.isArray(j.items)));
  await json('/xxxkerem/api/profiles', j => assert.ok(Array.isArray(j)));
  if (gallery.profiles.length) await json(`/xxxkerem/api/mobile/profile/${gallery.profiles[0].id}`, j => assert.ok(j.profile));
  await json('/drive/api/items', j => assert.ok(Array.isArray(j.items) && Array.isArray(j.crumbs)));
  await json('/drive/api/folders', j => assert.ok(Array.isArray(j)));
  await json('/drive/api/stats', j => assert.ok(Number.isFinite(j.used) && Number.isFinite(j.free)));
  console.log(`\n${passed} read-only integration checks passed. No write endpoints called.`);
} catch (error) { console.error(`FAIL ${error.message}`); process.exitCode = 1; }
