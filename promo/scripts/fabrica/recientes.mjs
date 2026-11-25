// The captures and clips the last videos showed. The same feed post or the same room screenshot
// in every video gets old, so the next videos must not repeat them: the writers don't get them
// offered and their validators, the director's included, reject them.
// FABRICA_SIN_REPETIR: how many recent videos count (6 by default; 0 turns it off).
import fs from 'node:fs';
import path from 'node:path';
import { FAB } from './comun.mjs';
import { cargarCatalogo } from './director/storyboard.mjs';

/** Captures each prefab scene of the scrapbook shows (promo/src/fabrica/Lista.tsx). */
export const PREFAB_CAPTURAS = {
  publica: ['screens/feed.jpg'],
  sala: ['todo/stills/sala.jpg'],
  carta: ['v0110/carta.mp4'],
  crush: ['todo/stills/crush-menu.jpg', 'todo/stills/match.jpg'],
  juegos: ['parches/games/golf.mp4', 'parches/games/kart.mp4', 'todo/stills/kart.jpg'],
  mapa: ['map/cali.png'],
};

/**
 * Catalog captures and clips (tipo imagen or clip) shown in the last n rendered videos. The
 * versions of `dir`'s own video don't count (an adjustment may keep its pictures).
 */
export function capturasRecientes(dir = null, n = Number(process.env.FABRICA_SIN_REPETIR ?? 6), catalogo = cargarCatalogo()) {
  const base = path.join(FAB, 'episodios');
  if (!fs.existsSync(base) || !(n > 0)) return [];
  const propio = dir ? path.basename(dir).replace(/-v\d+$/, '') : null;
  const captura = (x) => {
    const r = typeof x === 'string' ? catalogo.buscar(x) : null;
    return r && (r.tipo === 'imagen' || r.tipo === 'clip') ? r.ruta : null;
  };
  // the last rendered version of each video, by date
  const porVideo = new Map();
  for (const d of fs.readdirSync(base).sort()) {
    if (!/^\d{4}-\d{2}-\d{2}-/.test(d) || !fs.existsSync(path.join(base, d, 'episodio.json'))) continue;
    const id = d.replace(/-v\d+$/, '');
    if (id !== propio) porVideo.set(id, d);
  }
  const usadas = new Set();
  for (const d of [...porVideo.values()].sort().slice(-n)) {
    let ep;
    try { ep = JSON.parse(fs.readFileSync(path.join(base, d, 'episodio.json'), 'utf8')); } catch { continue; }
    const walk = (o) => {
      if (!o || typeof o !== 'object') return;
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === 'string') { if (k === 'src' || k === 'recurso') { const r = captura(v); if (r) usadas.add(r); } } else walk(v);
      }
    };
    walk(ep);
    for (const s of [...(ep.scenes ?? []), ...(ep.libre ?? [])]) for (const r of PREFAB_CAPTURAS[s?.feature ?? s?.prefab ?? ''] ?? []) usadas.add(r);
  }
  return [...usadas].sort();
}

/** Problems: pieces or prefabs of a storyboard (scrapbook sheets or newscast screens) that show a recent capture. */
export function revisarRepetidas(sb, prohibidos, catalogo = cargarCatalogo()) {
  if (!prohibidos?.length) return [];
  const P = new Set(prohibidos);
  const err = [];
  const escenas = sb?.escenas ?? sb?.pantallas ?? [];
  escenas.forEach((s, i) => {
    const at = sb?.escenas ? `escenas[${i}]` : `pantallas[${i}] (noticia ${i + 1})`;
    for (const r of PREFAB_CAPTURAS[s?.prefab ?? ''] ?? []) {
      if (P.has(r)) err.push(`${at}: el prefab «${s.prefab}» muestra ${r}, que salió en los últimos videos: compón esa escena tú con otra captura, un clip o una ilustración`);
    }
    (s?.elementos ?? []).forEach((e, k) => {
      const ruta = e.recurso ? catalogo.buscar(e.recurso)?.ruta ?? e.recurso : null;
      if (ruta && P.has(ruta)) err.push(`${at}.elementos[${k}]: «${ruta}» ya salió en los últimos videos; usa otra captura, un clip o una ilustración`);
    });
  });
  return err;
}
