// Run ONLY against an isolated Next instance with a disposable SQLite backup.
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
const dbPath = process.env.MOBILE_TEST_DB;
if (!dbPath?.startsWith('/tmp/kitabevi-mobile-test-')) throw new Error('Disposable test DB required');
const db = new Database(dbPath);
const id = 1900000001, name = `__mobile_test_${Date.now()}`;
db.prepare('INSERT INTO Book (id,relPath,format,sizeBytes,mtimeMs,title,updatedAt) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)').run(id, `${name}.epub`, 'epub', 100, 0, name);
const base = 'http://127.0.0.1:3102/keremkitabevi/api/mobile/manage';
const check = (name) => console.log(`PASS ${name}`);
async function get(params) { const r = await fetch(`${base}?${params}`); assert.equal(r.status, 200); return r.json(); }
async function post(action, fields = {}, { headers = {}, status = 200, marker = true } = {}) {
  const form = new FormData(); form.set('action', action);
  for (const [key, value] of Object.entries(fields)) form.set(key, String(value));
  const response = await fetch(base, { method: 'POST', headers: { ...(marker ? { 'X-Keremhub-Mobile': '1' } : {}), ...headers }, body: form });
  assert.equal(response.status, status, await response.clone().text()); return response.json();
}
try {
  await get('view=book&id=' + id); await get('view=tracking'); await get('view=kobo');
  const disk = await get('view=upload'); assert.equal(disk.writable, false); assert.match(disk.reason, /salt okunur/); check('GET book/tracking/kobo; HDD readonly reported');
  await post('status', { id, status: 'reading' }, { marker: false, status: 403 });
  await post('status', { id, status: 'reading' }, { headers: { Origin: 'http://evil.test' }, status: 403 });
  await post('status', { id, status: 'reading' }, { headers: { 'Sec-Fetch-Site': 'cross-site' }, status: 403 });
  await post('status', { id, status: 'invalid' }, { status: 400 });
  await post('rating', { id, rating: 'NaN' }, { status: 400 });
  await post('metadata', { id, title: '' }, { status: 400 });
  await post('metadata', { id, title: name, year: '10000' }, { status: 400 });
  await post('kobo', { id, on: 'maybe' }, { status: 400 });
  await post('shelf', { id, shelfId: '../', on: true }, { status: 400 });
  await post('upload', {}, { status: 507 }); check('invalid writes, CSRF and HDD upload rejected');
  await post('metadata', { id, title: `${name} edited`, author: 'Mobile Fixture Author', series: 'Mobile Fixture Series', seriesIndex: '1.5', year: '2026', genres: 'Roman, roman, Bilim' });
  const edited = await get(`view=book&id=${id}`);
  assert.equal(edited.book.metadataLocked, true); assert.equal(edited.book.coverLocked, true); assert.equal(edited.book.seriesIndex, 1.5); assert.equal(edited.book.genres.length, 2); check('metadata action persisted and both protections enabled');
  await post('status', { id, status: 'reading' });
  let book = await get(`view=book&id=${id}`); assert.ok(book.tracking.entry.startedAt);
  await post('status', { id, status: 'read' });
  await post('rating', { id, rating: 4 }); book = await get(`view=book&id=${id}`); assert.equal(book.tracking.entry.rating, 4); assert.ok(book.tracking.entry.finishedAt);
  const shelf = await post('createShelf', { name });
  await post('shelf', { id, shelfId: shelf.id, on: true });
  assert.ok((await get(`view=tracking&shelfId=${shelf.id}`)).books.some(b => b.id === id));
  await post('shelf', { id, shelfId: shelf.id, on: false });
  await post('deleteShelf', { shelfId: shelf.id }); check('status dates/rating and shelf create/connect/disconnect/delete');
  await post('kobo', { id, on: true });
  db.prepare('INSERT INTO KoboBookState (bookId,syncedAt,downloadedAt) VALUES (?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)').run(id);
  await post('kobo', { id, on: true, returnTo: 'kobo' });
  assert.equal(db.prepare('SELECT count(*) AS n FROM KoboBookState WHERE bookId=?').get(id).n, 0);
  await post('kobo', { id, on: false }); assert.equal((await get(`view=book&id=${id}`)).book.koboSync, false); check('Kobo expected redirects, add/resend/remove and state reset');
  await post('status', { id, status: '' }); await post('rating', { id, rating: 3 });
  assert.equal((await get(`view=book&id=${id}`)).tracking.entry.status, 'read'); check('rating untracked book uses existing read shelf rule');
  const conflict = await fetch(base + '?view=tracking&status=reading&shelfId=1'); assert.equal(conflict.status, 400); check('ambiguous status/shelf filter rejected');
} finally { db.close(); }
