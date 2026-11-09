import {chromium} from 'playwright';
import{readFileSync,copyFileSync}from'node:fs';
const font=readFileSync('node_modules/@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2').toString('base64');
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:512,height:512},deviceScaleFactor:1});
 await page.setContent(`<style>@font-face{font-family:'Bebas Neue';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:400}html,body{margin:0;width:512px;height:512px;background:#000}body{display:flex;align-items:center;justify-content:center}.wordmark{font-family:'Bebas Neue';font-size:128px;font-weight:400;letter-spacing:2px;line-height:1;color:#e50914;white-space:nowrap}</style><div class="wordmark">KEREMFLIX</div>`);
 await page.evaluate(async()=>{await document.fonts.load('128px "Bebas Neue"');await document.fonts.ready;const el=document.querySelector('.wordmark'),width=el.getBoundingClientRect().width;if(width>448)el.style.fontSize=(128*448/width)+'px';});
 await page.screenshot({path:'app/keremflix-icon.png'});
 copyFileSync('app/keremflix-icon.png','app/icon.png');
 console.log('Created black Keremflix tile with red Bebas Neue wordmark.');
}finally{await browser.close();}
