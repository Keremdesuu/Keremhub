export const NEW_CONTENT_DAYS=7;
export const NEW_CONTENT_LIMIT=10;
export function newContentWindow(now=Date.now()){return {gte:new Date(now-NEW_CONTENT_DAYS*86400000),lte:new Date(now)};}
export function chooseHero<T extends {id:number}>(candidates:T[],previous:number|null,random= Math.random):T|null{
 const pool=candidates.filter(t=>t.id!==previous);const available=pool.length?pool:candidates;
 if(!available.length)return null;return available[Math.min(available.length-1,Math.max(0,Math.floor(random()*available.length)))];
}
