"""Catálogo de recursos para el director (fabrica/catalogo/catalogo.json).

Junta fabrica/recursos.json (qué hay), fabrica/catalogo/descripciones.json (qué muestra cada
uno y qué evitar) y las medidas reales de cada archivo en promo/public. Las piezas del
catálogo (cabezas, cuerpos, disfraces, patos, categorías, logos) no se describen una por una:
el director las elige mirando las hojas de contacto de fabrica/catalogo/hojas/.

Uso (con las capturas descifradas en promo/public):  python scripts/fabrica/director/catalogo.py
"""
import json
import os
import re
import subprocess

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PROMO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
PUB = os.path.join(PROMO, 'public')
FAB = os.path.abspath(os.path.join(PROMO, '..', 'fabrica'))
FF = os.environ.get('FFMPEG') or 'ffmpeg'

recursos = json.load(open(os.path.join(FAB, 'recursos.json'), encoding='utf-8'))['categorias']
desc = json.load(open(os.path.join(FAB, 'catalogo', 'descripciones.json'), encoding='utf-8'))

# what kind of piece each group is: 'sticker' = cut-out with transparency (gets a white
# border), 'imagen' = rectangular picture (goes in a frame), 'clip' = video
GRUPOS = {
    'cabezas': 'pieza', 'cuerpos': 'pieza', 'disfraces': 'sticker', 'patos_sticker': 'sticker',
    'categorias_parches': 'sticker', 'logos_universidades': 'sticker', 'capturas_app': 'imagen',
    'dibujos_duckiart': 'imagen', 'app': 'sticker', 'tiendas': 'sticker', 'clips_app': 'clip',
}
EXTRA = [
    ('mapa', 'imagen', 'map/cali.png'),
    ('app', 'sticker', 'parches/duckisalas-ducks.png'),
]


def medidas(ruta):
    p = os.path.join(PUB, ruta)
    if ruta.endswith('.svg'):
        s = open(p, encoding='utf-8').read()
        m = re.search(r'viewBox="[\d.\s-]*?\s([\d.]+)\s+([\d.]+)"', s)
        return (round(float(m.group(1))), round(float(m.group(2)))) if m else (100, 100)
    if ruta.endswith('.mp4'):
        out = subprocess.run([FF, '-i', p], capture_output=True, text=True).stderr
        m = re.search(r'Video:.*?(\d{2,5})x(\d{2,5})', out)
        d = re.search(r'Duration: (\d+):(\d+):([\d.]+)', out)
        secs = int(d.group(1)) * 3600 + int(d.group(2)) * 60 + float(d.group(3)) if d else None
        return (int(m.group(1)), int(m.group(2)), round(secs, 2) if secs else None)
    with Image.open(p) as im:
        return im.size


items = []
falta = []
for grupo, tipo in GRUPOS.items():
    for it in recursos[grupo]['items']:
        ruta = it.get('pub')
        if not ruta:
            continue
        if not os.path.exists(os.path.join(PUB, ruta)):
            falta.append(ruta)
            continue
        m = medidas(ruta)
        e = {'id': it['id'], 'ruta': ruta, 'tipo': tipo, 'grupo': grupo, 'w': m[0], 'h': m[1]}
        if tipo == 'clip':
            e['segundos'] = m[2] if len(m) > 2 else it.get('segundos')
        info = desc.get(ruta, {})
        if info.get('d'):
            e['d'] = info['d']
        elif grupo == 'disfraces':
            e['d'] = 'Pato disfrazado de cuerpo entero: ' + os.path.basename(it.get('origen', '')).replace('halloween26-', '').replace('.png', '').replace('-', ' ')
        elif grupo == 'patos_sticker':
            e['d'] = 'Pato vestido de cuerpo entero: ' + it['id']
        elif grupo == 'categorias_parches':
            e['d'] = 'Ilustración de la categoría de parches «' + it['id'] + '» (patos haciendo esa actividad).'
        elif grupo == 'logos_universidades':
            e['d'] = 'Logo de la universidad ' + it['id'].upper()
        if info.get('evitar'):
            e['evitar'] = info['evitar']
        if info.get('prohibido'):
            e['prohibido'] = info['prohibido']
        items.append(e)
for grupo, tipo, ruta in EXTRA:
    if os.path.exists(os.path.join(PUB, ruta)):
        w, h = medidas(ruta)[:2]
        items.append({'id': os.path.splitext(os.path.basename(ruta))[0], 'ruta': ruta, 'tipo': tipo, 'grupo': grupo, 'w': w, 'h': h,
                      **({'d': desc[ruta]['d']} if ruta in desc else {})})
    else:
        falta.append(ruta)
# the stills of the scrapbook (not in recursos.json under that path)
for ruta in sorted(os.listdir(os.path.join(PUB, 'todo', 'stills'))):
    r = 'todo/stills/' + ruta
    if not any(i['ruta'] == r for i in items):
        w, h = medidas(r)
        items.append({'id': os.path.splitext(ruta)[0], 'ruta': r, 'tipo': 'imagen', 'grupo': 'capturas_app', 'w': w, 'h': h, **({'d': desc[r]['d']} if r in desc else {})})

out = {
    '_': 'Generado por promo/scripts/fabrica/director/catalogo.py. Rutas relativas a promo/public. Las piezas sin descripción se eligen mirando fabrica/catalogo/hojas/.',
    'hojas': {
        'cabezas': 'fabrica/catalogo/hojas/cabezas.jpg', 'cuerpos': 'fabrica/catalogo/hojas/cuerpos.jpg',
        'disfraces': 'fabrica/catalogo/hojas/disfraces.jpg', 'patos_sticker': 'fabrica/catalogo/hojas/patos_sticker.jpg',
        'categorias_parches': 'fabrica/catalogo/hojas/categorias_parches.jpg', 'logos_universidades': 'fabrica/catalogo/hojas/logos_universidades.jpg',
        'app': 'fabrica/catalogo/hojas/app.jpg',
    },
    'recursos': items,
}
json.dump(out, open(os.path.join(FAB, 'catalogo', 'catalogo.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(items), 'recursos;', 'faltan:', falta)
