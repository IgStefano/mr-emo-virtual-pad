import { useState } from 'react';
import { PadColor } from '../../contracts/catalog';
import type { Pad } from '../../contracts/catalog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
export function Editor({
  pad,
  busy,
  save,
  remove,
}: {
  pad: Pad;
  busy: boolean;
  save: (pad: Pad) => Promise<void>;
  remove: () => void;
}) {
  const [label, setLabel] = useState(pad.label);
  const color = pad.color;
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
            setLabel(event.target.value);
          }}
          onBlur={() => {
            if (label.trim() && label !== pad.label)
              save({ ...pad, label: label.trim(), color }).catch(() => {});
          }}
        />
      </label>
      {!label.trim() && <p role="alert">Informe um nome para salvar.</p>}
      <div className="colors" role="group" aria-label="Cor">
        {Object.values(PadColor).map((value) => (
          <Button
            key={value}
            className={`swatch color-${value}`}
            aria-label={`Cor ${value}`}
            aria-pressed={color === value}
            disabled={busy}
            onClick={() => {
              save({
                ...pad,
                label: label.trim() || pad.label,
                color: value,
              }).catch(() => {});
            }}
          />
        ))}
      </div>
      <Button disabled={busy} onClick={remove}>
        Excluir {pad.label}
      </Button>
    </section>
  );
}
