// The director's preview: checks the storyboard and renders frames of it in one image,
// so the director can look at its work and fix it before the video is rendered.
//
//   node promo/scripts/fabrica/director/cuadros.mjs <carpeta-del-episodio> [segundos,separados,por,comas]
//
// Without times it takes, per scene, a frame when its pieces are coming in and one at its
// end. Writes <carpeta>/revision/hoja-N.jpg (N grows each run) and prints its path.
import fs from 'node:fs';
import path from 'node:path';
import { FAB, python, readJson } from '../comun.mjs';
import { cargarFormato } from '../formatos/index.mjs';
import { renderEpisodio } from '../render.mjs';
import { episodioLibre, revisarStoryboard } from './storyboard.mjs';

const [, , carpeta, tiempos] = process.argv;
if (!carpeta) { console.error('uso: cuadros.mjs <carpeta-del-episodio> [segundos]'); process.exit(2); }
const dir = path.resolve(carpeta);
const base = readJson(path.join(dir, 'director-base.json'));
let storyboard;
try { storyboard = readJson(path.join(dir, 'storyboard.json')); } catch (e) {
  console.error(`No pude leer storyboard.json: ${e.message}`); process.exit(1);
}
const fmt = await cargarFormato(base.spec?.formato);
// a format with its own storyboard (the newscast's TV) checks and builds it itself
const problems = fmt.revisarStoryboard ? fmt.revisarStoryboard(storyboard, base) : revisarStoryboard(storyboard, base.words);
if (problems.length) {
  console.error(`El storyboard tiene ${problems.length} problema(s); corrígelos y vuelve a correr:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
const funciones = readJson(path.join(FAB, 'funciones.json'));
const episode = fmt.conStoryboard ? fmt.conStoryboard({ ...base, storyboard }) : episodioLibre({ ...base, funciones, storyboard });
const v0 = episode.v0;
let stills, labels;
if (tiempos) {
  stills = tiempos.split(',').map(Number).filter((x) => x >= 0).map((x) => +(x + v0).toFixed(2));
  labels = stills.map((s) => `${(s - v0).toFixed(1)} s`);
} else {
  stills = []; labels = [];
  episode.scenes.forEach((s, i) => {
    const t1 = i + 1 < episode.scenes.length ? episode.scenes[i + 1].t : episode.total - v0 - 0.3;
    const len = t1 - s.t;
    const at = len > 2.6 && !episode.libre?.[i]?.prefab ? [0.5, 0.93] : [0.88];
    for (const k of at) { const t = s.t + len * k; stills.push(+(t + v0).toFixed(2)); labels.push(`escena ${i} · ${t.toFixed(1)} s`); }
  });
}
const tmp = path.join(dir, 'revision', 'tmp');
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });
await renderEpisodio({ episode, dir: tmp, slug: 'revision', stills, fmt });
const files = fs.readdirSync(tmp).filter((f) => f.startsWith('cuadro-')).sort();
const prev = fs.readdirSync(path.join(dir, 'revision')).filter((f) => /^hoja-\d+\.jpg$/.test(f)).length;
const out = path.join(dir, 'revision', `hoja-${prev + 1}.jpg`);
python(['scripts/fabrica/director/hoja.py', out, ...files.map((f, k) => `${labels[k] ?? f}=${path.join(tmp, f)}`)]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Hoja de revisión: ${out}`);
console.log('Cuadros (de izquierda a derecha, de arriba abajo):\n' + labels.map((l, k) => `  ${k + 1}. ${l}`).join('\n'));
