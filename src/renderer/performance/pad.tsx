import { usePad } from './use-pad';
import type { DesktopRuntime } from '../runtime/desktop';
import { transport } from './transport';
import { Button } from '../components/ui/button';
import { Dialog } from '../components/ui/dialog';
import { Progress } from '../components/ui/progress';
import { ScrollArea } from '../components/ui/scroll-area';
import { Editor } from '../editing/editor';
export function Pad({ runtime }: { runtime: DesktopRuntime }) {
  const {
    catalog,
    orderedPads,
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
  } = usePad(runtime);
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
            onClick={toggleEditing}
          >
            {editing ? 'Concluir edição' : 'Editar repertório'}
          </Button>
          {editing && (
            <Button disabled={saving || snapshot.busy} onClick={importAudio}>
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
          {orderedPads.map((pad, index) => {
            const id = pad.id;
            return (
              <li key={id} className={`pad-item color-${pad.color}`}>
                <Button
                  className={`pad ${active === id ? 'active' : ''}`}
                  aria-pressed={active === id}
                  disabled={snapshot.busy || saving || editing}
                  onClick={() => {
                    play(pad, id);
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
                        startDrag(id);
                      }}
                      onDragOver={(event) => {
                        allowDrop(event);
                      }}
                      onDrop={(event) => {
                        drop(id, event);
                      }}
                    >
                      Arrastar para reordenar
                    </Button>
                    <div className="order-actions">
                      <Button
                        disabled={saving || index === 0}
                        aria-label={`Mover ${pad.label} para cima`}
                        onClick={() => {
                          moveUp(id, index);
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
                          moveDown(id, index);
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
                        changeLabel(id, label);
                      }}
                      save={(updated) => update(updated)}
                      remove={(control) => {
                        requestDelete(id, control);
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
              onClick={importIntoEmpty}
            >
              Importar áudio
            </Button>
          </div>
        )}
      </ScrollArea>
      <footer className="transport">
        <Button className="stop" onClick={stop}>
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
        restoreFocus={restoreFocus}
        open={deleting !== undefined}
        onOpenChange={changeDialog}
        title={`Excluir ${deleting?.label || 'pad'}?`}
      >
        <p>O pad e sua cópia interna de áudio serão excluídos.</p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button disabled={saving} onClick={cancelDelete}>
            Cancelar
          </Button>
          <Button
            disabled={saving}
            onClick={
              deleting
                ? () => {
                    confirmDelete(deleting);
                  }
                : undefined
            }
          >
            Confirmar exclusão
          </Button>
        </div>
      </Dialog>
    </main>
  );
}
