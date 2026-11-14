/** Real Chromium component integration. No WebGL/whole-game claim.
 * npm ci; node scripts/qa-hunter-loadout.mjs [output-directory]
 * Optional YHW_FIDELITY_SOURCE replays this fixture on an exact earlier source.
 * YHW_PLAYWRIGHT_MODULE and YHW_CHROMIUM_EXECUTABLE allow an explicit local runner;
 * both are recorded, never silently described as the locked project versions. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const project = fileURLToPath(new URL('../', import.meta.url));
const source = path.resolve(process.env.YHW_FIDELITY_SOURCE ?? project);
const output = path.resolve(process.argv[2] ?? path.join(project, 'docs/qa/gamedev-fidelity-loadout-20261029/browser'));
const { chromium } = await import(process.env.YHW_PLAYWRIGHT_MODULE ?? 'playwright');
const expected = JSON.parse(await readFile(path.join(project, 'tests/fixtures/hunter-reference-expectations.json')));
const html = await readFile(path.join(project, 'tests/fixtures/hunter-loadout-screen.html'), 'utf8');
const transport = process.env.YHW_BROWSER_TRANSPORT === 'memory' ? 'memory' : 'http';
// No browser/network policies are changed. A memory-only fixture can exercise
// native DOM/events when the host disallows navigating even to a local server.
const arsenalText = await readFile(path.join(source, 'js/data/hunterArsenal.js'), 'utf8');
const screenText = await readFile(path.join(source, 'js/ui/LoadoutScreen.js'), 'utf8');
const harness = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
if (!harness) throw new Error('Missing fixture module');
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/') { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html); return; }
    if (!pathname.startsWith('/js/')) { response.writeHead(404); response.end(); return; }
    const filename = path.resolve(source, '.' + decodeURIComponent(pathname));
    if (!filename.startsWith(source + path.sep)) throw new Error('invalid path');
    response.setHeader('Content-Type', 'text/javascript; charset=utf-8'); response.end(await readFile(filename));
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
let browser;
const rows = [];
async function check(name, action) {
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  page.setDefaultTimeout(1500);
  const errors=[]; page.on('pageerror', error=>errors.push(error.message));
  try {
    if (transport === 'http') await page.goto(url);
    else {
      await page.setContent(html.replace(/<script type="module">[\s\S]*?<\/script>/, ''));
      await page.evaluate(async ({arsenalText,screenText,harness})=>{
        const moduleURL=text=>URL.createObjectURL(new Blob([text],{type:'text/javascript'}));
        const arsenalURL=moduleURL(arsenalText);
        const screenURL=moduleURL(screenText.replace("'../data/hunterArsenal.js'",JSON.stringify(arsenalURL)));
        const fixtureURL=moduleURL(harness.replace("'/js/ui/LoadoutScreen.js'",JSON.stringify(screenURL)).replace("'/js/data/hunterArsenal.js'",JSON.stringify(arsenalURL)));
        try { await import(fixtureURL); }
        finally { for(const url of [arsenalURL,screenURL,fixtureURL]) URL.revokeObjectURL(url); }
      },{arsenalText,screenText,harness});
    }
    await page.waitForFunction(()=>window.ready===true,{},{timeout:3000});
    await action(page);
    assert.deepEqual(errors, [], 'unexpected browser errors');
    rows.push({name,passed:true}); console.log(`PASS ${name}`);
  } catch(error) { rows.push({name,passed:false,error:String(error.stack??error)}); console.log(`FAIL ${name}: ${error.message}`); }
  finally { await page.close(); }
}
const select = (page,id,mode='faithful')=>page.evaluate(([id,mode])=>window.selectContext(id,mode),[id,mode]);
const selection = page=>page.evaluate(()=>window.readSelection());
const click = (page,slot,id)=>page.locator(`.loadout-${slot}-btn[data-item="${id}"]`).click();
try {
  browser = await chromium.launch({headless:true,executablePath:process.env.YHW_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
  for(const row of expected) await check(`${row.id}: reference choices, summary and confirmed kit agree`,async page=>{
    await select(page,row.id);
    assert.deepEqual(await selection(page),{primary:row.primary,secondary:row.secondary,gadgets:row.gadgets});
    const summary=await page.locator('#loadout-reference-summary').textContent();
    assert.ok(summary.includes(row.labels.primary)); assert.ok(summary.includes(row.labels.special));
    for(const slot of ['primary','secondary']) {
      const buttons=await page.locator(`.loadout-${slot}-btn`).evaluateAll(nodes=>nodes.map(node=>({id:node.dataset.item,disabled:node.disabled,hidden:node.hidden,selected:node.getAttribute('aria-pressed')})));
      assert.equal(buttons.filter(item=>item.selected==='true').length,1);
      assert.ok(buttons.some(item=>item.id===row[slot]&&!item.disabled&&!item.hidden&&item.selected==='true'));
      for(const button of buttons.filter(item=>!item.disabled)) assert.equal(await page.evaluate(([id,slot,item])=>window.resolver(id,{fidelityMode:'faithful',[slot]:item})[slot],[row.id,slot,button.id]),button.id);
    }
    await page.locator('#btn-confirm-loadout').click();
    const received=await page.evaluate(()=>window.received);
    assert.equal(received.length,1);
    assert.deepEqual(received[0],{fidelityMode:'faithful',primary:row.primary,secondary:row.secondary,gadgets:row.gadgets,ranged:row.ranged,referenceKnown:true,plasma:row.ranged==='plasma_caster'?'single_caster':row.ranged});
    assert.equal(await page.locator('#loadout-prep-screen').isVisible(),false);
  });
  await check('adapted mode exposes ten implemented choices in each slot and six gadgets',async page=>{
    await select(page,'jungle_hunter','adapted');
    for(const slot of ['primary','secondary']) assert.equal(await page.locator(`.loadout-${slot}-btn:not([disabled])`).count(),10);
    assert.equal(await page.locator('.loadout-gadget-btn:not([disabled])').count(),6);
    await click(page,'primary','viking_axe');await click(page,'secondary','crossbow');
    assert.equal((await selection(page)).primary,'viking_axe');assert.equal((await selection(page)).secondary,'crossbow');
  });
  await check('reference mode rejects a synthetic click on hidden disallowed equipment',async page=>{
    await select(page,'jungle_hunter');
    const before=await selection(page);
    await page.locator('.loadout-secondary-btn[data-item="smart_disc"]').dispatchEvent('click');
    await page.locator('.loadout-gadget-btn[data-item="bear_trap"]').dispatchEvent('click');
    assert.deepEqual(await selection(page),before);
  });
  await check('mode and character changes retain separate chosen kits',async page=>{
    await select(page,'city_hunter','adapted');await click(page,'primary','katana');
    await select(page,'city_hunter');await click(page,'primary','wristblades');
    await select(page,'feral_predator');assert.equal((await selection(page)).secondary,'crossbow');
    await select(page,'city_hunter');assert.equal((await selection(page)).primary,'wristblades');
    await select(page,'city_hunter','adapted');assert.equal((await selection(page)).primary,'katana');
  });
  await check('gadget cap has feedback, replacing and selecting zero gadgets remain possible',async page=>{
    await select(page,'wolf_predator');
    await click(page,'gadget','mines');assert.match(await page.locator('#loadout-feedback').textContent(),/Deux gadgets maximum/);
    assert.deepEqual((await selection(page)).gadgets,['medicomp','acid_solvent']);
    await click(page,'gadget','acid_solvent');await click(page,'gadget','mines');
    assert.deepEqual((await selection(page)).gadgets,['medicomp','mines']);
    await click(page,'gadget','medicomp');await click(page,'gadget','mines');
    await page.locator('#btn-confirm-loadout').click();
    assert.deepEqual(await page.evaluate(()=>window.received[0].gadgets),[]);
  });
  await check('the real screen-opening observer refreshes a changed character on replay',async page=>{
    await select(page,'jungle_hunter');
    await page.evaluate(()=>document.getElementById('loadout-prep-screen').classList.add('hidden'));
    await page.evaluate(()=>{window.gameInstance.ui.selectedChar={id:'viking_predator'};document.getElementById('loadout-prep-screen').classList.remove('hidden')});
    await page.waitForFunction(()=>window.prep.selectedPrimary==='viking_axe');
    assert.equal(await page.locator('.loadout-primary-btn[data-item="viking_axe"]').isVisible(),true);
  });
  await check('unknown and inherited-property reference ids cannot deploy',async page=>{
    for(const id of ['missing','constructor','__proto__']) {
      await select(page,id);
      assert.equal(await page.locator('#btn-confirm-loadout').isDisabled(),true);
      await page.locator('#btn-confirm-loadout').dispatchEvent('click');
    }
    assert.deepEqual(await page.evaluate(()=>window.received),[]);
    assert.match(await page.locator('#loadout-feedback').textContent(),/kit de référence/);
  });
  await check('confirmation revalidates changed fields and mode without trusting the preview',async page=>{
    await select(page,'jungle_hunter');
    await page.evaluate(()=>{window.prep.selectedPrimary='katana';window.prep.selectedSecondary='plasma_whip';window.prep.selectedGadgets=['bear_trap','nuke','nuke']});
    await page.locator('#btn-confirm-loadout').click();
    const config=await page.evaluate(()=>window.received[0]);
    assert.equal(config.primary,'wristblades');assert.equal(config.secondary,'wristblades');assert.deepEqual(config.gadgets,['nuke']);
  });
  await check('repeated confirmation is single-use until the screen is reopened',async page=>{
    await select(page,'city_hunter');
    await page.evaluate(()=>{const b=document.getElementById('btn-confirm-loadout');b.click();b.click()});
    assert.equal(await page.evaluate(()=>window.received.length),1);
    await page.evaluate(()=>document.getElementById('loadout-prep-screen').classList.remove('hidden'));
    await page.locator('#btn-confirm-loadout').click();assert.equal(await page.evaluate(()=>window.received.length),2);
  });
  await check('confirmation hands off a private gadget array',async page=>{
    await select(page,'city_hunter');await page.locator('#btn-confirm-loadout').click();
    await page.evaluate(()=>window.received[0].gadgets.push('forged'));
    assert.deepEqual((await selection(page)).gadgets,['medicomp','nuke']);
  });
  await check('a failed deployment restores the same kit and exposes a retry message',async page=>{
    await select(page,'city_hunter');await click(page,'primary','wristblades');
    const before=await selection(page);
    assert.equal(await page.evaluate(()=>{window.failNext=true;try{window.prep.confirmLoadout()}catch(e){return e.message}}),'fixture deployment rejected');
    assert.equal(await page.locator('#loadout-prep-screen').isVisible(),true);
    assert.deepEqual(await selection(page),before);
    assert.match(await page.locator('#loadout-feedback').textContent(),/Déploiement interrompu/);
    await page.locator('#btn-confirm-loadout').click();assert.equal(await page.evaluate(()=>window.received.length),1);
  });
  await check('focus moves away from a disallowed option and keyboard confirmation works',async page=>{
    await select(page,'jungle_hunter','adapted');
    await page.locator('.loadout-primary-btn[data-item="katana"]').focus();
    await select(page,'jungle_hunter');
    assert.equal(await page.evaluate(()=>document.activeElement?.dataset.item),'wristblades');
    await page.locator('#btn-confirm-loadout').focus();await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>window.received.length),1);
  });
  await check('references remain inspectable and do not claim a certified 1:1 asset',async page=>{
    await select(page,'wolf_predator');await page.locator('#loadout-reference-details summary').click();
    const links=await page.locator('#loadout-reference-details a').evaluateAll(nodes=>nodes.map(node=>({href:node.href,rel:node.rel})));
    assert.ok(links.some(link=>link.href.includes('prime1studio.com')));
    assert.ok(links.every(link=>link.rel.includes('noopener')&&link.rel.includes('noreferrer')));
    assert.match(await page.locator('#loadout-reference-details').textContent(),/aucune fidélité visuelle 1:1 n’est certifiée/);
  });
  await check('dispose is idempotent, removes listeners and reconstruction adds no duplicate controls',async page=>{
    await select(page,'city_hunter');
    await page.evaluate(()=>{window.prep.dispose();window.prep.dispose();document.getElementById('btn-confirm-loadout').click()});
    assert.equal(await page.evaluate(()=>window.received.length),0);
    assert.equal(await page.locator('#loadout-reference-summary').count(),0);
    await page.evaluate(()=>{window.prep=window.makeScreen()});
    assert.equal(await page.locator('.loadout-primary-btn').count(),10);
    assert.equal(await page.locator('#loadout-reference-summary').count(),1);
    await page.locator('#btn-confirm-loadout').click();assert.equal(await page.evaluate(()=>window.received.length),1);
  });
  const report={schemaVersion:1,checkedAtUtc:new Date().toISOString(),sourceRoot:source,node:process.version,browser:await browser.version(),playwrightModule:process.env.YHW_PLAYWRIGHT_MODULE??'project:playwright',chromiumExecutable:process.env.YHW_CHROMIUM_EXECUTABLE??'playwright-managed',transport,moduleResolution:transport==='memory'?'Only import URL specifiers replaced with blob URLs; class and resolver bodies unchanged.':'Native HTTP ES-module imports',scope:'Actual LoadoutScreen class, existing HTML structure, real browser DOM/events/focus; isolated component, not full gameplay or full-game responsive QA.',fidelity1to1Verified:false,tests:rows.length,passed:rows.filter(row=>row.passed).length,failed:rows.filter(row=>!row.passed).length,results:rows};
  await mkdir(output,{recursive:true});await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({tests:report.tests,passed:report.passed,failed:report.failed}));process.exitCode=report.failed?1:0;
} finally { await browser?.close();await new Promise(resolve=>server.close(resolve)); }
