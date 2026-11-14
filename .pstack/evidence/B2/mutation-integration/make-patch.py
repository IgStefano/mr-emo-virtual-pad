import difflib
from pathlib import Path

root = Path(__file__).parent
path = 'eslint.config.mjs'
old = Path(path).read_text()
new = old.replace("import js from '@eslint/js';", "import js from '@eslint/js';\nimport featureViews from './scripts/eslint-feature-views.mjs';")
new = new.replace("  { files: ['src/main/main.ts']", "  {\n    files: ['src/renderer/{performance,editing}/**/*.tsx'],\n    plugins: { feature: { rules: { views: featureViews } } },\n    rules: { 'feature/views': 'error' },\n  },\n  { files: ['src/main/main.ts']")
patch = ''.join(difflib.unified_diff(old.splitlines(True), new.splitlines(True), fromfile='a/'+path, tofile='b/'+path))
for path, source in [('scripts/eslint-feature-views.mjs', 'boundary-rule.mjs'), ('tests/guardrails/feature-views.test.mjs', 'check-boundary.mjs')]:
    text = (root/source).read_text().replace("from './boundary-rule.mjs'", "from '../../scripts/eslint-feature-views.mjs'")
    patch += ''.join(difflib.unified_diff([], text.splitlines(True), fromfile='/dev/null', tofile='b/'+path))
(root/'shared-governance.patch').write_text(patch)
