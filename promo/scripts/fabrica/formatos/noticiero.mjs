// Formato «Ducki Noticias»: un noticiero parodia. El pato presenta detrás de un escritorio,
// una pantalla gigante muestra cada noticia, titulares de «ÚLTIMA HORA», cinta abajo.
// Plantilla: promo/src/fabrica/Noticiero.tsx; documentos: fabrica/formatos/noticiero/.
import fs from 'node:fs';
import path from 'node:path';
import { FAB } from '../comun.mjs';
import { cargarCatalogo } from '../director/storyboard.mjs';

export const id = 'noticiero';
export const composicion = 'Noticiero';
export const dir = path.join(FAB, 'formatos', id);
export const director = false;
export const publico = ['todo', 'fuentes', 'ducks', 'app', 'fabrica/piezas', 'fabrica/disfraces', 'parches/cat', 'parches/games', 'logos', 'duckart/weekly', 'screens', 'stores', 'map', 'v0110', 'tutorial-salas', 'generados'];

const TIPOS = ['marca', 'humor', 'pov', 'comunidad', 'funcion', 'tendencia'];
const PILARES = JSON.parse(fs.readFileSync(path.join(FAB, 'pilares.json'), 'utf8')).pilares.map((p) => p.id);
const PLANOS = ['presentador', 'pantalla', 'dividido'];
const nullable = (s) => ({ anyOf: [s, { type: 'null' }] });
const MAX_IA = 4;

export function esquema() {
  return {
    type: 'object', additionalProperties: false,
    required: ['slug', 'tipo', 'pilar', 'gancho', 'apertura', 'segmentos', 'ticker', 'cierre', 'caption', 'hashtags'],
    properties: {
      slug: { type: 'string', description: 'Nombre corto en kebab-case, sin tildes.' },
      tipo: { type: 'string', enum: TIPOS },
      pilar: { type: 'string', enum: PILARES },
      gancho: {
        type: 'object', additionalProperties: false, required: ['titulo', 'sub'],
        properties: {
          titulo: { type: 'string', description: 'El titular de portada: 1 a 4 palabras, máximo 22 caracteres («ÚLTIMA HORA», «ALERTA EN LA U»).' },
          sub: { type: 'string', description: 'La bajada de la portada, máximo 40 caracteres.' },
        },
      },
      apertura: { type: 'string', description: 'Lo primero que dice el presentador, en tono de noticiero (8 a 22 palabras): saludo y la noticia que engancha.' },
      segmentos: {
        type: 'array', description: 'De 3 a 6 noticias.',
        items: {
          type: 'object', additionalProperties: false, required: ['titular', 'bajada', 'voz', 'plano', 'urgente', 'pantalla'],
          properties: {
            titular: { type: 'string', description: 'El titular en la franja de abajo, en mayúsculas, máximo 42 caracteres.' },
            bajada: { type: 'string', description: 'La línea debajo del titular, máximo 64 caracteres.' },
            voz: { type: 'string', description: 'Lo que dice el presentador en esta noticia (10 a 28 palabras), serio por fuera, divertido por dentro.' },
            plano: { type: 'string', enum: PLANOS, description: 'presentador: el pato grande y la pantalla al lado; pantalla: la pantalla grande y el pato en una esquina; dividido: mitad y mitad.' },
            urgente: { type: 'boolean', description: 'Lleva la etiqueta roja «ÚLTIMA HORA» (máximo dos noticias).' },
            pantalla: {
              type: 'object', additionalProperties: false, required: ['recurso', 'imagen_ia', 'texto'],
              properties: {
                recurso: nullable({ type: 'string', description: 'Imagen, clip o sticker del catálogo para la pantalla.' }),
                imagen_ia: nullable({ type: 'string', description: `Si ningún recurso sirve: descripción de una ilustración nueva del pato para generarla con IA (máximo ${MAX_IA} en el video).` }),
                texto: nullable({ type: 'string', description: 'Un dato grande en la pantalla (máximo 12 caracteres): «101», «+24%», «2 A. M.».' }),
              },
            },
          },
        },
      },
      ticker: { type: 'array', items: { type: 'string' }, description: 'De 3 a 6 frases cortas (máximo 70) para la cinta de abajo: datos reales, chistes, avisos.' },
      cierre: { type: 'string', description: 'La despedida del presentador con la invitación final (con palabras distintas cada vez).' },
      caption: { type: 'string' },
      hashtags: { type: 'array', items: { type: 'string' } },
    },
  };
}

export function contexto() {
  const cat = cargarCatalogo();
  const items = cat.recursos.filter((r) => r.d && !r.ruta.startsWith('fabrica/piezas/')).map((r) => `${r.ruta} (${r.tipo}): ${r.d}${r.evitar ? ` [evitar: ${r.evitar}]` : ''}`);
  return 'Recursos para la pantalla (ruta (tipo): qué es):\n' + items.slice(0, 140).join('\n');
}

export function revisar(spec) {
  const err = [];
  const cat = cargarCatalogo();
  const segs = spec.segmentos ?? [];
  if (segs.length < 3 || segs.length > 6) err.push('segmentos: de 3 a 6 noticias');
  if (segs.filter((s) => s.urgente).length > 2) err.push('como mucho dos noticias urgentes');
  if (segs.filter((s) => s.pantalla?.imagen_ia && !s.pantalla?.recurso).length > MAX_IA) err.push(`como mucho ${MAX_IA} ilustraciones nuevas`);
  segs.forEach((s, k) => {
    if ([...(s.titular ?? '')].length > 42) err.push(`segmentos[${k}].titular pasa de 42 caracteres`);
    if ([...(s.bajada ?? '')].length > 64) err.push(`segmentos[${k}].bajada pasa de 64 caracteres`);
    const p = s.pantalla ?? {};
    if (!p.recurso && !p.imagen_ia && !p.texto) err.push(`segmentos[${k}]: la pantalla no muestra nada (recurso, imagen_ia o texto)`);
    if (p.recurso && !cat.buscar(p.recurso)) err.push(`segmentos[${k}].pantalla.recurso «${p.recurso}» no está en el catálogo`);
    if ([...(p.texto ?? '')].length > 12) err.push(`segmentos[${k}].pantalla.texto pasa de 12 caracteres`);
  });
  if ((spec.ticker ?? []).length < 3) err.push('ticker: al menos 3 frases');
  if ([...(spec.gancho?.titulo ?? '')].length > 22) err.push('gancho.titulo pasa de 22 caracteres');
  const palabras = segmentos(spec).join(' ').split(/\s+/).filter(Boolean).length;
  if (palabras < 55 || palabras > 160) err.push(`el presentador dice ${palabras} palabras: entre 55 y 160`);
  return err;
}

export const segmentos = (spec) => [spec.apertura.trim(), ...(spec.segmentos ?? []).map((s) => s.voz.trim()), spec.cierre.trim()];

export function aplicarTexto(spec, lines) {
  if (lines.length !== segmentos(spec).length) return null;
  const out = structuredClone(spec);
  out.apertura = lines[0];
  out.segmentos.forEach((s, k) => { s.voz = lines[k + 1]; });
  out.cierre = lines[lines.length - 1];
  return out;
}

/** The illustrations to generate: the screens that ask for one and have no resource. */
export function pedidosDeImagen(spec) {
  return (spec.segmentos ?? []).flatMap((s, k) => (s.pantalla?.imagen_ia && !s.pantalla?.recurso ? [{ prompt: s.pantalla.imagen_ia, para: `noticia ${k + 1}: ${s.titular}`, k }] : [])).slice(0, MAX_IA);
}

/** Puts the generated illustrations on their screens. */
export function usarImagenes(spec, hechas) {
  const out = structuredClone(spec);
  const pedidos = pedidosDeImagen(spec);
  // h.n says which request it answers (a failed one leaves its screen as it was)
  hechas.forEach((h, j) => { const k = pedidos[h.n ?? j]?.k; if (k != null) out.segmentos[k].pantalla.recurso = h.ruta; });
  return out;
}

export function construir({ spec, words, starts, vozDur, seed, mouth, v0 = 0.15, tail = 2 }) {
  const cat = cargarCatalogo();
  // a screen left empty (its AI drawing didn't come out) shows the waving duck instead of nothing
  const respaldo = cat.buscar('app/duck-waving.png');
  const segs = spec.segmentos.map((s, k) => {
    const rec = (s.pantalla.recurso ? cat.buscar(s.pantalla.recurso) : null) ?? (s.pantalla.texto ? null : respaldo);
    return {
      t: +(starts[k + 1] - 0.05).toFixed(3), titular: s.titular, bajada: s.bajada, plano: s.plano, urgente: !!s.urgente,
      pantalla: { src: rec?.ruta ?? null, tipo: rec?.tipo ?? null, w0: rec?.w ?? null, h0: rec?.h ?? null, texto: s.pantalla.texto },
    };
  });
  const fin = +(starts[starts.length - 1] - 0.05).toFixed(3);
  return {
    fps: 30, v0, total: +(vozDur + v0 + tail).toFixed(3), words, mouth, seed,
    scenes: [{ kind: 'intro', t: 0, ev: {} }, ...segs.map((s) => ({ kind: 'libre', t: s.t, ev: {} })), { kind: 'fin', t: fin, ev: {} }],
    N: 0, hook: { title: spec.gancho.titulo, sub: spec.gancho.sub, tag: null }, spoken: [], endLine: 'aquí todos somos patos',
    plan: { estilo: { subtitulos: 'cinta', resaltado: 'orange', contador: 'cinta', presentador: 'centro', estructura: 'historia' }, escenas: [] },
    noticiero: { segmentos: segs, ticker: spec.ticker, fin },
  };
}

export function resumen(spec) {
  return { gancho: spec.gancho?.titulo, noticias: (spec.segmentos ?? []).map((s) => s.titular) };
}
