import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const PROBE = readFileSync(new URL('./probe-a11y.js', import.meta.url), 'utf8');
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const ctx = await b.newContext({ viewport:{width:1280,height:900}, deviceScaleFactor:2 });
const p = await ctx.newPage();
const bad=[]; const failed=[];
p.on('console', m=>{ if(/Refused to|Content Security/i.test(m.text())) bad.push('CSP: '+m.text()); });
p.on('pageerror', e=>bad.push('JS: '+String(e)));
p.on('requestfailed', r=>failed.push(r.url().slice(0,80)+' :: '+(r.failure()?.errorText||'')));
await p.goto(process.argv[2], { waitUntil:'load' });
await p.waitForTimeout(1500);
const r = await p.evaluate(PROBE + '; probeA11y()');
const view = await p.evaluate(() => ({
  viewport: document.querySelector('meta[name=viewport]')?.content,
  横スクロール: document.documentElement.scrollWidth > window.innerWidth + 1,
  スクロール幅: document.documentElement.scrollWidth, 画面幅: window.innerWidth,
  dvh使用: [...document.styleSheets].some(s=>{try{return [...s.cssRules].some(x=>/dvh/.test(x.cssText))}catch{return false}}),
  safeArea: [...document.styleSheets].some(s=>{try{return [...s.cssRules].some(x=>/safe-area-inset/.test(x.cssText))}catch{return false}}),
}));
const seen=new Set(); const uniq=(a,k)=>a.filter(x=>{const s=k(x); if(seen.has(s))return false; seen.add(s); return true;});
console.log(JSON.stringify({
  問題: bad, 読み込み失敗: [...new Set(failed)], 表示: view,
  コントラスト件数: r.contrast.length, タップ件数: r.taps.length,
  コントラスト: uniq(r.contrast, x=>x.cls+'|'+x.color).slice(0,25),
  タップ: uniq(r.taps, x=>x.cls).slice(0,25),
}, null, 2));
await p.screenshot({ path: process.argv[3] || 'gas-shot.png', fullPage: false });
await b.close();
