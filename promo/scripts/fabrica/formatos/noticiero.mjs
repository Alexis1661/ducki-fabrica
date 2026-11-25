// Formato «Ducki Noticias»: un noticiero parodia. El pato presenta detrás de un escritorio,
// una tele siempre encendida muestra cada noticia, titulares de «ÚLTIMA HORA», cinta abajo.
// Lo que pasa en la tele lo compone y anima el director (DIRECTOR.md de este formato) noticia por
// noticia, con las piezas de las escenas libres; sin director, la tele muestra el recurso fijo.
// Plantilla: promo/src/fabrica/Noticiero.tsx; documentos: fabrica/formatos/noticiero/.
import fs from 'node:fs';
import path from 'node:path';
import { FAB } from '../comun.mjs';
import { MOVIMIENTOS, cargarCatalogo, piezasParaEpisodio, revisarPiezas } from '../director/storyboard.mjs';

export const id = 'noticiero';
export const composicion = 'Noticiero';
export const dir = path.join(FAB, 'formatos', id);
export const director = true;
export const publico = ['todo', 'fuentes', 'ducks', 'app', 'fabrica/piezas', 'fabrica/disfraces', 'parches/cat', 'parches/games', 'logos', 'duckart/weekly', 'screens', 'stores', 'map', 'v0110', 'tutorial-salas', 'generados'];

const TIPOS = ['marca', 'humor', 'pov', 'comunidad', 'funcion', 'tendencia'];
const PILARES = JSON.parse(fs.readFileSync(path.join(FAB, 'pilares.json'), 'utf8')).pilares.map((p) => p.id);
const PLANOS = ['presentador', 'pantalla', 'dividido'];
const nullable = (s) => ({ anyOf: [s, { type: 'null' }] });
const MAX_IA = 4;
/** The TV's canvas for the director: square, every shot scales it into its own box. */
const LADO = 1000;
const FONDOS = ['estudio', 'paper', 'cream', 'kraft', 'orange', 'lime', 'pink', 'cobalt', 'night', 'green', 'red', 'hot'];
const MIN_IA = 2;

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
                recurso: nullable({ type: 'string', description: 'Imagen, clip o sticker del catálogo para la pantalla (si además pides imagen_ia, queda de respaldo por si la ilustración no sale).' }),
                imagen_ia: nullable({ type: 'string', description: `Descripción de una ilustración nueva del pato hecha con IA para ESTA noticia (qué hace, dónde, con qué, su cara; sin texto escrito). Entre ${MIN_IA} y ${MAX_IA} en el video: las noticias que más se lucen con un dibujo propio.` }),
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

// escribiendo: only the writer is held to the minimum of new drawings; an approved older script still builds
export function revisar(spec, _funciones, { escribiendo = false } = {}) {
  const err = [];
  const cat = cargarCatalogo();
  const segs = spec.segmentos ?? [];
  if (segs.length < 3 || segs.length > 6) err.push('segmentos: de 3 a 6 noticias');
  if (segs.filter((s) => s.urgente).length > 2) err.push('como mucho dos noticias urgentes');
  const ia = segs.filter((s) => s.pantalla?.imagen_ia?.trim()).length;
  if (ia > MAX_IA) err.push(`como mucho ${MAX_IA} ilustraciones nuevas (imagen_ia)`);
  if (escribiendo && ia < Math.min(MIN_IA, segs.length)) err.push(`pide al menos ${MIN_IA} ilustraciones nuevas con imagen_ia: el video se ve vivo con dibujos hechos para estas noticias`);
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

/** The illustrations to generate: every screen that asks for one (its resource, if any, stays as the fallback). */
export function pedidosDeImagen(spec) {
  return (spec.segmentos ?? []).flatMap((s, k) => (s.pantalla?.imagen_ia?.trim() ? [{ prompt: s.pantalla.imagen_ia, para: `noticia ${k + 1}: ${s.titular}`, k }] : [])).slice(0, MAX_IA);
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

/** The words [w0, w1) of each story: voice segment k+1 (segment 0 is the opening). */
export function rangosDeNoticias(words, starts, n) {
  const first = (t) => { const i = words.findIndex((w) => w.s >= t - 0.06); return i < 0 ? words.length : i; };
  return Array.from({ length: n }, (_, k) => [first(starts[k + 1]), first(starts[k + 2])]);
}

/** Problems with the director's TV storyboard ({ pantallas: [...] }, one per story). */
export function revisarStoryboard(sb, { words, starts, spec }, catalogo = cargarCatalogo()) {
  const err = [];
  const n = spec.segmentos.length;
  const pant = sb?.pantallas;
  if (!Array.isArray(pant) || pant.length !== n) return [`storyboard.pantallas tiene que ser una lista con una entrada por noticia (${n})`];
  const R = rangosDeNoticias(words, starts, n);
  const at_ = (w) => words[Math.min(Math.max(0, w | 0), words.length - 1)];
  const usados = new Map();
  pant.forEach((p, k) => {
    const at = `pantallas[${k}] (noticia ${k + 1})`;
    const [w0, w1] = R[k];
    const within = (w, name) => {
      if (!Number.isInteger(w) || w < w0 || w >= w1) err.push(`${at}.${name} (${w}) tiene que ser una palabra de esta noticia: de ${w0} a ${w1 - 1}`);
    };
    const plano = p.plano ?? spec.segmentos[k].plano;
    if (!PLANOS.includes(plano)) err.push(`${at}.plano «${p.plano}» no existe (usa: ${PLANOS.join(', ')})`);
    if (p.fondo != null && !FONDOS.includes(p.fondo)) err.push(`${at}.fondo «${p.fondo}» no existe (usa: ${FONDOS.join(', ')})`);
    if (p.presentador) err.push(`${at}: en la tele no va el presentador (ya está en el escritorio)`);
    if (p.camara) {
      if (p.camara.mover != null && !MOVIMIENTOS.includes(p.camara.mover)) err.push(`${at}.camara.mover «${p.camara.mover}» no existe (usa: ${MOVIMIENTOS.join(', ')})`);
      if (p.camara.golpe != null) within(p.camara.golpe, 'camara.golpe');
    }
    const els = p.elementos ?? [];
    if (!Array.isArray(els) || els.length < 2) err.push(`${at}: la tele necesita al menos 2 piezas (una protagonista y algo que se mueva con la voz)`);
    if (els.length > 8) err.push(`${at} tiene ${els.length} piezas: máximo 8, que se lea en una tele`);
    const first = Math.min(...els.map((e) => (Number.isInteger(e.en) ? e.en : 1e9)));
    if (els.length && first > w0 + 3) err.push(`${at} arranca vacía: la primera pieza entra en la palabra ${first} y la noticia empieza en ${w0}; que algo entre en las primeras 3 palabras`);
    err.push(...revisarPiezas(els, { at, within, catalogo, at_, next: w1, nWords: words.length, lienzo: { w: LADO, h: LADO }, subtitulos: null, recortar: true, sinManos: true }));
    els.forEach((e, j) => {
      // in the «pantalla» shot the anchor sits over the TV's bottom-right corner
      if (plano === 'pantalla' && e.x > 760 && e.y > 820) err.push(`${at}.elementos[${j}]: en el plano «pantalla» el presentador tapa la esquina de abajo a la derecha (x>720 y y>790): muévela`);
      if (e.recurso) usados.set(e.recurso, [...(usados.get(e.recurso) ?? []), k + 1]);
    });
  });
  for (const [r, ks] of usados) if (new Set(ks).size > 1) err.push(`«${r}» sale en las noticias ${[...new Set(ks)].join(' y ')}: cada noticia con lo suyo, no repitas recursos`);
  return err;
}

/** The episode with the director's TV: the fixed build plus each story's pieces, shot and background. */
export function conStoryboard({ spec, words, starts, vozDur, seed, mouth, storyboard, catalogo = cargarCatalogo() }) {
  const ep = construir({ spec, words, starts, vozDur, seed, mouth });
  ep.libre = ep.scenes.map(() => null);
  const secs = (w) => +words[Math.min(Math.max(0, w), words.length - 1)].s.toFixed(3);
  storyboard.pantallas.forEach((p, k) => {
    const s = ep.noticiero.segmentos[k];
    if (p.plano) s.plano = p.plano;
    s.fondo = p.fondo ?? null;
    ep.libre[k + 1] = {
      prefab: null, presentador: null,
      camara: p.camara ? { ...p.camara, golpe: p.camara.golpe != null ? secs(p.camara.golpe) : null } : null,
      elementos: piezasParaEpisodio(p.elementos, words, catalogo),
    };
  });
  return ep;
}

export function resumen(spec) {
  return { gancho: spec.gancho?.titulo, noticias: (spec.segmentos ?? []).map((s) => s.titular) };
}
