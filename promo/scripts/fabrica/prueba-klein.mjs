import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { FAB, PROMO, loadEnv, python } from './comun.mjs';
import { MODELO, credenciales, generarKlein } from './klein.mjs';
import { ID_LOTE, guardar, leer, rutas } from './klein-estado.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const ESTILO = 'Usa exactamente el personaje de input_image_0: conserva su silueta, tres plumas, ojos, pico, colores y estilo de dibujo. Cambia solo pose, expresión y entorno necesarios para la situación. Un solo pato, sin añadir ropa ni accesorios al personaje salvo objetos necesarios para la acción. Cuerpo entero cuando la escena lo permita, composición clara, sin texto, logos ni marcas de agua.';

export function procesarImagen(mode, source, destination) {
  return JSON.parse(python(['scripts/fabrica/preparar-referencia.py', mode, source, destination]));
}

export function clienteTelegram(env = process.env, fetchImpl = fetch) {
  return async (method, fields, file) => {
    const form = new FormData();
    form.set('chat_id', env.TELEGRAM_CHAT_ID);
    form.set('message_thread_id', env.TELEGRAM_TOPIC_FABRICA);
    for (const [key, value] of Object.entries(fields)) form.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    if (file) form.set('document', new Blob([fs.readFileSync(file)], { type: 'image/png' }), path.basename(file));
    let res;
    try {
      res = await fetchImpl('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/' + method, {
        method: 'POST', body: form, signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw Object.assign(new Error('Telegram: envío incierto; comprueba el tema antes de reanudar.'), { incierto: true });
    }
    let body;
    try { body = await res.json(); } catch {
      throw Object.assign(new Error('Telegram: respuesta de envío ilegible.'), { incierto: true });
    }
    if (res.status >= 500) throw Object.assign(new Error('Telegram: error de servidor; envío incierto.'), { incierto: true });
    if (!res.ok || !body.ok) throw new Error('Telegram rechazó envío (HTTP ' + res.status + ').');
    if (!body.result?.message_id) throw Object.assign(new Error('Telegram no confirmó ID del mensaje.'), { incierto: true });
    return body.result;
  };
}

export async function ejecutarPrueba({
  lote, env = process.env, fab = FAB, promo = PROMO,
  procesar = procesarImagen, generar = generarKlein, telegram = clienteTelegram(env),
}) {
  if (!ID_LOTE.test(lote ?? '')) throw new Error('Lote inválido: usa hasta 40 letras minúsculas, números o guiones.');
  credenciales(env);
  for (const key of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'TELEGRAM_TOPIC_FABRICA'])
    if (!env[key]?.trim()) throw new Error('Falta ' + key + '.');
  if (!/^-?\d+$/.test(env.TELEGRAM_CHAT_ID) || !/^[1-9]\d*$/.test(env.TELEGRAM_TOPIC_FABRICA))
    throw new Error('Destino de Telegram inválido.');
  const p = rutas({ fab, promo });
  if (env.EPISODIOS_PRIVADOS !== '1' || !fs.existsSync(path.join(p.privado, '.git')))
    throw new Error('La prueba requiere checkout privado de episodios; no se generará nada.');
  const master = path.join(promo, 'public', 'app', 'duck-waving.png');
  if (!fs.existsSync(master)) throw new Error('Falta referencia maestra app/duck-waving.png.');
  const escenas = leer(path.join(fab, 'pruebas', 'klein', 'situaciones.json'), []);
  if (escenas.length !== 10 || new Set(escenas.map((s) => s.id)).size !== 10 ||
      escenas.some((s) => !/^[a-z0-9-]+$/.test(s.id) || typeof s.prompt !== 'string' || !s.prompt.trim()))
    throw new Error('La prueba requiere exactamente diez situaciones válidas y distintas.');
  const dir = path.join(p.privado, 'klein', lote);
  fs.mkdirSync(dir, { recursive: true });
  const stateFile = path.join(dir, 'lote.json');
  const sourceHash = hash(fs.readFileSync(master)), configHash = hash(JSON.stringify(escenas));
  const state = leer(stateFile, null) ?? {
    lote, modelo: MODELO, sourceHash, configHash, solicitudes: 0,
    referencia: { envio: 'pendiente' },
    escenas: escenas.map((s, i) => ({ ...s, id: 'k4b-' + lote + '-' + String(i + 1).padStart(2, '0'),
      prompt: s.prompt + ' ' + ESTILO, seed: 20261124 + i, estado: 'pendiente', envio: 'pendiente' })),
  };
  if (state.lote !== lote || !Array.isArray(state.escenas) || state.escenas.length !== 10 ||
      state.escenas.some((s, i) => s.id !== 'k4b-' + lote + '-' + String(i + 1).padStart(2, '0') ||
        s.prompt !== escenas[i].prompt + ' ' + ESTILO || s.seed !== 20261124 + i) ||
      !Number.isInteger(state.solicitudes) || state.solicitudes < 0 || state.solicitudes > 10)
    throw new Error('Estado de lote inválido; no se generará nada.');
  if (state.sourceHash !== sourceHash || state.configHash !== configHash || state.modelo !== MODELO)
    throw new Error('Referencia o situaciones cambiaron; no se puede reanudar este lote.');
  const save = () => guardar(stateFile, state);
  const reference = path.join(dir, 'referencia.png');
  if (!fs.existsSync(reference)) procesar('referencia', master, reference);
  const referenceBytes = fs.readFileSync(reference), referenceHash = hash(referenceBytes);
  if (state.referenceHash && state.referenceHash !== referenceHash) throw new Error('La referencia preparada cambió.');
  state.referenceHash = referenceHash;
  save();
  async function enviar(item, caption, file, keyboard) {
    if (item.envio === 'enviado') return;
    if (['iniciado', 'incierto'].includes(item.envio))
      throw new Error('Envío anterior incierto. Revisa Telegram antes de recuperar este lote.');
    item.envio = 'iniciado'; save();
    try {
      const msg = await telegram('sendDocument', { caption, ...(keyboard ? { reply_markup: keyboard } : {}) }, file);
      item.envio = 'enviado'; item.message_id = msg.message_id; item.telegram = msg.document?.file_id ?? null;
    } catch (e) {
      item.envio = e.incierto ? 'incierto' : 'pendiente';
      throw e;
    } finally { save(); }
  }
  try {
    await enviar(state.referencia, '🦆 Referencia fija · prueba Klein 4B · lote ' + lote +
      '\nLas diez situaciones parten de esta imagen original.', reference);
    for (let i = 0; i < state.escenas.length; i++) {
      const scene = state.escenas[i], file = path.join(dir, scene.id + '.png'), raw = file + '.original';
      let index = leer(p.indice, {});
      if (['aprobada', 'descartada'].includes(index[scene.id]?.estado)) continue;
      if (!fs.existsSync(file)) {
        if (!fs.existsSync(raw)) {
          if (scene.estado !== 'pendiente')
            throw new Error('Generación anterior incierta para escena ' + (i + 1) + '; no se repetirá.');
          if (!Number.isInteger(state.solicitudes) || state.solicitudes >= 10)
            throw new Error('Este lote alcanzó su máximo de diez solicitudes.');
          scene.estado = 'solicitando'; state.solicitudes += 1; save();
          const bytes = await generar({ referencia: referenceBytes, prompt: scene.prompt, seed: scene.seed, env });
          fs.writeFileSync(raw + '.tmp', bytes); fs.renameSync(raw + '.tmp', raw);
        }
        const size = procesar('resultado', raw, file + '.tmp');
        if (!Number.isInteger(size.w) || !Number.isInteger(size.h) || size.w <= 0 || size.h <= 0)
          throw new Error('Dimensiones de respuesta inválidas.');
        fs.renameSync(file + '.tmp', file);
        scene.w = size.w; scene.h = size.h;
      }
      if (!scene.w || !scene.h) Object.assign(scene, procesar('resultado', file, file));
      scene.estado = 'generada'; save();
      index = leer(p.indice, {});
      index[scene.id] = { ...index[scene.id], estado: index[scene.id]?.estado ?? 'pendiente',
        archivo: 'klein/' + lote + '/' + scene.id + '.png', w: scene.w, h: scene.h,
        prompt: scene.prompt, modelo: MODELO, referenceHash, seed: scene.seed };
      guardar(p.indice, index);
      const caption = '🖼 Klein 4B · ' + (i + 1) + '/10 · ' + escenas[i].id +
        '\nLote: ' + lote + '\nRevisa ojos, pico, plumas, proporciones y estilo.' +
        '\n✅ Aprobar incorpora esta escena al catálogo de videos.';
      await enviar(scene, caption, file, { inline_keyboard: [[
        { text: '✅ Aprobar', callback_data: 'f:iok:' + scene.id },
        { text: '🗑 Descartar', callback_data: 'f:ino:' + scene.id },
      ]] });
      index[scene.id].telegram = scene.telegram; guardar(p.indice, index);
    }
  } finally {
    const enviadas = state.escenas.filter((s) => s.envio === 'enviado').length;
    await telegram('sendMessage', { text: 'Prueba Klein 4B · ' + lote + '\n' + enviadas +
      '/10 imágenes enviadas; ' + state.solicitudes + '/10 solicitudes utilizadas.' +
      '\nCada imagen tiene botones para aprobar o descartar.' }).catch(() => {});
  }
  return { lote, enviadas: state.escenas.filter((s) => s.envio === 'enviado').length, solicitudes: state.solicitudes };
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  loadEnv();
  const lote = process.env.KLEIN_LOTE || 'prueba-' + process.env.GITHUB_RUN_ID;
  ejecutarPrueba({ lote }).then((r) => console.log(JSON.stringify(r))).catch((e) => {
    console.error(String(e.message)); process.exitCode = 1;
  });
}
