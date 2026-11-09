import {withBase} from "./base";
export function artworkUrl(t:{id:number;posterUrl:string|null;backdropUrl:string|null;kind?:string},role:"poster"|"card"|"hero"){
 let hash=5381;for(const char of `${t.posterUrl}|${t.backdropUrl}`)hash=(Math.imul(hash,33)^char.charCodeAt(0))>>>0;
 return withBase(`/api/artwork/${t.id}/${role}?v=${t.kind==="ANIME"&&role!=="poster"?"3-anime":"2"}-${hash.toString(16)}`);
}
