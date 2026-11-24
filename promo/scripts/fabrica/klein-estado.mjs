import fs from 'node:fs';
import path from 'node:path';
import { FAB, PROMO } from './comun.mjs';

export const ID_LOTE = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const esKlein = (id) => typeof id === 'string' && id.startsWith('k4b-');
export const leer = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
export function guardar(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(file + '.tmp', file);
}
export function rutas({ fab = FAB, promo = PROMO } = {}) {
  const privado = path.join(fab, 'episodios');
  return { privado, indice: path.join(privado, 'klein-pendientes.json'),
    publico: path.join(promo, 'public', 'generados'), catalogo: path.join(fab, 'catalogo', 'generados.json') };
}
function archivoSeguro(p, entry) {
  if (!/^klein\/[a-z0-9][a-z0-9-]{0,39}\/k4b-[a-z0-9-]+\.png$/.test(entry.archivo ?? ''))
    throw new Error('Ruta privada de imagen inválida.');
  const file = path.join(p.privado, ...entry.archivo.split('/'));
  const root = fs.realpathSync(p.privado);
  const target = fs.realpathSync(fs.existsSync(file) ? file : path.dirname(file));
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Ruta privada fuera de episodios.');
  return file;
}

/** Retain approved originals privately so a failed public push can be recovered. */
export function decidirKlein({ id, accion, ...config }) {
  if (!esKlein(id)) return false;
  if (!/^k4b-[a-z0-9][a-z0-9-]{0,39}-(?:0[1-9]|10)$/.test(id)) throw new Error('No existe imagen Klein con ese ID exacto.');
  if (!['aprobar', 'descartar'].includes(accion)) throw new Error('Decisión inválida.');
  const p = rutas(config), indice = leer(p.indice, {});
  const entry = Object.hasOwn(indice, id) ? indice[id] : null;
  if (!entry) throw new Error('No existe imagen Klein con ese ID exacto.');
  if (entry.estado === 'descartada' || (entry.estado === 'aprobada' && accion === 'descartar')) return true;
  const file = archivoSeguro(p, entry);
  if (path.basename(file) !== id + '.png') throw new Error('Ruta privada no coincide con ID.');
  if (accion === 'aprobar') {
    if (!Number.isInteger(entry.w) || !Number.isInteger(entry.h) || entry.w <= 0 || entry.h <= 0)
      throw new Error('Dimensiones de imagen inválidas.');
    fs.mkdirSync(p.publico, { recursive: true });
    fs.copyFileSync(file, path.join(p.publico, id + '.png'));
    const cat = leer(p.catalogo, { recursos: [] });
    cat.recursos = cat.recursos.filter((r) => r.id !== id);
    cat.recursos.push({ id, ruta: `generados/${id}.png`, tipo: 'imagen', grupo: 'generados',
      w: entry.w, h: entry.h, d: `Escena ilustrada de Ducki: ${entry.prompt}` });
    guardar(p.catalogo, cat);
    entry.estado = 'aprobada';
  } else {
    entry.estado = 'descartada';
  }
  guardar(p.indice, indice);
  if (entry.estado === 'descartada') fs.rmSync(file, { force: true });
  return true;
}

/** GitHub concurrency can replace pending runs: replay all known image decisions. */
export async function reconciliarKlein({ env = process.env, fetchImpl = fetch, ...config } = {}) {
  const p = rutas(config), indice = leer(p.indice, {});
  if (!Object.keys(indice).length || !env.FABRICA_TOKEN) return;
  const api = new URL(env.FABRICA_API || 'https://api.duck-i.app');
  if (api.protocol !== 'https:') throw new Error('FABRICA_API requiere HTTPS.');
  let cursor = '';
  for (let page = 0; page < 6; page++) {
    const url = new URL('/api/v1/fabrica/decisiones', api);
    if (cursor) url.searchParams.set('desde', cursor);
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${env.FABRICA_TOKEN}` },
      signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`No pude recuperar decisiones Klein: HTTP ${res.status}.`);
    const data = (await res.json()).data;
    if (!Array.isArray(data?.decisiones)) throw new Error('Respuesta de decisiones inválida.');
    for (const d of data.decisiones) {
      if (!Object.hasOwn(indice, d.episodio)) continue;
      const accion = { 'imagen-aprobar': 'aprobar', 'imagen-descartar': 'descartar' }[d.accion];
      if (accion) decidirKlein({ id: d.episodio, accion, ...config });
    }
    if (data.decisiones.length < 100 || !data.cursor || data.cursor === cursor) break;
    cursor = data.cursor;
  }
}
