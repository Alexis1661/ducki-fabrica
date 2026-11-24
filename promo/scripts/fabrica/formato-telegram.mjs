// Messages of the new-format workflow (.github/workflows/formato.yml) in the «Fábrica» topic.
//
//   node scripts/fabrica/formato-telegram.mjs propuesta <formato-nuevo.json> [version]
//   node scripts/fabrica/formato-telegram.mjs aviso "texto"
//
// The proposal is the first video of the format (1080p, with music) with three buttons
// the moderation bot receives: f:fok (approve: merge into main), f:faj (adjust: Opus
// changes it), f:fno (discard).
import fs from 'node:fs';
import path from 'node:path';
import { duration, ffmpeg, loadEnv } from './comun.mjs';

const need = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Falta ${k}`);
  return v;
};
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ROOT = path.resolve(process.cwd(), '..');

async function call(method, body) {
  const token = need('TELEGRAM_BOT_TOKEN');
  const isForm = body instanceof FormData;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', body: isForm ? body : JSON.stringify(body), headers: isForm ? undefined : { 'Content-Type': 'application/json' },
  });
  const out = await res.json();
  if (!out.ok) throw new Error(`Telegram (${method}): ${out.description}`);
  return out.result;
}

function destino() {
  const topic = Number(process.env.TELEGRAM_TOPIC_FABRICA ?? 0);
  return { chat_id: need('TELEGRAM_CHAT_ID'), ...(topic ? { message_thread_id: topic } : {}) };
}

async function aviso(texto) {
  await call('sendMessage', { ...destino(), text: texto, parse_mode: 'HTML' });
}

async function propuesta(file, version = 1) {
  const nuevo = JSON.parse(fs.readFileSync(file, 'utf8'));
  let video = path.resolve(ROOT, nuevo.video);
  if (fs.statSync(video).size / 1e6 > 49.5) {
    const out = video.replace(/\.mp4$/, '-telegram.mp4');
    const kbps = Math.floor((48 * 8000) / duration(video)) - 192;
    ffmpeg(['-i', video, '-c:v', 'libx264', '-preset', 'slow', '-b:v', `${kbps}k`, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]);
    video = out;
  }
  let caption = [
    `<b>${esc(nuevo.emoji ?? '🆕')} Formato nuevo · ${esc(nuevo.nombre)}</b>${version > 1 ? ` (versión ${version})` : ''}`,
    esc(nuevo.resumen),
    '',
    'Es el video «9 cosas» con este estilo. <b>Aprobar</b> lo deja en /video; <b>Ajustar</b> le pide cambios a Opus.',
    `<code>${esc(nuevo.id)}</code>`,
  ].join('\n');
  if (caption.length > 1000) caption = caption.slice(0, 997) + '…';
  const form = new FormData();
  for (const [k, v] of Object.entries(destino())) form.set(k, String(v));
  form.set('caption', caption);
  form.set('parse_mode', 'HTML');
  form.set('supports_streaming', 'true');
  form.set('width', '1080');
  form.set('height', '1920');
  form.set('reply_markup', JSON.stringify({
    inline_keyboard: [
      [{ text: '✅ Aprobar formato', callback_data: `f:fok:${nuevo.id}` }, { text: '✏️ Ajustar', callback_data: `f:faj:${nuevo.id}` }],
      [{ text: '🗑 Descartar', callback_data: `f:fno:${nuevo.id}` }],
    ],
  }));
  form.set('video', new Blob([fs.readFileSync(video)], { type: 'video/mp4' }), path.basename(video));
  await call('sendVideo', form);
}

loadEnv();
const [cmd, a, b] = process.argv.slice(2);
const run = cmd === 'propuesta' ? () => propuesta(a, Number(b ?? 1)) : cmd === 'aviso' ? () => aviso(a) : null;
if (!run) { console.error('uso: formato-telegram.mjs propuesta <formato-nuevo.json> [version] | aviso "texto"'); process.exit(2); }
run().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
