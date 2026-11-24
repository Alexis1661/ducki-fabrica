// The scriptwriter: turns a short brief ("3 cosas para declararte a tu crush") into
// the episode spec — the script and its edit plan (which knobs of the format the
// video turns today; see fabrica/formatos/lista-scrapbook/guia.md). One request per
// script, one per adjustment, plus one retry when the validator finds problems; the
// long, stable part of the prompt (rules, functions, format, guide) is cached.
// Daily episodes run on Sonnet: the format and its first video are made with Opus.
import Anthropic from '@anthropic-ai/sdk';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FAB, readJson } from './comun.mjs';
import { ESCENAS, revisarSpec } from './linea.mjs';
import { PERILLAS } from './plan.mjs';

const MODEL = () => process.env.FABRICA_MODELO || 'claude-sonnet-5-5';
const EFFORT = () => process.env.FABRICA_ESFUERZO || 'low';

const nullable = (s) => ({ anyOf: [s, { type: 'null' }] });
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
      required: ['subtitulos', 'resaltado', 'contador', 'presentador', 'musica'],
      properties: {
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
export const SPEC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['slug', 'gancho', 'intro', 'puntos', 'cierre_todo', 'cierre', 'caption', 'hashtags', 'plan'],
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
        required: ['funcion', 'texto', 'favorita', 'look'],
        properties: {
          funcion: { type: 'string', enum: ESCENAS },
          texto: { type: 'string', description: 'Lo que dice en este punto; empieza con el número en palabra.' },
          favorita: { type: 'boolean' },
          look: LOOK,
        },
      },
    },
    cierre_todo: nullable({ type: 'string', description: 'Frase opcional tipo "Todo eso en una sola app…", o null.' }),
    cierre: { type: 'string', description: 'Llamado a descargar y cierre de marca.' },
    caption: { type: 'string', description: 'Texto que acompaña el video en TikTok/Instagram: 1 a 3 frases.' },
    hashtags: { type: 'array', items: { type: 'string' }, description: '4 a 6 hashtags, incluye #Ducki.' },
    plan: PLAN,
  },
};

function systemPrompt() {
  const fun = readJson(path.join(FAB, 'funciones.json'));
  const usable = fun.funciones.filter((f) => f.mencionar && f.escena);
  const ejemplo = readJson(path.join(FAB, 'formatos', 'lista-scrapbook', 'ejemplo.json'));
  const formato = fs.readFileSync(path.join(FAB, 'formatos', 'lista-scrapbook', 'formato.md'), 'utf8');
  const guia = fs.readFileSync(path.join(FAB, 'formatos', 'lista-scrapbook', 'guia.md'), 'utf8');
  const hojas = Object.fromEntries(Object.entries(PERILLAS.escenas).map(([k, v]) => [k, { hojas: v.hojas, nota: !!v.nota }]));
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
    guia,
    'Colores permitidos por escena y si tiene espacio para nota (las escenas de cada punto se llaman como su función):\n' + JSON.stringify(hojas),
    'Ejemplo de un guion que ya funcionó (no lo copies; varía el ángulo, el gancho, las funciones y el plan):\n' + JSON.stringify(ejemplo, null, 1),
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
    const e = s.plan?.estilo;
    return [{
      episodio: d, gancho: s.gancho?.titulo, funciones: (s.puntos ?? []).map((p) => p.funcion),
      ...(e ? { estilo: `${e.subtitulos}/${e.contador}/${e.resaltado}/${e.musica?.bpm}bpm`, entradas: (s.puntos ?? []).map((p) => p.look?.entrada) } : {}),
    }];
  });
}

// Without an API key but with CLAUDE_CODE_OAUTH_TOKEN (`claude setup-token`, a
// Pro/Max subscription), the script goes through the Claude Code CLI instead:
// same prompt and schema, billed against the subscription's usage limits.
const viaCli = () => !process.env.ANTHROPIC_API_KEY && !!process.env.CLAUDE_CODE_OAUTH_TOKEN;

async function askCli(userText) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guionista-'));
  const sysFile = path.join(tmp, 'system.md');
  fs.writeFileSync(sysFile, systemPrompt());
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY; // an empty one would shadow the subscription token
  const args = ['-p', '--output-format', 'json', '--json-schema', JSON.stringify(SPEC_SCHEMA),
    '--system-prompt-file', sysFile, '--model', process.env.FABRICA_MODELO_CLI || 'sonnet',
    '--effort', EFFORT(), '--tools', '', '--no-session-persistence'];
  const out = await new Promise((resolve, reject) => {
    const p = spawn(process.env.CLAUDE_BIN ?? 'claude', args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let so = '', se = '';
    p.stdout.on('data', (d) => { so += d; });
    p.stderr.on('data', (d) => { se += d; });
    p.on('error', (e) => reject(new Error(`No pude correr Claude Code (${e.message}); ¿está instalado?`)));
    p.on('close', (code) => (code === 0 ? resolve(so) : reject(new Error(
      `Claude Code salió con código ${code}: ${(so.trim().slice(-500) + ' ' + se.trim().slice(-300)).trim()} (si dice límite de uso, la suscripción llegó al tope de hoy)`))));
    p.stdin.end(userText);
  });
  fs.rmSync(tmp, { recursive: true, force: true });
  const res = JSON.parse(out);
  if (res.is_error) throw new Error(`Claude Code no escribió el guion: ${String(res.result ?? res.subtype).slice(0, 400)}`);
  const u = res.usage ?? {};
  console.log(`guionista (Claude Code, suscripción): entrada ${u.input_tokens ?? '?'} (+${u.cache_read_input_tokens ?? 0} en caché), salida ${u.output_tokens ?? '?'} tokens`);
  if (res.structured_output) return res.structured_output;
  const text = String(res.result ?? '').replace(/^```(?:json)?\s*|\s*```$/g, '');
  return JSON.parse(text);
}

async function ask(userText) {
  if (viaCli()) return askCli(userText);
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

/** Asks, checks the result against the template and the knobs, and asks once more with the problems. */
async function askChecked(userText) {
  const funciones = readJson(path.join(FAB, 'funciones.json'));
  let spec = await ask(userText);
  let problems = revisarSpec(spec, funciones);
  if (problems.length) {
    console.log(`guionista: el guion tiene ${problems.length} problema(s), lo corrijo: ${problems.join('; ')}`);
    spec = await ask(`${userText}\n\nTu respuesta anterior:\n${JSON.stringify(spec)}\n\nTiene estos problemas; devuelve el guion completo corregido:\n- ${problems.join('\n- ')}`);
    problems = revisarSpec(spec, funciones);
    if (problems.length) throw new Error('El guion sigue sin servir para la plantilla:\n- ' + problems.join('\n- '));
  }
  return spec;
}

export async function escribirGuion(encargo) {
  const hoy = new Date().toISOString().slice(0, 10);
  return askChecked(`Fecha: ${hoy}.\nEpisodios recientes (no repitas gancho, ni el mismo grupo de funciones, ni el mismo estilo): ${JSON.stringify(recientes())}\n\nEncargo: ${encargo}`);
}

export async function reescribirGuion(spec, ajuste) {
  return askChecked(`Este es el guion actual:\n${JSON.stringify(spec, null, 1)}\n\nAjuste pedido por el equipo: ${ajuste}\n\nDevuelve el guion completo con el ajuste aplicado; lo demás igual (incluido el plan) salvo que el ajuste lo afecte.`);
}
