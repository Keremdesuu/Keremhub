import { rotateMedia } from '@/lib/rotate-media';
export const dynamic='force-dynamic';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 const raw=(await params).id,id=Number(raw);
 if(!/^\d+$/.test(raw)||!Number.isSafeInteger(id)||id<1)return Response.json({error:'Geçersiz kimlik'},{status:400});
 const origin=req.headers.get('origin'),host=req.headers.get('x-forwarded-host')??req.headers.get('host');
 if(origin&&new URL(origin).host!==host)return Response.json({error:'Geçersiz istek'},{status:403});
 try{return Response.json(await rotateMedia(id));}
 catch(e){const message=e instanceof Error?e.message:'';return Response.json({error:message && !message.includes('/') && !message.includes('ENOENT') && !message.includes('EACCES')?message:'Fotoğraf kaydedilemedi. HDD bağlantısını ve dosya izinlerini kontrol edin.'},{status:400});}
}
