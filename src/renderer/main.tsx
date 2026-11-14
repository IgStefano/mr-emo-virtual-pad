import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { connectDesktop } from './runtime/desktop';
import type { DesktopRuntime } from './runtime/desktop';
import { Button } from './components/ui/button';
import './style.css';

function Pad({ runtime }: { runtime: DesktopRuntime }) {
  const [catalog, setCatalog] = useState(runtime.catalog);
  const [snapshot, setSnapshot] = useState(runtime.playback.snapshot());
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  useEffect(
    () =>
      runtime.playback.subscribe(() => {
        setSnapshot(runtime.playback.snapshot());
      }),
    [runtime],
  );
  async function edit(padId?: Parameters<typeof runtime.edit>[0]) {
    setEditing(true);
    setError('');
    try {
      setCatalog(await runtime.edit(padId));
    } catch {
      setError('Não foi possível salvar. Tente novamente.');
    } finally {
      setEditing(false);
    }
  }
  return (
    <main>
      <h1>Seu repertório</h1>
      <div className="transport">
        <Button
          onClick={() => {
            runtime.playback.stop().catch(() => {
              setError('Falha ao parar. Tente STOP novamente.');
            });
          }}
        >
          STOP
        </Button>
        <span role="status">{snapshot.busy ? 'Reproduzindo' : 'Parado'}</span>
        <output aria-label="Posição">
          {snapshot.positionSeconds.toFixed(1)}
        </output>
        <progress
          aria-label="Progresso"
          max={snapshot.durationSeconds || 1}
          value={snapshot.positionSeconds}
        />
      </div>
      <Button
        disabled={snapshot.busy || editing}
        onClick={() => {
          edit().catch(() => {});
        }}
      >
        Importar áudio
      </Button>
      {catalog.pads.length === 0 && <p>O repertório está vazio.</p>}
      <ul>
        {catalog.pads.map((pad) => (
          <li key={pad.id}>
            <Button
              disabled={snapshot.busy || editing}
              onClick={() => {
                runtime.playback.play(pad.id, pad.assetId).catch(() => {
                  setError('Falha na reprodução.');
                });
              }}
            >
              {pad.label}
            </Button>
            <Button
              disabled={snapshot.busy || editing}
              onClick={() => {
                if (window.confirm(`Excluir ${pad.label}?`))
                  edit(pad.id).catch(() => {});
              }}
            >
              Excluir {pad.label}
            </Button>
          </li>
        ))}
      </ul>
      {(error || snapshot.failed) && (
        <p role="alert">
          {error || 'Falha na reprodução. Pressione STOP e tente novamente.'}
        </p>
      )}
    </main>
  );
}
const root = document.getElementById('root');
if (root === null) throw new Error('Missing application root');
const view = createRoot(root);
connectDesktop(window.pad)
  .then((runtime) => {
    view.render(<Pad runtime={runtime} />);
  })
  .catch(() => {
    view.render(
      <main>
        <p role="alert">Não foi possível abrir o repertório.</p>
      </main>,
    );
  });
