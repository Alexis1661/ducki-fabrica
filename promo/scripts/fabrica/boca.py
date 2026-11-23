"""Pico del presentador: cuánto abre y qué tan redondo, cuadro a cuadro.

Mezcla las formas de las vocales de cada palabra (a abierta, e/i a medias, o/u
redonda, m/b/p cerrada) con el volumen real de la voz, así las sílabas fuertes
abren más y los silencios quedan cerrados. Igual que scripts/todo_prep.py.

Uso:  python scripts/fabrica/boca.py voz.wav palabras.json boca.json
"""
import json
import sys
import unicodedata
import wave

import numpy as np

wav_path, words_path, out_path = sys.argv[1:4]
FPS = 30
words = json.load(open(words_path, encoding='utf-8'))['words']

with wave.open(wav_path) as wv:
    sr, ch = wv.getframerate(), wv.getnchannels()
    a = np.frombuffer(wv.readframes(wv.getnframes()), dtype='<i2').astype(np.float32) / 32768
a = a.reshape(-1, ch).mean(1)
hop = sr // FPS
n = len(a) // hop + 1
rms = np.array([np.sqrt(np.mean(a[k * hop:(k + 1) * hop] ** 2) + 1e-12) for k in range(n)])
db = 20 * np.log10(rms)
lo, hi = np.percentile(db[db > -60], 20), np.percentile(db, 97)
o = np.clip((db - lo) / max(1e-6, hi - lo), 0, 1)
sm = np.zeros_like(o)
for k in range(1, n):
    sm[k] = sm[k - 1] + (o[k] - sm[k - 1]) * (0.85 if o[k] > sm[k - 1] else 0.45)
sm[sm < 0.12] = 0

SHAPE = {'a': (1.0, 0.0), 'e': (0.62, 0.0), 'i': (0.42, 0.0), 'o': (0.8, 1.0), 'u': (0.55, 1.0), 'y': (0.42, 0.0),
         'm': (0.0, 0.3), 'b': (0.0, 0.3), 'p': (0.0, 0.3), 'f': (0.14, 0.0), 'v': (0.14, 0.0)}
keys = []
for w in words:
    txt = unicodedata.normalize('NFD', w['w'].lower())
    txt = ''.join(c for c in txt if c.isalpha() and unicodedata.category(c) != 'Mn')
    if not txt:
        continue
    s, e = w['s'], w['e']
    keys.append((s - 0.04, 0.0, 0.0))
    for k, c in enumerate(txt):
        if c in SHAPE:
            op, rd = SHAPE[c]
            keys.append((s + (e - s) * (k + 0.5) / len(txt), op, rd))
    keys.append((e + 0.02, 0.12, 0.0))
keys.sort()
ts = np.arange(n) / FPS
if keys:
    shape_open = np.interp(ts, [k[0] for k in keys], [k[1] for k in keys], left=0, right=0)
    shape_round = np.interp(ts, [k[0] for k in keys], [k[2] for k in keys], left=0, right=0)
else:
    shape_open = shape_round = np.zeros(n)
loud = np.clip(0.35 + 0.9 * sm, 0, 1.15) * (sm > 0)
mouth = np.convolve(np.clip(shape_open * loud, 0, 1), [0.25, 0.5, 0.25], mode='same')
rnd_ = np.convolve(shape_round, [0.25, 0.5, 0.25], mode='same')
json.dump({'fps': FPS, 'open': [round(float(x), 3) for x in mouth], 'round': [round(float(x), 3) for x in rnd_]}, open(out_path, 'w'))
print('boca', n, 'cuadros')
