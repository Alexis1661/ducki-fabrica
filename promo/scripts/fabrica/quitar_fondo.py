"""Quita el fondo blanco liso de una imagen generada (el modelo a veces no da transparencia).

Rellena desde los bordes todo lo que sea casi blanco y conectado al borde, y lo vuelve
transparente; el blanco de adentro (el pato, sus ojos) queda intacto. Suaviza un poco el borde.

Uso:  python scripts/fabrica/quitar_fondo.py imagen.png
"""
import sys
from collections import deque

from PIL import Image, ImageFilter

path = sys.argv[1]
im = Image.open(path).convert('RGBA')
w, h = im.size
px = im.load()
if any(px[x, y][3] < 250 for x, y in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]):
    print('ya tiene transparencia')
    sys.exit(0)


def blanco(p):
    r, g, b, _ = p
    return r > 238 and g > 238 and b > 238


seen = bytearray(w * h)
q = deque()
for x in range(w):
    for y in (0, h - 1):
        q.append((x, y))
for y in range(h):
    for x in (0, w - 1):
        q.append((x, y))
mask = Image.new('L', (w, h), 255)
mp = mask.load()
while q:
    x, y = q.popleft()
    i = y * w + x
    if seen[i]:
        continue
    seen[i] = 1
    if not blanco(px[x, y]):
        continue
    mp[x, y] = 0
    if x > 0: q.append((x - 1, y))
    if x < w - 1: q.append((x + 1, y))
    if y > 0: q.append((x, y - 1))
    if y < h - 1: q.append((x, y + 1))
mask = mask.filter(ImageFilter.GaussianBlur(1.2))
im.putalpha(mask)
im.save(path)
print('fondo quitado')
