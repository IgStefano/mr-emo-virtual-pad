import assert from 'node:assert/strict';
import test from 'node:test';
import { ESLint } from 'eslint';

const eslint = new ESLint();
for (const code of [
  'const make = window.Audio; export const sound = new make();',
  'const make = document.createElement.bind(document); export const sound = make("audio");',
  'const element = document.createElement; export const sound = element.call(document, "audio");',
]) {
  test(`aliased audio remains owned by the adapter: ${code}`, async () => {
    const results = await eslint.lintText(code, {
      filePath: 'src/renderer/main.tsx',
    });
    assert.ok(
      results
        .flatMap((result) => result.messages)
        .some(
          (message) =>
            message.ruleId === 'policy/audio-owner' ||
            message.ruleId === '@typescript-eslint/unbound-method',
        ),
      JSON.stringify(results),
    );
  });
}
