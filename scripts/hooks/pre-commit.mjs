import { checkedIndex, npm } from './git-state.mjs';
const cwd = process.cwd();
checkedIndex(cwd);
npm(['exec', '--no', '--', 'lint-staged']);
const tree = checkedIndex(cwd);
npm(['run', 'verify']);
if (checkedIndex(cwd) !== tree)
  throw new Error(
    'HOOK005: index changed during verification; retry the commit.',
  );
