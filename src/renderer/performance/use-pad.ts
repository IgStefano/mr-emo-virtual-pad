import { useEffect, useRef, useState } from 'react';
import type * as React from 'react';
import type { DesktopRuntime } from '../runtime/desktop';
import type { Pad as CatalogPad, PadId } from '../../contracts/catalog';
import { movePad } from '../editing/order';
export function usePad(runtime: DesktopRuntime) {
  const [catalog, setCatalog] = useState(runtime.catalog);
  const [snapshot, setSnapshot] = useState(runtime.playback.snapshot());
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<PadId | null>(null);
  const deleting = catalog.pads.find((pad) => pad.id === deletingId);
  const [dragged, setDragged] = useState<PadId | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<PadId, string>>>({});
  const deleteOrigin = useRef<HTMLElement | null>(null);
  const editControl = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState('');
  const [cleanupError, setCleanupError] = useState('');
  useEffect(
    () =>
      runtime.playback.subscribe(() => {
        setSnapshot(runtime.playback.snapshot());
      }),
    [runtime],
  );
  async function save(operation?: () => Promise<typeof catalog>) {
    setSaving(true);
    setError('');
    try {
      for (const pad of runtime.catalog.pads) {
        const label = drafts[pad.id];
        if (label === undefined || label === pad.label) continue;
        await runtime.update({ ...pad, label: label.trim() });
        setDrafts((current) => {
          const next = { ...current };
          next[pad.id] = undefined;
          return next;
        });
      }
      if (operation) await operation();
      setCatalog(runtime.catalog);
      return true;
    } catch (failure) {
      setCatalog(runtime.catalog);
      if (failure instanceof Error && failure.message === 'cleanup-required')
        setCleanupError(
          'Catálogo atualizado. A limpeza da cópia interna falhou. Feche e reabra o aplicativo para tentar a limpeza novamente.',
        );
      else
        setError(
          'Não foi possível salvar. Os nomes pendentes foram mantidos. Tente salvar novamente.',
        );
      return false;
    } finally {
      setSaving(false);
    }
  }
  function toggleEditing() {
    if (!editing) setEditing(true);
    else
      void save()
        .then((saved) => {
          if (saved) setEditing(false);
        })
        .catch(() => {});
  }
  function importAudio() {
    save(() => runtime.edit()).catch(() => {});
  }
  function play(pad: CatalogPad, id: PadId) {
    runtime.playback.play(id, pad.assetId).catch(() => {
      setError('Falha na reprodução. Pressione STOP.');
    });
  }
  function startDrag(id: PadId) {
    setDragged(id);
  }
  function allowDrop(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault();
  }
  function drop(id: PadId, event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (dragged && dragged !== id) {
      const order = movePad(catalog.repertoire.padIds, dragged, id);
      save(() => runtime.reorder(order)).catch(() => {});
    }
    setDragged(null);
  }
  function moveUp(id: PadId, index: number) {
    const order = [...catalog.repertoire.padIds];
    order.splice(index, 1);
    order.splice(index - 1, 0, id);
    save(() => runtime.reorder(order)).catch(() => {});
  }
  function moveDown(id: PadId, index: number) {
    const order = [...catalog.repertoire.padIds];
    order.splice(index, 1);
    order.splice(index + 1, 0, id);
    save(() => runtime.reorder(order)).catch(() => {});
  }
  function changeLabel(id: PadId, label: string) {
    setDrafts((current) => ({ ...current, [id]: label }));
  }
  async function update(updated: CatalogPad) {
    await save(() => runtime.update(updated));
  }
  function requestDelete(id: PadId, control: HTMLButtonElement) {
    deleteOrigin.current = control;
    void save()
      .then((saved) => {
        if (saved) setDeletingId(id);
      })
      .catch(() => {});
  }
  function importIntoEmpty() {
    setEditing(true);
    save(() => runtime.edit()).catch(() => {});
  }
  function stop() {
    runtime.playback.stop().catch(() => {
      setError('Falha ao parar. Tente STOP novamente.');
    });
  }
  function restoreFocus() {
    const target = deleteOrigin.current;
    if (target?.isConnected) target.focus();
    else editControl.current?.focus();
  }
  function changeDialog() {
    if (!saving) setDeletingId(null);
  }
  function cancelDelete() {
    setDeletingId(null);
  }
  function confirmDelete(pad: CatalogPad) {
    save(() => runtime.edit(pad.id)).catch(() => {});
  }
  const orderedPads = catalog.repertoire.padIds.flatMap((id) =>
    catalog.pads.filter((pad) => pad.id === id),
  );
  return {
    orderedPads,
    catalog,
    snapshot,
    editing,
    saving,
    deleting,
    drafts,
    editControl,
    error,
    cleanupError,
    toggleEditing,
    importAudio,
    play,
    startDrag,
    allowDrop,
    drop,
    moveUp,
    moveDown,
    changeLabel,
    update,
    requestDelete,
    importIntoEmpty,
    stop,
    restoreFocus,
    changeDialog,
    cancelDelete,
    confirmDelete,
  };
}
