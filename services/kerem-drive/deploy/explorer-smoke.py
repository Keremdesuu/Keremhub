import base64,io,json,pathlib,urllib.request,urllib.error,uuid,zipfile

BASE='http://127.0.0.1:3400/drive/api'
checks=0
def request(route,method='GET',body=None,status=200,headers=None):
    global checks
    hs=headers or {}
    if body is not None and not isinstance(body,bytes):
        body=json.dumps(body).encode();hs={**hs,'Content-Type':'application/json'}
    try:r=urllib.request.urlopen(urllib.request.Request(BASE+route,method=method,data=body,headers=hs))
    except urllib.error.HTTPError as e:r=e
    data=r.read();assert r.status==status,(route,r.status,status,data[:300]);checks+=1
    return json.loads(data) if 'application/json' in r.headers.get('Content-Type','') else data

def folder(name,parent=None):return request('/folders','POST',{'name':name,'parent':parent},201)
def upload(name,payload,parent,mime='application/octet-stream'):
    boundary='kd-'+uuid.uuid4().hex
    content=('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="'+name+'"\r\nContent-Type: '+mime+'\r\n\r\n').encode()+payload+('\r\n--'+boundary+'--\r\n').encode()
    request('/upload?parent='+parent,'POST',content,201,{'Content-Type':'multipart/form-data; boundary='+boundary})
    return next(x for x in request('/items?parent='+parent)['items'] if x['name']==name)

def zip_bytes(files):
    result=io.BytesIO()
    with zipfile.ZipFile(result,'w',zipfile.ZIP_DEFLATED) as z:
        for name,value in files.items():z.writestr(name,value)
    return result.getvalue()

def pdf_bytes():
    chunks=[b'%PDF-1.4\n'];positions=[0]
    streams=[]
    for text in ['Kerem Drive PDF preview - page 1','Second page - preview works']:
        streams.append(('BT /F1 22 Tf 50 740 Td ('+text+') Tj ET').encode())
    objects=[b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>',b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>',b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
    for stream in streams:objects.append(b'<< /Length '+str(len(stream)).encode()+b' >>\nstream\n'+stream+b'\nendstream')
    for i,obj in enumerate(objects,1):positions.append(sum(map(len,chunks)));chunks.append(str(i).encode()+b' 0 obj\n'+obj+b'\nendobj\n')
    start=sum(map(len,chunks));chunks.append(b'xref\n0 8\n0000000000 65535 f \n')
    for pos in positions[1:]:chunks.append(f'{pos:010d} 00000 n \n'.encode())
    chunks.append(f'trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n{start}\n%%EOF'.encode())
    return b''.join(chunks)

root=folder('Drive QA '+uuid.uuid4().hex[:8]);source=folder('A - Belgeler',root['id']);target=folder('B - Arsiv',root['id']);child=folder('Alt klasor',source['id'])
try:
    text=upload('Türkçe not.txt','Merhaba Kerem!\nTürkçe dosya adı ve içerik.\n'.encode(),root['id'],'text/plain')
    docx=zip_bytes({'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>','_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>','word/document.xml':'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Kerem Drive DOCX kontrolü</w:t></w:r></w:p><w:p><w:r><w:t>Bu belge doğrudan tarayıcıda açıldı. Türkçe: ıİğĞşŞöÖüÜçÇ.</w:t></w:r></w:p><w:p><w:hyperlink r:id="evil"><w:r><w:t>Güvenlik kontrolü</w:t></w:r></w:hyperlink></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Ad</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Kerem</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>','word/_rels/document.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="evil" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="javascript:alert(1)" TargetMode="External"/></Relationships>'})
    doc=upload('Deneme.docx',docx,root['id'])
    pdf=upload('Deneme.pdf',pdf_bytes(),root['id'])
    xlsx=zip_bytes({'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>','_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>','xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Dosyalar" sheetId="1" r:id="rId1"/></sheets></workbook>','xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>','xl/worksheets/sheet1.xml':'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Dosya</t></is></c><c r="B1" t="inlineStr"><is><t>Boyut</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Türkçe belge</t></is></c><c r="B2"><v>42</v></c></row></sheetData></worksheet>'})
    excel=upload('Deneme.xlsx',xlsx,root['id'])
    move=lambda ids,destination,status=200:request('/items/move','POST',{'ids':ids,'parent':destination},status)
    move([source['id']],child['id'],400)
    move([source['id'],child['id']],target['id'])
    assert next(x for x in request('/items?parent='+source['id'])['items'] if x['id']==child['id'])
    move([source['id']],root['id'])
    a=upload('collision.txt',b'one',source['id'],'text/plain');b=upload('collision.txt',b'two',target['id'],'text/plain')
    move([a['id'],text['id']],target['id'],409)
    assert any(x['id']==text['id'] for x in request('/items?parent='+root['id'])['items'])
    move([text['id']],source['id']);move([text['id']],root['id'])
    props=request('/items/'+root['id']+'/properties');assert props['fileCount']==6 and props['folderCount']==3,props
    r=urllib.request.urlopen(BASE+'/items/'+pdf['id']+'/content?preview=1');assert r.headers['Content-Type']=='application/pdf';assert r.read().startswith(b'%PDF')
    assert request('/items/'+doc['id']+'/content')==docx
    fixture={'root':root,'source':source,'target':target,'child':child,'text':text,'docx':doc,'pdf':pdf,'xlsx':excel}
    pathlib.Path('/home/kerempi/kerem-drive/data/qa-explorer.json').write_text(json.dumps(fixture))
    print('PASS:',checks,'API checks; batch move/cycle/atomic conflict/ancestor selection/properties/UTF8/PDF MIME')
    print(json.dumps({key:value['id'] for key,value in fixture.items()}))
except Exception:
    request('/items/'+root['id'],'DELETE');request('/items/'+root['id']+'?permanent=true','DELETE');raise
