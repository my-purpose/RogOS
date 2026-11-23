// Isolated UI regression; failure injection affects only this browser context.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.ACCEPTANCE_URL || 'http://127.0.0.1:5174';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Local only');
const browser = await chromium.launch({headless:true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
const results=[];
try {
 const context=await browser.newContext({locale:'en-US'});
 const page=await context.newPage(); page.setDefaultTimeout(20000);
 await page.goto(base);
 await page.evaluate(async()=>{const {useAppStore}=await import('/src/stores/useAppStore.ts');useAppStore.getState().launchApp('contacts');});
 await page.getByTitle('New Contact',{exact:true}).click();
 await page.getByPlaceholder('First Name',{exact:true}).fill('Boundary');
 await page.getByPlaceholder('Last Name',{exact:true}).fill('Original');
 await page.getByRole('button',{name:'Done',exact:true}).click();
 await page.reload();
 await page.getByText('Boundary Original',{exact:true}).first().waitFor();
 results.push({case:'new contact immediate reload',pass:true});
 for(const name of ['Edited','Second','Third']) {
  await page.getByRole('button',{name:'Edit',exact:true}).click();
  await page.getByPlaceholder('Last Name',{exact:true}).fill(name);
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await page.reload();
  await page.getByText(`Boundary ${name}`,{exact:true}).first().waitFor();
  results.push({case:`edit existing then immediate reload: ${name}`,pass:true});
 }
 await page.getByRole('button',{name:'Edit',exact:true}).click();
 await page.getByPlaceholder('Last Name',{exact:true}).fill('QuotaRetry');
 await page.evaluate(()=>{
  window.__originalSetItem=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){if(key==='rogos:contacts:save-recovery')throw new DOMException('Acceptance quota exhausted','QuotaExceededError');return window.__originalSetItem.call(this,key,value);};
 });
 await page.getByRole('button',{name:'Done',exact:true}).click();
 await page.getByText('Could not save contact. Please try again.',{exact:true}).waitFor();
 assert.equal(await page.getByPlaceholder('Last Name',{exact:true}).inputValue(),'QuotaRetry');
 assert.equal(await page.getByRole('button',{name:'Done',exact:true}).isEnabled(),true);
 results.push({case:'checkpoint quota failure keeps editor and allows retry',pass:true});
 await page.evaluate(()=>{Storage.prototype.setItem=window.__originalSetItem;delete window.__originalSetItem;});
 await page.getByRole('button',{name:'Done',exact:true}).click();
 await page.reload();
 await page.getByText('Boundary QuotaRetry',{exact:true}).first().waitFor();
 const checkpoint=await page.evaluate(()=>localStorage.getItem('rogos:contacts:save-recovery'));
 assert.equal(checkpoint,null);
 results.push({case:'retry after quota failure persists and cleans checkpoint',pass:true});
 await page.getByRole('button',{name:'Edit',exact:true}).click();
 await page.getByPlaceholder('Last Name',{exact:true}).fill('DatabaseRecovery');
 await page.evaluate(()=>{
  window.__originalTransaction=IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction=function(names,mode,...rest){
   if(mode==='readwrite')throw new DOMException('Acceptance database write failure','UnknownError');
   return window.__originalTransaction.call(this,names,mode,...rest);
  };
 });
 await page.getByRole('button',{name:'Done',exact:true}).click();
 await page.getByText('Could not save contact. Please try again.',{exact:true}).waitFor();
 assert.equal(await page.getByPlaceholder('Last Name',{exact:true}).inputValue(),'DatabaseRecovery');
 assert.ok(await page.evaluate(()=>localStorage.getItem('rogos:contacts:save-recovery')));
 results.push({case:'database failure retains editor and recovery checkpoint',pass:true});
 await page.reload();
 await page.getByText('Boundary DatabaseRecovery',{exact:true}).first().waitFor();
 assert.equal(await page.evaluate(()=>localStorage.getItem('rogos:contacts:save-recovery')),null);
 results.push({case:'reload after database failure restores checkpoint to database',pass:true});
 await context.close();
} catch(error) {results.push({pass:false,error:String(error)});process.exitCode=1;} finally {await browser.close();}
console.log(JSON.stringify(results,null,2));
