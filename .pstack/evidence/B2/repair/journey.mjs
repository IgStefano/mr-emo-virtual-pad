/* global document */
import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  copyFile,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import electron from 'electron';
import { _electron } from 'playwright';
import { fixtures } from '../../../../scripts/verification/fixtures.mjs';
const output = path.resolve('reports/b2-repair/journey');
await mkdir('reports/B2-native', { recursive: true });
const profile = await mkdtemp(path.resolve('reports/B2-native/profile-'));
const sources = await mkdtemp(path.resolve('reports/B2-native/sources-'));
await fixtures(sources);
const files = [];
for (let i = 1; i <= 31; i++) {
  const file = path.join(sources, `Track ${String(i).padStart(2, '0')}.wav`);
  await copyFile(path.join(sources, 'stereo.wav'), file);
  files.push(file);
}
let app;
const observations = [];
async function launch() {
  app = await _electron.launch({
    executablePath: electron,
    chromiumSandbox: true,
    args: [process.cwd()],
    env: { ...process.env, PAD_VERIFICATION_DATA_DIR: profile },
  });
  const page = await app.firstWindow();
  await page.getByRole('button', { name: 'Editar repertório' }).waitFor();
  return page;
}
try {
  let page = await launch();
  await app.evaluate(({ dialog }, filePaths) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths });
  }, files);
  await page.getByRole('button', { name: 'Importar áudio' }).click();
  await page.getByRole('button', { name: 'Concluir edição' }).waitFor();
  await page
    .getByRole('region', { name: 'Editar Track 31.wav', exact: true })
    .waitFor();
  assert.equal((await readdir(path.join(profile, 'library/media'))).length, 31);
  const region = page.getByRole('region', {
    name: 'Editar Track 01.wav',
    exact: true,
  });
  await region.getByRole('textbox', { name: 'Nome' }).fill('Abertura');
  await region
    .getByRole('button', { name: 'Salvar nome', exact: true })
    .click();
  await page
    .getByRole('region', { name: 'Editar Abertura', exact: true })
    .waitFor();
  await page
    .getByRole('region', { name: 'Editar Abertura', exact: true })
    .getByRole('button', { name: 'Cor blue' })
    .click();
  await page.getByRole('button', { name: 'Mover Abertura para baixo' }).click();
  await page.getByRole('button', { name: 'Concluir edição' }).click();
  await app.close();
  app = undefined;
  page = await launch();
  const pads = page.locator('.pad');
  assert.match(await pads.nth(0).innerText(), /Track 02/);
  assert.match(await pads.nth(1).innerText(), /Abertura/);
  assert.match(
    await pads.nth(1).locator('..').getAttribute('class'),
    /color-blue/,
  );
  const media = [];
  page.on('response', (r) => {
    if (r.url().startsWith('pad-media:')) media.push(r.status());
  });
  await pads.nth(1).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[role="progressbar"]')
        ?.getAttribute('aria-valuenow') > 0,
  );
  assert.equal(
    await page.getByRole('button', { name: 'Editar repertório' }).isDisabled(),
    true,
  );
  assert.equal(await pads.nth(0).isDisabled(), true);
  assert.equal(await pads.nth(1).isDisabled(), true);
  await page.getByRole('button', { name: 'STOP', exact: true }).click();
  await page.getByRole('button', { name: 'Editar repertório' }).click();
  await page
    .getByRole('region', { name: 'Editar Track 31.wav', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, 'native-scroll.png') });
  const box = await page
    .getByRole('button', { name: 'STOP', exact: true })
    .boundingBox();
  assert.ok(
    box &&
      box.y >= 0 &&
      box.y + box.height <= ((await page.viewportSize()?.height) ?? 900),
  );
  await page
    .getByRole('button', { name: 'Excluir Track 31.wav', exact: true })
    .click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  assert.equal(await pads.count(), 31);
  await page
    .getByRole('button', { name: 'Excluir Track 31.wav', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirmar exclusão' }).click();
  await page.waitForFunction(
    () => document.querySelectorAll('.pad').length === 30,
  );
  assert.equal((await readdir(path.join(profile, 'library/media'))).length, 30);
  assert.equal((await readFile(files[30])).length > 0, true);
  assert.ok(media.includes(206) || media.includes(200));
  observations.push({
    imported: 31,
    persistedOrderAndColor: true,
    nativeMediaStatuses: media,
    playbackLocked: true,
    stopVisible: true,
    deleted: 1,
    originalPreserved: true,
  });
  await writeFile(
    path.join(output, 'native-result.json'),
    JSON.stringify(
      { status: 'PASS', mode: 'unpackaged Linux', observations },
      null,
      2,
    ),
  );
} catch (error) {
  await writeFile(
    path.join(output, 'native-result.json'),
    JSON.stringify(
      { status: 'ISSUES', error: error.stack, observations },
      null,
      2,
    ),
  );
  throw error;
} finally {
  if (app) await app.close();
  await rm(profile, { recursive: true, force: true });
}
