import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
const project = '/home/kerempi/keremkitabevi', library = '/mnt/hdd/keremkitabevi';
assert.equal(process.cwd(), project);
const require = createRequire(`${project}/package.json`);
const Database = require('better-sqlite3');
const db = new Database(`${project}/data/kitabevi.db`);
db.pragma('foreign_keys = ON');
const book = db.prepare('SELECT * FROM Book WHERE id=824').get();
assert.equal(book?.relPath, 'keremhub-kobo-mobile-1793372848529.epub');
assert.equal(book.sizeBytes, 2328); assert.equal(book.koboSync, 0);
const source = path.resolve(library, book.relPath); assert.equal(path.dirname(source), library);
assert.equal(createHash('sha256').update(await fs.readFile(source)).digest('hex'), '84f1ef573124fdb8899a44edc36fa73e98948d78345ed466ac89abc24277af2c');
const shelf = db.prepare('SELECT * FROM Shelf WHERE id=2').get();
assert.equal(shelf?.name, 'Keremhub Kobo Test 824');
const relations = db.prepare('SELECT A,B FROM _BookToShelf WHERE B=2').all();
assert.ok(relations.every(row => row.A === 824));
const recovery = `${project}/data/kobo-mobile-test-recovery-${Date.now()}`;
const diskRecovery = `/mnt/hdd/.${path.basename(recovery)}`;
await fs.mkdir(recovery); await fs.mkdir(diskRecovery);
await db.backup(`${recovery}/before-cleanup.db`);
await fs.writeFile(`${recovery}/fixture.json`, JSON.stringify({ book, shelf, relations }, null, 2));
const destination = `${diskRecovery}/${book.relPath}`;
await fs.rename(source, destination);
try {
  db.transaction(() => {
    assert.equal(db.prepare('DELETE FROM Book WHERE id=? AND relPath=?').run(book.id, book.relPath).changes, 1);
    assert.equal(db.prepare('DELETE FROM Shelf WHERE id=? AND name=?').run(shelf.id, shelf.name).changes, 1);
    db.prepare('DELETE FROM Author WHERE name=? AND NOT EXISTS (SELECT 1 FROM Book WHERE authorId=Author.id)').run('Keremhub Test');
  })();
} catch (error) { await fs.rename(destination, source); throw error; }
finally { db.close(); }
console.log(JSON.stringify({ removedTestBook: book.id, removedTestShelf: shelf.id, recovery, diskRecovery, recoverable: true }));
