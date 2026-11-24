// The reference videos for a new format, made readable for Opus: Claude cannot watch
// a video, so each one becomes contact sheets (2 frames per second), the frames where
// the shot changes, and a transcript with timings.
//
//   node scripts/fabrica/referencias.mjs --texto "links y notas" [--archivos "id1\nid2"] --salida <carpeta>
//
// Links (TikTok, Instagram, YouTube…) are downloaded with yt-dlp; videos sent to the
// bot come as Telegram file ids. Whatever fails is written down instead of stopping:
// the format can still be made from the rest.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { duration, ffmpeg, loadEnv, python, readJson } from './comun.mjs';
import { bajarArchivo } from './telegram.mjs';

function args() {
  const a = process.argv.slice(2), o = {};
  for (let i = 0; i < a.length; i++) o[a[i].replace(/^--/, '')] = a[++i] ?? '';
  return o;
}

const LINK = /https?:\/\/[^\s<>"']+/g;

function bajarLink(url, base) {
  const r = spawnSync('yt-dlp', ['-q', '--no-playlist', '-f', 'mp4/bestvideo*+bestaudio/best', '--merge-output-format', 'mp4', '-o', `${base}.%(ext)s`, url], { encoding: 'utf8', timeout: 180_000 });
  const file = fs.readdirSync(path.dirname(base)).find((f) => f.startsWith(path.basename(base) + '.'));
  if (r.status !== 0 || !file) throw new Error((r.stderr || r.stdout || 'yt-dlp falló').trim().split('\n').slice(-2).join(' '));
  return path.join(path.dirname(base), file);
}

/** Contact sheets: 16 frames per sheet (4×4), 2 per second, each 270×480. */
function hojas(video, dir, n) {
  const pat = path.join(dir, `ref${n}-hoja-%02d.jpg`);
  ffmpeg(['-i', video, '-vf', 'fps=2,scale=270:480:force_original_aspect_ratio=decrease,pad=270:480:(ow-iw)/2:(oh-ih)/2,tile=4x4', '-q:v', '4', pat]);
  return fs.readdirSync(dir).filter((f) => f.startsWith(`ref${n}-hoja-`)).sort();
}

/** Frames where the shot changes (at most 24), at 540 px wide, named by their second. */
function cortes(video, dir, n) {
  const tmp = path.join(dir, `ref${n}-corte-%03d.jpg`);
  ffmpeg(['-i', video, '-vf', "select='gt(scene,0.32)',scale=540:-2", '-vsync', 'vfr', '-frames:v', '24', '-q:v', '4', tmp]);
  return fs.readdirSync(dir).filter((f) => f.startsWith(`ref${n}-corte-`)).sort();
}

function transcribir(video, dir, n) {
  const w16 = path.join(dir, `ref${n}-16k.wav`);
  try {
    ffmpeg(['-i', video, '-ac', '1', '-ar', '16000', w16]);
    const out = path.join(dir, `ref${n}-palabras.json`);
    python(['scripts/transcribe.py', w16, out]);
    const words = readJson(out);
    // lines of about 8 words with their start time
    const lines = [];
    for (let i = 0; i < words.length; i += 8) lines.push(`[${words[i].s.toFixed(1)} s] ${words.slice(i, i + 8).map((w) => w.w).join(' ')}`);
    return lines.join('\n') || '(sin voz)';
  } catch (e) {
    return `(no pude transcribir: ${String(e.message).split('\n')[0]})`;
  } finally {
    fs.rmSync(w16, { force: true });
  }
}

loadEnv();
const o = args();
const out = path.resolve(o.salida);
fs.mkdirSync(out, { recursive: true });
const texto = o.texto ?? '';
const links = [...new Set(texto.match(LINK) ?? [])];
const archivos = (o.archivos ?? '').split(/\s+/).filter(Boolean);
const notas = texto.replace(LINK, '').trim();
const md = ['# Referencias para el formato nuevo', '', `Notas del equipo: ${notas || '(ninguna)'}`, ''];
let n = 0;
const fuentes = [...links.map((l) => ({ tipo: 'link', v: l })), ...archivos.map((a) => ({ tipo: 'archivo', v: a }))];
for (const f of fuentes) {
  n += 1;
  const base = path.join(out, `ref${n}`);
  md.push(`## Referencia ${n}`, '', `Fuente: ${f.tipo === 'link' ? f.v : 'video enviado al bot'}`);
  try {
    const video = f.tipo === 'link' ? bajarLink(f.v, base) : await bajarArchivo(f.v, base);
    const secs = duration(video);
    const hs = hojas(video, out, n), cs = cortes(video, out, n);
    md.push(`Duración: ${secs.toFixed(1)} s · ${cs.length} cambios de plano detectados`, '',
      `Hojas de contacto (2 cuadros por segundo, 16 por hoja, de izquierda a derecha y de arriba abajo): ${hs.join(', ')}`,
      `Cuadros donde cambia el plano: ${cs.join(', ') || '(ninguno)'}`, '', 'Transcripción:', '```', transcribir(video, out, n), '```', '');
    fs.rmSync(video, { force: true });
  } catch (e) {
    md.push(`**No pude bajarla:** ${String(e.message).slice(0, 300)}`, '');
    console.log(`referencia ${n}: ${String(e.message).split('\n')[0]}`);
  }
}
if (!fuentes.length) md.push('(No llegó ningún link ni video: diseña a partir de las notas.)');
fs.writeFileSync(path.join(out, 'README.md'), md.join('\n') + '\n');
console.log(`referencias: ${fuentes.length} fuentes → ${out}`);
