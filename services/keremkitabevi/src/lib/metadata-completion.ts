import {normalizeSearch} from "./search";
export function completionToken(value:string,multiple:boolean,caret=value.length){
 const position=Math.max(0,Math.min(caret,value.length));
 const start=multiple?value.slice(0,position).lastIndexOf(",")+1:0;
 const next=multiple?value.indexOf(",",position):-1;
 const end=next<0?value.length:next;
 return {start,end,query:value.slice(start,end).trim()};
}
export function completionOptions(options:string[],value:string,multiple=false,caret=value.length){
 const token=completionToken(value,multiple,caret),query=normalizeSearch(token.query);
 const selected=multiple?new Set((value.slice(0,token.start)+value.slice(token.end)).split(",").map(normalizeSearch).filter(Boolean)):new Set<string>();
 return options.filter(option=>!selected.has(normalizeSearch(option))&&normalizeSearch(option).includes(query))
  .sort((a,b)=>Number(!normalizeSearch(a).startsWith(query))-Number(!normalizeSearch(b).startsWith(query)))
  .slice(0,12);
}
export function insertCompletion(value:string,option:string,multiple=false,caret=value.length){
 if(!multiple)return {value:option,caret:option.length};
 const {start,end}=completionToken(value,true,caret),prefix=value.slice(0,start).trimEnd(),suffix=value.slice(end);
 const before=prefix+(prefix?" ":"");
 return {value:before+option+suffix,caret:before.length+option.length};
}
