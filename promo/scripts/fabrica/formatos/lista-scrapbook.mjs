// Formato «Lista scrapbook»: lo que la fábrica necesita saber de él. Cada formato
// tiene un módulo como este en scripts/fabrica/formatos/ (la interfaz está en
// fabrica/formatos/COMO-CREAR-UN-FORMATO.md) y una entrada en fabrica/formatos/index.json.
import fs from 'node:fs';
import path from 'node:path';
import { FAB } from '../comun.mjs';
import { ESCENAS, construirEpisodio, revisarSpec, segmentos as segs } from '../linea.mjs';
import { PERILLAS } from '../plan.mjs';

export const id = 'lista-scrapbook';
/** Composition id in src/fabrica/index.ts. */
export const composicion = 'Lista';
/** A director decides what each scene shows (fabrica/formatos/lista-scrapbook/DIRECTOR.md). */
export const director = true;
/** Folder with formato.md, guia.md and ejemplo.json. */
export const dir = path.join(FAB, 'formatos', id);
/** Files and folders of promo/public the template uses (render copies only these). */
export const publico = [
  'todo', 'fabrica/piezas', 'fabrica/disfraces', 'fuentes', 'ducks', 'duckart/weekly', 'parches/cat', 'parches/games', 'logos', 'app',
  'screens', 'map', 'stores', 'parches/duckisalas-ducks.png', 'v0110', 'tutorial-salas', 'generados',
];

const nullable = (s) => ({ anyOf: [s, { type: 'null' }] });
export const TIPOS = ['marca', 'humor', 'pov', 'comunidad', 'funcion', 'tendencia'];
const PILARES = JSON.parse(fs.readFileSync(path.join(FAB, 'pilares.json'), 'utf8')).pilares.map((p) => p.id);
const HOJAS = [...new Set(Object.values(PERILLAS.escenas).flatMap((e) => e.hojas))];
const LOOK = {
  type: 'object',
  additionalProperties: false,
  required: ['entrada', 'direccion', 'hoja', 'titulo', 'impacto', 'mano', 'nota'],
  properties: {
    entrada: { type: 'string', enum: PERILLAS.entradas },
    direccion: { type: 'string', enum: PERILLAS.direcciones },
    hoja: { type: 'string', enum: HOJAS, description: 'Solo un color de la lista de esa escena (ver la guía).' },
    titulo: { type: 'string', enum: PERILLAS.titulos },
    impacto: { type: 'string', enum: PERILLAS.impactos },
    mano: { type: 'boolean' },
    nota: nullable({ type: 'string', description: `Nota a mano, máximo ${PERILLAS.nota_max} caracteres; solo en escenas con espacio para nota.` }),
  },
};
const PLAN = {
  type: 'object',
  additionalProperties: false,
  required: ['estilo', 'intro', 'todo', 'fin'],
  properties: {
    estilo: {
      type: 'object',
      additionalProperties: false,
      required: ['estructura', 'subtitulos', 'resaltado', 'contador', 'presentador', 'musica'],
      properties: {
        estructura: { type: 'string', enum: PERILLAS.estructuras, description: 'Cómo se cuenta el video: lista numerada, historia, POV o pregunta. Ver formato.md.' },
        subtitulos: { type: 'string', enum: PERILLAS.subtitulos },
        resaltado: { type: 'string', enum: PERILLAS.resaltados },
        contador: { type: 'string', enum: PERILLAS.contadores },
        presentador: { type: 'string', enum: PERILLAS.presentador },
        musica: {
          type: 'object',
          additionalProperties: false,
          required: ['bpm', 'tono', 'progresion'],
          properties: { bpm: { type: 'integer' }, tono: { type: 'integer' }, progresion: { type: 'integer' } },
        },
      },
    },
    intro: LOOK,
    todo: nullable(LOOK),
    fin: LOOK,
  },
};

/** JSON schema of the script + plan the writer returns. */
export function esquema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['slug', 'tipo', 'pilar', 'gancho', 'intro', 'puntos', 'cierre_todo', 'cierre', 'caption', 'hashtags', 'plan'],
    properties: {
      slug: { type: 'string', description: 'Nombre corto del episodio en kebab-case, sin tildes.' },
      tipo: { type: 'string', enum: TIPOS, description: 'Tipo de video (fabrica/tipos.md). Fuera de "funcion", no hace falta nombrar funciones.' },
      pilar: { type: 'string', enum: PILARES, description: 'Pilar de contenido (fabrica/pilares.json).' },
      gancho: {
        type: 'object',
        additionalProperties: false,
        required: ['titulo', 'sub', 'etiqueta'],
        properties: {
          titulo: { type: 'string', description: 'Título en letras recortadas: 1 a 3 palabras en MAYÚSCULAS, máximo 14 caracteres. Ej: "9 COSAS".' },
          sub: { type: 'string', description: 'Frase corta debajo del título, máximo 28 caracteres. Ej: "que puedes hacer en".' },
          etiqueta: nullable({ type: 'string', description: 'Nota corta pegada en el gancho, máximo 26 caracteres, o null.' }),
        },
      },
      intro: { type: 'string', description: 'Lo primero que dice el presentador: el gancho hablado, nombra a Ducki.' },
      puntos: {
        type: 'array',
        description: 'Entre 2 y 9 momentos del guion (en una lista, los puntos; en una historia, POV o pregunta, los momentos).',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['funcion', 'texto', 'rotulo', 'favorita', 'look'],
          properties: {
            funcion: nullable({ type: 'string', enum: [...ESCENAS, 'otra'], description: 'Solo si este momento habla de una función de la app ("otra" si es una novedad leída en el código); null si no habla de ninguna (lo normal fuera del tipo "funcion").' }),
            texto: { type: 'string', description: 'Lo que dice la voz en esta hoja. En una lista empieza con el número en palabra; en historia, POV o pregunta, nunca.' },
            rotulo: nullable({ type: 'string', description: `Título de la hoja fuera de una lista: el momento de la historia, en mayúsculas, máximo ${PERILLAS.rotulo_max} caracteres (ej. "LUNES 7 AM", "EN LA FILA"). null en una lista.` }),
            favorita: { type: 'boolean' },
            look: LOOK,
          },
        },
      },
      cierre_todo: nullable({ type: 'string', description: 'Frase opcional tipo "Todo eso en una sola app…", o null.' }),
      cierre: { type: 'string', description: 'El remate y la invitación final, con palabras distintas cada vez (ver tipos.md).' },
      caption: { type: 'string', description: 'Texto que acompaña el video en TikTok/Instagram: 1 a 3 frases.' },
      hashtags: { type: 'array', items: { type: 'string' }, description: '4 a 6 hashtags, incluye #Ducki.' },
      plan: PLAN,
    },
  };
}

/** Extra context for the writer beyond formato.md / guia.md / ejemplo.json. */
export function contexto() {
  const hojas = Object.fromEntries(Object.entries(PERILLAS.escenas).map(([k, v]) => [k, { hojas: v.hojas, nota: !!v.nota }]));
  return 'Colores permitidos por escena y si tiene espacio para nota (las escenas de cada punto se llaman como su función):\n' + JSON.stringify(hojas);
}

/** Problems with a spec (empty when the template can render it). */
export const revisar = (spec, funciones) => revisarSpec(spec, funciones);

/** What the voice reads, in order: one segment per scene. */
export const segmentos = (spec) => segs(spec);

/** The script edited by hand, line by line (same lines as segmentos); null if the lines don't match. */
export function aplicarTexto(spec, lines) {
  if (lines.length !== segs(spec).length) return null;
  const out = structuredClone(spec);
  let k = 0;
  out.intro = lines[k++];
  for (const p of out.puntos) p.texto = lines[k++];
  if (out.cierre_todo) out.cierre_todo = lines[k++];
  out.cierre = lines[k++];
  return out;
}

/** The props of the composition (Episode) from the spec and the voice timings. */
export const construir = (args) => construirEpisodio(args);

/** One line about an episode, so the writer doesn't repeat recent ones. */
export function resumen(spec) {
  const e = spec.plan?.estilo;
  return {
    gancho: spec.gancho?.titulo, funciones: (spec.puntos ?? []).map((p) => p.funcion).filter(Boolean),
    ...(e ? { estructura: e.estructura ?? 'lista', estilo: `${e.subtitulos}/${e.contador}/${e.resaltado}/${e.musica?.bpm}bpm`, entradas: (spec.puntos ?? []).map((p) => p.look?.entrada) } : {}),
  };
}
