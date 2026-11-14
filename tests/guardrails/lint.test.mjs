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

for (const tag of ['button', 'input', 'select', 'textarea', 'dialog']) {
  test(`UI primitive ${tag} belongs to the approved component source`, async () => {
    const results = await eslint.lintText(
      `export const Example = () => <${tag} />;`,
      { filePath: 'src/renderer/main.tsx' },
    );
    assert.ok(
      results
        .flatMap((result) => result.messages)
        .some((message) => message.ruleId === 'policy/ui-primitives'),
    );
  });
}
test('named UI components remain composable in feature views', async () => {
  const results = await eslint.lintText(
    'const Button = () => <span>Play</span>; export const Example = () => <Button />;',
    { filePath: 'src/renderer/main.tsx' },
  );
  assert.equal(
    results
      .flatMap((result) => result.messages)
      .filter((message) => message.ruleId === 'policy/ui-primitives').length,
    0,
  );
});
test('component source can implement raw primitives without disabling other lint rules', async () => {
  const config = await eslint.calculateConfigForFile(
    'src/renderer/components/ui/button.tsx',
  );
  assert.equal(config.rules['policy/ui-primitives'], undefined);
  assert.equal(config.rules['@typescript-eslint/no-explicit-any'][0], 2);
});

for (const code of [
  'export const sound = new Audio();',
  'export const bypass = () => fetch("file:///tmp/audio");',
]) {
  test(`renderer rejects privileged effect ${code}`, async () => {
    const results = await eslint.lintText(code, {
      filePath: 'src/renderer/main.tsx',
    });
    assert.ok(
      results
        .flatMap((result) => result.messages)
        .some((message) => message.ruleId === 'no-restricted-globals'),
    );
  });
}

for (const code of [
  'const NativeAudio = window.Audio; export const sound = new NativeAudio();',
  'const create = document.createElement.bind(document); export const sound = create("audio");',
  'export const sound = document.createElement("audio");',
]) {
  test(`native audio ownership follows resolved types: ${code}`, async () => {
    const results = await eslint.lintText(code, {
      filePath: 'src/renderer/main.tsx',
    });
    assert.ok(
      results
        .flatMap((result) => result.messages)
        .some((message) => message.ruleId === 'policy/audio-owner'),
    );
  });
}
