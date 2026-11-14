import { expect, it } from 'vitest';
import { padIdSchema } from '../../src/contracts/catalog';
import { movePad } from '../../src/renderer/editing/order';
const first = padIdSchema.parse('00000000-0000-4000-8000-000000000001');
const second = padIdSchema.parse('00000000-0000-4000-8000-000000000002');
const third = padIdSchema.parse('00000000-0000-4000-8000-000000000003');
it('moves a pad to the target position in either direction without changing the source order', () => {
  const order = [first, second, third];
  expect(movePad(order, first, second)).toEqual([second, first, third]);
  expect(movePad(order, third, first)).toEqual([third, first, second]);
  expect(movePad(order, second, second)).toEqual(order);
  expect(order).toEqual([first, second, third]);
});
