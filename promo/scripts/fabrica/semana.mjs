// The weekly plan: every Monday Sonnet proposes 7 ideas (one per day) spread across the
// content pillars and the formats; each goes to the «Fábrica» topic with ✅ Usar / ✏️ Cambiar /
// 🗑 No. Every morning the factory makes the script of the day's idea (the chosen ones first).
//
//   node scripts/fabrica/semana.mjs nueva
//   node scripts/fabrica/semana.mjs ajustar --idea <id> --texto "…"
//
// The plan lives with the episodes (private repo): fabrica/episodios/plan/<AAAA-SNN>.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAB, loadEnv, readJson, writeJson } from './comun.mjs';
import { pedirJson } from './claude.mjs';
import { datosApp } from './datos.mjs';
import { listaFormatos } from './formatos/index.mjs';

const PLANES = path.join(FAB, 'episodios', 'plan');
const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const PILARES = () => readJson(path.join(FAB, 'pilares.json')).pilares;
const TIPOS = ['marca', 'humor', 'pov', 'comunidad', 'funcion', 'tendencia'];

/** «2026-S48»: the ISO week, in Bogotá time. */
export function semanaDe(date = new Date()) {
  const d = new Date(date.getTime() - 5 * 3600e3);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-S${String(w).padStart(2, '0')}`;
}
const diaDeHoy = () => (new Date(Date.now() - 5 * 3600e3).getUTCDay() || 7);

function esquemaIdea() {
  return {
    type: 'object', additionalProperties: false,
    required: ['dia', 'pilar', 'tipo', 'formato', 'titulo', 'encargo', 'gancho', 'por_que', 'imagen'],
    properties: {
      dia: { type: 'integer', description: '1 = lunes … 7 = domingo' },
      pilar: { type: 'string', enum: PILARES().map((p) => p.id) },
      tipo: { type: 'string', enum: TIPOS },
      formato: { type: 'string', enum: listaFormatos().map((f) => f.id) },
      titulo: { type: 'string', description: 'La idea en una línea (máximo 60 caracteres).' },
      encargo: { type: 'string', description: 'La instrucción para el guionista: de qué va, el ángulo y el tono, en 1 a 3 frases.' },
      gancho: { type: 'string', description: 'La primera frase o imagen que engancha.' },
      por_que: { type: 'string', description: 'Por qué esta idea puede funcionar en TikTok/Reels (máximo 140 caracteres).' },
      imagen: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Si al video le sirve un recurso nuevo que no existe (el pato en una situación), descríbelo para generarlo con IA; si no, null.' },
    },
  };
}

function sistema() {
  const formatos = listaFormatos().map(({ id, nombre, descripcion }) => ({ id, nombre, descripcion }));
  const fun = readJson(path.join(FAB, 'funciones.json'));
  return [
    'Eres el estratega de contenido de Ducki (app social para universitarios de Cali) en TikTok e Instagram Reels. Cada lunes propones las 7 ideas de la semana. La meta: que cada video sorprenda, que ningún día se parezca al anterior y que la gente quiera comentar, compartir y descargar.',
    fs.readFileSync(path.join(FAB, 'tipos.md'), 'utf8'),
    'Pilares (reparte la semana según su peso; nunca el mismo pilar dos días seguidos; al menos 4 pilares distintos; como mucho 2 ideas de tipo funcion):\n' + JSON.stringify(PILARES(), null, 1),
    'Formatos disponibles (si hay más de uno, usa al menos dos en la semana):\n' + JSON.stringify(formatos, null, 1),
    'Qué hace la app (contexto): ' + JSON.stringify(fun.funciones.filter((f) => f.mencionar).map((f) => ({ id: f.id, nombre: f.nombre, que_es: f.que_es }))),
    'No se mencionan por ahora: ' + fun.funciones.filter((f) => !f.mencionar).map((f) => f.nombre).join(', ') + '.',
    fs.existsSync(path.resolve(FAB, '..', 'ducki-app')) ? 'Puedes leer el código de la app en ducki-app/ (solo lectura) para ideas de funciones nuevas (mira docs/ y mobile/src/features/). Nunca pongas datos de usuarios en una idea.' : '',
    'Ideas concretas, no genéricas: «Tipos de compañeros en un trabajo en grupo» sí; «un video sobre la U» no. Usa los datos reales de la app cuando sirvan (pilar comunidad).',
  ].filter(Boolean).join('\n\n');
}

function recientes(n = 14) {
  const dir = path.join(FAB, 'episodios');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).sort().flatMap((d) => {
    const f = path.join(dir, d, 'spec.json');
    if (!fs.existsSync(f)) return [];
    const s = readJson(f);
    return [{ episodio: d, tipo: s.tipo, pilar: s.pilar, formato: s.formato, gancho: s.gancho?.titulo }];
  }).slice(-n);
}

function revisarPlan(ideas) {
  const err = [];
  if (ideas.length !== 7) err.push(`son ${ideas.length} ideas: tienen que ser 7`);
  const dias = ideas.map((i) => i.dia).sort((a, b) => a - b).join(',');
  if (dias !== '1,2,3,4,5,6,7') err.push('cada idea va en un día distinto, del 1 al 7');
  const porDia = [...ideas].sort((a, b) => a.dia - b.dia);
  for (let k = 1; k < porDia.length; k++) if (porDia[k].pilar === porDia[k - 1].pilar) err.push(`los días ${porDia[k - 1].dia} y ${porDia[k].dia} repiten el pilar ${porDia[k].pilar}`);
  if (new Set(ideas.map((i) => i.pilar)).size < 4) err.push('usa al menos 4 pilares distintos');
  if (ideas.filter((i) => i.tipo === 'funcion').length > 2) err.push('como mucho 2 ideas de tipo funcion');
  if (listaFormatos().length > 1 && new Set(ideas.map((i) => i.formato)).size < 2) err.push('usa al menos dos formatos');
  return err;
}

/** The latest decision cursor, so the plan only reads the choices made after it was sent. */
async function cursorActual() {
  const api = (process.env.FABRICA_API || 'https://api.duck-i.app').replace(/\/$/, '');
  let cursor = '';
  for (let k = 0; k < 20; k++) {
    const res = await fetch(`${api}/api/v1/fabrica/decisiones${cursor ? `?desde=${encodeURIComponent(cursor)}` : ''}`, { headers: { Authorization: `Bearer ${process.env.FABRICA_TOKEN}` } });
    if (!res.ok) throw new Error(`decisiones: HTTP ${res.status}`);
    const { data } = await res.json();
    if (!data.decisiones.length) return data.cursor || cursor;
    cursor = data.cursor;
  }
  return cursor;
}

/** Every decision about this plan's ideas since it was sent. */
async function decisionesDelPlan(plan) {
  const api = (process.env.FABRICA_API || 'https://api.duck-i.app').replace(/\/$/, '');
  const ids = new Set(plan.ideas.map((i) => i.id));
  const out = [];
  let cursor = plan.cursor || '';
  for (let k = 0; k < 20; k++) {
    const res = await fetch(`${api}/api/v1/fabrica/decisiones${cursor ? `?desde=${encodeURIComponent(cursor)}` : ''}`, { headers: { Authorization: `Bearer ${process.env.FABRICA_TOKEN}` } });
    if (!res.ok) throw new Error(`decisiones: HTTP ${res.status}`);
    const { data } = await res.json();
    out.push(...data.decisiones.filter((d) => ids.has(d.episodio)));
    if (!data.decisiones.length || data.cursor === cursor) break;
    cursor = data.cursor;
  }
  return out;
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function enviarIdea(idea) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  const topic = Number(process.env.TELEGRAM_TOPIC_FABRICA ?? 0);
  const fmt = listaFormatos().find((f) => f.id === idea.formato);
  const pilar = PILARES().find((p) => p.id === idea.pilar);
  // no «🆔» here: the bot reads that line on scripts (a reply to it would be a script change)
  const text = [
    `<b>${DIAS[idea.dia]} · ${esc(pilar?.nombre ?? idea.pilar)}</b> · ${esc(fmt ? `${fmt.emoji ?? ''} ${fmt.nombre}`.trim() : idea.formato)} · ${esc(idea.tipo)}`,
    `<b>${esc(idea.titulo)}</b>`,
    esc(idea.encargo),
    `<i>Gancho:</i> ${esc(idea.gancho)}`,
    `<i>Por qué:</i> ${esc(idea.por_que)}`,
    idea.imagen ? `🖼 <i>Imagen nueva:</i> ${esc(idea.imagen)}` : '',
    `<code>#${esc(idea.id)}</code>`,
  ].filter(Boolean).join('\n');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chat, ...(topic ? { message_thread_id: topic } : {}), text, parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[
        { text: '✅ Usar', callback_data: `f:pok:${idea.id}` }, { text: '✏️ Cambiar', callback_data: `f:paj:${idea.id}` }, { text: '🗑 No', callback_data: `f:pno:${idea.id}` },
      ]] },
    }),
  });
  const body = await res.json();
  if (!body.ok) throw new Error(`Telegram no aceptó la idea ${idea.id}: ${body.description}`);
  return body.result.message_id;
}

async function aviso(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  const topic = Number(process.env.TELEGRAM_TOPIC_FABRICA ?? 0);
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, ...(topic ? { message_thread_id: topic } : {}), text, parse_mode: 'HTML' }),
  });
}

/** Adds the images the ideas ask for to the queue the image generator reads. */
function encolarImagenes(plan) {
  const f = path.join(FAB, 'episodios', 'generados-pedidos.json');
  const cola = fs.existsSync(f) ? readJson(f) : { pedidos: [] };
  for (const i of plan.ideas) {
    if (i.imagen && !cola.pedidos.some((p) => p.idea === i.id)) cola.pedidos.push({ idea: i.id, dia: i.dia, semana: plan.semana, prompt: i.imagen, estado: 'pendiente' });
  }
  writeJson(f, cola);
}

async function nueva() {
  const semana = semanaDe();
  const datos = await datosApp();
  let ideas = (await pedirJson({
    sistema: sistema(),
    mensaje: [`Semana ${semana}. Propón las 7 ideas (dia 1 = lunes).`, `Videos recientes (no los repitas): ${JSON.stringify(recientes())}`, datos ? `Datos reales de la app: ${JSON.stringify(datos)}` : ''].filter(Boolean).join('\n'),
    esquema: { type: 'object', additionalProperties: false, required: ['ideas'], properties: { ideas: { type: 'array', items: esquemaIdea() } } },
  })).ideas;
  let problems = revisarPlan(ideas);
  if (problems.length) {
    console.log(`plan: ${problems.length} problema(s), lo corrijo: ${problems.join('; ')}`);
    ideas = (await pedirJson({
      sistema: sistema(),
      mensaje: `Semana ${semana}. Este plan tiene problemas; devuélvelo completo corregido:\n- ${problems.join('\n- ')}\n\n${JSON.stringify(ideas)}`,
      esquema: { type: 'object', additionalProperties: false, required: ['ideas'], properties: { ideas: { type: 'array', items: esquemaIdea() } } },
    })).ideas;
    problems = revisarPlan(ideas);
    if (problems.length) throw new Error('El plan sigue con problemas:\n- ' + problems.join('\n- '));
  }
  const plan = { semana, creado: new Date().toISOString(), cursor: await cursorActual(), ideas: ideas.sort((a, b) => a.dia - b.dia).map((i) => ({ ...i, id: `${semana}-${i.dia}`, estado: 'propuesta' })) };
  fs.mkdirSync(PLANES, { recursive: true });
  await aviso(`📅 <b>Plan de la semana ${semana.split('-S')[1]}</b>: 7 ideas. Toca ✅ en las que quieras (van primero), ✏️ para cambiar una o 🗑 para quitarla. Cada mañana sale el guion de la idea del día.`);
  for (const idea of plan.ideas) idea.telegram = await enviarIdea(idea);
  writeJson(path.join(PLANES, `${semana}.json`), plan);
  encolarImagenes(plan);
  console.log(`plan ${semana}: ${plan.ideas.map((i) => `${i.dia}:${i.pilar}/${i.formato}`).join(' ')}`);
}

function planCon(id) {
  if (!fs.existsSync(PLANES)) return null;
  for (const f of fs.readdirSync(PLANES).sort().reverse()) {
    const plan = readJson(path.join(PLANES, f));
    if (plan.ideas.some((i) => i.id === id)) return { plan, file: path.join(PLANES, f) };
  }
  return null;
}

async function ajustar(o) {
  const found = planCon(o.idea);
  if (!found) throw new Error(`No encuentro la idea ${o.idea}`);
  const { plan, file } = found;
  const k = plan.ideas.findIndex((i) => i.id === o.idea);
  const vieja = plan.ideas[k];
  const nuevaIdea = await pedirJson({
    sistema: sistema(),
    mensaje: `Esta es la idea del ${DIAS[vieja.dia]} del plan ${plan.semana}:\n${JSON.stringify(vieja)}\n\nEl resto del plan (para no repetir): ${JSON.stringify(plan.ideas.filter((i) => i.id !== vieja.id).map(({ dia, pilar, tipo, formato, titulo }) => ({ dia, pilar, tipo, formato, titulo })))}\n\nCambio pedido por el equipo: ${o.texto}\n\nDevuelve la idea cambiada (mismo día).`,
    esquema: esquemaIdea(),
  });
  plan.ideas[k] = { ...nuevaIdea, dia: vieja.dia, id: vieja.id, estado: 'propuesta', cambio: o.texto };
  plan.ideas[k].telegram = await enviarIdea(plan.ideas[k]);
  writeJson(file, plan);
  encolarImagenes(plan);
  console.log(`idea ${vieja.id} cambiada`);
}

/**
 * The idea for today's video: a chosen one first (by day), else today's own idea if nobody
 * discarded it, else the next remaining one; null when the week has nothing left (the writer
 * then picks). Marks it as used.
 */
export async function ideaDeHoy() {
  const file = path.join(PLANES, `${semanaDe()}.json`);
  if (!fs.existsSync(file)) return null;
  const plan = readJson(file);
  let decisiones = [];
  try { decisiones = await decisionesDelPlan(plan); } catch (e) { console.log(`plan: no pude leer las decisiones (${e.message}); uso el orden del plan`); }
  const ultima = {};
  for (const d of decisiones) if (d.accion === 'plan-aprobar' || d.accion === 'plan-descartar') ultima[d.episodio] = d.accion;
  const libres = plan.ideas.filter((i) => i.estado !== 'usada' && ultima[i.id] !== 'plan-descartar');
  const hoy = diaDeHoy();
  const elegida = libres.filter((i) => ultima[i.id] === 'plan-aprobar').sort((a, b) => a.dia - b.dia)[0]
    ?? libres.find((i) => i.dia === hoy)
    ?? libres.filter((i) => i.dia >= hoy).sort((a, b) => a.dia - b.dia)[0];
  if (!elegida) return null;
  elegida.estado = 'usada';
  elegida.usada = new Date().toISOString();
  writeJson(file, plan);
  return elegida;
}

/** Which episode an idea became. */
export function anotarEpisodio(id, episodio) {
  const found = planCon(id);
  if (!found) return;
  const idea = found.plan.ideas.find((i) => i.id === id);
  idea.episodio = episodio;
  writeJson(found.file, found.plan);
}

function args() {
  const a = process.argv.slice(3), o = {};
  for (let i = 0; i < a.length; i++) o[a[i].replace(/^--/, '')] = a[++i];
  return o;
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  loadEnv();
  const run = { nueva, ajustar }[process.argv[2]];
  if (!run) { console.error('uso: semana.mjs nueva | ajustar --idea <id> --texto "…"'); process.exit(2); }
  run(args()).catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
}
