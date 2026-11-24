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

const MODEL = () => process.env.FABRICA_MODELO || 'claude-sonnet-5-5';
const EFFORT = () => process.env.FABRICA_ESFUERZO || 'low';

/** The writer's instructions for one format (fmt: scripts/fabrica/formatos/<id>.mjs). */
function systemPrompt(fmt) {
  const fun = readJson(path.join(FAB, 'funciones.json'));
  const usable = fun.funciones.filter((f) => f.mencionar && f.escena);
  const leer = (n) => (fs.existsSync(path.join(fmt.dir, n)) ? fs.readFileSync(path.join(fmt.dir, n), 'utf8') : '');
  const ejemplo = leer('ejemplo.json');
  const ficha = usable.map((f) => ({
    funcion: f.id, nombre: f.nombre, que_es: f.que_es, ideas: f.ideas, no_decir: f.no_decir,
    palabras_que_animan: Object.values(f.anclas).flatMap((a) => a.palabras.slice(0, 2)),
  }));
  return [
    'Escribes los guiones de los videos cortos de Ducki (TikTok e Instagram Reels). Los lee en voz alta un pato presentador; la plantilla de video pone en pantalla las piezas de cada función.',
    'Reglas que no se rompen:\n- ' + fun.reglas_generales.join('\n- '),
    'Funciones que puedes usar (solo estas, y solo afirmando lo que dice cada ficha):\n' + JSON.stringify(ficha, null, 1),
    'Funciones que NO se mencionan por ahora: ' + fun.funciones.filter((f) => !f.mencionar).map((f) => f.nombre).join(', ') + '.',
    `Formato de hoy: «${fmt.nombre}».`,
    leer('formato.md'),
    leer('guia.md'),
    fmt.contexto ? fmt.contexto() : '',
    ejemplo ? 'Ejemplo de un guion que ya funcionó en este formato (no lo copies; varía el ángulo, el gancho, las funciones y el plan):\n' + ejemplo : '',
  ].filter(Boolean).join('\n\n');
}

/** The last episodes of this format, so the writer doesn't repeat itself. */
function recientes(fmt, n = 8) {
  const dir = path.join(FAB, 'episodios');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).sort().flatMap((d) => {
    const f = path.join(dir, d, 'spec.json');
    if (!fs.existsSync(f)) return [];
    const spec = readJson(f);
    if ((spec.formato || 'lista-scrapbook') !== fmt.id) return [];
    return [{ episodio: d, ...(fmt.resumen ? fmt.resumen(spec) : {}) }];
  }).slice(-n);
}

// Without an API key but with CLAUDE_CODE_OAUTH_TOKEN (`claude setup-token`, a
// Pro/Max subscription), the script goes through the Claude Code CLI instead:
// same prompt and schema, billed against the subscription's usage limits.
const viaCli = () => !process.env.ANTHROPIC_API_KEY && !!process.env.CLAUDE_CODE_OAUTH_TOKEN;

async function askCli(userText, fmt) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guionista-'));
  const sysFile = path.join(tmp, 'system.md');
  fs.writeFileSync(sysFile, systemPrompt(fmt));
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY; // an empty one would shadow the subscription token
  const args = ['-p', '--output-format', 'json', '--json-schema', JSON.stringify(fmt.esquema()),
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

async function ask(userText, fmt) {
  if (viaCli()) return askCli(userText, fmt);
  const client = new Anthropic();
  const res = await client.beta.messages.create({
    model: MODEL(),
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: EFFORT(), format: { type: 'json_schema', schema: fmt.esquema() } },
    system: [{ type: 'text', text: systemPrompt(fmt), cache_control: { type: 'ephemeral' } }],
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
async function askChecked(userText, fmt) {
  const funciones = readJson(path.join(FAB, 'funciones.json'));
  const check = (sp) => { sp.formato = fmt.id; return fmt.revisar(sp, funciones); };
  let spec = await ask(userText, fmt);
  let problems = check(spec);
  if (problems.length) {
    console.log(`guionista: el guion tiene ${problems.length} problema(s), lo corrijo: ${problems.join('; ')}`);
    spec = await ask(`${userText}\n\nTu respuesta anterior:\n${JSON.stringify(spec)}\n\nTiene estos problemas; devuelve el guion completo corregido:\n- ${problems.join('\n- ')}`, fmt);
    problems = check(spec);
    if (problems.length) throw new Error('El guion sigue sin servir para la plantilla:\n- ' + problems.join('\n- '));
  }
  return spec;
}

export async function escribirGuion(encargo, fmt) {
  const hoy = new Date().toISOString().slice(0, 10);
  return askChecked(`Fecha: ${hoy}.\nEpisodios recientes de este formato (no repitas gancho, ni el mismo grupo de funciones, ni el mismo estilo): ${JSON.stringify(recientes(fmt))}\n\nEncargo: ${encargo}`, fmt);
}

export async function reescribirGuion(spec, ajuste, fmt) {
  return askChecked(`Este es el guion actual:\n${JSON.stringify(spec, null, 1)}\n\nAjuste pedido por el equipo: ${ajuste}\n\nDevuelve el guion completo con el ajuste aplicado; lo demás igual (incluido el plan) salvo que el ajuste lo afecte.`, fmt);
}
