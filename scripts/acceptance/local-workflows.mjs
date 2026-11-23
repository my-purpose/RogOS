// Local-only UI regressions. Each application uses a fresh browser context.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.ACCEPTANCE_URL || 'http://127.0.0.1:5174';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local server required');
const out = new URL('../../docs/rogos/acceptance-2026-11-20/local-results.json', import.meta.url);
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}) });
const results = [];
async function menu(p, top, item) {
  await p.getByText(top, {exact:true}).click();
  await p.getByRole('menuitem', {name:item}).click();
}
async function run(id, fn) {
  const c = await browser.newContext({locale:'en-US',viewport:{width:1440,height:1000}});
  const p = await c.newPage(); p.setDefaultTimeout(10000);
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  try {
    await p.goto(base); await p.waitForTimeout(1000);
    await p.evaluate(async id => {const {useAppStore}=await import('/src/stores/useAppStore.ts');useAppStore.getState().launchApp(id);},id);
    await p.waitForTimeout(1200);
    const evidence = await fn(p);
    assert.equal(errors.length,0,errors.join('\n'));
    results.push({id,status:evidence?.limitation ? 'partial' : 'pass',evidence,errors});
  } catch(e) {results.push({id,status:'fail',error:String(e),errors,text:(await p.locator('body').innerText()).slice(-2500)});}
  finally {await c.close();fs.writeFileSync(out,JSON.stringify(results,null,2)+'\n');console.log(id,results.at(-1).status);}
}
try {
await run('journal',async p=>{
  const day = new Date().getDate().toString();
  await p.getByRole('button',{name:day,exact:true}).first().click();
  const editor=p.locator('[contenteditable=true]').first();
  await editor.fill('Acceptance journal 中文\nSecond paragraph');
  await p.waitForTimeout(1000); await p.reload();
  await p.locator('[contenteditable=true]').first().waitFor();
  assert.match(await p.locator('[contenteditable=true]').first().innerText(),/Acceptance journal 中文/);
  await p.getByRole('button',{name:'Freeform',exact:true}).click();
  await p.getByRole('toolbar',{name:'Page Tools',exact:true}).last().hover();
  await p.waitForTimeout(500);
  await p.getByRole('button',{name:'Add Note',exact:true}).last().click();
  await p.locator('[data-journal-placeholder]').last().dblclick();
  const note=p.locator('textarea.journal-canvas-note');
  await note.fill('Acceptance canvas note'); await note.press('Tab');
  await p.waitForTimeout(1000); await p.reload(); await p.waitForTimeout(1500);
  assert.match(await p.locator('body').innerText(),/Acceptance canvas note/);
  return ['daily Chinese text survives reload after 1 second','freeform note survives reload'];
});
await run('stickies',async p=>{
  await p.getByPlaceholder('Write a note…').last().fill('Acceptance sticky 中文');
  await menu(p,'File','New Note');
  await p.getByPlaceholder('Write a note…').last().fill('Acceptance second note');
  await p.waitForTimeout(1000);await p.reload();await p.waitForTimeout(1500);
  const values=await p.locator('textarea').evaluateAll(es=>es.map(e=>e.value));
  assert(values.includes('Acceptance sticky 中文'));assert(values.includes('Acceptance second note'));
  await p.getByPlaceholder('Write a note…').last().click();
  await menu(p,'File','Clear All Notes');
  const dialog=p.getByRole('dialog');
  if(await dialog.count()) await dialog.getByRole('button',{name:/clear|delete/i}).click();
  await p.waitForTimeout(1000);await p.reload();await p.waitForTimeout(1500);
  const remaining=await p.locator('textarea').evaluateAll(es=>es.map(e=>e.value));
  assert(!remaining.includes('Acceptance sticky 中文'));assert(!remaining.includes('Acceptance second note'));
  return {saved:values,afterClear:remaining};
});
await run('terminal',async p=>{
  async function command(s){await p.locator('.terminal-input').fill(s);await p.locator('.terminal-input').press('Enter');await p.waitForTimeout(300);}
  await command('help');assert.match(await p.locator('body').innerText(),/mkdir <dir>/);
  await command('mkdir acceptance-dir');
  assert.match(await p.locator('body').innerText(),/command not implemented: mkdir/);
  await command('cd Documents');await command('touch sample.txt');await command('ls');
  assert.match(await p.locator('body').innerText(),/created file: sample.txt/);
  assert.match(await p.locator('body').innerText(),/→ \/Documents/);
  await command('echo Acceptance terminal 中文');await command('not-a-command');
  const text=(await p.locator('body').innerText()).slice(-3500);
  assert.match(text,/command not found|unknown command/i);
  await command('rm sample.txt');assert.match(await p.locator('body').innerText(),/moved to trash: sample.txt/);await command('ls');
  return {limitation:'mkdir is advertised but explicitly unimplemented; directory creation not passed',commands:['help','cd Documents','touch','ls','echo','unknown command','rm'],output:text};
});
await run('paint',async p=>{
  const canvas=p.locator('canvas').first(); const initial=await canvas.evaluate(e=>e.toDataURL());const box=await canvas.boundingBox();
  await p.mouse.move(box.x+80,box.y+80);await p.mouse.down();await p.mouse.move(box.x+180,box.y+140,{steps:20});await p.mouse.up();
  const drawn=await canvas.evaluate(e=>e.toDataURL());assert.notEqual(drawn,initial);
  await menu(p,'Edit',/^Undo/);await p.waitForTimeout(300);assert.equal(await canvas.evaluate(e=>e.toDataURL()),initial);
  await menu(p,'Edit',/^Redo/);await p.waitForTimeout(300);assert.equal(await canvas.evaluate(e=>e.toDataURL()),drawn);
  return ['stroke changes pixels','Undo restores exact original pixels','Redo restores exact drawn pixels'];
});
await run('finder',async p=>{
  await p.getByText('Documents',{exact:true}).last().dblclick();await p.waitForTimeout(800);
  async function create(name){await menu(p,'File','New Folder…');await p.getByRole('dialog').locator('input').fill(name);await p.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();await p.waitForTimeout(500);}
  await create('Acceptance Folder');await create('Acceptance Folder');
  assert.match(await p.locator('body').innerText(),/already exists/);
  await p.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  await p.getByText('README.md',{exact:true}).last().dragTo(p.getByText('Acceptance Folder',{exact:true}).last());
  await p.waitForTimeout(500);
  await p.getByText('Acceptance Folder',{exact:true}).last().dblclick();
  await p.getByText('README.md',{exact:true}).last().waitFor();
  await p.waitForTimeout(1000);await p.reload();await p.waitForTimeout(1500);
  assert.match(await p.locator('body').innerText(),/README.md/);
  return ['duplicate folder name rejected','README.md moved into folder by drag and retained after reload'];
});
await run('textedit',async p=>{
  const input=p.locator('input[type=file]');
  await input.setInputFiles({name:'acceptance.html',mimeType:'text/html',buffer:Buffer.from('<h1>Acceptance rich title</h1><p><strong>Bold text</strong> and 中文</p><ul><li>First item</li><li>Second item</li></ul>')});
  const editor=p.locator('[contenteditable=true]');
  await editor.locator('h1').waitFor();
  assert.equal(await editor.locator('strong').innerText(),'Bold text');
  assert.equal(await editor.locator('li').count(),2);
  await p.getByText('File',{exact:true}).click();await p.getByRole('menuitem',{name:'Export As…',exact:true}).hover();
  const downloadPromise=p.waitForEvent('download');await p.getByRole('menuitem',{name:'HTML',exact:true}).click();
  const download=await downloadPromise;const bytes=fs.readFileSync(await download.path());
  assert.match(bytes.toString(),/<strong>Bold text<\/strong>/);assert.match(bytes.toString(),/中文/);
  await input.setInputFiles({name:'roundtrip.html',mimeType:'text/html',buffer:bytes});await p.waitForTimeout(500);
  assert.equal(await editor.locator('h1').innerText(),'Acceptance rich title');assert.equal(await editor.locator('li').count(),2);
  await input.setInputFiles({name:'acceptance.rtf',mimeType:'application/rtf',buffer:Buffer.from(String.raw`{\rtf1\ansi Acceptance RTF \b bold\b0\par Second paragraph}`)});await p.waitForTimeout(500);
  assert.match(await editor.innerText(),/Acceptance RTF/);assert.match(await editor.innerText(),/Second paragraph/);
  return ['HTML heading, bold, list, Chinese imported','HTML exported bytes checked and reimported with structure intact','RTF two paragraphs imported'];
});
await run('preview',async p=>{
  await p.locator('input[type=file]').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('not a PNG')});
  await p.waitForTimeout(1500);
  const text=await p.locator('body').innerText();assert.match(text,/error|failed|unable|invalid|could not|couldn.t open/i);
  await p.locator('input[type=file]').setInputFiles({name:'valid.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="red"/></svg>')});
  await p.waitForTimeout(500);
  const size=await p.getByAltText('valid.svg',{exact:true}).evaluate(e=>({w:e.naturalWidth,h:e.naturalHeight}));assert.deepEqual(size,{w:40,h:30});
  return {invalidImageMessage:text.slice(-1500),subsequentValidImage:size};
});
} finally {await browser.close();}
if(results.some(r=>r.status==='fail'))process.exitCode=1;
