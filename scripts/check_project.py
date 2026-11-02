"""Build the offline artifact and run the project's real Node test files."""
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parent.parent
subprocess.run([sys.executable, str(root / 'build.py')], cwd=root, check=True)
tests = sorted(p.name for p in root.glob('*tests.cjs'))
# scripts/ 下的专项回归（非浏览器、node --test 风格）显式收编
for extra in ['check-scenario-data.cjs']:
    p = root / 'scripts' / extra
    if p.exists():
        tests.append('scripts/' + extra)
if not tests:
    raise SystemExit('No test files found')
subprocess.run(['node', '--test', *tests], cwd=root, check=True)
print('Project build and tests passed.')
