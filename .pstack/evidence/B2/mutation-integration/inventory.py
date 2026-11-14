import collections
import gzip
import hashlib
import json
import subprocess
from pathlib import Path

report = Path('reports/mutation/mutation.json')
data = json.loads(report.read_text())
assert len(data['files']) == 26, 'Expected the complete default mutation scope'
assert all(m['status'] in ['Killed', 'Timeout'] for f in data['files'].values() for m in f['mutants']), 'Mutation acceptance is incomplete'
summary = {}
for name, file in data['files'].items():
    assert Path(name).read_text() == file['source'], f'Stale report: {name}'
    summary[name] = dict(collections.Counter(m['status'] for m in file['mutants']))
root = Path(__file__).parent
(root/'mutation.json.gz').write_bytes(gzip.compress(report.read_bytes(), mtime=0))
paths = sorted([*Path('src/renderer').rglob('*.ts'), *Path('src/renderer').rglob('*.tsx'), Path('tests/ui/editing.test.ts'), Path('package.json'), Path('package-lock.json')])
source = {str(path): subprocess.check_output(['git', 'hash-object', str(path)], text=True).strip() for path in paths}
(root/'inventory.json').write_text(json.dumps({
    'base': 'f33af795cdbadda96230a873e8583e43161a3700',
    'sourceGitBlobs': source,
    'reportSha256': hashlib.sha256(report.read_bytes()).hexdigest(),
    'files': summary,
    'totals': dict(collections.Counter(m['status'] for f in data['files'].values() for m in f['mutants'])),
}, indent=2)+'\n')
