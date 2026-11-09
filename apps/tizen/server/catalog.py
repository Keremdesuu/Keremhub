"""Read the existing Keremflix catalog without modifying its schema or data."""
import json
import datetime
import pathlib
import sqlite3
import sys

database = pathlib.Path(sys.argv[1]).resolve()
connection = sqlite3.connect(database.as_uri() + '?mode=ro', uri=True, timeout=10)
connection.row_factory = sqlite3.Row
titles = connection.execute('SELECT * FROM Title ORDER BY title COLLATE NOCASE').fetchall()
episodes = connection.execute('SELECT id, titleId, season, number, quality FROM Episode ORDER BY season, number').fetchall()
listed = {row[0] for row in connection.execute('SELECT titleId FROM ListItem')}
by_title = {}
for episode in episodes:
    by_title.setdefault(episode['titleId'], []).append(episode)


def array(value):
    try:
        result = json.loads(value or '[]')
        return result if isinstance(result, list) else []
    except (ValueError, TypeError):
        return []


items = []
for title in titles:
    item = dict(title)
    eps = by_title.get(title['id'], [])
    qualities = [e['quality'] for e in eps if e['quality']]
    item = {key: item.get(key) for key in ('id', 'kind', 'title', 'year', 'overview', 'posterUrl', 'backdropUrl', 'rating', 'certification', 'runtime')}
    item['addedAt'] = title['addedAt']
    try:
        added = title['addedAt']
        if isinstance(added, (int, float)):
            timestamp = added / 1000 if added > 100000000000 else added
        else:
            timestamp = datetime.datetime.fromisoformat(str(added).replace('Z', '+00:00')).replace(tzinfo=datetime.timezone.utc).timestamp()
        is_new = datetime.datetime.now(datetime.timezone.utc).timestamp() - timestamp < 14 * 86400
    except (ValueError, TypeError, OverflowError):
        is_new = False
    for key in ('genres', 'cast', 'moods'):
        item[key] = array(title[key])
    item.update(seasons=len({e['season'] for e in eps}), episodeCount=len(eps),
                quality=next((q for q in qualities if q.startswith('4K')), 'HD' if 'HD' in qualities else next(iter(qualities), None)),
                isNew=is_new, inList=title['id'] in listed, progress=None, resumeEpisodeId=None,
                firstEpisodeId=eps[0]['id'] if eps else None)
    items.append(item)
connection.close()
print(json.dumps({'version': 1, 'items': items}, ensure_ascii=False))
