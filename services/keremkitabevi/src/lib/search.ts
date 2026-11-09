/** Fold Turkish case, diacritics and Unicode variants for forgiving text search. */
export function normalizeSearch(value:string):string {
 return value.normalize("NFC").toLocaleLowerCase("tr-TR").normalize("NFKD")
  .replace(/\p{M}/gu, "").replace(/ı/g,"i")
  .replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");
}
export function matchesSearch(query:string,fields:(string|null|undefined)[]):boolean {
 const terms=normalizeSearch(query).split(" ").filter(Boolean);
 const haystack=fields.map(value=>normalizeSearch(value||"")).join(" ");
 return terms.every(term=>haystack.includes(term));
}
