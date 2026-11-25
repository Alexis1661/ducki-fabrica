// Formato «Historia en chat»: una conversación de chat que avanza mientras el pato la narra.
// La plantilla es promo/src/fabrica/Chat.tsx; los documentos, fabrica/formatos/chat/.
import fs from 'node:fs';
import path from 'node:path';
import { FAB } from '../comun.mjs';
import { capturasRecientes } from '../recientes.mjs';
import { cargarCatalogo } from '../director/storyboard.mjs';

export const id = 'chat';
export const composicion = 'Chat';
export const dir = path.join(FAB, 'formatos', id);
export const director = false;
export const publico = ['todo', 'fuentes', 'ducks', 'app', 'fabrica/piezas', 'fabrica/disfraces', 'parches/cat', 'logos', 'duckart/weekly', 'screens', 'stores', 'generados'];

const TIPOS = ['marca', 'humor', 'pov', 'comunidad', 'funcion', 'tendencia'];
const PILARES = JSON.parse(fs.readFileSync(path.join(FAB, 'pilares.json'), 'utf8')).pilares.map((p) => p.id);
const nullable = (s) => ({ anyOf: [s, { type: 'null' }] });
const TEMAS = ['claro', 'oscuro', 'papel'];
const BURBUJAS = ['naranja', 'lima', 'rosa', 'cobalto'];
const MAX_IA = 4;
const MIN_IA = 2;

export function esquema() {
  const mensaje = {
    type: 'object', additionalProperties: false, required: ['de', 'tipo', 'texto', 'recurso', 'imagen_ia'],
    properties: {
      de: { type: 'string', enum: ['yo', 'otro', 'sistema'], description: 'yo = quien tiene el celular (derecha); otro = el contacto (izquierda); sistema = aviso centrado («Hoy 2:14 a. m.», «Ana te mandó una carta»).' },
      tipo: { type: 'string', enum: ['texto', 'sticker', 'foto'] },
      texto: nullable({ type: 'string', description: 'El mensaje (máximo 120 caracteres; corto, como se escribe en un chat: minúsculas, sin punto final).' }),
      recurso: nullable({ type: 'string', description: 'Para sticker o foto: ruta o id del catálogo (fabrica/catalogo/catalogo.json). Con imagen_ia queda de respaldo.' }),
      imagen_ia: nullable({ type: 'string', description: `Solo en stickers: un sticker NUEVO del pato hecho con IA para este momento (qué hace y su cara: «el pato llorando abrazado a un cuaderno»; sin texto escrito). Entre ${MIN_IA} y ${MAX_IA} en la historia.` }),
    },
  };
  return {
    type: 'object', additionalProperties: false,
    required: ['slug', 'tipo', 'pilar', 'gancho', 'contacto', 'estilo', 'lineas', 'cierre', 'caption', 'hashtags'],
    properties: {
      slug: { type: 'string', description: 'Nombre corto del episodio en kebab-case, sin tildes.' },
      tipo: { type: 'string', enum: TIPOS },
      pilar: { type: 'string', enum: PILARES },
      gancho: {
        type: 'object', additionalProperties: false, required: ['titulo', 'sub'],
        properties: {
          titulo: { type: 'string', description: 'Título grande sobre el chat al empezar: 1 a 3 palabras, máximo 14 caracteres.' },
          sub: { type: 'string', description: 'Frase pequeña debajo (máximo 28).' },
        },
      },
      contacto: {
        type: 'object', additionalProperties: false, required: ['nombre', 'avatar'],
        properties: {
          nombre: { type: 'string', description: 'Nombre del contacto en la barra del chat (máximo 24): «Mi crush 💛» no; «Valen (la de cálculo)» sí.' },
          avatar: nullable({ type: 'string', description: 'Pato del catálogo para la foto del contacto (sticker o pieza); null = pato básico.' }),
        },
      },
      estilo: {
        type: 'object', additionalProperties: false, required: ['tema', 'burbuja'],
        properties: { tema: { type: 'string', enum: TEMAS }, burbuja: { type: 'string', enum: BURBUJAS, description: 'Color de las burbujas de «yo».' } },
      },
      lineas: {
        type: 'array', description: 'De 3 a 9 momentos. En cada uno el narrador dice una frase y aparecen de 0 a 4 mensajes.',
        items: {
          type: 'object', additionalProperties: false, required: ['voz', 'mensajes'],
          properties: {
            voz: { type: 'string', description: 'Lo que dice el narrador en este momento (8 a 25 palabras). Comenta o cuenta; no lee los mensajes en voz alta.' },
            mensajes: { type: 'array', items: mensaje },
          },
        },
      },
      cierre: { type: 'string', description: 'La última frase del narrador: el remate y la invitación (con palabras distintas cada vez).' },
      caption: { type: 'string' },
      hashtags: { type: 'array', items: { type: 'string' } },
    },
  };
}

export function contexto() {
  const cat = cargarCatalogo();
  // the captures the last videos showed are not offered: every video with its own
  const recientes = new Set(capturasRecientes(null, undefined, cat));
  const stickers = cat.recursos.filter((r) => r.tipo === 'sticker' && r.d && !r.ruta.startsWith('logos/') && !recientes.has(r.ruta)).map((r) => `${r.ruta}: ${r.d}`);
  return 'Stickers y fotos que puedes mandar en el chat (ruta: qué es):\n' + stickers.slice(0, 90).join('\n');
}

// escribiendo: only the writer is held to the minimum of new stickers; an approved older script still builds
export function revisar(spec, _funciones, { escribiendo = false } = {}) {
  const err = [];
  const cat = cargarCatalogo();
  if (!Array.isArray(spec.lineas) || spec.lineas.length < 3 || spec.lineas.length > 9) err.push('lineas tiene que tener entre 3 y 9 momentos');
  let msgs = 0;
  let ia = 0;
  (spec.lineas ?? []).forEach((l, k) => {
    if (!l.voz?.trim()) err.push(`lineas[${k}] sin voz`);
    if ((l.mensajes ?? []).length > 4) err.push(`lineas[${k}] tiene más de 4 mensajes`);
    for (const m of l.mensajes ?? []) {
      msgs += 1;
      if (m.tipo === 'texto' && !(m.texto ?? '').trim()) err.push(`lineas[${k}]: un mensaje de texto sin texto`);
      if ([...(m.texto ?? '')].length > 120) err.push(`lineas[${k}]: un mensaje de más de 120 caracteres`);
      if (m.imagen_ia?.trim()) {
        ia += 1;
        if (m.tipo !== 'sticker') err.push(`lineas[${k}]: imagen_ia solo va en mensajes tipo sticker`);
        if (m.recurso && !cat.buscar(m.recurso)) err.push(`lineas[${k}]: «${m.recurso}» no está en el catálogo`);
      } else if (m.tipo !== 'texto' && !cat.buscar(m.recurso ?? '')) err.push(`lineas[${k}]: «${m.recurso}» no está en el catálogo`);
      if (m.tipo === 'foto' && cat.buscar(m.recurso ?? '')?.tipo === 'clip') err.push(`lineas[${k}]: «${m.recurso}» es un video, no una foto`);
    }
  });
  if (msgs < 4) err.push(`solo hay ${msgs} mensajes: una historia en chat necesita al menos 4`);
  if (ia > MAX_IA) err.push(`como mucho ${MAX_IA} stickers nuevos con imagen_ia`);
  if (escribiendo) {
    const recientes = new Set(capturasRecientes(null, undefined, cat));
    for (const [k, l] of (spec.lineas ?? []).entries()) {
      for (const m of l.mensajes ?? []) {
        const r = m.tipo === 'foto' && m.recurso ? cat.buscar(m.recurso)?.ruta : null;
        if (r && recientes.has(r)) err.push(`lineas[${k}]: la foto «${r}» salió en los últimos videos: usa otra`);
      }
    }
  }
  if (escribiendo && ia < MIN_IA) err.push(`manda al menos ${MIN_IA} stickers nuevos del pato con imagen_ia (tipo sticker): los hace la IA para esta historia`);
  if (spec.contacto?.avatar && !cat.buscar(spec.contacto.avatar)) err.push(`el avatar «${spec.contacto.avatar}» no está en el catálogo`);
  if (!spec.cierre?.trim()) err.push('falta cierre');
  const palabras = segmentos(spec).join(' ').split(/\s+/).filter(Boolean).length;
  if (palabras < 45 || palabras > 150) err.push(`el narrador dice ${palabras} palabras: entre 45 y 150`);
  return err;
}

export const segmentos = (spec) => [...(spec.lineas ?? []).map((l) => l.voz.trim()), spec.cierre.trim()];

export function aplicarTexto(spec, lines) {
  if (lines.length !== segmentos(spec).length) return null;
  const out = structuredClone(spec);
  out.lineas.forEach((l, k) => { l.voz = lines[k]; });
  out.cierre = lines[lines.length - 1];
  return out;
}

/** The stickers to draw with AI: [line, message] says where each one goes. */
export function pedidosDeImagen(spec) {
  return (spec.lineas ?? []).flatMap((l, k) => (l.mensajes ?? []).flatMap((m, j) => (m.imagen_ia?.trim() && m.tipo === 'sticker'
    ? [{ prompt: m.imagen_ia, para: `momento ${k + 1} del chat: ${l.voz}`, k: [k, j] }] : []))).slice(0, MAX_IA);
}

/** Puts the stickers that came out into their messages (h.n = which request; a failed one keeps its fallback). */
export function usarImagenes(spec, hechas) {
  const out = structuredClone(spec);
  const pedidos = pedidosDeImagen(spec);
  for (const [j, h] of hechas.entries()) {
    const k = pedidos[h.n ?? j]?.k;
    if (k) out.lineas[k[0]].mensajes[k[1]].recurso = h.ruta;
  }
  return out;
}

/** The props of Chat.tsx: each line with its time, each message with the second it appears. */
export function construir({ spec, words, starts, vozDur, seed, mouth, v0 = 0.15, tail = 2.2 }) {
  const cat = cargarCatalogo();
  // a sticker whose AI drawing didn't come out (and had no fallback) sends the waving duck
  const respaldo = cat.buscar('app/duck-waving.png');
  const lineas = spec.lineas.map((l, k) => {
    const t = k === 0 ? 0 : starts[k] - 0.05;
    const t1 = starts[k + 1] - 0.05;
    const n = l.mensajes.length;
    // messages spread over the line, the first one right away
    const mensajes = l.mensajes.map((m, j) => {
      const rec = (m.recurso ? cat.buscar(m.recurso) : null) ?? (m.tipo === 'texto' ? null : respaldo);
      return { de: m.de, tipo: m.tipo, texto: m.texto, src: rec?.ruta ?? null, w0: rec?.w ?? null, h0: rec?.h ?? null, en: +(t + 0.25 + ((t1 - t - 0.6) * j) / Math.max(1, n)).toFixed(3) };
    });
    return { t: +t.toFixed(3), t1: +t1.toFixed(3), mensajes };
  });
  const fin = starts[starts.length - 1] - 0.05;
  const avatar = spec.contacto.avatar ? cat.buscar(spec.contacto.avatar) : null;
  return {
    fps: 30, v0, total: +(vozDur + v0 + tail).toFixed(3), words, mouth, seed,
    scenes: [...lineas.map((l) => ({ kind: 'libre', t: l.t, ev: {} })), { kind: 'fin', t: +fin.toFixed(3), ev: {} }],
    N: 0, hook: { title: spec.gancho.titulo, sub: spec.gancho.sub, tag: null }, spoken: [], endLine: 'aquí todos somos patos',
    plan: { estilo: { subtitulos: 'papel', resaltado: spec.estilo.burbuja === 'lima' ? 'lime' : spec.estilo.burbuja === 'rosa' ? 'pink' : 'orange', contador: 'cinta', presentador: 'centro', estructura: 'historia' }, escenas: [] },
    chat: {
      contacto: { nombre: spec.contacto.nombre, avatar: avatar?.ruta ?? 'app/default-head.png' },
      tema: spec.estilo.tema, burbuja: spec.estilo.burbuja, lineas, fin: +fin.toFixed(3),
    },
  };
}

export function resumen(spec) {
  return { gancho: spec.gancho?.titulo, contacto: spec.contacto?.nombre, tema: spec.estilo?.tema, mensajes: (spec.lineas ?? []).reduce((a, l) => a + (l.mensajes?.length ?? 0), 0) };
}
