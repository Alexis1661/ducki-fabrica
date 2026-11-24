"""Hoja de revisión del director: los cuadros en una sola imagen, con el número de escena y el segundo.

Uso:  python hoja.py salida.jpg etiqueta1=cuadro1.jpg etiqueta2=cuadro2.jpg ...
"""
import sys

from PIL import Image, ImageDraw, ImageFont

out, pares = sys.argv[1], [a.split('=', 1) for a in sys.argv[2:]]
W, H, COLS = 360, 640, 4
rows = (len(pares) + COLS - 1) // COLS
sheet = Image.new('RGB', (COLS * (W + 8) + 8, rows * (H + 44) + 8), (250, 247, 240))
try:
    font = ImageFont.truetype('DejaVuSans-Bold.ttf', 22)
except OSError:
    font = ImageFont.load_default()
d = ImageDraw.Draw(sheet)
for k, (label, path) in enumerate(pares):
    x, y = 8 + (k % COLS) * (W + 8), 8 + (k // COLS) * (H + 44)
    im = Image.open(path).convert('RGB').resize((W, H))
    sheet.paste(im, (x, y + 36))
    d.text((x + 4, y + 6), label, fill=(20, 20, 30), font=font)
    # the captions band (y 1590-1800 in the video): faint red lines, so nothing covers it
    d.line([(x, y + 36 + int(1590 * H / 1920)), (x + W, y + 36 + int(1590 * H / 1920))], fill=(230, 80, 80), width=1)
sheet.save(out, quality=82)
print(out)
