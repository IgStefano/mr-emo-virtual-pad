import { readFile } from 'node:fs/promises';
const report = JSON.parse(
  await readFile('reports/mutation/mutation.json', 'utf8'),
);
const mutants = Object.values(report.files).flatMap((file) => file.mutants);
if (mutants.length === 0)
  throw new Error('Mutation scope is empty; zero mutants is not verification.');
const unacceptable = mutants.filter(
  (mutant) => !['Killed', 'Timeout'].includes(mutant.status),
);
if (unacceptable.length > 0)
  throw new Error(
    `Review ${String(unacceptable.length)} non-detected/invalid/ignored mutants; none are silently accepted.`,
  );
console.log(
  `Mutation gate: ${String(mutants.length)} mutants, ${String(mutants.filter((mutant) => mutant.status === 'Timeout').length)} detected by timeout.`,
);
