import assert from "node:assert/strict";
import {consumeGenreDraft,genreFormValue,uniqueGenres} from "../src/lib/genre-tags";
const first=consumeGenreDraft([],"Fantastik,");assert.deepEqual(first,{tags:["Fantastik"],draft:""});
const pasted=consumeGenreDraft(first.tags,"Bilim Kurgu, Roman, Macera");assert.deepEqual(pasted,{tags:["Fantastik","Bilim Kurgu","Roman"],draft:" Macera"});
assert.equal(genreFormValue(pasted.tags,pasted.draft),"Fantastik, Bilim Kurgu, Roman, Macera");
assert.deepEqual(uniqueGenres([" Fantastik ","fantastik","","BİLİM KURGU","bilim kurgu"]),["Fantastik","BİLİM KURGU"]);
assert.deepEqual(consumeGenreDraft(["Roman"],"Roman,,\n"),{tags:["Roman"],draft:""});
assert.equal(genreFormValue([],"  Yeni Tür  "),"Yeni Tür");
console.log("PASS comma commits a tag; pasted tags preserve draft; pending text submits; duplicates and empty tags removed; new genres allowed");
