import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Minus,Plus,Download,FileText,LoaderCircle,RotateCcw,Maximize} from 'lucide-react';
import type {PDFDocumentProxy} from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {BASE,bytes,format,type Item} from './types';

function Pdf({item}:{item:Item}){
 const [doc,setDoc]=useState<PDFDocumentProxy|null>(null),[page,setPage]=useState(1),[zoom,setZoom]=useState(1),[error,setError]=useState(''),[rendering,setRendering]=useState(true),[width,setWidth]=useState(600);
 const canvas=useRef<HTMLCanvasElement>(null),area=useRef<HTMLDivElement>(null);
 useEffect(()=>{let stop=false,task:ReturnType<typeof import('pdfjs-dist').getDocument>|undefined;setError('');
  void import('pdfjs-dist').then(pdf=>{if(stop)return;pdf.GlobalWorkerOptions.workerSrc=pdfWorkerUrl;task=pdf.getDocument({url:`${BASE}/items/${item.id}/content?preview=1`,cMapUrl:'/drive/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/drive/pdfjs/standard_fonts/',wasmUrl:'/drive/pdfjs/wasm/',iccUrl:'/drive/pdfjs/iccs/'});task.onPassword=()=>{setError('Bu PDF şifreli. İndirip kendi PDF uygulamanda açabilirsin.');void task?.destroy()};return task.promise}).then(d=>{if(d&&!stop)setDoc(d)}).catch(e=>{if(!stop)setError(e.name==='PasswordException'?'Bu PDF şifreli.':`PDF açılamadı: ${e.message}`)});
  return()=>{stop=true;void task?.destroy()};
 },[item.id]);
 useEffect(()=>{const el=area.current;if(!el)return;const observer=new ResizeObserver(([entry])=>setWidth(Math.max(200,entry.contentRect.width-40)));observer.observe(el);return()=>observer.disconnect()},[]);
 useEffect(()=>{if(!doc)return;let stop=false,task:ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']>|undefined;setRendering(true);
  void doc.getPage(page).then(p=>{if(stop||!canvas.current)return;const base=p.getViewport({scale:1}),scale=Math.min(width/base.width,1.5)*zoom,dpr=Math.min(devicePixelRatio||1,2),viewport=p.getViewport({scale:scale*dpr}),el=canvas.current;el.width=viewport.width;el.height=viewport.height;el.style.width=`${viewport.width/dpr}px`;el.style.height=`${viewport.height/dpr}px`;task=p.render({canvas:el,canvasContext:el.getContext('2d')!,viewport});return task.promise}).then(()=>{if(!stop)setRendering(false)}).catch(e=>{if(!stop&&e.name!=='RenderingCancelledException'){setError(e.message);setRendering(false)}});
  return()=>{stop=true;task?.cancel()};
 },[doc,page,zoom,width]);
 return <div className="pdf-viewer"><div className="document-toolbar"><div className="page-controls"><button aria-label="Önceki sayfa" disabled={page<=1||!doc} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={17}/></button><label><input aria-label="Sayfa numarası" type="number" min={1} max={doc?.numPages||1} value={page} onChange={e=>setPage(Math.min(doc?.numPages||1,Math.max(1,Number(e.target.value)||1)))}/><span>/ {doc?.numPages||'—'}</span></label><button aria-label="Sonraki sayfa" disabled={!doc||page>=doc.numPages} onClick={()=>setPage(p=>p+1)}><ChevronRight size={17}/></button></div><div className="zoom-controls"><button aria-label="Uzaklaştır" disabled={zoom<=.5} onClick={()=>setZoom(z=>Math.max(.5,z-.25))}><Minus size={16}/></button><span>%{Math.round(zoom*100)}</span><button aria-label="Yakınlaştır" disabled={zoom>=3} onClick={()=>setZoom(z=>Math.min(3,z+.25))}><Plus size={16}/></button><button aria-label="Genişliğe sığdır" onClick={()=>setZoom(1)}><Maximize size={16}/></button></div></div><div className="pdf-pages" ref={area}>{error?<PreviewError message={error} item={item}/>:<><canvas ref={canvas} aria-label={`PDF sayfa ${page}`}/>{rendering&&<div className="document-loading"><LoaderCircle className="spin" size={24}/><span>Sayfa hazırlanıyor…</span></div>}</>}</div></div>;
}

function PreviewError({message,item}:{message:string;item:Item}){return <div className="preview-message"><FileText size={38} strokeWidth={1.4}/><h3>Önizleme açılamadı</h3><p>{message}</p><a className="secondary" href={`${BASE}/items/${item.id}/content`} download><Download size={16}/>Dosyayı indir</a></div>}

function Document({item}:{item:Item}){
 const [html,setHtml]=useState(''),[text,setText]=useState(''),[sheets,setSheets]=useState<string[]>([]),[sheet,setSheet]=useState(1),[rows,setRows]=useState<string[][]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const kind=format(item);
 useEffect(()=>{const controller=new AbortController();let disposed=false;setLoading(true);setError('');
  void (async()=>{
   const limit=kind==='text'?2*1024**2:25*1024**2;if(item.size>limit)throw Error(`Bu dosya tarayıcı önizlemesi için büyük. Sınır ${bytes(limit)}; indirerek açabilirsin.`);
   const r=await fetch(`${BASE}/items/${item.id}/content`,{signal:controller.signal});if(!r.ok)throw Error('Dosya okunamadı.');const blob=await r.blob();
   if(kind==='docx'){
    const [mammoth,purify]=await Promise.all([import('mammoth/mammoth.browser'),import('dompurify')]);
    const result=await mammoth.convertToHtml({arrayBuffer:await blob.arrayBuffer()});
    const clean=purify.default.sanitize(result.value,{FORBID_TAGS:['style','form','input','button','video','audio','iframe','object','embed'],FORBID_ATTR:['style','srcset','target'],ALLOW_DATA_ATTR:false});
    if(!disposed)setHtml(clean);
   }else if(kind==='xlsx'){
    const excel=await import('read-excel-file/browser');
    const parsed=await excel.default(blob),names=parsed.map(s=>s.sheet),data=parsed[sheet-1]?.data||[];
    if(!disposed){setSheets(names);setRows(data.slice(0,1000).map(row=>row.slice(0,50).map(cell=>cell instanceof Date?cell.toLocaleDateString('tr-TR'):String(cell??''))))}
   }else{const value=await blob.text();if(!disposed)setText(value)}
  })().catch(e=>{if(!disposed&&e.name!=='AbortError')setError(e.message)}).finally(()=>{if(!disposed)setLoading(false)});
  return()=>{disposed=true;controller.abort()};
 },[item.id,sheet,kind]);
 if(loading)return <div className="document-loading"><LoaderCircle className="spin" size={26}/><span>Belge hazırlanıyor…</span></div>;
 if(error)return <PreviewError item={item} message={error}/>;
 if(kind==='docx')return <div className="document-scroll"><article className="word-page" dangerouslySetInnerHTML={{__html:html||'<p>Bu belge boş.</p>'}} onClick={e=>{const a=(e.target as HTMLElement).closest('a');if(a){e.preventDefault();if(/^https?:\/\//i.test(a.href))window.open(a.href,'_blank','noopener,noreferrer')}}}/><p className="document-note">Okuma görünümü · Belgenin özgün düzeni farklı olabilir.</p></div>;
 if(kind==='xlsx')return <div className="spreadsheet"><div className="document-toolbar"><label>Sayfa<select aria-label="Çalışma sayfası" value={sheet} onChange={e=>setSheet(Number(e.target.value))}>{sheets.map((name,i)=><option key={i} value={i+1}>{name}</option>)}</select></label><span>En fazla 1.000 satır / 50 sütun</span></div><div className="sheet-scroll"><table><thead><tr><th>#</th>{Array.from({length:Math.max(0,...rows.map(r=>r.length))},(_,i)=><th key={i}>{i<26?String.fromCharCode(65+i):'A'+String.fromCharCode(65+i-26)}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}><th>{i+1}</th>{row.map((value,j)=><td key={j}>{value}</td>)}</tr>)}</tbody></table>{!rows.length&&<p className="document-note">Bu sayfa boş.</p>}</div></div>;
 return <div className="text-viewer"><pre>{text||'(Boş dosya)'}</pre></div>;
}

export default function Preview({item}:{item:Item}){
 const kind=format(item),url=`${BASE}/items/${item.id}/content?preview=1`;
 if(kind==='pdf')return <Pdf item={item}/>;
 if(['docx','xlsx','text'].includes(kind))return <Document item={item}/>;
 if(kind==='image')return <div className="media-preview"><img src={url} alt={item.name}/></div>;
 if(kind==='video')return <div className="media-preview"><video controls playsInline src={url}>Tarayıcın bu video biçimini desteklemiyor.</video></div>;
 if(kind==='audio')return <div className="media-preview audio-preview"><div className="audio-cover">♪</div><h3>{item.name}</h3><audio controls src={url}/></div>;
 return <div className="preview-message"><FileText size={42} strokeWidth={1.2}/><h3>Bu biçim indirilebilir.</h3><p>PDF, DOCX, XLSX, metin, görsel, ses ve video dosyalarını burada görüntüleyebilirsin. Bu biçim için özgün uygulamasını kullan.</p><a className="secondary" href={`${BASE}/items/${item.id}/content`} download><Download size={16}/>Dosyayı indir</a></div>;
}
