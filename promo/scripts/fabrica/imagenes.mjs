// New resources made with AI (OpenAI's gpt-image-2.5-sunburst, OPENAI_IMAGE_MODEL to change it; production key): the duck in
// situations the catalog doesn't have. Two ways in:
//  - each video makes its own (imagenesParaEpisodio, up to FABRICA_IMAGENES_VIDEO, 4 by default),
//    straight into the catalog: the team judges them inside the finished video;
//  - the image of the day (FABRICA_IMAGENES_DIA, off by default) goes to the «Fábrica» topic
//    with ✅ Aprobar / 🗑 Descartar; approved, it joins the director's catalog
//    (promo/public/generados/ + fabrica/catalogo/generados.json).
//
//   node scripts/fabrica/imagenes.mjs generar                 the image of the day (if any is left)
//   node scripts/fabrica/imagenes.mjs decidir --imagen <id> --accion aprobar|descartar
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decidirKlein, esKlein, reconciliarKlein } from './klein-estado.mjs';
import { FAB, PROMO, loadEnv, python, readJson, slugify, writeJson } from './comun.mjs';

const PUB = path.join(PROMO, 'public');
const PEND = path.join(PUB, 'generados', 'pendientes');
const PEDIDOS = path.join(FAB, 'episodios', 'generados-pedidos.json');
const REGISTRO = path.join(FAB, 'episodios', 'generados-registro.json');
const CATALOGO = path.join(FAB, 'catalogo', 'generados.json');
// the image of the day is off by default: each video makes its own (imagenesParaEpisodio)
const POR_DIA = () => Number(process.env.FABRICA_IMAGENES_DIA || 0);
const POR_VIDEO = () => Number(process.env.FABRICA_IMAGENES_VIDEO ?? 4);
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

/** One image from OpenAI for a prompt (the duck's references attached): { png } or { error, code, status }. */
export async function generarUna(prompt) {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-sunburst';
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
    return { error: body.error?.message ?? `HTTP ${res.status}`, code: body.error?.code ?? body.error?.type ?? '', status: res.status };
  }
  return { png: Buffer.from(body.data[0].b64_json, 'base64') };
}

/** Writes an image and cuts its plain white background out (the director needs cut-outs). */
function guardarRecorte(png, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png);
  try { console.log(`imagenes: ${python(['scripts/fabrica/quitar_fondo.py', file]).trim()}`); } catch (e) { console.log(`imagenes: no pude quitar el fondo (${String(e.message).split('\n')[0]})`); }
}

/**
 * The images made for one video (FABRICA_IMAGENES_VIDEO, 4 by default): what this script
 * needs that the catalog doesn't have. The format may say them (pedidosDeImagen); otherwise an
 * art director (Sonnet) proposes them from the script. They go straight into the catalog
 * (the team judges them in the finished video) and into <episode>/imagenes-episodio.json.
 */
export async function imagenesParaEpisodio({ dir, spec, fmt }) {
  const max = POR_VIDEO();
  const listo = path.join(dir, 'imagenes-episodio.json');
  if (fs.existsSync(listo)) return readJson(listo);
  if (!process.env.OPENAI_API_KEY || max <= 0) return [];
  // an adjusted version (-v2, -v3…) keeps the images of the one before: same video, new words
  const antes = imagenesDeVersionAnterior(dir);
  if (antes && !fmt.pedidosDeImagen) {
    fs.mkdirSync(dir, { recursive: true });
    writeJson(listo, antes);
    console.log(`imagenes: reuso las ${antes.length} de la versión anterior`);
    return antes;
  }
  let pedidos = fmt.pedidosDeImagen ? fmt.pedidosDeImagen(spec) : null;
  if (!pedidos) {
    const { pedirJson } = await import('./claude.mjs');
    const { cargarCatalogo } = await import('./director/storyboard.mjs');
    const cat = cargarCatalogo();
    const yaHay = cat.recursos.filter((r) => r.d && (r.grupo === 'generados' || r.ruta.startsWith('app/') || r.ruta.startsWith('ducks/'))).map((r) => `- ${r.ruta}: ${r.d}`);
    try {
      pedidos = (await pedirJson({
        sistema: 'Eres el director de arte de los videos de Ducki (app social para universitarios de Cali). Decides qué ilustraciones nuevas harían que ESTE video se vea vivo y hecho para su guion: el pato de Ducki (u otros patos iguales) en situaciones concretas que dice el guion y que el catálogo no tiene. Cada ilustración se genera con IA a partir del pato de referencia, como sticker con fondo transparente.',
        mensaje: [
          `Guion: ${JSON.stringify(spec)}`,
          `Ya existen (no las repitas):\n${yaHay.join('\n')}`,
          `Propón entre ${Math.min(3, max)} y ${max} ilustraciones, las que más sumen, para momentos distintos del guion (el inicio, el giro, el remate). Para cada una: "prompt" (descripción visual concreta en español: qué hace el pato, dónde, con qué objetos, su expresión; sin texto escrito en la imagen, sin personas reales, sin marcas), "para" (qué momento del guion ilustra) y "por_que".`,
        ].join('\n\n'),
        esquema: { type: 'object', additionalProperties: false, required: ['imagenes'], properties: { imagenes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['prompt', 'para', 'por_que'], properties: { prompt: { type: 'string' }, para: { type: 'string' }, por_que: { type: 'string' } } } } } },
        esfuerzo: 'low',
      })).imagenes;
    } catch (e) {
      console.log(`imagenes: el director de arte no respondió (${String(e.message).slice(0, 160)}); sigo sin imágenes nuevas`);
      return [];
    }
  }
  // the id comes from the prompt: the same drawing asked again (a new version, a rerun) is reused, not paid twice
  const base = slugify(path.basename(dir).replace(/-v\d+$/, '')).slice(0, 24);
  const hechas = [];
  let sinCupo = false;
  for (const [n, p] of (pedidos ?? []).slice(0, max).entries()) {
    const id = `gen-${base}-${crypto.createHash('sha1').update(p.prompt).digest('hex').slice(0, 6)}`;
    const file = path.join(PUB, 'generados', `${id}.png`);
    if (fs.existsSync(file)) {
      console.log(`imagenes: la ${n + 1} ya estaba hecha (${id})`);
    } else {
      if (sinCupo) continue;
      const r = await generarUna(p.prompt);
      if (!r.png) {
        // the reason, so the log says why this video has fewer images
        console.log(`imagenes: no salió la ${n + 1} de ${Math.min(max, pedidos.length)} (HTTP ${r.status}, ${r.code}: ${String(r.error).slice(0, 160)})`);
        if (/quota|billing|insufficient/i.test(`${r.error} ${r.code}`)) sinCupo = true;
        continue;
      }
      guardarRecorte(r.png, file);
    }
    // n: which request it answers, so a failed one doesn't shift the rest onto the wrong moment
    hechas.push({ id, ruta: `generados/${id}.png`, prompt: p.prompt, para: p.para, n });
  }
  if (hechas.length) {
    const cat = fs.existsSync(CATALOGO) ? readJson(CATALOGO) : { recursos: [] };
    const ids = new Set(hechas.map((h) => h.id));
    cat.recursos = [...cat.recursos.filter((r) => !ids.has(r.id)),
      ...hechas.map((h) => ({ id: h.id, ruta: h.ruta, tipo: 'sticker', grupo: 'generados', w: 1024, h: 1536, d: `Hecha con IA para el video ${path.basename(dir)} (${h.para}): ${h.prompt}`, episodio: path.basename(dir) }))];
    writeJson(CATALOGO, cat);
  }
  fs.mkdirSync(dir, { recursive: true });
  writeJson(listo, hechas);
  console.log(`imagenes: ${hechas.length} imagen(es) para este video`);
  return hechas;
}

/** The images list of the closest earlier version of this episode (…-v3 looks at -v2, then the first one). */
function imagenesDeVersionAnterior(dir) {
  const m = path.basename(dir).match(/^(.*)-v(\d+)$/);
  if (!m) return null;
  for (let v = Number(m[2]) - 1; v >= 1; v--) {
    const f = path.join(path.dirname(dir), v === 1 ? m[1] : `${m[1]}-v${v}`, 'imagenes-episodio.json');
    if (fs.existsSync(f)) {
      const lista = readJson(f).filter((h) => fs.existsSync(path.join(PUB, h.ruta)));
      return lista.length ? lista : null;
    }
  }
  return null;
}

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

  const r = await generarUna(prompt);
  if (!r.png) {
    const why = r.error;
    const code = r.code;
    const res = { status: r.status };
    console.log(`imagenes: OpenAI no generó la imagen (${code}: ${why.slice(0, 200)})`);
    // say it once a day in the topic, so a key without balance doesn't go unnoticed
    if (!registro.avisos?.[hoy()]) {
      await telegram('sendMessage', { ...destino(), text: `⚠️ No pude generar la imagen del día con OpenAI (${code || res.status}). ${/quota|billing|insufficient/i.test(why + code) ? 'La clave no tiene saldo para imágenes: la moderación es gratis, las imágenes no.' : ''}` }).catch(() => {});
      registro.avisos = { ...(registro.avisos ?? {}), [hoy()]: true };
      writeJson(REGISTRO, registro);
    }
    return;
  }
  const file = path.join(PEND, `${id}.png`);
  guardarRecorte(r.png, file);
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
  const sent = await telegram('sendDocument', photo);
  // Telegram keeps the file: if the copy here gets lost, approving it can still fetch it
  pend[id].telegram = sent.document?.file_id ?? null;
  writeJson(meta, pend);
  console.log(`imagenes: ${id} enviada para aprobar`);
}

async function decidir(o) {
  // Replay pending Klein decisions: Actions may replace an older queued run.
  await reconciliarKlein().catch(() => console.log('imagenes: no pude recuperar otras decisiones Klein; aplico la actual.'));
  if (esKlein(o.imagen)) {
    decidirKlein({ id: o.imagen, accion: o.accion });
    console.log('imagenes: decisión Klein guardada');
    return;
  }
  const meta = path.join(PEND, 'pendientes.json');
  const pend = fs.existsSync(meta) ? readJson(meta) : {};
  const id = Object.keys(pend).find((k) => k.startsWith(o.imagen));
  if (!id) {
    console.log(`imagenes: no encuentro la imagen pendiente ${o.imagen}`);
    await telegram('sendMessage', { ...destino(), text: `⚠️ No encontré la imagen ${o.imagen} (no quedó guardada). Mañana llega otra.` }).catch(() => {});
    return;
  }
  const file = path.join(PEND, `${id}.png`);
  if (!fs.existsSync(file) && pend[id].telegram && o.accion === 'aprobar') {
    const { bajarArchivo } = await import('./telegram.mjs');
    const got = await bajarArchivo(pend[id].telegram, path.join(PEND, id));
    if (got !== file) fs.renameSync(got, file);
  }
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
