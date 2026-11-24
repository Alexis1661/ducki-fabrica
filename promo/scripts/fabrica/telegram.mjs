// The factory's side of the Telegram review: posts a proposal into the moderation
// group's «Fábrica» topic with the same bot the moderation uses, and waits for the
// team's answer. The bot itself (the API's internal/modbot) receives the buttons —
// a bot has one long-polling reader — and the factory reads the decisions back
// from the API (internal/fabrica): GET /api/v1/fabrica/decisiones.
//
// .env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_TOPIC_FABRICA, FABRICA_TOKEN,
//       FABRICA_API (default https://api.duck-i.app).
import fs from 'node:fs';
import path from 'node:path';
import { FAB, duration, ffmpeg, readJson, writeJson } from './comun.mjs';

const need = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Falta ${k} en RecursosVideo/fabrica/.env`);
  return v;
};
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ESTADO = path.join(FAB, '.estado.json');

/** Callback data is capped at 64 bytes: "f:ok:" + the episode id. */
export const idCorto = (id) => Buffer.from(id).subarray(0, 59).toString().replace(/�+$/, '');

/** Telegram bots upload up to 50 MB: the preview is a lighter copy (720p). */
function preview(video, dir) {
  const out = path.join(dir, 'vista-previa.mp4');
  ffmpeg(['-i', video, '-vf', 'scale=720:-2', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out]);
  return out;
}

export async function enviarPropuesta({ dir, id, spec, video, version = 1 }) {
  const token = need('TELEGRAM_BOT_TOKEN'), chat = need('TELEGRAM_CHAT_ID');
  const topic = Number(process.env.TELEGRAM_TOPIC_FABRICA ?? 0);
  const file = preview(video, dir);
  const secs = Math.round(duration(file));
  let caption = [
    `<b>🎬 Fábrica · ${esc(spec.gancho?.titulo)}</b>${version > 1 ? ` (versión ${version})` : ''}`,
    esc(spec.intro),
    '',
    '<i>Texto para publicar:</i>',
    esc(spec.caption),
    esc((spec.hashtags ?? []).join(' ')),
    '',
    `<code>${esc(id)}</code> · ${secs} s`,
  ].join('\n');
  if (caption.length > 1000) caption = caption.slice(0, 997) + '…';
  const short = idCorto(id);
  const form = new FormData();
  form.set('chat_id', chat);
  if (topic) form.set('message_thread_id', String(topic));
  form.set('caption', caption);
  form.set('parse_mode', 'HTML');
  form.set('supports_streaming', 'true');
  form.set('width', '720');
  form.set('height', '1280');
  form.set('duration', String(secs));
  form.set('reply_markup', JSON.stringify({
    inline_keyboard: [
      [{ text: '✅ Aprobar', callback_data: `f:ok:${short}` }, { text: '✏️ Ajustar', callback_data: `f:aj:${short}` }],
      [{ text: '🗑 Descartar', callback_data: `f:no:${short}` }],
    ],
  }));
  form.set('video', new Blob([fs.readFileSync(file)], { type: 'video/mp4' }), path.basename(file));
  const res = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, { method: 'POST', body: form });
  const body = await res.json();
  if (!body.ok) throw new Error(`Telegram no aceptó el video: ${body.description}`);
  writeJson(path.join(dir, 'telegram.json'), { message_id: body.result.message_id, enviado: new Date().toISOString(), version, id: short });
  return short;
}

/**
 * Step 1 when the voice is made by hand: posts the script to the topic. Someone
 * reads it into ElevenLabs (web) and replies to this message with the audio; the
 * moderation bot sees the reply, reads the 🆔 line and starts the video run.
 * The 🆔 line is what the bot parses: keep its format in sync with
 * Backend/internal/modbot/factory.go (scriptIDRE).
 */
export async function enviarGuion({ dir, id, spec, texto, version = 1 }) {
  const token = need('TELEGRAM_BOT_TOKEN'), chat = need('TELEGRAM_CHAT_ID');
  const topic = Number(process.env.TELEGRAM_TOPIC_FABRICA ?? 0);
  const text = [
    `<b>🎙 Guion · ${esc(spec.gancho?.titulo)}</b>${version > 1 ? ` (versión ${version})` : ''}`,
    'Pega esto en ElevenLabs con la voz del pato:',
    `<pre>${esc(texto)}</pre>`,
    '<b>Responde a este mensaje con el audio</b> (mp3 o wav; mantén presionado → Responder) y la fábrica arma el video.',
    '',
    `<i>Texto para publicar:</i> ${esc(spec.caption)}`,
    '',
    `🆔 <code>${esc(id)}</code>`,
  ].join('\n');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, ...(topic ? { message_thread_id: topic } : {}), text, parse_mode: 'HTML' }),
  });
  const body = await res.json();
  if (!body.ok) throw new Error(`Telegram no aceptó el guion: ${body.description}`);
  writeJson(path.join(dir, 'guion-telegram.json'), { message_id: body.result.message_id, enviado: new Date().toISOString(), version, id });
}

/** Downloads a file the team sent to the bot (bots can fetch up to 20 MB). */
export async function bajarArchivo(fileId, destSinExt) {
  const token = need('TELEGRAM_BOT_TOKEN');
  const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const body = await res.json();
  if (!body.ok) throw new Error(`Telegram no entregó el audio (${body.description}); ¿pesa más de 20 MB?`);
  const p = body.result.file_path;
  const ext = path.extname(p) || '.mp3';
  const bin = await fetch(`https://api.telegram.org/file/bot${token}/${p}`);
  if (!bin.ok) throw new Error(`No pude bajar el audio: HTTP ${bin.status}`);
  const out = destSinExt + ext;
  fs.writeFileSync(out, Buffer.from(await bin.arrayBuffer()));
  return out;
}

function estado() {
  return fs.existsSync(ESTADO) ? readJson(ESTADO) : {};
}

/** All decisions newer than the saved cursor (and moves the cursor). */
export async function leerDecisiones() {
  const api = (process.env.FABRICA_API ?? 'https://api.duck-i.app').replace(/\/$/, '');
  const st = estado();
  const url = `${api}/api/v1/fabrica/decisiones${st.cursor ? `?desde=${encodeURIComponent(st.cursor)}` : ''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${need('FABRICA_TOKEN')}` } });
  if (res.status === 404) throw new Error('El backend todavía no tiene la fábrica conectada (falta desplegar o FABRICA_TOKEN).');
  if (!res.ok) throw new Error(`El backend respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const { data } = await res.json();
  const pend = st.pendientes ?? [];
  for (const d of data.decisiones) pend.push(d);
  writeJson(ESTADO, { ...st, cursor: data.cursor, pendientes: pend });
  return pend;
}

/** Waits until the team answers about `id` (polling every `cada` seconds); returns that decision. */
export async function esperarDecision(id, { cada = 15, maxHoras = 24 } = {}) {
  const hasta = Date.now() + maxHoras * 3600e3;
  for (;;) {
    let pend = [];
    try { pend = await leerDecisiones(); } catch (e) {
      if (String(e.message).includes('desplegar')) throw e;
      console.log(`  (no pude leer decisiones: ${String(e.message).split('\n')[0]}; reintento)`);
    }
    const i = pend.findIndex((d) => d.episodio === id);
    if (i >= 0) {
      const [d] = pend.splice(i, 1);
      writeJson(ESTADO, { ...estado(), pendientes: pend });
      return d;
    }
    if (Date.now() > hasta) throw new Error(`Nadie respondió sobre ${id} en ${maxHoras} h.`);
    await new Promise((r) => setTimeout(r, cada * 1000));
  }
}
