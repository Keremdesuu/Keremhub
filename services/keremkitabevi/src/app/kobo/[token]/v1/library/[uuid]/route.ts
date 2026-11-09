import {db} from "@/lib/db";
import {idFromBookUuid,validKoboToken} from "@/lib/kobo";
export const dynamic="force-dynamic";
export async function DELETE(_req:Request,{params}:{params:Promise<{token:string;uuid:string}>}){
 const {token,uuid}=await params;if(!(await validKoboToken(token)))return new Response("Not found",{status:404});
 const id=idFromBookUuid(uuid);if(id)await db.book.updateMany({where:{id},data:{koboSync:false}});
 return new Response(null,{status:204});
}