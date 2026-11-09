import {randomUUID} from "node:crypto";
import {validKoboToken} from "@/lib/kobo";
export const dynamic="force-dynamic";
export async function GET(req:Request,{params}:{params:Promise<{token:string}>}) {
 const {token}=await params;
 if(!(await validKoboToken(token))) return new Response("Not found",{status:404});
 const input=new URL(req.url);
 const result=new URLSearchParams({code:"local-"+randomUUID(),state:input.searchParams.get("state")||""});
 return new Response(null,{status:302,headers:{"Location":"kobo://UserAuthenticated?"+result.toString(),"Cache-Control":"no-store"}});
}