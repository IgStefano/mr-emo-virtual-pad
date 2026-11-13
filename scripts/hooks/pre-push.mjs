import { readFileSync } from 'node:fs';
import { checkedHead, checkPushRefs, npm } from './git-state.mjs';
const cwd = process.cwd();
const input = readFileSync(0, 'utf8');
const head = checkedHead(cwd);
if (checkPushRefs(cwd, input, head)) {
  npm(['run', 'package']);
  if (checkedHead(cwd) !== head)
    throw new Error('HOOK006: HEAD changed during packaging; retry the push.');
}
