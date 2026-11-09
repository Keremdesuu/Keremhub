import {describe,it,expect,afterEach,vi} from 'vitest';
import {needsMetadata} from './metadata-policy';
import {cleanTitle} from './parse';
import {getJson,MetadataRequestError} from './metadata/http';
afterEach(()=>vi.unstubAllGlobals());
describe('metadata repair',()=>{
 it('normal scans retry failed sources and missing artwork',()=>{
  const valid={metaStatus:'ok',posterUrl:'poster',backdropUrl:'wide',overview:'Summary'};
  expect(needsMetadata(valid)).toBe(false);
  for(const status of ['pending','no-key','not-found','unavailable','artwork-unavailable'])expect(needsMetadata({...valid,metaStatus:status})).toBe(true);
  expect(needsMetadata({...valid,posterUrl:null})).toBe(true);
  expect(needsMetadata({...valid,backdropUrl:'poster'})).toBe(true);
 });
 it('keeps dotted years and dotted title words',()=>{
  expect(cleanTitle('Whiplash.2014')).toEqual({title:'Whiplash',year:2014});
  expect(cleanTitle('Oldboy.2003.1080p.mkv')).toEqual({title:'Oldboy',year:2003});
  expect(cleanTitle('Dr.No')).toEqual({title:'Dr No',year:null});
 });
 it('does not treat a provider outage as a missing title',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:429})));
  await expect(getJson('https://api.example.test')).rejects.toBeInstanceOf(MetadataRequestError);
 });
 it('keeps genuine no-result responses distinct',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:404})));
  expect(await getJson('https://api.example.test')).toBeNull();
 });
});
