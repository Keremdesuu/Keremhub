const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 fs.mkdirSync('.tools/screenshots',{recursive:true});
 const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1920,height:1080}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function shot(name){await page.screenshot({path:'.tools/screenshots/'+name+'.png',animations:'disabled'});}
 await page.goto('http://127.0.0.1:3211');await page.locator('.hero h1').waitFor();await page.locator('.hero-image').evaluate(i=>i.decode().catch(()=>{}));await shot('home');
 await page.getByRole('button',{name:'Daha fazla bilgi',exact:true}).click();await page.locator('.detail-dialog').waitFor();await shot('detail');await page.keyboard.press('Escape');
 for(const[label,name]of[['Diziler','series'],['Filmler','movies'],['Anime','anime'],['Yeni Eklenenler','catalog'],['Listem','my-list']]){await page.getByRole('button',{name:label,exact:true}).click();await page.locator('.loading-screen').waitFor({state:'hidden'});await shot(name);}
 await page.getByRole('button',{name:'Ara',exact:true}).click();await page.getByLabel('Yapım ara').fill('parazit');await shot('search');
 await page.getByRole('button',{name:'Profil ve ayarlar'}).click();await page.getByLabel('Sunucu adresi').waitFor();await shot('settings');
 await page.getByRole('button',{name:'Diziler',exact:true}).click();await page.locator('.hero h1').waitFor();await page.getByRole('button',{name:'Daha fazla bilgi',exact:true}).click();await page.locator('.episode').first().waitFor();await page.locator('.episode').first().scrollIntoViewIfNeeded();await shot('episodes');
 console.log(JSON.stringify({screens:10,pageErrors:errors}));await browser.close();if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
