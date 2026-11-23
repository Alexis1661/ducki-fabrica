"""Catálogo de recursos de la fábrica de videos.

Recorre lo que ya existe (Head/, Body/, disfraces/ en la raíz del repo y lo que hay en
promo/public), copia a promo/public/fabrica/ las piezas del catálogo en tamaño de video
(para que Remotion las sirva) y escribe:

  RecursosVideo/fabrica/recursos.json      qué hay, dónde está y para qué sirve
  RecursosVideo/fabrica/recursos/*.jpg     una hoja de contactos por categoría

Uso:  python scripts/fabrica/catalogo.py
"""
import glob
import json
import os
import re
import subprocess

from PIL import Image, ImageDraw

PROMO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PUB = os.path.join(PROMO, 'public')
REPO = os.path.abspath(os.path.join(PROMO, '..', '..'))
FAB = os.path.join(REPO, 'RecursosVideo', 'fabrica')
SHEETS = os.path.join(FAB, 'recursos')
os.makedirs(SHEETS, exist_ok=True)
FF = os.path.join(os.environ.get('APPDATA', ''), 'Python', 'Python312', 'site-packages', 'imageio_ffmpeg', 'binaries', 'ffmpeg-win-x86_64-v7.1.exe')


def rel(p):
    return os.path.relpath(p, REPO).replace('\\', '/')


def pub(p):
    return os.path.relpath(p, PUB).replace('\\', '/')


def copy_resized(srcs, outdir, prefix, width):
    """Copies images into public/, `width` px wide; skips the ones already there."""
    os.makedirs(outdir, exist_ok=True)
    out = []
    for i, s in enumerate(srcs):
        dst = os.path.join(outdir, f'{prefix}{i:03d}.png')
        if not os.path.exists(dst):
            im = Image.open(s).convert('RGBA')
            im.resize((width, round(im.height * width / im.width)), Image.LANCZOS).save(dst, optimize=True)
        out.append({'id': f'{prefix}{i:03d}', 'origen': rel(s), 'pub': pub(dst)})
    return out


def duration(path):
    r = subprocess.run([FF, '-hide_banner', '-i', path], capture_output=True, text=True)
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', r.stderr)
    return round(int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]), 2) if m else None


def sheet(name, paths, thumb=150, cols=12, bg=(255, 246, 220)):
    paths = [p for p in paths if os.path.splitext(p)[1].lower() in ('.png', '.jpg', '.jpeg', '.webp')]
    if not paths:
        return
    rows = (len(paths) + cols - 1) // cols
    th = thumb + 18
    s = Image.new('RGB', (cols * thumb, rows * th), bg)
    d = ImageDraw.Draw(s)
    for k, p in enumerate(paths):
        try:
            im = Image.open(p).convert('RGBA')
        except Exception:
            continue
        im.thumbnail((thumb - 8, thumb - 8))
        x, y = (k % cols) * thumb, (k // cols) * th
        tile = Image.new('RGBA', (thumb, thumb), bg + (255,))
        tile.alpha_composite(im, ((thumb - im.width) // 2, (thumb - im.height) // 2))
        s.paste(tile.convert('RGB'), (x, y))
        d.text((x + 4, y + thumb + 2), os.path.splitext(os.path.basename(p))[0][:22], fill=(60, 50, 40))
    s.save(os.path.join(SHEETS, f'{name}.jpg'), quality=82)


cat = {}
heads = sorted(glob.glob(os.path.join(REPO, 'Head', '**', '*.png'), recursive=True))
bodies = sorted(glob.glob(os.path.join(REPO, 'Body', '**', '*.png'), recursive=True))
cos = sorted(glob.glob(os.path.join(REPO, 'disfraces', '*.png')))
cat['cabezas'] = {'uso': 'Cabezas del catálogo (495x446 originales, aquí a 330 px). Mismo encuadre: ojos y pico en el mismo sitio.',
                  'items': copy_resized(heads, os.path.join(PUB, 'fabrica', 'piezas'), 'h', 330)}
cat['cuerpos'] = {'uso': 'Cuerpos del catálogo (495x529, aquí a 330 px); van debajo de una cabeza.',
                  'items': copy_resized(bodies, os.path.join(PUB, 'fabrica', 'piezas'), 'b', 330)}
cat['disfraces'] = {'uso': 'Disfraces de cuerpo completo (Halloween 2026), 495x956, aquí a 330 px.',
                    'items': copy_resized(cos, os.path.join(PUB, 'fabrica', 'disfraces'), 'd', 330)}


def listing(folder, uso, exts=('.png', '.jpg', '.jpeg', '.webp', '.svg')):
    items = []
    for p in sorted(glob.glob(os.path.join(PUB, folder, '*'))):
        if os.path.splitext(p)[1].lower() in exts:
            items.append({'id': os.path.splitext(os.path.basename(p))[0], 'pub': pub(p)})
    return {'uso': uso, 'items': items}


cat['patos_sticker'] = listing('ducks', 'Patos vestidos de cuerpo entero (stickers con fondo transparente).')
cat['categorias_parches'] = listing('parches/cat', 'Ilustraciones de las categorías de Parches (300x300).')
cat['logos_universidades'] = listing('logos', 'Logos de las universidades de Cali.')
cat['capturas_app'] = {'uso': 'Capturas de pantalla de la app.', 'items': listing('screens', '')['items'] + listing('todo/stills', '')['items']}
cat['dibujos_duckiart'] = listing('duckart/weekly', 'Dibujos ganadores de DuckiArt (cuadrados).')
cat['app'] = listing('app', 'Icono de la app, pato anónimo y accesorios sueltos.')
cat['tiendas'] = listing('stores', 'Botones oficiales de App Store y Google Play.')
clips = []
for folder in ('v0110', 'parches/games', 'tutorial-salas'):
    for p in sorted(glob.glob(os.path.join(PUB, folder, '*.mp4'))):
        clips.append({'id': os.path.splitext(os.path.basename(p))[0], 'pub': pub(p), 'segundos': duration(p)})
cat['clips_app'] = {'uso': 'Grabaciones de pantalla y de juegos. OJO: sala.mp4 tiene banners de WhatsApp con nombres entre 11 y 15 s; esconde.mp4 entre 16 y 22 s.', 'items': clips}
cat['presentador'] = {'uso': 'Pato presentador con cara animada (ojos, párpados, pico) y micrófono: src/todo/HostDuck.tsx + public/todo/duck/.',
                      'items': listing('todo/duck', '')['items']}
cat['mano'] = {'uso': 'La mano del pato de ¡Al maíz! como trazo vectorial (src/todo/hand.ts); en los videos pone los stickers.', 'items': []}
cat['kit_scrapbook'] = {'uso': 'Papel, cinta, recortes, letras de secuestro, garabatos que hierven: src/todo/paper.tsx; textura public/todo/paper.png.', 'items': []}

json.dump({'generado_por': 'promo/scripts/fabrica/catalogo.py', 'categorias': cat}, open(os.path.join(FAB, 'recursos.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for k in ('cabezas', 'cuerpos', 'disfraces', 'patos_sticker', 'categorias_parches', 'logos_universidades', 'capturas_app', 'dibujos_duckiart'):
    items = cat[k]['items']
    paths = [os.path.join(PUB, i['pub']) for i in items]
    sheet(k, paths)
print({k: len(v['items']) for k, v in cat.items()})
