import { createRoot } from 'react-dom/client';
import { connectDesktop } from './runtime/desktop';
import { Pad } from './performance/pad';
import { Button } from './components/ui/button';
import './style.css';
const root = document.getElementById('root');
if (root === null) throw new Error('Missing application root');
const view = createRoot(root);
view.render(
  <main>
    <p role="status">Abrindo repertório…</p>
    <footer className="transport">
      <Button className="stop">STOP</Button>
    </footer>
  </main>,
);
connectDesktop(window.pad)
  .then((runtime) => {
    view.render(<Pad runtime={runtime} />);
  })
  .catch(() => {
    view.render(
      <main>
        <p role="alert">
          Não foi possível abrir o repertório. Feche e abra o aplicativo para
          tentar novamente.
        </p>
        <footer className="transport">
          <Button className="stop">STOP</Button>
        </footer>
      </main>,
    );
  });
