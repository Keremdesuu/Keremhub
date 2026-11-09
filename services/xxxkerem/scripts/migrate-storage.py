from pathlib import Path
import sqlite3,json,hashlib,shutil,subprocess,uuid
root=Path('/home/kerempi/xxxkerem');hdd=Path('/mnt/hdd/xxxkerem')
subprocess.run(['mountpoint','-q','/mnt/hdd'],check=True)
b=Path((root/'data/storage-migration-backup.txt').read_text().strip())
c=sqlite3.connect(root/'prisma/dev.db');c.row_factory=sqlite3.Row
snap={t:[dict(r) for r in c.execute('select * from "'+t+'"')] for t in ['Profile','Media','_MediaToProfile']}
d=sqlite3.connect(b/'dev.db');c.backup(d);d.close()
(b/'before.json').write_text(json.dumps(snap,ensure_ascii=False))
rows={r['path']:r for r in snap['Media']};used={r['path'] for r in snap['Media']};moves=[];updates=[]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for oldroot,prefix in [(root/'profil','@profil/'),(root/'data/uploads','@uploads/')]:
 for src in sorted(oldroot.rglob('*')):
  if not src.is_file():continue
  assert not src.is_symlink()
  rel=src.relative_to(oldroot);key=prefix+rel.as_posix();row=rows.get(key)
  private=prefix=='@profil/' or (row and row['isAvatar'])
  folder='Profil' if private else 'Videolar' if (row and row['kind']=='VIDEO') or src.suffix.lower() in ['.mp4','.webm','.mkv','.avi','.mov','.m4v'] else 'Fotoğraflar'
  dest=hdd/folder/rel;dbpath='@profil/'+rel.as_posix() if private else folder+'/'+rel.as_posix()
  if (dest.exists() and digest(dest)!=digest(src)) or (dbpath in used and dbpath!=key):
   rel=rel.with_name(src.stem+'-migrated-'+uuid.uuid4().hex[:8]+src.suffix);dest=hdd/folder/rel;dbpath='@profil/'+rel.as_posix() if private else folder+'/'+rel.as_posix()
  assert dest.resolve().is_relative_to(hdd.resolve())
  dest.parent.mkdir(parents=True,exist_ok=True)
  if not dest.exists():shutil.copy2(src,dest)
  assert digest(src)==digest(dest)
  moves.append({'source':str(src),'destination':str(dest),'sha256':digest(src),'oldPath':key,'newPath':dbpath})
  if row:updates.append((dbpath,row['id']))
  used.add(dbpath)
with c:
 for dbpath,ident in updates:c.execute('update Media set path=? where id=?',(dbpath,ident))
 for move in moves:
  if move['oldPath'].startswith('@profil/'):
   c.execute('update Media set avatarFile=? where avatarFile=?',(move['newPath'],move['oldPath']))
for t in ['Profile','_MediaToProfile']:
 assert [dict(r) for r in c.execute('select * from "'+t+'"')]==snap[t],t
now={r['id']:dict(r) for r in c.execute('select * from Media')}
for r in snap['Media']:
 assert {k:v for k,v in r.items() if k not in ['path','avatarFile']}=={k:v for k,v in now[r['id']].items() if k not in ['path','avatarFile']}
settings={'UPLOAD_DIR':str(hdd/'Fotoğraflar'),'PHOTO_DIR':str(hdd/'Fotoğraflar'),'VIDEO_DIR':str(hdd/'Videolar'),'PROFILE_DIR':str(hdd/'Profil')}
p=root/'.env';lines=p.read_text().splitlines();lines=[l for l in lines if not any(l.startswith(k+'=') for k in settings)];lines.extend(k+'="'+v+'"' for k,v in settings.items());p.write_text('\n'.join(lines)+'\n')
(b/'migration.json').write_text(json.dumps({'moves':moves,'updates':updates,'settings':settings},ensure_ascii=False,indent=2))
print('Copied and hash-verified:',len(moves),'files; updated paths:',len(updates))
print('All profile records, hidden flags, media metadata and associations preserved.')
c.close()
