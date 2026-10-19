from pathlib import Path
root=Path(__file__).resolve().parent
html=(root/'shell.html').read_text(encoding='utf-8')
html=html.replace('<link rel="stylesheet" href="style.css">','<style>\n'+(root/'style.css').read_text(encoding='utf-8')+'\n</style>')
for name in ['data.js','starter-decks.js','player-cards.js','ringsdb-snapshot.js','planning-engine.js','quest-engine.js','travel-engine.js','encounter-engine.js','engine.js','player-ui.js','image-index.js','encounter-image-index.js','chinese-core-images.js','image-ui.js','planning-ui.js','quest-ui.js','travel-ui.js','encounter-ui.js','app.js']:
    source=(root/name).read_text(encoding='utf-8')
    if '</script' in source.lower():
        raise ValueError(f'Embedded closing script tag in {name}')
    html=html.replace(f'<script src="{name}"></script>','<script>\n'+source+'\n</script>')
(root/'index.html').write_text(html,encoding='utf-8')
print('Built index.html; retain assets folder for local Chinese art')
