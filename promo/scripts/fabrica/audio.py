"""Música y efectos de un episodio de la fábrica, sintetizados (sin derechos de terceros).

  musica.wav  amapiano / afro-house; tono, tempo, acordes y patrón del bajo cambian con
              la semilla del episodio, así no suenan todos igual
  sfx.wav     papel que se rasga, hojas que entran, cinta, sellos, marcador, pops y
              campanitas, puestos en los momentos del episodio (episodio.json)

Uso:  python scripts/fabrica/audio.py episodio.json carpeta_salida
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import instrumentos as I  # noqa: E402

ep = json.load(open(sys.argv[1], encoding='utf-8'))
out = sys.argv[2]
seed = int(ep.get('seed', 1))
I.reseed(seed)
R = np.random.default_rng(seed)
V0 = ep['v0']
DUR = ep['total']
SC = ep['scenes']
T = lambda t: t + V0  # noqa: E731  voice seconds -> video seconds
ENTER = 6 / 30

# --- music ---------------------------------------------------------------------------
BPM = float(R.choice([108, 110, 112, 114, 116]))
BEAT = 60 / BPM
STEP = BEAT / 4
SWING = float(R.uniform(0.12, 0.2)) * STEP
SHIFT = int(R.integers(-3, 4))
PROGS = [
    [([57, 60, 64, 67, 71], 45), ([53, 57, 60, 64, 67], 41), ([50, 53, 57, 60, 64], 38), ([52, 55, 59, 62, 67], 40)],   # Am9 Fmaj7 Dm9 Em7
    [([50, 53, 57, 60, 64], 38), ([55, 59, 62, 65, 69], 43), ([48, 52, 55, 59, 62], 36), ([57, 60, 64, 67, 71], 45)],   # Dm9 G9 Cmaj7 Am9
    [([52, 55, 59, 62, 66], 40), ([48, 52, 55, 59, 62], 36), ([55, 59, 62, 66, 69], 43), ([50, 54, 57, 60, 64], 38)],   # Em9 Cmaj7 Gmaj7 D9
]
CH = [([n + SHIFT for n in tones], root + SHIFT) for tones, root in PROGS[int(R.integers(0, len(PROGS)))]]
LOGS = [
    [(0, 0), (3, 0), (6, 12), (8, 0), (10, 7), (13, 0), (14, 12)],
    [(0, 0), (3, 7), (7, 0), (10, 12), (12, 0), (14, 7)],
    [(0, 0), (2, 0), (6, 7), (9, 0), (11, 12), (14, 0)],
]
LOG = LOGS[int(R.integers(0, len(LOGS)))]
first = next((s['t'] for s in SC if s['kind'] != 'intro'), DUR)
feat = [s for s in SC if s['kind'] == 'feature']
lift = T(feat[-1]['t']) if feat else DUR            # the last point lifts the energy
after = next((T(s['t']) for s in SC if s['kind'] in ('todo', 'fin')), DUR)
SEC = [
    (0.0, T(first), {'keys', 'shaker', 'log'}),
    (T(first), lift, {'keys', 'shaker', 'log', 'kick', 'rim', 'clap'}),
    (lift, after, {'keys', 'shaker', 'log', 'kick', 'rim', 'clap', 'stab', 'hats'}),
    (after, DUR + 1, {'keys', 'shaker', 'log', 'kick', 'rim', 'clap', 'stab', 'pad'}),
]
music = I.Track(DUR)
for s in range(int(DUR / STEP)):
    i, bar = s % 16, s // 16
    t0 = s * STEP + (SWING if i % 2 else 0)
    parts = next((p for a, z, p in SEC if a <= s * STEP < z), set())
    tones, root = CH[bar % 4]
    if 'keys' in parts and i in (0, 7, 10):
        music.add(I.rhodes(tones, STEP * (7 if i == 0 else 3)), t0, pan=-0.15, gain=0.5 if i == 0 else 0.32)
    if 'shaker' in parts:
        music.add(I.shaker(), t0, pan=0.35, gain=0.17 if i % 4 == 2 else 0.1)
    if 'log' in parts:
        for st, iv in LOG:
            if st == i:
                music.add(I.logdrum(root - 12 + iv), t0, gain=0.62 if 'kick' in parts else 0.42)
    if 'kick' in parts and i in (0, 8):
        music.add(I.kick(), t0, gain=0.42)
    if 'rim' in parts and i in (3, 6, 11, 14):
        music.add(I.rim(), t0, pan=-0.4, gain=0.16)
    if 'clap' in parts and i in (4, 12):
        music.add(I.clap(), t0, pan=0.1, gain=0.25)
    if 'hats' in parts and i % 4 == 2:
        music.add(I.hat(open_=True), t0, pan=0.25, gain=0.13)
    if 'stab' in parts and i in (2, 9) and bar % 2 == 1:
        music.add(I.stab(tones[1:4]), t0, pan=0.3, gain=0.35)
    if 'pad' in parts and i == 0:
        music.add(I.pad(tones, BEAT * 4 + 0.3, 1300), t0, gain=0.25)
music.write(os.path.join(out, 'musica.wav'), 0.85)

# --- effects --------------------------------------------------------------------------
fx = I.Track(DUR)


def chime(at, notes=(84, 88, 91), gain=0.26):
    for k, n in enumerate(notes):
        fx.add(I.glass(n, 0.9), at + k * 0.07, pan=-0.5 + k * 1.0 / max(1, len(notes) - 1), gain=gain)


def pops(at, n, gap, gain=0.28):
    for k in range(n):
        fx.add(I.pop_fx(), at + k * gap, pan=-0.6 + 1.2 * k / max(1, n - 1), gain=gain)


SOUND = {
    'ducki': lambda t: fx.add(I.stamp(), t, gain=0.6),
    'fav': lambda t: (fx.add(I.pop_fx(), t, gain=0.4), fx.add(I.scribble(0.3), t + 0.13, gain=0.5)),
    'anon': lambda t: (fx.add(I.tick(), t, gain=0.9), fx.add(I.scribble(0.3), t + 0.02, gain=0.5), fx.add(I.pop_fx(), t + 0.07, gain=0.4)),
    'mapa': lambda t: (pops(t - 0.13, 5, 0.1, 0.3), fx.add(I.scribble(0.3), t, gain=0.35)),
    'amigos': lambda t: fx.add(I.scribble(0.3), t, gain=0.5),
    'cientos': lambda t: pops(t, 10, 1 / 30),
    'dibuja': lambda t: fx.add(I.scribble(0.5), t, gain=0.5),
    'celular': lambda t: (fx.add(I.stamp(), t, gain=0.6), chime(t + 0.1)),
    'gente': lambda t: fx.add(I.pop_fx(), t, gain=0.35),
    'cualquier': lambda t: [fx.add(I.tick(), t + k / 30, pan=-0.6 + k * 0.15, gain=0.25) for k in range(9)],
    'carta': lambda t: fx.add(I.stamp(), t, gain=0.55),
    'firmada': lambda t: fx.add(I.scribble(0.4), t, gain=0.5),
    'anonima': lambda t: fx.add(I.stamp(), t, gain=0.75),
    'crush': lambda t: [fx.add(I.scribble(0.2), t + k * 0.1, pan=-0.5 + k * 0.25, gain=0.3) for k in range(5)],
    'match': lambda t: (fx.add(I.stamp(), t, gain=0.6), chime(t + 0.05, (84, 88, 91, 96), 0.3)),
    'duckisala': lambda t: fx.add(I.pop_fx(), t, gain=0.4),
    'voz': lambda t: fx.add(I.bubble(500, 1300, 0.12), t, gain=0.35),
    'juegos': lambda t: (fx.add(I.riser(0.5), t - 0.5, gain=0.3), fx.add(I.boom()[: int(I.SR * 0.5)], t, gain=0.45)),
    'kart': lambda t: (fx.add(I.stamp(), t, gain=0.55), fx.add(I.engine(0.6), t + 0.1, gain=0.25)),
    'golf': lambda t: (fx.add(I.stamp(), t, gain=0.55), fx.add(I.putt(), t + 0.25, gain=0.5)),
    'impostor': lambda t: fx.add(I.stamp(), t, gain=0.55),
    'quien': lambda t: fx.add(I.stamp(), t, gain=0.55),
    'porvoz': lambda t: fx.add(I.bubble(500, 1300, 0.12), t, gain=0.35),
    'app': lambda t: (fx.add(I.stamp(), t, gain=0.55), chime(t + 0.1)),
    'cali': lambda t: fx.add(I.pop_fx(), t, gain=0.35),
    'gratis': lambda t: (fx.add(I.stamp(), t, gain=0.6), fx.add(I.stamp(), t + 0.13, gain=0.4)),
    'aqui': lambda t: (chime(t, (84, 88, 91, 96, 98), 0.3), pops(t, 8, 2 / 30, 0.25)),
}

# the hook: the page tears open, the title letters land
fx.add(I.rip(0.35), 0.0, gain=0.9)
fx.add(I.boom()[: int(I.SR * 0.5)], 0.05, gain=0.35)
for k in range(len(ep['hook']['title'].replace(' ', ''))):
    fx.add(I.tick(), 0.07 + k * 0.067, pan=-0.5 + k / 8, gain=0.35)
fx.add(I.pop_fx(), 0.95 + V0, gain=0.35)
for idx, s in enumerate(SC):
    if s['kind'] != 'intro':
        fx.add(I.slide(), T(s['t']) - ENTER, pan=0.3, gain=0.7)
        fx.add(I.tape(), T(s['t']) + 0.05, pan=-0.2, gain=0.45)
        fx.add(I.pop_fx(), T(s['t']) + 0.25, gain=0.25)
    end = T(SC[idx + 1]['t']) if idx + 1 < len(SC) else DUR
    if s.get('feature') == 'pato':                      # the outfit flips until the burst
        until = T(s['ev'].get('cientos', s['t'] + 2))
        k = 0
        while T(s['t']) + 0.2 + k * 4 / 30 < min(until, end):
            fx.add(I.tick(), T(s['t']) + 0.2 + k * 4 / 30, pan=0.15, gain=0.12)
            k += 1
    if s.get('feature') == 'parche':
        pops(T(s['t']) + ENTER, 9, 2 / 30, 0.22)
    if s['kind'] == 'todo':
        for k in range(9):
            fx.add(I.slide(0.12), T(s['t']) + ENTER + k * 0.1, pan=-0.6 + k * 0.15, gain=0.35)
    if s['kind'] == 'fin':
        fx.add(I.boom()[: int(I.SR * 0.6)], T(s['t']), gain=0.4)
    for name, t in s['ev'].items():
        if name in SOUND:
            SOUND[name](T(t))
fx.write(os.path.join(out, 'sfx.wav'), 0.8)
print(f'audio: {BPM:.0f} BPM, tono {SHIFT:+d}, {DUR:.1f} s')
