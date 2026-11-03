"""Package deployable static files. No node_modules, source corpus, or local paths required."""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
DIST.mkdir(exist_ok=True)
for name in ('index.html', 'styles.css', 'app.js', 'core.js', 'favicon.svg'):
    shutil.copy2(ROOT / name, DIST / name)
(DIST / 'data').mkdir(exist_ok=True)
shutil.copytree(ROOT / 'data', DIST / 'data', dirs_exist_ok=True)
print(f'Static site ready: {DIST}')
