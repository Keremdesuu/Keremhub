import {validKoboToken} from "@/lib/kobo";
export const dynamic="force-dynamic";
export async function GET(_req:Request,{params}:{params:Promise<{token:string;file:string}>}) {
 const {token}=await params;
 if(!(await validKoboToken(token))) return new Response("Not found",{status:404});
 return new Response(null,{status:204,headers:{"Cache-Control":"no-store"}});
}
