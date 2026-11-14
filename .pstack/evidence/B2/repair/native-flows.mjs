/* global document */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import electron from 'electron';
import { _electron } from 'playwright';
import { fixtures } from '../../../../scripts/verification/fixtures.mjs';
await mkdir('reports/b2-repair/native', { recursive: true });
const profile = await mkdtemp(
  path.resolve('reports/b2-repair/native/profile-'),
);
const sources = await mkdtemp(
  path.resolve('reports/b2-repair/native/sources-'),
);
await fixtures(sources);
const files = [];
for (let i = 1; i <= 31; i++) {
  const file = path.join(sources, `Track ${String(i).padStart(2, '0')}.wav`);
  await copyFile(path.join(sources, 'stereo.wav'), file);
  files.push(file);
}
let app;
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

  const results = [];
  for (const action of ['color', 'reorder', 'delete', 'conclude']) {
    console.error('action', action);
    const input = page.locator('.pad-editor input').first();
    const label = await input.inputValue();
    const renamed = 'Native ' + action;
    await input.fill(renamed);
    const target =
      action === 'color'
        ? page
            .locator('.pad-editor')
            .first()
            .getByRole('button', { name: 'Cor blue' })
        : action === 'reorder'
          ? page.getByRole('button', {
              name: `Mover ${label} para baixo`,
              exact: true,
            })
          : action === 'delete'
            ? page
                .locator('.pad-editor')
                .first()
                .getByRole('button', { name: `Excluir ${label}`, exact: true })
            : page.getByRole('button', { name: 'Concluir edição' });
    await target.click();
    if (action === 'conclude')
      await page.getByRole('button', { name: 'Editar repertório' }).waitFor();
    else if (action !== 'delete')
      await page
        .getByRole('region', { name: `Editar ${renamed}`, exact: true })
        .waitFor();
    if (action === 'color')
      await page.locator('.pad-item.color-blue').first().waitFor();
    if (action === 'reorder')
      assert.equal(
        await page.locator('.pad').nth(1).innerText(),
        '2\n' + renamed,
      );
    if (action === 'delete') {
      await page
        .getByRole('dialog', { name: 'Excluir ' + renamed + '?' })
        .waitFor();
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await page.waitForFunction(() =>
        document.activeElement?.textContent?.startsWith('Excluir'),
      );
    }
    if (action === 'conclude')
      assert.match(
        await page.locator('.pad').first().innerText(),
        /Native conclude/,
      );
    results.push({
      action,
      firstPad: await page.locator('.pad').first().innerText(),
      color: await page.locator('.pad-item').first().getAttribute('class'),
      dialog: await page.getByRole('dialog').count(),
      editing: await page
        .getByRole('button', { name: 'Concluir edição' })
        .count(),
    });
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  if (app) await app.close();
}
