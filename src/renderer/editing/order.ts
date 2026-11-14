import type { PadId } from '../../contracts/catalog';

export function movePad(
  padIds: readonly PadId[],
  source: PadId,
  target: PadId,
): PadId[] {
  const order = padIds.filter((id) => id !== source);
  order.splice(padIds.indexOf(target), 0, source);
  return order;
}
