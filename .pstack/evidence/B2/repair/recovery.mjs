import { createServer } from 'vite';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const server = await createServer({ server: { middlewareMode: true } });
try {
  const { ManagedCatalog } = await server.ssrLoadModule(
    '/src/main/library/managed-catalog.ts',
  );
  const { ManagedFiles } = await server.ssrLoadModule(
    '/src/main/storage/managed-files.ts',
  );
  const { createDesktopApi } = await server.ssrLoadModule(
    '/src/preload/desktop-bridge.ts',
  );
  const { connectDesktop } = await server.ssrLoadModule(
    '/src/renderer/runtime/desktop.ts',
  );
  const root = await mkdtemp(resolve('reports/b2-repair/catalog-'));
  const source = join(root, 'original.wav');
  await writeFile(source, 'controlled validator accepts this fixture');
  const library = new ManagedCatalog(root, {
    assertEditLease() {},
    selectFiles: async () => [source],
    validateAudio: async () => ({ durationSeconds: 60 }),
  });
  const sid = '00000000-0000-4000-8000-000000000001',
    lid = '00000000-0000-4000-8000-000000000002';
  const requests = [];
  const api = createDesktopApi(async (channel, payload) => {
    requests.push({ channel, payload });
    try {
      let value;
      if (channel === 'catalog:open') value = sid;
      else if (channel === 'catalog:acquire')
        value = { ...payload, leaseId: lid };
      else if (channel === 'catalog:read') value = await library.getCatalog();
      else if (channel === 'catalog:import')
        value = await library.importAudio(payload);
      else if (channel === 'catalog:delete')
        value = await library.deletePad(payload);
      else if (channel === 'catalog:update')
        value = await library.updatePad(payload);
      else if (channel === 'catalog:reorder')
        value = await library.reorderPads(payload);
      else value = null;
      return { ok: true, value };
    } catch (error) {
      return { ok: false, error: { code: error.code } };
    }
  });
  const runtime = await connectDesktop(api);
  await runtime.edit();
  await runtime.edit();
  const originalRemove = ManagedFiles.prototype.remove;
  ManagedFiles.prototype.remove = function () {
    throw new Error('controlled unlink failure');
  };
  const deleted = runtime.catalog.pads[0];
  await assert.rejects(runtime.edit(deleted.id), /cleanup-required/);
  ManagedFiles.prototype.remove = originalRemove;
  const disk = await library.getCatalog();
  assert.equal(runtime.catalog.revision, disk.revision);
  assert.equal(runtime.catalog.pads.length, 1);
  const failures = [];
  await runtime.update({ ...runtime.catalog.pads[0], label: 'Recovered' });
  await runtime.reorder(runtime.catalog.repertoire.padIds);
  await runtime.edit();
  assert.equal(runtime.catalog.pads.length, 2);
  await runtime.edit(runtime.catalog.pads[1].id);
  assert.equal(runtime.catalog.pads.length, 1);
  library.recover(
    requests.find((r) => r.channel === 'catalog:delete').payload.lease,
  );
  const reopened = await connectDesktop(api);
  await reopened.update(reopened.catalog.pads[0]);
  console.log(
    JSON.stringify(
      {
        reopenUpdateRevision: reopened.catalog.revision,
        root,
        runtimeRevision: runtime.catalog.revision,
        diskRevision: disk.revision,
        runtimePads: runtime.catalog.pads.length,
        diskPads: disk.pads.length,
        failures,
        requests,
      },
      null,
      2,
    ),
  );
  library.close();
} finally {
  await server.close();
}
