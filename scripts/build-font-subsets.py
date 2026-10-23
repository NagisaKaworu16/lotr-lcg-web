#!/usr/bin/env python3
"""v0.15.34 字体子集化：从仓库源码收集实际用字，生成 assets/fonts/*.woff2。

用法：venv python（需 fonttools+brotli）：
  python scripts/build-font-subsets.py
字体来源（均 OFL/免费商用）：
  - 京華老宋体 v3.0  KingHwa_OldSong-Regular.ttf（标题）
  - 霞鹜文楷 v1.520  LXGWWenKai-Regular.ttf（正文）
  - Cinzel          Cinzel[wght].ttf（西文碑刻风眉题，全量保留）
原始 TTF 放 assets/fonts/_src/（不入库），语料扫仓库 *.js 与 shell.html。
"""
import os, subprocess, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'fonts', '_src')
OUT = os.path.join(ROOT, 'assets', 'fonts')

# 1) 语料：源码全部字符中 ord>=0x80 的 + ASCII 可打印 + 全角标点兜底
corpus = set(chr(c) for c in range(0x20, 0x7F))
PUNCT = '，。、；：？！""''（）《》〈〉【】〔〕·—…～％＋－×÷°′″¥　⒈⑴①⑧〔〕'
for pat in ('*.js', 'shell.html'):
    for f in glob.glob(os.path.join(ROOT, pat)):
        if f.endswith('index.html'):
            continue
        with open(f, encoding='utf8', errors='ignore') as fh:
            for ch in fh.read():
                if ord(ch) >= 0x80:
                    corpus.add(ch)
corpus.update(PUNCT)
corpus_file = os.path.join(OUT, '_corpus.txt')
with open(corpus_file, 'w', encoding='utf8') as fh:
    fh.write(''.join(sorted(corpus)))
print(f'corpus: {len(corpus)} chars -> {corpus_file}')

# 2) 子集化
JOBS = [
    ('KingHwa.ttf', 'kinghwa-subset.woff2'),
    ('LXGWWenKai-Regular.ttf', 'wenkai-subset.woff2'),
]
for src_name, out_name in JOBS:
    src, dst = os.path.join(SRC, src_name), os.path.join(OUT, out_name)
    if not os.path.exists(src):
        sys.exit(f'missing source font: {src}')
    subprocess.run([sys.executable, '-m', 'fontTools.subset', src,
                    f'--text-file={corpus_file}', '--flavor=woff2',
                    f'--output-file={dst}', '--no-hinting',
                    '--layout-features=*', '--desubroutinize'], check=True)
    print(f'{out_name}: {os.path.getsize(dst)//1024} KB')
print('done')
