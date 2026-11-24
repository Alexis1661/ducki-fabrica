// New resources made with AI (OpenAI's image model, with the production key): the duck in
// situations the catalog doesn't have. At most FABRICA_IMAGENES_DIA a day (1 by default).
// Each one goes to the «Fábrica» topic with ✅ Aprobar / 🗑 Descartar; approved, it joins the
// director's catalog (promo/public/generados/ + fabrica/catalogo/generados.json).
//
//   node scripts/fabrica/imagenes.mjs generar                 the image of the day (if any is left)
//   node scripts/fabrica/imagenes.mjs decidir --imagen <id> --accion aprobar|descartar
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAB, PROMO, loadEnv, readJson, slugify, writeJson } from './comun.mjs';

const PUB = path.join(PROMO, 'public');
const PEND = path.join(PUB, 'generados', 'pendientes');
const PEDIDOS = path.join(FAB, 'episodios', 'generados-pedidos.json');
const REGISTRO = path.join(FAB, 'episodios', 'generados-registro.json');
const CATALOGO = path.join(FAB, 'catalogo', 'generados.json');
const POR_DIA = () => Number(process.env.FABRICA_IMAGENES_DIA || 1);
// the duck's look, so the model draws the same character
const REFERENCIAS = ['app/duck-waving.png', 'ducks/estudiante.png', 'app/duck-confused.png'];
const ESTILO = 'El mismo personaje de las imágenes de referencia: un pato blanco de caricatura, contorno negro grueso, pico y patas naranjas, ojos grandes redondos con pupilas negras, tres plumas en la cabeza. Mismo trazo y colores planos. Ilustración tipo sticker, cuerpo entero, fondo transparente, sin texto, sin marcas de agua.';
// when no idea of the week asks for one, an everyday situation of Cali's students
const SIEMPRE = [
  'el pato estudiando en la biblioteca con una pila de libros y cara de cansancio',
  'el pato esperando el bus MIO en una estación, mirando el celular',
  'el pato con morral corriendo porque llega tarde a clase',
  'el pato tomando café en la cafetería de la universidad',
  'el pato en una fiesta con luces de colores, bailando',
  'el pato haciendo un parcial, sudando, con un lápiz en la mano',
  'dos patos chocando las alas como amigos',
  'el pato acostado en el pasto del campus con audífonos',
  'el pato con toga y birrete el día de su graduación',
  'el pato escribiendo una carta de amor, sonrojado',
];

const hoy = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);

async function telegram(method, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const isForm = body instanceof FormData;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', body: isForm ? body : JSON.stringify(body), headers: isForm ? undefined : { 'Content-Type': 'application/json' } });
  const out = await res.json();
  if (!out.ok) throw new Error(`Telegram (${method}): ${out.description}`);
  return out.result;
}
const destino = () => {
  const topic = Number(process.env.TELEGRAM_TOPIC_FABRICA ?? 0);
  return { chat_id: process.env.TELEGRAM_CHAT_ID, ...(topic ? { message_thread_id: topic } : {}) };
};

async function generar() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) { console.log('imagenes: sin OPENAI_API_KEY, no genero'); return; }
  const registro = fs.existsSync(REGISTRO) ? readJson(REGISTRO) : { dias: {} };
  const ya = registro.dias[hoy()] ?? 0;
  if (ya >= POR_DIA()) { console.log(`imagenes: hoy ya van ${ya} (máximo ${POR_DIA()})`); return; }
  const cola = fs.existsSync(PEDIDOS) ? readJson(PEDIDOS) : { pedidos: [] };
  const pedido = cola.pedidos.find((p) => p.estado === 'pendiente');
  const usados = new Set(Object.values(registro.prompts ?? {}));
  const prompt = pedido?.prompt ?? SIEMPRE.find((s) => !usados.has(s)) ?? SIEMPRE[Math.floor(Math.random() * SIEMPRE.length)];
  const id = `img-${hoy().replace(/-/g, '')}-${slugify(prompt).slice(0, 32)}`;

  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
  const pedir = async (transparente) => {
    const form = new FormData();
    form.set('model', model);
    form.set('prompt', `${prompt}. ${ESTILO}${transparente ? '' : ' Fondo blanco liso.'}`);
    form.set('size', '1024x1536');
    if (transparente) form.set('background', 'transparent');
    form.set('quality', process.env.OPENAI_IMAGE_QUALITY || 'medium');
    form.set('n', '1');
    for (const r of REFERENCIAS) form.append('image[]', new Blob([fs.readFileSync(path.join(PUB, r))], { type: 'image/png' }), path.basename(r));
    const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(240_000) });
    return { res, body: await res.json().catch(() => ({})) };
  };
  console.log(`imagenes: generando con ${model} «${prompt.slice(0, 60)}»…`);
  let { res, body } = await pedir(true);
  // a model that cannot do transparent backgrounds says so before generating: ask again on white
  if (!res.ok && /background|transparen/i.test(body.error?.message ?? '')) ({ res, body } = await pedir(false));
  if (!res.ok || !body.data?.[0]?.b64_json) {
    const why = body.error?.message ?? `HTTP ${res.status}`;
    const code = body.error?.code ?? body.error?.type ?? '';
    console.log(`imagenes: OpenAI no generó la imagen (${code}: ${why.slice(0, 200)})`);
    // say it once a day in the topic, so a key without balance doesn't go unnoticed
    if (!registro.avisos?.[hoy()]) {
      await telegram('sendMessage', { ...destino(), text: `⚠️ No pude generar la imagen del día con OpenAI (${code || res.status}). ${/quota|billing|insufficient/i.test(why + code) ? 'La clave no tiene saldo para imágenes: la moderación es gratis, las imágenes no.' : ''}` }).catch(() => {});
      registro.avisos = { ...(registro.avisos ?? {}), [hoy()]: true };
      writeJson(REGISTRO, registro);
    }
    return;
  }
  fs.mkdirSync(PEND, { recursive: true });
  const file = path.join(PEND, `${id}.png`);
  fs.writeFileSync(file, Buffer.from(body.data[0].b64_json, 'base64'));
  registro.dias[hoy()] = ya + 1;
  registro.prompts = { ...(registro.prompts ?? {}), [id]: prompt };
  writeJson(REGISTRO, registro);
  if (pedido) { pedido.estado = 'generada'; pedido.imagen = id; writeJson(PEDIDOS, cola); }
  const meta = path.join(PEND, 'pendientes.json');
  const pend = fs.existsSync(meta) ? readJson(meta) : {};
  pend[id] = { prompt, idea: pedido?.idea ?? null, creado: new Date().toISOString() };
  writeJson(meta, pend);

  const photo = new FormData();
  for (const [k, v] of Object.entries(destino())) photo.set(k, String(v));
  photo.set('caption', `🖼 Imagen nueva para los videos:\n«${prompt}»${pedido ? `\n(para la idea ${pedido.idea})` : ''}\n\n✅ Aprobar la suma a los recursos del director.`);
  photo.set('reply_markup', JSON.stringify({ inline_keyboard: [[{ text: '✅ Aprobar', callback_data: `f:iok:${id.slice(0, 58)}` }, { text: '🗑 Descartar', callback_data: `f:ino:${id.slice(0, 58)}` }]] }));
  photo.set('document', new Blob([fs.readFileSync(file)], { type: 'image/png' }), `${id}.png`);
  await telegram('sendDocument', photo);
  console.log(`imagenes: ${id} enviada para aprobar`);
}

async function decidir(o) {
  const meta = path.join(PEND, 'pendientes.json');
  const pend = fs.existsSync(meta) ? readJson(meta) : {};
  const id = Object.keys(pend).find((k) => k.startsWith(o.imagen));
  if (!id) throw new Error(`No encuentro la imagen pendiente ${o.imagen}`);
  const file = path.join(PEND, `${id}.png`);
  if (o.accion === 'aprobar') {
    const dest = path.join(PUB, 'generados', `${id}.png`);
    fs.renameSync(file, dest);
    const cat = fs.existsSync(CATALOGO) ? readJson(CATALOGO) : { recursos: [] };
    cat.recursos = cat.recursos.filter((r) => r.id !== id);
    cat.recursos.push({ id, ruta: `generados/${id}.png`, tipo: 'sticker', grupo: 'generados', w: 1024, h: 1536, d: `Ilustración generada con IA: ${pend[id].prompt}.` });
    writeJson(CATALOGO, cat);
    console.log(`imagenes: ${id} aprobada y en el catálogo`);
  } else {
    fs.rmSync(file, { force: true });
    console.log(`imagenes: ${id} descartada`);
  }
  delete pend[id];
  writeJson(meta, pend);
}

function args() {
  const a = process.argv.slice(3), o = {};
  for (let i = 0; i < a.length; i++) o[a[i].replace(/^--/, '')] = a[++i];
  return o;
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  loadEnv();
  const run = { generar, decidir }[process.argv[2]];
  if (!run) { console.error('uso: imagenes.mjs generar | decidir --imagen <id> --accion aprobar|descartar'); process.exit(2); }
  run(args()).catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
}
