// Stills of an episode, to check a layout without rendering the whole video.
//   node scripts/fabrica/cuadros.mjs <episodio.json> <carpeta> [mitad | 1.5,7,12.2]
// "mitad" (default) takes one frame near the end of each scene, when its pieces are all in.
import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './comun.mjs';
import { renderEpisodio } from './render.mjs';

const [, , epFile, out, which = 'mitad'] = process.argv;
const episode = readJson(path.resolve(epFile));
fs.mkdirSync(out, { recursive: true });
let stills;
if (which === 'mitad') {
  stills = episode.scenes.map((s, i) => {
    const t1 = i + 1 < episode.scenes.length ? episode.scenes[i + 1].t : episode.total - episode.v0;
    return +(episode.v0 + s.t + (t1 - s.t) * 0.85).toFixed(2);
  });
} else stills = which.split(',').map(Number);
await renderEpisodio({ episode, dir: path.resolve(out), slug: 'cuadros', stills });
console.log(stills.join(' '));
