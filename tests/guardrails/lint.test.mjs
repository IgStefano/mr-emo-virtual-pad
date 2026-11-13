import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESLint } from 'eslint';
const eslint = new ESLint();
for (const [name, code, rule] of [
  [
    'string enum union',
    "export type Status = 'idle' | 'playing';",
    'policy/const-object-enums',
  ],
  [
    'native enum',
    "export enum Status { Idle = 'idle' }",
    'policy/const-object-enums',
  ],
  [
    'inline discriminator',
    "export type State = { status: 'idle' };",
    'policy/const-object-enums',
  ],
  [
    'unknown in domain',
    'export type Value = unknown;',
    'policy/validated-unknown',
  ],
  [
    'dynamic import',
    "export const load = () => import('./playback');",
    'no-restricted-syntax',
  ],
  [
    'double assertion',
    'export const value = 1 as unknown as string;',
    'no-restricted-syntax',
  ],
  ['ambient clock', 'export const now = Date.now();', 'no-restricted-globals'],
  [
    'randomness',
    'export const id = Math.random();',
    'no-restricted-properties',
  ],
]) {
  test(`lint rejects ${name}`, async () => {
    const results = await eslint.lintText(code, {
      filePath: 'src/domain/playback.ts',
    });
    assert.ok(
      results
        .flatMap((result) => result.messages)
        .some((message) => message.ruleId === rule),
      JSON.stringify(results),
    );
  });
}
test('validated ingress may use unknown', async () => {
  const results = await eslint.lintFiles(['src/preload/preload.ts']);
  assert.equal(
    results
      .flatMap((result) => result.messages)
      .filter((message) => message.ruleId === 'policy/validated-unknown')
      .length,
    0,
  );
});

test('const-object enum and derived type are accepted', async () => {
  const results = await eslint.lintText(
    "export const Status = { Idle: 'idle', Playing: 'playing' } as const; export type Status = (typeof Status)[keyof typeof Status];",
    { filePath: 'src/domain/playback.ts' },
  );
  assert.deepEqual(
    results.flatMap((result) => result.messages),
    [],
  );
});
