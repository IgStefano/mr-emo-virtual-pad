/* global localStorage, window, document, EventTarget, Event */
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const output = path.resolve('.pstack/evidence/B2');
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
      return ok(catalog);
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
        catalog.pads = catalog.pads.filter((p) => p.id !== request.padId);
        catalog.repertoire.padIds = catalog.repertoire.padIds.filter(
          (id) => id !== request.padId,
        );
        return save();
      },
    };
  });
  await page.goto('https://pad.test/');
  await page.getByRole('button', { name: 'Importar áudio' }).click();
  await page
    .getByRole('region', { name: 'Editar Faixa 1', exact: true })
    .waitFor();
  assert.equal(await page.locator('.pad').count(), 31);
  const editor = page.getByRole('region', {
    name: 'Editar Faixa 1',
    exact: true,
  });
  await editor.getByRole('textbox', { name: 'Nome' }).fill('Entrada');
  await editor.getByRole('textbox', { name: 'Nome' }).press('Tab');
  await page
    .getByRole('region', { name: 'Editar Entrada', exact: true })
    .getByRole('button', { name: 'Cor blue', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Mover Entrada', exact: true })
    .filter({ hasText: 'Arrastar' })
    .dragTo(
      page
        .getByRole('button', { name: 'Mover Faixa 2', exact: true })
        .filter({ hasText: 'Arrastar' }),
    );
  await page.waitForFunction(() =>
    document.querySelectorAll('.pad')[1]?.textContent.includes('Entrada'),
  );
  assert.match(await page.locator('.pad').nth(1).innerText(), /Entrada/);
  await page.evaluate(() => localStorage.setItem('fail', 'yes'));
  const renamed = page
    .getByRole('region', { name: 'Editar Entrada', exact: true })
    .getByRole('textbox', { name: 'Nome' });
  await renamed.fill('Falha');
  await renamed.press('Tab');
  await page
    .getByRole('alert')
    .filter({ hasText: 'Não foi possível salvar' })
    .waitFor();
  await page.evaluate(() => localStorage.removeItem('fail'));
  await renamed.fill('Entrada');
  await renamed.press('Tab');

  await page.getByRole('button', { name: 'Concluir edição' }).click();
  await page.reload();
  await page.locator('.pad').first().waitFor();
  await page.waitForFunction(() =>
    document.querySelectorAll('.pad')[1]?.textContent.includes('Entrada'),
  );
  assert.match(await page.locator('.pad').nth(1).innerText(), /Entrada/);
  assert.match(
    await page.locator('.pad-item').nth(1).getAttribute('class'),
    /color-blue/,
  );
  await page.screenshot({ path: path.join(output, 'desktop.png') });
  await page.locator('.pad').first().click();
  await page.getByRole('status').filter({ hasText: 'Reproduzindo' }).waitFor();
  assert.equal(
    await page.getByRole('button', { name: 'Editar repertório' }).isDisabled(),
    true,
  );
  assert.equal(await page.locator('.pad:not([disabled])').count(), 0);
  await page.screenshot({ path: path.join(output, 'playing.png') });
  await page.getByRole('button', { name: 'STOP', exact: true }).click();
  await page
    .getByRole('button', { name: 'Editar repertório' })
    .waitFor({ state: 'visible' });

  await page.locator('.pad').last().scrollIntoViewIfNeeded();
  assert.equal(
    await page.getByRole('button', { name: 'STOP', exact: true }).isVisible(),
    true,
  );
  await page.screenshot({ path: path.join(output, 'scroll.png') });
  await page.getByRole('button', { name: 'Editar repertório' }).click();
  await page
    .getByRole('button', { name: 'Excluir Entrada', exact: true })
    .click();
  await page.getByRole('dialog').waitFor();
  await page.screenshot({ path: path.join(output, 'delete.png') });
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  assert.equal(await page.locator('.pad').count(), 31);
  await page
    .getByRole('button', { name: 'Excluir Entrada', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirmar exclusão', exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll('.pad').length === 30,
  );
  await page.getByRole('button', { name: 'Concluir edição' }).click();
  await page.setViewportSize({ width: 560, height: 800 });
  await page.locator('.pad').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, 'narrow.png') });
  console.log(
    'PASS: renderer fixture import 31, rename, color, reorder, reload persistence, delete cancel/confirm, fixed STOP, desktop/narrow captures. Native Electron/audio not covered.',
  );
} finally {
  await browser.close();
}
