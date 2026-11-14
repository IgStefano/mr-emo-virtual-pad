import type { Pad } from '../../contracts/catalog';
export function editorActions(
  pad: Pad,
  label: string,
  save: (pad: Pad) => Promise<void>,
) {
  return {
    rename: () => {
      save({ ...pad, label: label.trim() }).catch(() => {});
    },
    recolor: (color: Pad['color']) => {
      save({ ...pad, label: label.trim() || pad.label, color }).catch(() => {});
    },
  };
}
