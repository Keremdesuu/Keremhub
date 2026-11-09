"""Read-only verification against the deployed bridge; no watch/list mutations."""
import json
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET

BASE = 'http://127.0.0.1:3210'


def get(path):
    with urllib.request.urlopen(BASE + path, timeout=40) as response:
        assert response.status == 200
        assert response.headers['Access-Control-Allow-Origin'] == '*'
        return json.load(response)


health = get('/health')
assert health['upstream'] and health['service'] == 'keremflix-tv'
home = get('/api/mobile/home')
all_items = get('/api/tv/catalog')['items']
print('Catalog:', {kind: sum(t['kind'] == kind for t in all_items) for kind in ('MOVIE', 'SERIES', 'ANIME')})
listed = get('/api/tv/list')['items']
assert all(t['inList'] for t in listed)
assert len(listed) == sum(t['inList'] for t in all_items)
for kind in ('MOVIE', 'SERIES', 'ANIME'):
    data = get('/api/mobile/home?kind=' + kind)
    assert all(t['kind'] == kind for t in data['recent'])
    assert all(t['kind'] == kind for t in get('/api/tv/catalog?kind=' + kind)['items'])
if all_items:
    detail = get('/api/mobile/title/' + str(all_items[0]['id']))
    get('/api/mobile/search?q=' + urllib.parse.quote(all_items[0]['title'][:5]))
    if detail['episodes']:
        episode = detail['episodes'][0]
        request = urllib.request.Request(BASE + '/api/stream/' + str(episode['id']), headers={'Range': 'bytes=0-1023'})
        with urllib.request.urlopen(request, timeout=30) as response:
            assert response.status == 206
            assert len(response.read()) == 1024
            assert response.headers['Content-Range'].startswith('bytes 0-1023/')
        print('Video byte-range: OK, episode', episode['id'])
    with urllib.request.urlopen(BASE + '/api/artwork/' + str(all_items[0]['id']) + '/card', timeout=40) as response:
        assert response.headers['Content-Type'] == 'image/webp'
        assert len(response.read()) > 100
    print('Artwork, details and search: OK')
for path in ('/', '/boot.js', '/app.js', '/style.css', '/icon.png'):
    with urllib.request.urlopen(BASE + path) as response:
        assert response.status == 200
        assert len(response.read()) > 100
print('Health, categories, complete catalog, list and static assets: OK')
print('No watch progress or list entries changed by verification.')
