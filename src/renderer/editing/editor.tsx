import { editorActions } from './editor-actions';
import { PadColor } from '../../contracts/catalog';
import type { Pad } from '../../contracts/catalog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
export function Editor({
  pad,
  busy,
  label,
  changeLabel,
  save,
  remove,
}: {
  pad: Pad;
  busy: boolean;
  label: string;
  changeLabel: (label: string) => void;
  save: (pad: Pad) => Promise<void>;
  remove: (control: HTMLButtonElement) => void;
}) {
  const color = pad.color;
  const { rename, recolor } = editorActions(pad, label, save);
  return (
    <section className="pad-editor" aria-label={`Editar ${pad.label}`}>
      <label htmlFor={`label-${pad.id}`}>
        Nome
        <Input
          id={`label-${pad.id}`}
          value={label}
          required
          aria-invalid={!label.trim()}
          disabled={busy}
          onChange={(event) => {
            changeLabel(event.target.value);
          }}
        />
      </label>
      {!label.trim() && <p role="alert">Informe um nome para salvar.</p>}
      <Button
        disabled={busy || !label.trim() || label === pad.label}
        onClick={rename}
      >
        Salvar nome
      </Button>
      <div className="colors" role="group" aria-label="Cor">
        {Object.values(PadColor).map((value) => (
          <Button
            key={value}
            className={`swatch color-${value}`}
            aria-label={`Cor ${value}`}
            aria-pressed={color === value}
            disabled={busy}
            onClick={() => {
              recolor(value);
            }}
          />
        ))}
      </div>
      <Button
        disabled={busy}
        onClick={(event) => {
          remove(event.currentTarget);
        }}
      >
        Excluir {pad.label}
      </Button>
    </section>
  );
}
