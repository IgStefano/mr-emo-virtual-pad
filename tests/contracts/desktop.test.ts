import { expect, it } from 'vitest';
import { desktopOperations } from '../../src/contracts/desktop';
import { createDesktopApi } from '../../src/preload/desktop-bridge';
it('rejects malformed requests before invocation and malformed responses after invocation', async () => {
  let calls = 0;
  const api = createDesktopApi(() => {
    calls++;
    return Promise.resolve({});
  });
  await expect(api.openSession(null)).rejects.toThrow();
  expect(calls).toBe(1);
  await expect(api.getCatalog({ sessionId: 'forged' })).rejects.toThrow();
  expect(calls).toBe(1);
  await expect(api.getAppInfo()).rejects.toThrow();
  expect(Object.keys(api).sort()).toEqual(
    [...Object.keys(desktopOperations), 'getAppInfo'].sort(),
  );
  for (const operation of Object.values(desktopOperations)) {
    expect(
      operation.request.safeParse({
        path: '/tmp/audio',
        channel: 'arbitrary',
        kind: 'recovery',
      }).success,
    ).toBe(false);
    expect(
      operation.response.safeParse({ ok: false, error: { code: 'invented' } })
        .success,
    ).toBe(false);
    expect(operation.response.safeParse({ ok: true, value: {} }).success).toBe(
      false,
    );
  }
});
it('preserves the raw app info wire', async () => {
  const api = createDesktopApi((channel, payload) => {
    expect(channel).toBe('app:info');
    expect(payload).toBeUndefined();
    return Promise.resolve({ version: '1' });
  });
  expect(await api.getAppInfo()).toEqual({ version: '1' });
});

it('freezes the finite wire channels independently of the bridge and registration', () => {
  expect(
    Object.fromEntries(
      Object.entries(desktopOperations).map(([name, operation]) => [
        name,
        operation.channel,
      ]),
    ),
  ).toEqual({
    openSession: 'catalog:open',
    getCatalog: 'catalog:read',
    acquire: 'catalog:acquire',
    release: 'catalog:release',
    disposeSession: 'catalog:dispose',
    importAudio: 'catalog:import',
    updatePad: 'catalog:update',
    reorderPads: 'catalog:reorder',
    deletePad: 'catalog:delete',
  });
});

it('never serializes recovery authority to or from the renderer', () => {
  const recovery = {
    sessionId: '00000000-0000-4000-8000-000000000001',
    leaseId: '00000000-0000-4000-8000-000000000002',
    kind: 'recovery',
    attemptId: 1,
  };
  expect(desktopOperations.release.request.safeParse(recovery).success).toBe(
    false,
  );
  expect(
    desktopOperations.acquire.response.safeParse({ ok: true, value: recovery })
      .success,
  ).toBe(false);
  expect(
    desktopOperations.acquire.request.safeParse({
      sessionId: recovery.sessionId,
      kind: recovery.kind,
      attemptId: 1,
    }).success,
  ).toBe(false);
});
