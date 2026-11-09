import {randomUUID} from "node:crypto";
import {NextResponse} from "next/server";
import {validKoboToken} from "@/lib/kobo";
export const dynamic="force-dynamic";
export async function POST(_req:Request,{params}:{params:Promise<{token:string}>}) {
 const {token}=await params;
 if(!(await validKoboToken(token))) return new Response("Not found",{status:404});
 const access="local-"+randomUUID(),refresh="local-"+randomUUID(),tracking=randomUUID();
 return NextResponse.json({access_token:access,refresh_token:refresh,token_type:"Bearer",expires_in:315360000,scope:"openid profile email offline_access kobo_profile public_api_authenticated",user_id:"local-kobo-user",AccessToken:access,RefreshToken:refresh,TokenType:"Bearer",TrackingId:tracking,UserKey:"local-kobo-user"},{headers:{"Cache-Control":"no-store"}});
}