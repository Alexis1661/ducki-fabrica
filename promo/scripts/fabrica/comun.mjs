// Shared bits of the video factory: paths, the .env, ffmpeg, child processes.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROMO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const FAB = path.resolve(PROMO, '..', 'fabrica');
// ffmpeg: on Windows the one imageio-ffmpeg brings; elsewhere (GitHub Actions) the system's.
export const FF = process.env.FFMPEG ?? (process.platform === 'win32'
  ? path.join(process.env.APPDATA ?? '', 'Python', 'Python312', 'site-packages', 'imageio_ffmpeg', 'binaries', 'ffmpeg-win-x86_64-v7.1.exe')
  : 'ffmpeg');

/** Reads RecursosVideo/fabrica/.env (KEY=VALUE lines) without overriding variables already set. */
export function loadEnv(file = path.join(FAB, '.env')) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const v = m[2].replace(/^['"]|['"]$/g, '');
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

export const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
export const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 1));

export function ffmpeg(args) {
  execFileSync(FF, ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
}
/** Length of an audio/video file in seconds (from ffmpeg's banner). */
export function duration(file) {
  const r = spawnSync(FF, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const m = r.stderr.match(/Duration: (\d+):(\d+):([\d.]+)/);
  if (!m) throw new Error(`no pude leer la duración de ${file}`);
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
}
export function python(args) {
  const r = spawnSync(process.env.PYTHON ?? 'python', args, { cwd: PROMO, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`python ${args[0]} falló (código ${r.status}):\n${r.stderr || r.stdout}`);
  return r.stdout;
}

/** Lower-case, no accents, letters and digits only: how words are compared. */
export const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const slugify = (s) => s.split(/[\s_-]+/).map(norm).filter(Boolean).join('-').slice(0, 48) || 'episodio';
