import { useEffect, useRef, useState } from 'react';
import type { DesktopRuntime } from '../runtime/desktop';
import type { Pad as CatalogPad, PadId } from '../../contracts/catalog';
import { transport } from './transport';
import { Button } from '../components/ui/button';
import { Dialog } from '../components/ui/dialog';
import { Progress } from '../components/ui/progress';
import { ScrollArea } from '../components/ui/scroll-area';
import { Editor } from '../editing/editor';
import { movePad } from '../editing/order';
export function Pad({ runtime }: { runtime: DesktopRuntime }) {
  const [catalog, setCatalog] = useState(runtime.catalog);
  const [snapshot, setSnapshot] = useState(runtime.playback.snapshot());
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<CatalogPad | null>(null);
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
  async function save(operation: () => Promise<typeof catalog>) {
    setSaving(true);
    setError('');
    try {
      for (const pad of runtime.catalog.pads) {
        const label = drafts[pad.id];
        if (label === undefined || label === pad.label) continue;
        if (!label.trim())
          throw new Error('Nome vazio. Informe um nome para salvar.');
        await runtime.update({ ...pad, label: label.trim() });
        setDrafts((current) => {
          const next = { ...current };
          next[pad.id] = undefined;
          return next;
        });
      }
      setCatalog(await operation());
      return true;
    } catch (failure) {
      setCatalog(runtime.catalog);
      const code =
        failure instanceof Error ? failure.message : 'storage-failure';
      if (code === 'cleanup-required')
        setCleanupError(
          'Catálogo atualizado. A limpeza da cópia interna falhou (cleanup-required). Feche e reabra o aplicativo para tentar a limpeza novamente.',
        );
      else
        setError(
          `Não foi possível salvar (${code}). Os nomes pendentes foram mantidos. Tente salvar novamente.`,
        );
      return false;
    } finally {
      setSaving(false);
    }
  }
  const { active, status, remaining, progress } = transport(snapshot);
  return (
    <main>
      <header className="toolbar">
        <h1>{catalog.repertoire.name}</h1>
        <div>
          <Button
            ref={editControl}
            disabled={snapshot.busy || saving}
            aria-pressed={editing}
            onClick={() => {
              if (!editing) setEditing(true);
              else
                void save(() => Promise.resolve(runtime.catalog))
                  .then((saved) => {
                    if (saved) setEditing(false);
                  })
                  .catch(() => {});
            }}
          >
            {editing ? 'Concluir edição' : 'Editar repertório'}
          </Button>
          {editing && (
            <Button
              disabled={saving || snapshot.busy}
              onClick={() => {
                save(() => runtime.edit()).catch(() => {});
              }}
            >
              Importar áudio
            </Button>
          )}
        </div>
      </header>
      {(error || cleanupError || snapshot.failed) && (
        <p role="alert" className="error">
          {error ||
            cleanupError ||
            'Falha na reprodução. Pressione STOP e tente novamente.'}
        </p>
      )}
      {saving && <p role="status">Salvando…</p>}
      <ScrollArea>
        <ul className="pad-grid">
          {catalog.repertoire.padIds.map((id, index) => {
            const pad = catalog.pads.find((item) => item.id === id);
            if (!pad) return null;
            return (
              <li key={id} className={`pad-item color-${pad.color}`}>
                <Button
                  className={`pad ${active === id ? 'active' : ''}`}
                  aria-pressed={active === id}
                  disabled={snapshot.busy || saving || editing}
                  onClick={() => {
                    runtime.playback.play(id, pad.assetId).catch(() => {
                      setError('Falha na reprodução. Pressione STOP.');
                    });
                  }}
                >
                  <span className="pad-number">{index + 1}</span>
                  <span>{pad.label}</span>
                  {active === id && <span className="pad-state">{status}</span>}
                </Button>
                {editing && (
                  <>
                    <Button
                      className="drag-handle"
                      draggable={!saving}
                      disabled={saving}
                      aria-label={`Mover ${pad.label}`}
                      onDragStart={() => {
                        setDragged(id);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (dragged && dragged !== id) {
                          const order = movePad(
                            catalog.repertoire.padIds,
                            dragged,
                            id,
                          );
                          save(() => runtime.reorder(order)).catch(() => {});
                        }
                        setDragged(null);
                      }}
                    >
                      Arrastar para reordenar
                    </Button>
                    <div className="order-actions">
                      <Button
                        disabled={saving || index === 0}
                        aria-label={`Mover ${pad.label} para cima`}
                        onClick={() => {
                          const order = [...catalog.repertoire.padIds];
                          order.splice(index, 1);
                          order.splice(index - 1, 0, id);
                          save(() => runtime.reorder(order)).catch(() => {});
                        }}
                      >
                        Subir
                      </Button>
                      <Button
                        disabled={
                          saving ||
                          index === catalog.repertoire.padIds.length - 1
                        }
                        aria-label={`Mover ${pad.label} para baixo`}
                        onClick={() => {
                          const order = [...catalog.repertoire.padIds];
                          order.splice(index, 1);
                          order.splice(index + 1, 0, id);
                          save(() => runtime.reorder(order)).catch(() => {});
                        }}
                      >
                        Descer
                      </Button>
                    </div>
                    <Editor
                      pad={pad}
                      busy={saving}
                      label={drafts[id] ?? pad.label}
                      changeLabel={(label) => {
                        setDrafts((current) => ({ ...current, [id]: label }));
                      }}
                      save={async (updated) => {
                        await save(() => runtime.update(updated));
                      }}
                      remove={(control) => {
                        deleteOrigin.current = control;
                        void save(() => Promise.resolve(runtime.catalog))
                          .then((saved) => {
                            if (saved)
                              setDeleting(
                                runtime.catalog.pads.find(
                                  (item) => item.id === id,
                                ) ?? null,
                              );
                          })
                          .catch(() => {});
                      }}
                    />
                  </>
                )}
              </li>
            );
          })}
        </ul>
        {catalog.repertoire.padIds.length === 0 && (
          <div className="empty">
            <h2>Seu repertório está vazio</h2>
            <Button
              disabled={snapshot.busy || saving}
              onClick={() => {
                setEditing(true);
                save(() => runtime.edit()).catch(() => {});
              }}
            >
              Importar áudio
            </Button>
          </div>
        )}
      </ScrollArea>
      <footer className="transport">
        <Button
          className="stop"
          onClick={() => {
            runtime.playback.stop().catch(() => {
              setError('Falha ao parar. Tente STOP novamente.');
            });
          }}
        >
          STOP
        </Button>
        <div className="playback-info">
          <span role="status">{status}</span>
          <strong>
            {catalog.pads.find((pad) => pad.id === active)?.label ||
              'Nenhum pad ativo'}
          </strong>
          <Progress value={progress} />
        </div>
        <output aria-label="Tempo restante">
          −{Math.floor(remaining / 60)}:
          {String(remaining % 60).padStart(2, '0')}
        </output>
      </footer>
      <Dialog
        restoreFocus={() => {
          const target = deleteOrigin.current;
          if (target?.isConnected) target.focus();
          else editControl.current?.focus();
        }}
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setDeleting(null);
        }}
        title={`Excluir ${deleting?.label || 'pad'}?`}
      >
        <p>O pad e sua cópia interna de áudio serão excluídos.</p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button
            disabled={saving}
            onClick={() => {
              setDeleting(null);
            }}
          >
            Cancelar
          </Button>
          <Button
            disabled={saving}
            onClick={() => {
              if (deleting)
                save(() => runtime.edit(deleting.id))
                  .catch(() => {})
                  .then((saved) => {
                    if (
                      saved ||
                      !runtime.catalog.pads.some(
                        (pad) => pad.id === deleting.id,
                      )
                    )
                      setDeleting(null);
                  })
                  .catch(() => {});
            }}
          >
            Confirmar exclusão
          </Button>
        </div>
      </Dialog>
    </main>
  );
}
