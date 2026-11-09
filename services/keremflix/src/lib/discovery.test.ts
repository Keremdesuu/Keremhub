import {it,expect} from 'vitest';
import {newContentWindow,NEW_CONTENT_LIMIT,chooseHero} from './discovery';
it('restricts new content to seven days and at most ten entries',()=>{const now=Date.UTC(2026,10,8,12);const window=newContentWindow(now);expect(window.lte.getTime()).toBe(now);expect(window.gte.getTime()).toBe(now-7*86400000);expect(NEW_CONTENT_LIMIT).toBe(10);});
it('does not repeat the previous hero when alternatives exist',()=>{const candidates=[{id:1},{id:2},{id:3}];for(const random of [0,0.49,0.99])expect(chooseHero(candidates,2,()=>random)?.id).not.toBe(2);expect(chooseHero([{id:1}],1)?.id).toBe(1);expect(chooseHero([],null)).toBeNull();});
