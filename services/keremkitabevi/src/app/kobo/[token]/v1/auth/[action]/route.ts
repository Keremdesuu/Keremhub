import {randomUUID,randomBytes} from "node:crypto";
import {NextResponse} from "next/server";
import {validKoboToken} from "@/lib/kobo";
export const dynamic="force-dynamic";
export async function POST(req:Request,{params}:{params:Promise<{token:string}>}){
 const {token}=await params;if(!(await validKoboToken(token)))return new Response("Not found",{status:404});
 const body=await req.json().catch(()=>({}));
 return NextResponse.json({AccessToken:randomBytes(24).toString("base64"),RefreshToken:randomBytes(24).toString("base64"),TokenType:"Bearer",TrackingId:randomUUID(),UserKey:body?.UserKey??""});
}