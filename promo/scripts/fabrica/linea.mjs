// From a script (spec) and its voice timings to the Episode the Remotion template
// reads (src/fabrica/head.tsx -> Episode): scenes, the anchors each scene animates
// on, the keywords written on screen, the hook.
import { norm } from './comun.mjs';
import { musicaDe, planEpisodio, revisarPlan } from './plan.mjs';

/** Where each scene writes its spoken keyword, if the anchor word is said (layout of src/fabrica/Lista.tsx). */
const STICKERS = {
  publica: { ancla: 'anon', x: 800, y: 1290 },
  mapa: { ancla: 'amigos', x: 300, y: 1450 },
  crush: { ancla: 'crush', x: 820, y: 430 },
  sala: { ancla: 'voz', x: 790, y: 1300 },
};
const SHORT = new Set(['por', 'de', 'en', 'tu', 'mi', 'a', 'con']);

/** Scene ids the template can show, as functions.json names them. */
export const ESCENAS = ['publica', 'mapa', 'pato', 'arte', 'parche', 'carta', 'crush', 'sala', 'juegos'];

/** Checks a spec against the template and functions.json; returns the problems found. */
export function revisarSpec(spec, funciones) {
  const err = [];
  const byId = Object.fromEntries(funciones.funciones.map((f) => [f.id, f]));
  if (!spec.gancho?.titulo) err.push('falta gancho.titulo');
  if (!spec.intro) err.push('falta intro');
  if (!Array.isArray(spec.puntos) || spec.puntos.length < 2 || spec.puntos.length > 9) err.push('puntos debe tener entre 2 y 9');
  // outside a «funcion» video, functions are not the point: at most one moment names one
  const nombradas = (spec.puntos ?? []).filter((p) => p.funcion && p.funcion !== 'otra').length;
  if (spec.tipo && spec.tipo !== 'funcion' && spec.tipo !== 'tendencia' && nombradas > 1) err.push(`es un video de tipo «${spec.tipo}» y ${nombradas} momentos hablan de funciones de la app: como mucho uno (y solo si suma); el resto, funcion: null`);
  const seen = new Set();
  for (const p of spec.puntos ?? []) {
    if (!p.funcion || p.funcion === 'otra') { if (!p.texto?.trim()) err.push('un momento sin texto'); continue; }
    const f = byId[p.funcion];
    if (!f) err.push(`función desconocida: ${p.funcion}`);
    else if (!f.escena || !ESCENAS.includes(f.escena)) err.push(`${p.funcion} no tiene escena en este formato`);
    else if (!f.mencionar) err.push(`${p.funcion} está marcada para no mencionar`);
    if (seen.has(p.funcion)) err.push(`${p.funcion} repetida`);
    seen.add(p.funcion);
    if (!p.texto?.trim()) err.push(`punto ${p.funcion} sin texto`);
  }
  if (!spec.cierre) err.push('falta cierre');
  if (!err.length) err.push(...revisarPlan(spec, funciones));
  return err;
}

/** The text the voice reads, as segments: intro, each point, the optional all-in-one line, the close. */
export function segmentos(spec) {
  return [spec.intro, ...spec.puntos.map((p) => p.texto), ...(spec.cierre_todo ? [spec.cierre_todo] : []), spec.cierre].map((s) => s.trim());
}

/** Each anchor: the first word in the scene (after the previous anchor) that starts like one of its words; else a share of the scene. */
export function anchors(defs, words, t0, t1) {
  const ev = {}, found = {};
  let from = words.findIndex((w) => w.s >= t0 - 0.02);
  if (from < 0) from = words.length;
  for (const [name, def] of Object.entries(defs ?? {})) {
    const keys = def.palabras.map(norm);
    let hit = -1;
    for (let j = from; j < words.length && words[j].s < t1; j++) {
      const w = norm(words[j].w);
      if (w && keys.some((k) => w === k || (k.length >= 4 && w.startsWith(k)))) { hit = j; break; }
    }
    if (hit >= 0) { ev[name] = words[hit].s; found[name] = hit; from = hit + 1; }
    else ev[name] = t0 + (t1 - t0) * def.respaldo;
  }
  return { ev, found };
}

export function construirEpisodio({ spec, words, starts, vozDur, funciones, seed, mouth, v0 = 0.15, tail = 1.7 }) {
  const byId = Object.fromEntries(funciones.funciones.map((f) => [f.id, f]));
  const fixed = funciones.escenas_fijas;
  const plan = [
    { kind: 'intro', defs: fixed.intro.anclas },
    ...spec.puntos.map((p, k) => (!p.funcion || p.funcion === 'otra'
      ? { kind: 'todo', defs: fixed.todo.anclas }
      : { kind: 'feature', feature: byId[p.funcion].escena, n: k + 1, fav: !!p.favorita, defs: byId[p.funcion].anclas })),
    ...(spec.cierre_todo ? [{ kind: 'todo', defs: fixed.todo.anclas }] : []),
    { kind: 'fin', defs: fixed.fin.anclas },
  ];
  if (plan.length !== starts.length) throw new Error(`hay ${plan.length} escenas y ${starts.length} segmentos de voz`);
  const scenes = [], spoken = [];
  plan.forEach((p, i) => {
    const t = i === 0 ? 0 : Math.max(0, starts[i] - 0.05);
    const t1 = i + 1 < starts.length ? starts[i + 1] - 0.05 : vozDur;
    const { ev, found } = anchors(p.defs, words, t, t1);
    const sc = { kind: p.kind, t: +t.toFixed(3), ev: Object.fromEntries(Object.entries(ev).map(([k, v]) => [k, +v.toFixed(3)])) };
    if (p.feature) Object.assign(sc, { feature: p.feature, n: p.n, fav: p.fav });
    scenes.push(sc);
    const st = STICKERS[p.feature];
    if (st && found[st.ancla] !== undefined) {
      const j = found[st.ancla];
      const clean = (w) => w.replace(/[.,;:!?¿¡…"]/g, '').toLowerCase();
      const prev = j > 0 && SHORT.has(clean(words[j - 1].w)) ? `${clean(words[j - 1].w)} ` : '';
      spoken.push({ t: ev[st.ancla], text: prev + clean(words[j].w), x: st.x, y: st.y });
    }
  });
  return {
    fps: 30, v0, total: +(vozDur + v0 + tail).toFixed(3), words, mouth, scenes,
    N: spec.puntos.length,
    hook: { title: spec.gancho.titulo, sub: spec.gancho.sub ?? '', tag: spec.gancho.etiqueta || null },
    spoken, endLine: spec.frase_final || 'aquí todos somos patos', seed,
    plan: planEpisodio(spec, funciones),
    musica: musicaDe(spec),
  };
}
