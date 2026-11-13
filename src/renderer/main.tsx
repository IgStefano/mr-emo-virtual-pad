import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const root = document.getElementById('root');
if (root === null) throw new Error('Missing application root');
createRoot(root).render(
  <StrictMode>
    <main>
      <p className="eyebrow">MR. EMO / VIRTUAL PAD</p>
      <h1>
        Seu repertório.
        <br />
        Pronto para o palco.
      </h1>
      <p>
        O repertório está vazio. A importação de faixas será o próximo passo.
      </p>
      <div className="transport" role="status">
        <span className="status-dot" />
        Parado
      </div>
    </main>
  </StrictMode>,
);
