export function genreKey(value:string){return value.normalize("NFC").replace(/\s+/g," ").trim().toLocaleLowerCase("tr-TR");}
export function uniqueGenres(values:string[]):string[]{
 const seen=new Set<string>();return values.map(value=>value.normalize("NFC").replace(/\s+/g," ").trim()).filter(value=>{const key=genreKey(value);if(!key||seen.has(key))return false;seen.add(key);return true;});
}
export function genreFormValue(tags:string[],draft=""){return uniqueGenres([...tags,...draft.split(/[,\n]/)]).join(", ");}
export function consumeGenreDraft(tags:string[],text:string){
 const parts=text.split(/[,\n]/),draft=parts.pop()||"";
 return {tags:uniqueGenres([...tags,...parts]),draft};
}
