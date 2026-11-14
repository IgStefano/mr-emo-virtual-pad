// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  act,
  screen,
  waitFor,
} from '@testing-library/react';
import { usePad } from '../../src/renderer/performance/use-pad';
import { Pad } from '../../src/renderer/performance/pad';
import { connectDesktop } from '../../src/renderer/runtime/desktop';
import { createDesktopApi } from '../../src/preload/desktop-bridge';
import { desktopOperations } from '../../src/contracts/desktop';
import { catalogSchema, padIdSchema } from '../../src/contracts/catalog';

function first<T>(items: T[]): T {
  const item = items[0];
  if (item === undefined) throw new Error('Expected a rendered control');
  return item;
}
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
async function setup(empty = false) {
  let catalog = catalogSchema.parse({
    schemaVersion: 1,
    revision: 0,
    assets: [1, 2].map((n) => ({
      id: id(n + 10),
      name: `${String(n)}.wav`,
      durationSeconds: 60,
    })),
    pads: [1, 2].map((n) => ({
      id: id(n),
      assetId: id(n + 10),
      label: `Track ${String(n)}`,
      color: 'blue',
    })),
    repertoire: { id: id(20), name: 'Show', padIds: [id(1), id(2)] },
  });
  if (empty)
    catalog = {
      ...catalog,
      pads: [],
      assets: [],
      repertoire: { ...catalog.repertoire, padIds: [] },
    };
  let fail = false;
  let partial = false;
  const api = createDesktopApi(async (channel, payload) => {
    await Promise.resolve();
    if (channel === 'catalog:open') return { ok: true, value: id(30) };
    if (channel === 'catalog:acquire')
      return {
        ok: true,
        value: {
          sessionId: id(30),
          leaseId: id(31),
          kind: desktopOperations.acquire.request.parse(payload).kind,
          attemptId: 1,
        },
      };
    if (channel === 'catalog:read') return { ok: true, value: catalog };
    if (channel === 'catalog:update') {
      if (fail) return { ok: false, error: { code: 'storage-failure' } };
      const request = desktopOperations.updatePad.request.parse(payload);
      catalog = {
        ...catalog,
        revision: catalog.revision + 1,
        pads: catalog.pads.map((p) =>
          p.id === request.padId
            ? { ...p, label: request.label, color: request.color }
            : p,
        ),
      };
      return { ok: true, value: catalog };
    }
    if (channel === 'catalog:reorder') {
      const request = desktopOperations.reorderPads.request.parse(payload);
      catalog = {
        ...catalog,
        revision: catalog.revision + 1,
        repertoire: { ...catalog.repertoire, padIds: request.padIds },
      };
      return { ok: true, value: catalog };
    }
    if (channel === 'catalog:import') {
      catalog = catalogSchema.parse({
        ...catalog,
        revision: catalog.revision + 1,
        assets: [
          ...catalog.assets,
          { id: id(13), name: '3.wav', durationSeconds: 60 },
        ],
        pads: [
          ...catalog.pads,
          { id: id(3), assetId: id(13), label: 'Track 3', color: 'blue' },
        ],
        repertoire: {
          ...catalog.repertoire,
          padIds: [...catalog.repertoire.padIds, id(3)],
        },
      });
      return { ok: true, value: catalog };
    }
    if (channel === 'catalog:delete') {
      if (fail) return { ok: false, error: { code: 'storage-failure' } };
      catalog = {
        ...catalog,
        revision: catalog.revision + 1,
        pads: catalog.pads.slice(1),
        repertoire: {
          ...catalog.repertoire,
          padIds: [padIdSchema.parse(id(2))],
        },
      };
      if (partial) return { ok: false, error: { code: 'cleanup-required' } };
      return { ok: true, value: catalog };
    }
    return { ok: true, value: null };
  });
  const runtime = await connectDesktop(api);
  render(createElement(Pad, { runtime }));
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Editar repertório' }));
  return {
    runtime,
    fail: (value: boolean) => {
      fail = value;
    },
    partial: () => {
      partial = true;
    },
  };
}
it('retains a failed draft through direct conclusion, then retries and persists it', async () => {
  const port = await setup();
  port.fail(true);
  fireEvent.change(first(screen.getAllByRole('textbox')), {
    target: { value: 'Novo' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Concluir edição' }));
  await screen.findByText(/Não foi possível salvar/);
  expect(first(screen.getAllByRole('textbox'))).toHaveProperty('value', 'Novo');
  expect(screen.getByRole('button', { name: 'Concluir edição' })).toBeTruthy();
  expect(screen.getByRole('alert').textContent).not.toContain(
    'storage-failure',
  );
  port.fail(false);
  fireEvent.click(screen.getByRole('button', { name: 'Concluir edição' }));
  await screen.findByRole('button', { name: 'Editar repertório' });
  expect(port.runtime.catalog.pads[0]?.label).toBe('Novo');
});
it('saves a draft on direct color and delete, restores cancel focus, and reconciles partial deletion', async () => {
  const port = await setup();
  fireEvent.change(first(screen.getAllByRole('textbox')), {
    target: { value: 'Renomeado' },
  });
  fireEvent.click(first(screen.getAllByRole('button', { name: 'Cor red' })));
  await waitFor(() => {
    expect(port.runtime.catalog.pads[0]).toMatchObject({
      label: 'Renomeado',
      color: 'red',
    });
  });
  const origin = screen.getByRole('button', { name: 'Excluir Renomeado' });
  fireEvent.click(origin);
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  await waitFor(() => {
    expect(document.activeElement).toBe(origin);
  });
  port.partial();
  fireEvent.click(origin);
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  expect(
    screen.queryByRole('button', { name: 'Excluir Renomeado' }),
  ).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain('Feche e reabra');
  expect(screen.getByRole('alert').textContent).not.toContain(
    'cleanup-required',
  );
  await waitFor(() => {
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Concluir edição' }),
    );
  });
});

it('saves directly before both move buttons and drag, and ignores a drop without a source', async () => {
  const port = await setup();
  fireEvent.change(first(screen.getAllByRole('textbox')), {
    target: { value: 'Moved' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Mover Track 1 para baixo' }),
  );
  await waitFor(() => {
    expect(port.runtime.catalog.repertoire.padIds).toEqual([id(2), id(1)]);
  });
  expect(port.runtime.catalog.pads[0]?.label).toBe('Moved');
  fireEvent.click(
    screen.getByRole('button', { name: 'Mover Moved para cima' }),
  );
  await waitFor(() => {
    expect(port.runtime.catalog.repertoire.padIds).toEqual([id(1), id(2)]);
  });
  const source = screen.getByRole('button', {
    name: 'Mover Moved',
  });
  const target = screen.getByRole('button', {
    name: 'Mover Track 2',
  });
  const drop = new Event('drop', { bubbles: true, cancelable: true });
  fireEvent(target, drop);
  expect(drop.defaultPrevented).toBe(true);
  await waitFor(() => {
    expect(screen.queryByText('Salvando…')).toBeNull();
  });
  expect(screen.queryByRole('alert')).toBeNull();
  expect(port.runtime.catalog.repertoire.padIds).toEqual([id(1), id(2)]);
  fireEvent.dragStart(source);
  const over = new Event('dragover', { bubbles: true, cancelable: true });
  fireEvent(target, over);
  expect(over.defaultPrevented).toBe(true);
  const revision = port.runtime.catalog.revision;
  fireEvent.drop(source);
  await waitFor(() => {
    expect(screen.queryByText('Salvando…')).toBeNull();
  });
  expect(port.runtime.catalog.revision).toBe(revision);
  expect(port.runtime.catalog.repertoire.padIds).toEqual([id(1), id(2)]);
  fireEvent.dragStart(source);
  fireEvent.drop(target);
  await waitFor(() => {
    expect(port.runtime.catalog.repertoire.padIds).toEqual([id(2), id(1)]);
  });
  const committedRevision = port.runtime.catalog.revision;
  fireEvent.drop(target);
  await waitFor(() => {
    expect(screen.queryByText('Salvando…')).toBeNull();
  });
  expect(port.runtime.catalog.revision).toBe(committedRevision);
  expect(port.runtime.catalog.repertoire.padIds).toEqual([id(2), id(1)]);
});
it('keeps a failed deletion open and retries without losing the catalog', async () => {
  const port = await setup();
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Track 1' }));
  await screen.findByRole('dialog');
  port.fail(true);
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
  await screen.findAllByText(/Não foi possível salvar/);
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(port.runtime.catalog.pads).toHaveLength(2);
  port.fail(false);
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  expect(port.runtime.catalog.pads).toHaveLength(1);
});
it('saves explicit names, blocks empty drafts, saves before import, and clears a previous error', async () => {
  const port = await setup();
  fireEvent.change(first(screen.getAllByRole('textbox')), {
    target: { value: '  Explicit  ' },
  });
  fireEvent.click(
    first(screen.getAllByRole('button', { name: 'Salvar nome' })),
  );
  await waitFor(() => {
    expect(port.runtime.catalog.pads[0]?.label).toBe('Explicit');
  });
  fireEvent.change(first(screen.getAllByRole('textbox')), {
    target: { value: '   ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Concluir edição' }));
  await screen.findByText(/Não foi possível salvar/);
  expect(port.runtime.catalog.pads[0]?.label).toBe('Explicit');
  fireEvent.change(first(screen.getAllByRole('textbox')), {
    target: { value: 'Imported' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Importar áudio' }));
  await waitFor(() => {
    expect(port.runtime.catalog.pads[0]?.label).toBe('Imported');
  });
  await screen.findByRole('button', { name: 'Excluir Track 3' });
  expect(screen.queryByText(/Não foi possível salvar/)).toBeNull();
});

it('imports from the empty surface and leaves editing open', async () => {
  await setup(true);
  fireEvent.click(screen.getByRole('button', { name: 'Concluir edição' }));
  await screen.findByRole('button', { name: 'Editar repertório' });
  fireEvent.click(screen.getByRole('button', { name: 'Importar áudio' }));
  await screen.findByRole('button', { name: 'Excluir Track 3' });
  await waitFor(() => {
    expect(screen.queryByText('Salvando…')).toBeNull();
  });
});
it('locks switching and editing until STOP using a controlled media port', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  const port = await setup();
  fireEvent.click(screen.getByRole('button', { name: 'Concluir edição' }));
  await screen.findByRole('button', { name: 'Editar repertório' });
  fireEvent.click(screen.getByRole('button', { name: /1Track 1/ }));
  await waitFor(() => {
    expect(port.runtime.playback.snapshot().busy).toBe(true);
  });
  expect(
    screen.getByRole('button', { name: 'Editar repertório' }),
  ).toHaveProperty('disabled', true);
  expect(screen.getByRole('button', { name: /2Track 2/ })).toHaveProperty(
    'disabled',
    true,
  );
  fireEvent.click(screen.getByRole('button', { name: 'STOP' }));
  await waitFor(() => {
    expect(port.runtime.playback.snapshot().busy).toBe(false);
  });
  expect(
    screen.getByRole('button', { name: 'Editar repertório' }),
  ).toHaveProperty('disabled', false);
});

it('preserves multiple drafts and never resaves a committed draft when another save fails', async () => {
  const port = await setup();
  const inputs = screen.getAllByRole('textbox');
  fireEvent.change(first(inputs), { target: { value: '  First  ' } });
  fireEvent.change(first(inputs.slice(1)), { target: { value: 'Second' } });
  const update = port.runtime.update;
  vi.spyOn(port.runtime, 'update').mockImplementation(async (pad) => {
    if (pad.label === 'Second') throw new Error('controlled write failure');
    return update(pad);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Concluir edição' }));
  await screen.findByText(/Não foi possível salvar/);
  expect(port.runtime.catalog.pads[0]?.label).toBe('First');
  expect(first(screen.getAllByRole('textbox'))).toHaveProperty(
    'value',
    'First',
  );
  expect(first(screen.getAllByRole('textbox').slice(1))).toHaveProperty(
    'value',
    'Second',
  );
  vi.restoreAllMocks();
  fireEvent.click(screen.getByRole('button', { name: 'Concluir edição' }));
  await screen.findByRole('button', { name: 'Editar repertório' });
  expect(port.runtime.catalog.revision).toBe(2);
  expect(port.runtime.catalog.pads.map((pad) => pad.label)).toEqual([
    'First',
    'Second',
  ]);
});
it('keeps controls locked for the whole save and exposes a plain playback/STOP failure', async () => {
  const port = await setup();
  let rejectPending: (reason: string) => void = () => {};
  const pending = new Promise<typeof port.runtime.catalog>(
    (_resolve, reject) => {
      rejectPending = reject;
    },
  );
  vi.spyOn(port.runtime, 'update').mockReturnValue(pending);
  fireEvent.change(first(screen.getAllByRole('textbox')), {
    target: { value: 'Pending' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Concluir edição' }));
  await screen.findByText('Salvando…');
  expect(
    screen.getByRole('button', { name: 'Concluir edição' }),
  ).toHaveProperty('disabled', true);
  rejectPending('cleanup-required');
  await screen.findByText(/Não foi possível salvar/);
  expect(screen.queryByText(/Catálogo atualizado/)).toBeNull();
  vi.restoreAllMocks();
  fireEvent.click(screen.getByRole('button', { name: 'Concluir edição' }));
  await screen.findByRole('button', { name: 'Editar repertório' });
  vi.spyOn(port.runtime.playback, 'play').mockRejectedValue(
    new Error('controlled playback port'),
  );
  fireEvent.click(screen.getByRole('button', { name: /1Pending/ }));
  await screen.findByText('Falha na reprodução. Pressione STOP.');
  vi.spyOn(port.runtime.playback, 'stop').mockRejectedValue(
    new Error('controlled stop port'),
  );
  fireEvent.click(screen.getByRole('button', { name: 'STOP' }));
  await screen.findByText('Falha ao parar. Tente STOP novamente.');
});
it('does not open deletion after a draft failure, and dismisses confirmation with Escape', async () => {
  const port = await setup();
  port.fail(true);
  fireEvent.change(first(screen.getAllByRole('textbox')), {
    target: { value: 'Draft' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Track 1' }));
  await screen.findByText(/Não foi possível salvar/);
  expect(screen.queryByRole('dialog')).toBeNull();
  port.fail(false);
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Track 1' }));
  await screen.findByRole('dialog');
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Excluir Draft' }),
  );
});
it('retains a cleanup warning after another successful save and refuses blank recoloring', async () => {
  const port = await setup();
  fireEvent.change(first(screen.getAllByRole('textbox')), {
    target: { value: '   ' },
  });
  fireEvent.click(first(screen.getAllByRole('button', { name: 'Cor red' })));
  await screen.findByText(/Não foi possível salvar/);
  expect(port.runtime.catalog.pads[0]?.color).toBe('blue');
  fireEvent.change(first(screen.getAllByRole('textbox')), {
    target: { value: 'Track 1' },
  });
  fireEvent.click(first(screen.getAllByRole('button', { name: 'Cor red' })));
  await waitFor(() => {
    expect(port.runtime.catalog.revision).toBe(1);
  });
  port.partial();
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Track 1' }));
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  fireEvent.click(first(screen.getAllByRole('button', { name: 'Cor red' })));
  await waitFor(() => {
    expect(port.runtime.catalog.revision).toBe(3);
  });
  expect(screen.getByRole('alert').textContent).toContain('Feche e reabra');
});
it('trims names on direct recolor and reports explicit saves as complete', async () => {
  const port = await setup();
  fireEvent.change(first(screen.getAllByRole('textbox')), {
    target: { value: '  Color  ' },
  });
  fireEvent.click(first(screen.getAllByRole('button', { name: 'Cor red' })));
  await waitFor(() => {
    expect(port.runtime.catalog.pads[0]).toMatchObject({
      label: 'Color',
      color: 'red',
    });
  });
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.change(first(screen.getAllByRole('textbox')), {
    target: { value: '  Save  ' },
  });
  fireEvent.click(
    first(screen.getAllByRole('button', { name: 'Salvar nome' })),
  );
  await waitFor(() => {
    expect(screen.queryByText('Salvando…')).toBeNull();
  });
  expect(screen.queryByRole('alert')).toBeNull();
  expect(port.runtime.catalog.pads[0]?.label).toBe('Save');
});
it('prevents Escape from dismissing a deletion that is still saving', async () => {
  const port = await setup();
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Track 1' }));
  await screen.findByRole('dialog');
  let rejectSave: (error: Error) => void = () => {};
  vi.spyOn(port.runtime, 'edit').mockReturnValue(
    new Promise((_resolve, reject) => {
      rejectSave = reject;
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
  await screen.findByText('Salvando…');
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.getByRole('dialog')).toBeTruthy();
  rejectSave(new Error('controlled deletion failure'));
  await screen.findAllByText(/Não foi possível salvar/);
  expect(screen.getByRole('dialog')).toBeTruthy();
});

it('can restore focus safely before attachment and after the originating view disappears', async () => {
  const port = await setup();
  const hook = renderHook(() => usePad(port.runtime));
  expect(() => {
    hook.result.current.restoreFocus();
  }).not.toThrow();
  fireEvent.click(screen.getByRole('button', { name: 'Excluir Track 1' }));
  await screen.findByRole('dialog');
  screen
    .getByRole('button', { name: 'Excluir Track 1', hidden: true })
    .remove();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  await waitFor(() => {
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Concluir edição' }),
    );
  });
  hook.unmount();
});
it('subscribes to a replacement runtime and detaches the prior playback source', async () => {
  const firstPort = await setup();
  cleanup();
  const secondPort = await setup();
  cleanup();
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  const hook = renderHook(({ runtime }) => usePad(runtime), {
    initialProps: { runtime: firstPort.runtime },
  });
  hook.rerender({ runtime: secondPort.runtime });
  const pad = secondPort.runtime.catalog.pads[0];
  if (!pad) throw new Error('Expected pad');
  await act(async () => {
    await secondPort.runtime.playback.play(pad.id, pad.assetId);
  });
  expect(hook.result.current.snapshot.busy).toBe(true);
  await act(async () => {
    await secondPort.runtime.playback.stop();
  });
  expect(hook.result.current.snapshot.busy).toBe(false);
  await act(async () => {
    await firstPort.runtime.playback.play(pad.id, pad.assetId);
  });
  expect(hook.result.current.snapshot.busy).toBe(false);
  await act(async () => {
    await firstPort.runtime.playback.stop();
  });
  hook.unmount();
});
