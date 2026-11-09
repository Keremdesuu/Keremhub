import json,urllib.request,urllib.error,http.cookiejar,uuid,pathlib
BASE='http://127.0.0.1:3400/drive/api'
cookies=http.cookiejar.CookieJar()
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))
checks=0
def request(route,method='GET',body=None,status=200,headers=None):
    global checks
    hs=headers or {}
    if body is not None and not isinstance(body,bytes):
        body=json.dumps(body).encode(); hs={**hs,'Content-Type':'application/json'}
    req=urllib.request.Request(BASE+route,data=body,method=method,headers=hs)
    try:r=client.open(req)
    except urllib.error.HTTPError as e:r=e
    data=r.read()
    assert r.status==status,(route,r.status,status,data[:500])
    checks+=1
    return json.loads(data) if 'application/json' in r.headers.get('Content-Type','') else data

request('/items')
assert request('/session')['authRequired'] is False
request('/login','POST',{'password':'unused'},404)
request('/password','POST',{'password':'unused'},404)
request('/folders','POST',{'name':'../bad'},400)
request('/folders','POST',{'name':'csrf'},403,{'Origin':'http://other.invalid'})
folder=request('/folders','POST',{'name':'QA-'+uuid.uuid4().hex[:8]},201)
child=request('/folders','POST',{'name':'İç klasör','parent':folder['id']},201)
try:
    request('/items/'+folder['id'],'PATCH',{'parent':child['id']},400)
    boundary='kd-'+uuid.uuid4().hex
    payload=b'kerem-drive-test\x00\x01\xff\n'
    body=('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\n').encode()+payload+('\r\n--'+boundary+'--\r\n').encode()
    request('/upload?parent='+child['id'],'POST',body,201,{'Content-Type':'multipart/form-data; boundary='+boundary})
    file=request('/items?parent='+child['id'])['items'][0]
    assert request('/items/'+file['id']+'/content')==payload
    assert request('/items/'+file['id']+'/content',headers={'Range':'bytes=0-4'},status=206)==payload[:5]
    request('/items/'+file['id'],'PATCH',{'name':'Türkçe belge.txt','star':True})
    assert any(x['id']==file['id'] for x in request('/items?mode=starred')['items'])
    assert any(x['id']==file['id'] for x in request('/items?q=T%C3%BCrk%C3%A7e')['items'])
    request('/items/'+folder['id'],'DELETE')
    request('/items/'+file['id']+'/content',status=404)
    assert any(x['id']==folder['id'] for x in request('/items?mode=trash')['items'])
    request('/items/'+folder['id']+'/restore','POST')
    assert request('/items/'+file['id']+'/content')==payload
    request('/items/'+file['id'],'PATCH',{'parent':folder['id']})
    request('/items/'+file['id']+'?permanent=true','DELETE',status=400)
    request('/stats')
finally:
    request('/items/'+folder['id'],'DELETE')
    request('/items/'+folder['id']+'?permanent=true','DELETE')
request('/items')
print('PASS:',checks,'API assertions; upload/download/range/folders/move/favorites/search/trash/restore/no-login/CSRF')
