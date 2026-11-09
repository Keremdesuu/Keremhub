import {NextResponse} from "next/server";
import {validKoboToken} from "@/lib/kobo";
export const dynamic="force-dynamic";
async function empty(_req:Request,{params}:{params:Promise<{token:string}>}){
 const {token}=await params;if(!(await validKoboToken(token)))return new Response("Not found",{status:404});
 return NextResponse.json({});
}
export const GET=empty,POST=empty,PUT=empty,PATCH=empty,DELETE=empty;