import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const base=process.env.ACCEPTANCE_URL||'http://127.0.0.1:5174';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local only');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const results=[];
async function open(){const c=await browser.newContext({locale:'en-US'});const p=await c.newPage();p.setDefaultTimeout(20000);await p.goto(base);await p.evaluate(async()=>{const {useAppStore}=await import('/src/stores/useAppStore.ts');useAppStore.getState().launchApp('calendar');});await p.getByRole('button',{name:'Today',exact:true}).waitFor();await p.waitForTimeout(600);return {c,p};}
try{
 let {c,p}=await open();
 await p.getByRole('menuitem',{name:'File',exact:true}).click();
 await p.getByRole('menuitem',{name:'New Event',exact:true}).click();
 await p.getByPlaceholder('Title',{exact:true}).fill('Acceptance multi-day');
 await p.locator('input[type=date]').nth(0).fill('2026-11-20');
 await p.locator('input[type=date]').nth(1).fill('2026-11-22');
 await p.getByPlaceholder('Notes',{exact:true}).fill('中文往返');
 const download=p.waitForEvent('download');
 await p.getByRole('menuitem',{name:'File',exact:true}).click();
 await p.getByRole('menuitem',{name:'Export Events…',exact:true}).click();
 const bytes=await readFile(await (await download).path());const ics=bytes.toString();
 assert.match(ics,/SUMMARY:Acceptance multi-day/);assert.match(ics,/中文往返/);assert.match(ics,/DTSTART;VALUE=DATE:20261120/);assert.match(ics,/DTEND;VALUE=DATE:20261123/);
 results.push({case:'multi-day all-day export with exclusive end and Chinese notes',pass:true});
 await c.close();({c,p}=await open());
 await p.locator('input[type=file]').first().setInputFiles({name:'roundtrip.ics',mimeType:'text/calendar',buffer:bytes});
 await p.getByText('Acceptance multi-day',{exact:true}).first().waitFor();
 await p.waitForTimeout(800);await p.reload();
 await p.getByText('Acceptance multi-day',{exact:true}).first().waitFor();
 await p.getByText('Acceptance multi-day',{exact:true}).first().click();
 assert.equal(await p.getByPlaceholder('Notes',{exact:true}).inputValue(),'中文往返');
 assert.equal(await p.locator('input[type=date]').nth(1).inputValue(),'2026-11-22');
 results.push({case:'import into clean context then reload retains date and notes',pass:true});
 await c.close();
}catch(e){results.push({pass:false,error:String(e)});process.exitCode=1;}finally{await browser.close();}
console.log(JSON.stringify(results,null,2));
