/* global setTimeout, localStorage, window, document, EventTarget, Event */
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const output = path.resolve('reports/b2-repair');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PAD_CHROMIUM_EXECUTABLE,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  await page.route('https://pad.test/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const file = path.resolve(
      '.vite/renderer/main_window',
      pathname === '/' ? 'index.html' : pathname.slice(1),
    );
    await route.fulfill({
      body: await readFile(file),
      contentType: file.endsWith('.js')
        ? 'text/javascript'
        : file.endsWith('.css')
          ? 'text/css'
          : 'text/html',
    });
  });
  await page.addInitScript(() => {
    const createElement = document.createElement.bind(document);
    document.createElement = (tag, options) => {
      if (tag !== 'audio') return createElement(tag, options);
      const element = Object.assign(new EventTarget(), {
        autoplay: false,
        loop: false,
        src: '',
        currentTime: 0,
        duration: 60,
        pause() {},
        load() {},
        removeAttribute() {},
      });
      element.play = () => {
        element.dispatchEvent(new Event('playing'));
        element.currentTime = 10;
        element.dispatchEvent(new Event('timeupdate'));
        return Promise.resolve();
      };
      return element;
    };
    const uuid = (n) =>
      `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    let catalog = JSON.parse(localStorage.getItem('catalog') || 'null') || {
      schemaVersion: 1,
      revision: 0,
      assets: [],
      pads: [],
      repertoire: { id: uuid(1), name: 'Repertório', padIds: [] },
    };
    const ok = (value) => Promise.resolve({ ok: true, value });
    const save = () => {
      catalog.revision++;
      localStorage.setItem('catalog', JSON.stringify(catalog));
      return new Promise((resolve) =>
        setTimeout(
          () => resolve({ ok: true, value: structuredClone(catalog) }),
          100,
        ),
      );
    };
    window.pad = {
      openSession: () => ok(uuid(2)),
      getCatalog: () => ok(catalog),
      getAppInfo: () => Promise.resolve({ version: 'test' }),
      acquire: (request) => ok({ ...request, leaseId: uuid(3) }),
      release: () => ok(null),
      disposeSession: () => ok(null),
      importAudio: () => {
        for (let i = 0; i < 31; i++) {
          const id = uuid(100 + i);
          catalog.pads.push({
            id,
            assetId: uuid(200 + i),
            label: `Faixa ${i + 1}`,
            color: 'slate',
          });
          catalog.assets.push({
            id: uuid(200 + i),
            name: `Faixa ${i + 1}`,
            durationSeconds: 60,
          });
          catalog.repertoire.padIds.push(id);
        }
        return save();
      },
      updatePad: (request) => {
        if (localStorage.getItem('fail') === 'yes')
          return Promise.resolve({
            ok: false,
            error: { code: 'storage-failure' },
          });
        const pad = catalog.pads.find((p) => p.id === request.padId);
        pad.label = request.label;
        pad.color = request.color;
        return save();
      },
      reorderPads: (request) => {
        catalog.repertoire.padIds = request.padIds;
        return save();
      },
      deletePad: (request) => {
        if (localStorage.getItem('failDelete') === 'yes')
          return Promise.resolve({
            ok: false,
            error: { code: 'storage-failure' },
          });

        catalog.pads = catalog.pads.filter((p) => p.id !== request.padId);
        catalog.repertoire.padIds = catalog.repertoire.padIds.filter(
          (id) => id !== request.padId,
        );
        if (localStorage.getItem('failDelete') === 'cleanup')
          return save().then(() => ({
            ok: false,
            error: { code: 'cleanup-required' },
          }));
        return save();
      },
    };
  });
  await page.goto('https://pad.test/');
  await page.getByRole('button', { name: 'Importar áudio' }).click();
  await page.locator('.pad-editor').first().waitFor();
  const observations = [];
  const input = page.locator('.pad-editor input').first();
  await input.fill('Unsaved draft');
  await page.evaluate(() => localStorage.setItem('fail', 'yes'));
  await page
    .getByRole('button', { name: 'Salvar nome', exact: true })
    .first()
    .click();
  await page.getByRole('alert').waitFor();
  await page.getByRole('button', { name: 'Concluir edição' }).click();
  assert.equal(
    await page.getByRole('button', { name: 'Editar repertório' }).count(),
    0,
  );
  assert.equal(await input.inputValue(), 'Unsaved draft');
  observations.push({
    case: 'failed draft after conclude',
    label: await input.inputValue(),
    alert: await page.getByRole('alert').innerText(),
  });
  await page.evaluate(() => localStorage.removeItem('fail'));
  await page.getByRole('button', { name: 'Concluir edição' }).click();
  await page.getByRole('button', { name: 'Editar repertório' }).click();
  assert.equal(await input.inputValue(), 'Unsaved draft');
  const remove = page
    .locator('.pad-editor')
    .first()
    .getByRole('button', { name: 'Excluir Unsaved draft', exact: true });
  await remove.click();
  observations.push({
    case: 'dialog initial focus',
    focus: await page.evaluate(() => document.activeElement.textContent),
  });
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  observations.push({
    case: 'dialog cancel focus',
    focus: await page.evaluate(() => ({
      tag: document.activeElement.tagName,
      text: document.activeElement.textContent.slice(0, 100),
    })),
  });
  await page.waitForFunction(
    () => document.activeElement?.textContent === 'Excluir Unsaved draft',
  );
  assert.equal(
    await remove.evaluate((el) => el === document.activeElement),
    true,
  );
  await remove.click();
  await page.evaluate(() => localStorage.setItem('failDelete', 'yes'));
  await page
    .getByRole('button', { name: 'Confirmar exclusão', exact: true })
    .click();
  await page.getByRole('dialog').getByRole('alert').waitFor();
  await page.evaluate(() => localStorage.setItem('failDelete', 'cleanup'));
  await page
    .getByRole('button', { name: 'Confirmar exclusão', exact: true })
    .click();
  await page.waitForFunction(
    () => document.activeElement?.textContent === 'Concluir edição',
  );
  assert.equal(await page.locator('.pad-item').count(), 30);
  await page
    .getByRole('alert')
    .filter({ hasText: 'cleanup-required' })
    .waitFor();
  await page
    .locator('.pad-editor')
    .first()
    .getByRole('button', { name: 'Cor blue' })
    .click();
  await page.locator('.pad-item.color-blue').first().waitFor();
  assert.match(await page.getByRole('alert').innerText(), /cleanup-required/);
  observations.push({
    case: 'committed cleanup failure',
    remainingPads: 30,
    focusRestoredAfterDeletion: true,
    cleanupWarningPersistsAfterColorSave: true,
  });
  await page.screenshot({ path: 'reports/b2-repair/repaired.png' });
  console.log(JSON.stringify(observations, null, 2));
} finally {
  await browser.close();
}
