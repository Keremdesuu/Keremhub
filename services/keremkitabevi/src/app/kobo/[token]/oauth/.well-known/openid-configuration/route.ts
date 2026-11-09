import {NextResponse} from "next/server";
import {koboPublicOrigin,validKoboToken} from "@/lib/kobo";
import {BASE_PATH} from "@/lib/config";
export const dynamic="force-dynamic";
export async function GET(req:Request,{params}:{params:Promise<{token:string}>}) {
 const {token}=await params;
 if(!(await validKoboToken(token))) return new Response("Not found",{status:404});
 const base=koboPublicOrigin(req)+BASE_PATH+"/kobo/"+token;
 const oauth=base+"/oauth";
 return NextResponse.json({issuer:base,authorization_endpoint:oauth+"/authorize",token_endpoint:oauth+"/token",response_types_supported:["code"],grant_types_supported:["authorization_code","refresh_token"],code_challenge_methods_supported:["S256","plain"],subject_types_supported:["public"],id_token_signing_alg_values_supported:["RS256"],scopes_supported:["openid","profile","email","offline_access"]},{headers:{"Cache-Control":"no-store"}});
}
