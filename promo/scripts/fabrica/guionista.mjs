// The scriptwriter: turns a short brief ("3 cosas para declararte a tu crush") into
// the episode spec, with Claude through the API. One request per script, one per
// adjustment; the long, stable part of the prompt (rules, the functions sheet, the
// format, an example) is cached between calls.
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';
import { FAB, readJson } from './comun.mjs';
import { ESCENAS } from './linea.mjs';

const MODEL = () => process.env.FABRICA_MODELO ?? 'claude-opus-5-5';
const EFFORT = () => process.env.FABRICA_ESFUERZO ?? 'low';

const nullable = (s) => ({ anyOf: [s, { type: 'null' }] });
export const SPEC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['slug', 'gancho', 'intro', 'puntos', 'cierre_todo', 'cierre', 'caption', 'hashtags'],
  properties: {
    slug: { type: 'string', description: 'Nombre corto del episodio en kebab-case, sin tildes.' },
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
      description: 'Entre 2 y 9 puntos, cada uno de una función distinta.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['funcion', 'texto', 'favorita'],
        properties: {
          funcion: { type: 'string', enum: ESCENAS },
          texto: { type: 'string', description: 'Lo que dice en este punto; empieza con el número en palabra.' },
          favorita: { type: 'boolean' },
        },
      },
    },
    cierre_todo: nullable({ type: 'string', description: 'Frase opcional tipo "Todo eso en una sola app…", o null.' }),
    cierre: { type: 'string', description: 'Llamado a descargar y cierre de marca.' },
    caption: { type: 'string', description: 'Texto que acompaña el video en TikTok/Instagram: 1 a 3 frases.' },
    hashtags: { type: 'array', items: { type: 'string' }, description: '4 a 6 hashtags, incluye #Ducki.' },
  },
};

function systemPrompt() {
  const fun = readJson(path.join(FAB, 'funciones.json'));
  const usable = fun.funciones.filter((f) => f.mencionar && f.escena);
  const ejemplo = readJson(path.join(FAB, 'formatos', 'lista-scrapbook', 'ejemplo.json'));
  const formato = fs.readFileSync(path.join(FAB, 'formatos', 'lista-scrapbook', 'formato.md'), 'utf8');
  const ficha = usable.map((f) => ({
    funcion: f.id, nombre: f.nombre, que_es: f.que_es, ideas: f.ideas, no_decir: f.no_decir,
    palabras_que_animan: Object.values(f.anclas).flatMap((a) => a.palabras.slice(0, 2)),
  }));
  return [
    'Escribes los guiones de los videos cortos de Ducki (TikTok e Instagram Reels). Los lee en voz alta un pato presentador; la plantilla de video pone en pantalla las piezas de cada función.',
    'Reglas que no se rompen:\n- ' + fun.reglas_generales.join('\n- '),
    'Funciones que puedes usar (solo estas, y solo afirmando lo que dice cada ficha):\n' + JSON.stringify(ficha, null, 1),
    'Funciones que NO se mencionan por ahora: ' + fun.funciones.filter((f) => !f.mencionar).map((f) => f.nombre).join(', ') + '.',
    formato,
    'Ejemplo de un guion que ya funcionó (no lo copies; varía el ángulo, el gancho y las funciones):\n' + JSON.stringify(ejemplo, null, 1),
  ].join('\n\n');
}

/** The last episodes made, so the writer doesn't repeat itself. */
function recientes(n = 8) {
  const dir = path.join(FAB, 'episodios');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).sort().slice(-n).flatMap((d) => {
    const f = path.join(dir, d, 'spec.json');
    if (!fs.existsSync(f)) return [];
    const s = readJson(f);
    return [{ episodio: d, gancho: s.gancho?.titulo, funciones: (s.puntos ?? []).map((p) => p.funcion) }];
  });
}

async function ask(userText) {
  const client = new Anthropic();
  const res = await client.beta.messages.create({
    model: MODEL(),
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: EFFORT(), format: { type: 'json_schema', schema: SPEC_SCHEMA } },
    system: [{ type: 'text', text: systemPrompt(), cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userText }],
  });
  if (res.stop_reason === 'refusal') throw new Error(`El modelo no escribió el guion (refusal: ${res.stop_details?.category ?? 'sin categoría'}).`);
  if (res.stop_reason === 'max_tokens') throw new Error('El guion se cortó por max_tokens.');
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const u = res.usage;
  console.log(`guionista: ${res.model}, entrada ${u.input_tokens} (+${u.cache_read_input_tokens ?? 0} en caché), salida ${u.output_tokens} tokens`);
  return JSON.parse(text);
}

export async function escribirGuion(encargo) {
  const hoy = new Date().toISOString().slice(0, 10);
  return ask(`Fecha: ${hoy}.\nEpisodios recientes (no repitas gancho ni el mismo grupo de funciones): ${JSON.stringify(recientes())}\n\nEncargo: ${encargo}`);
}

export async function reescribirGuion(spec, ajuste) {
  return ask(`Este es el guion actual:\n${JSON.stringify(spec, null, 1)}\n\nAjuste pedido por el equipo: ${ajuste}\n\nDevuelve el guion completo con el ajuste aplicado; lo demás igual salvo que el ajuste lo afecte.`);
}
