import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import assert from 'node:assert/strict';
import rule from './boundary-rule.mjs';
const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.tsx'],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
      plugins: { boundary: { rules: { views: rule } } },
      rules: { 'boundary/views': 'error' },
    },
  ],
});
const filePath = 'src/renderer/performance/negative.tsx';
for (const source of [
  'export const View = () => { new Promise(resolve => resolve()); return <div/>; };',
  'export const View = () => { setTimeout(save); return <div/>; };',
  "export const View = () => { save()['then'](done); return <div/>; };",
  "import { useState as state } from 'react'; export const View = () => <div/>;",
  'export const View = () => <Button onClick={() => ok && save()}/>;',
  'export const View = () => <Button onClick={() => ok ? save() : cancel()}/>;',
  'export async function View() { await save(); return <div/>; }',
  'export function View() { if (saving) save(); return <div/>; }',
  'export function View() { save().then(done); return <div/>; }',
  'export function View() { const [x, setX] = useState(0); return <div/>; }',
  'export function View() { return <Button onClick={() => { count++; }}/ >; }',
]) {
  const [result] = await eslint.lintText(source, { filePath });
  assert(
    result.messages.some((message) => message.ruleId === 'boundary/views'),
  );
}
const [renderExpressions] = await eslint.lintText(
  'export const View = () => items.map(item => <Button disabled={busy || !item} onClick={item ? () => save(item) : undefined}>{item && <span/>}</Button>);',
  { filePath },
);
assert.equal(renderExpressions.errorCount, 0);
const results = await eslint.lintFiles([
  'src/renderer/{performance,editing}/**/*.tsx',
]);
assert.equal(
  results.reduce((count, result) => count + result.errorCount, 0),
  0,
  JSON.stringify(results),
);
console.log(
  'Boundary: eleven negative fixtures rejected; current feature views accepted.',
);
