// "Gerar código C" dialog: header fields, C project and prefix, folder picker, file preview,
// generation on disk and settings saved with the project.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME });
  const pg = await b.newPage({ viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' });
  const errors = [];
  pg.on('pageerror', e => errors.push(e.message));
  pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const ok = (name, cond, info) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' ' + JSON.stringify(info) : '')); if (!cond) process.exitCode = 1; };
  const base = 'http://localhost:' + (process.env.PORT || 8799) + '/';
  await pg.goto(base);
  await pg.waitForFunction(() => document.body.classList.contains('ready'));
  const ws = await pg.evaluate(() => BTStore.S.backend.workspace);
  const pid = await pg.evaluate(() => { const p = BTModel.makeProject('gen_ui'); BTStore.addProject(p); return p.id; });

  await pg.evaluate(id => BTApp.generateCode(id), pid);
  await pg.waitForSelector('#genPreview .gen-file');
  ok('defaults: C project = Studio project', await pg.inputValue('#genProject') === 'gen_ui');

  // folder picker: create a folder and use it
  await pg.fill('#genOutput', ws);
  await pg.click('#genBrowse');
  await pg.waitForSelector('#genBrowser .gen-bbar');
  await pg.click('#genBrowser button:has-text("Nova pasta")');
  await pg.waitForSelector('.modal h3:text("Nova pasta")');
  await pg.locator('.modal').last().locator('input').fill('firmware');
  await pg.locator('.modal').last().locator('.btn.primary').click();
  await pg.waitForFunction(() => /\/firmware$/.test(document.querySelector('#genBrowser .gen-bpath').textContent));
  await pg.click('#genBrowser button:has-text("Usar esta pasta")');
  const out = path.join(ws, 'firmware');
  ok('picked folder fills the output', await pg.inputValue('#genOutput') === out);

  await pg.fill('#genAuthor', 'Ana');
  await pg.fill('#genEmail', 'ana@x.com');
  await pg.fill('#genVersion', '3.0');
  await pg.fill('#genCopyright', 'ACME');
  await pg.fill('#genProject', 'porta_fw');
  await pg.fill('#genPrefix', 'acme');
  await pg.waitForFunction(() => /btree_porta_fw/.test(document.getElementById('genPreview').textContent));
  const tree = await pg.locator('#genPreview').innerText();
  ok('preview shows tools/ include/ src/ with btree_<projeto>/', /tools\/[\s\S]*btree_porta_fw\/[\s\S]*porta_fw\.xml[\s\S]*include\/[\s\S]*src\//.test(tree));
  ok('preview marks new files', (tree.match(/novo/g) || []).length === 9, (tree.match(/novo/g) || []).length);

  await pg.fill('#genProject', '9bad');
  await pg.waitForTimeout(400);
  ok('invalid C name is reported', /Projeto/.test(await pg.locator('#genError').innerText()));
  await pg.click('.modal-foot .btn.primary');
  ok('generate is blocked while invalid', await pg.locator('#genProject').isVisible());
  await pg.fill('#genProject', 'porta_fw');
  await pg.waitForTimeout(400);

  await pg.click('.modal-foot .btn.primary');
  await pg.waitForSelector('.modal h3:text("Código gerado")');
  await pg.click('.modal-foot .btn.primary');
  const src = path.join(out, 'src/btree_porta_fw/btree_porta_fw_main.c');
  ok('files written in the chosen folder', fs.existsSync(src) && fs.existsSync(path.join(out, 'tools/btree_porta_fw/porta_fw.xml')));
  const text = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : '';
  ok('header and prefix applied', /@author Ana \(ana@x\.com\)/.test(text) && /@version 3\.0/.test(text) && /ACME/.test(text) && /acme_btree_porta_fw_main_/.test(text));
  ok('Monitor log name follows the C project', await pg.evaluate(id => BTModel.logNameOf(BTStore.project(id)), pid) === 'PORTA_FW');

  // the dialog opens again with the same settings, and now marks the files as existing
  await pg.evaluate(id => BTApp.generateCode(id), pid);
  await pg.waitForSelector('#genPreview .gen-file');
  const again = { project: await pg.inputValue('#genProject'), prefix: await pg.inputValue('#genPrefix'), copyright: await pg.inputValue('#genCopyright'), output: await pg.inputValue('#genOutput') };
  ok('settings remembered', JSON.stringify(again) === JSON.stringify({ project: 'porta_fw', prefix: 'acme', copyright: 'ACME', output: out }), again);
  await pg.waitForFunction(() => /mesclado/.test(document.getElementById('genPreview').textContent));
  ok('existing user files marked as kept', /mesclado, seu código é mantido/.test(await pg.locator('#genPreview').innerText()));
  ok('no page errors', !errors.length, errors);
  await b.close();
})();
