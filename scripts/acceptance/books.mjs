import { chromium } from 'playwright';
import JSZip from 'jszip';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.ACCEPTANCE_URL || 'http://127.0.0.1:5174';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local only');
const out = 'docs/rogos/acceptance-2026-11-20';
await mkdir(out, {recursive:true});
const zip = new JSZip();
zip.file('mimetype','application/epub+zip',{compression:'STORE'});
zip.file('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
zip.file('book.opf','<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="uid" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">rogos-acceptance</dc:identifier><dc:title>Acceptance Reader</dc:title><dc:creator>RogOS Test</dc:creator><dc:language>en</dc:language><meta property="dcterms:modified">2026-11-20T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>');
zip.file('nav.xhtml','<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="one.xhtml">First Chapter</a></li><li><a href="two.xhtml">Second Chapter</a></li></ol></nav></body></html>');
for(const [name,title] of [['one','First Chapter'],['two','Second Chapter']]) zip.file(name+'.xhtml',`<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${title}</title></head><body><h1>${title}</h1><p id="passage">Acceptance reading passage for persistent highlighting.</p>${Array.from({length:18},(_,i)=>`<p>Paragraph ${i+1}. This original fixture verifies reading, navigation, bookmarks and durable annotations without external services.</p>`).join('')}</body></html>`);
const epub = await zip.generateAsync({type:'nodebuffer'});
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({locale:'en-US',viewport:{width:1440,height:1000}});
const page=await context.newPage();
page.setDefaultTimeout(20000);
const results=[];
try {
 await page.goto(base);
 await page.evaluate(async()=>{const {useAppStore}=await import('/src/stores/useAppStore.ts'); useAppStore.getState().launchApp('books');});
 await page.locator('input[type=file][accept*="epub"]').setInputFiles({name:'acceptance.epub',mimeType:'application/epub+zip',buffer:epub});
 await page.getByTitle('Acceptance Reader',{exact:true}).click();
 await page.waitForTimeout(3000);
 const frame=page.frames().find(f=>f!==page.mainFrame());
 await frame.locator('#passage').waitFor();
 results.push({test:'import EPUB and render chapter',passed:(await frame.locator('h1').innerText())==='First Chapter'});
 await page.mouse.move(350,45);
 await page.getByRole('button',{name:'Add Bookmark',exact:true}).click();
 results.push({test:'add bookmark',passed:await page.getByRole('button',{name:'Remove Bookmark',exact:true}).count()===1});
 const box=await frame.locator('#passage').boundingBox();
 await page.mouse.move(box.x+2,box.y+8); await page.mouse.down();
 await page.mouse.move(box.x+Math.min(box.width-5,220),box.y+8,{steps:20}); await page.mouse.up();
 await page.waitForTimeout(800);
 const readState=()=>page.evaluate(async()=>{
   const {useBooksStore}=await import('/src/stores/useBooksStore.ts');
   const s=useBooksStore.getState();
   return {highlights:s.highlightsByPath['/Books/acceptance.epub']||[],bookmarks:s.bookmarksByPath['/Books/acceptance.epub']||[],progress:s.progressByPath['/Books/acceptance.epub'],color:s.settings.lastHighlightColor};
 });
 let state=await readState();
 assert.equal(state.highlights.length,1);
 results.push({test:'mouse selection automatically highlights',passed:true,text:state.highlights[0].text});
 await page.getByRole('button',{name:'Blue highlight',exact:true}).click();
 state=await readState(); assert.equal(state.highlights[0].color,'blue');
 results.push({test:'change highlight to blue',passed:true});
 await page.locator('button').filter({hasText:/^Go$/}).click();
 await page.getByRole('menuitem',{name:'Chapters',exact:true}).hover();
 await page.getByRole('menuitemradio',{name:'Second Chapter',exact:true}).click();
 await page.waitForTimeout(1000);
 assert.equal(await page.frameLocator('iframe').locator('h1').innerText(),'Second Chapter');
 state=await readState(); assert.ok(state.progress.percentage>0);
 results.push({test:'chapter navigation updates progress',passed:true,progress:state.progress});
 await page.reload();
 await page.frameLocator('iframe').locator('h1').waitFor();
 assert.equal(await page.frameLocator('iframe').locator('h1').innerText(),'Second Chapter');
 state=await readState(); assert.equal(state.highlights[0].color,'blue'); assert.equal(state.bookmarks.length,1);
 results.push({test:'refresh restores book, progress, blue highlight and bookmark',passed:true,state});
 await page.locator('button').filter({hasText:/^Go$/}).click();
 await page.getByRole('menuitem',{name:'Chapters',exact:true}).hover();
 await page.getByRole('menuitemradio',{name:'First Chapter',exact:true}).click();
 await page.waitForTimeout(700);
 await page.mouse.move(350,45);
 await page.getByRole('button',{name:'Remove Bookmark',exact:true}).click();
 state=await readState(); assert.equal(state.bookmarks.length,0);
 results.push({test:'remove bookmark',passed:true});
 // Check the actual hit target, not just visibility, at two desktop widths.
 for (const width of [1440, 1000]) {
   await page.setViewportSize({width,height:1000});
   if (width === 1000) {
     const handle=page.locator('.resize-handle.cursor-se-resize');
     const corner=await handle.boundingBox();
     await page.mouse.move(corner.x+corner.width/2,corner.y+corner.height/2);
     await page.mouse.down();
     await page.mouse.move(corner.x+corner.width/2-120,corner.y+corner.height/2,{steps:12});
     await page.mouse.up();
   }
   await page.mouse.move(350,45);
   await page.waitForTimeout(250);
   const hit=await page.getByRole('button',{name:'Shelf',exact:true}).evaluate(button=>{
     const r=button.getBoundingClientRect();
     return button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
   });
   assert.equal(hit,true,`Shelf center hit at viewport ${width}`);
   results.push({test:`shelf button center is clickable at viewport ${width}`,passed:true,windowWidth:(await page.locator('.window-material-notitlebar').boundingBox()).width});
 }
 await page.getByRole('button',{name:'Shelf',exact:true}).click();
 await page.getByTitle('Acceptance Reader',{exact:true}).click();
 await page.frameLocator('iframe').locator('h1').waitFor();
 results.push({test:'close to shelf and reopen imported book',passed:true});
 await page.waitForTimeout(700);
 await page.reload();
 await page.frameLocator('iframe').locator('h1').waitFor();
 state=await readState(); assert.equal(state.bookmarks.length,0); assert.equal(state.highlights[0].color,'blue');
 results.push({test:'bookmark deletion persists after second reload',passed:true});
 await page.mouse.move(350,45);
 await page.getByRole('button',{name:'Highlights',exact:true}).click();
 await page.locator('[data-books-highlights-drawer]').getByTitle('Blue highlight',{exact:true}).waitFor();
 results.push({test:'restored blue highlight visible in drawer',passed:true});
 await writeFile(out+'/books-results.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2));
 await page.waitForTimeout(1500); // Let the book-open and drawer animations finish for evidence.
 await page.screenshot({path:out+'/books-reader.png'});
} catch(error) {console.log(await page.locator('body').innerText()); await page.screenshot({path:out+'/books-failure.png'}); throw error;} finally {await browser.close();}
