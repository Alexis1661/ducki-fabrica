// Renders an Episode with the «Lista» template (src/fabrica/Lista.tsx) and mixes the
// audio: <slug>.mp4 with music (Instagram) and <slug>-sin-musica.mp4 (TikTok, where
// a trending sound goes on top). Video in resumable parts, like scripts/todo-mp4.mjs.
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PROMO, ffmpeg } from './comun.mjs';

// Only what the template uses: bundling all of public/ would copy ~1 GB of clips into %TEMP%.
function publicDir(fmt) {
  const pub = path.resolve(process.env.TEMP ?? '.', 'fabrica-public');
  fs.rmSync(pub, { recursive: true, force: true });
  const walk = (d) => fs.readdirSync(path.join(PROMO, 'public', d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
  const files = fmt.publico.filter((p) => fs.existsSync(path.join(PROMO, 'public', p)))
    .flatMap((p) => (fs.statSync(path.join(PROMO, 'public', p)).isDirectory() ? walk(p) : [p]))
    .filter((f) => !f.startsWith('generados/pendientes/'))
    .filter((f) => !/^todo\/.*\/?(voz|voz16|music|sfx)\.wav$/.test(f));
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(pub, f)), { recursive: true });
    fs.copyFileSync(path.join(PROMO, 'public', f), path.join(pub, f));
  }
  return pub;
}

export function mix(video, out, { voz, sfx, musica, v0, musicVol = 0.13 }) {
  const ms = Math.round(v0 * 1000);
  const inputs = ['-i', video, '-i', voz, '-i', sfx];
  let filter = `[1:a]adelay=${ms}|${ms},aresample=48000[v];[2:a]volume=0.45,aresample=48000[s]`;
  let ins = '[v][s]', n = 2;
  if (musica) { inputs.push('-i', musica); filter += `;[3:a]volume=${musicVol},aresample=48000[m]`; ins += '[m]'; n = 3; }
  // one-pass loudnorm, as in the earlier videos: with the ElevenLabs voice it lands at
  // about -14.5 LUFS (the robotic Windows test voice comes out ~2 dB lower)
  filter += `;${ins}amix=inputs=${n}:normalize=0:duration=longest,loudnorm=I=-14:TP=-1.5:LRA=11[a]`;
  ffmpeg([...inputs, '-filter_complex', filter, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-shortest', out]);
}

export async function renderEpisodio({ episode, dir, slug, stills = null, fmt }) {
  if (!fmt) fmt = await (await import('./formatos/index.mjs')).cargarFormato(null);
  const pub = publicDir(fmt);
  try {
    const serveUrl = await bundle({ entryPoint: path.join(PROMO, 'src', 'fabrica', 'index.ts'), publicDir: pub });
    const inputProps = { episode };
    const composition = await selectComposition({ serveUrl, id: fmt.composicion, inputProps });
    if (stills) {
      for (const s of stills) {
        const frame = Math.min(composition.durationInFrames - 1, Math.round(s * composition.fps));
        await renderStill({ serveUrl, composition, frame, inputProps, output: path.join(dir, `cuadro-${s.toFixed(2).padStart(5, '0')}.jpg`), imageFormat: 'jpeg', jpegQuality: 80 });
      }
      return [];
    }
    const parts = path.join(dir, 'partes');
    fs.mkdirSync(parts, { recursive: true });
    const N = composition.durationInFrames, STEP = 450, list = [];
    for (let a = 0; a < N; a += STEP) {
      const b = Math.min(N, a + STEP) - 1;
      const file = path.join(parts, `p${String(a).padStart(5, '0')}.mp4`);
      list.push(file);
      if (fs.existsSync(file)) continue;
      for (let attempt = 1; ; attempt++) {
        try {
          await renderMedia({ serveUrl, composition, inputProps, codec: 'h264', crf: 18, muted: true, frameRange: [a, b], outputLocation: `${file}.tmp.mp4`, concurrency: Number(process.env.RENDER_CONCURRENCY ?? Math.max(1, os.cpus().length)) });
          fs.renameSync(`${file}.tmp.mp4`, file);
          console.log(`  cuadros ${a}-${b} listos`);
          break;
        } catch (e) {
          console.log(`  parte ${a} falló (intento ${attempt}): ${String(e).split('\n')[0]}`);
          if (attempt >= 3) throw e;
        }
      }
    }
    fs.writeFileSync(path.join(parts, 'lista.txt'), list.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
    const video = path.join(parts, 'video.mp4');
    ffmpeg(['-f', 'concat', '-safe', '0', '-i', path.join(parts, 'lista.txt'), '-c', 'copy', video]);
    const audio = { voz: path.join(dir, 'voz.wav'), sfx: path.join(dir, 'sfx.wav'), v0: episode.v0 };
    const conMusica = path.join(dir, `${slug}.mp4`), sinMusica = path.join(dir, `${slug}-sin-musica.mp4`);
    mix(video, conMusica, { ...audio, musica: path.join(dir, 'musica.wav') });
    mix(video, sinMusica, audio);
    fs.rmSync(parts, { recursive: true, force: true });
    return [conMusica, sinMusica];
  } finally {
    fs.rmSync(pub, { recursive: true, force: true });
  }
}
