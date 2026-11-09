import { photoPreview } from '@/lib/photo-preview';
import { BASE } from '@/lib/url';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const raw=(await params).id,id=Number(raw);
 if(!/^\d+$/.test(raw)||!Number.isSafeInteger(id)||id<1)return new Response('Invalid ID',{status:400});
 try{
  const {data,key}=await photoPreview(id),etag=`"${key}"`;
  const headers={'Content-Type':'image/webp','Cache-Control':'private, max-age=86400','ETag':etag};
  if(req.headers.get('if-none-match')===etag)return new Response(null,{status:304,headers});
  return new Response(new Uint8Array(data),{headers:{...headers,'Content-Length':String(data.length)}});
 }catch{return Response.redirect(new URL(`${BASE}/api/file/${id}`,req.url),307);}
}
