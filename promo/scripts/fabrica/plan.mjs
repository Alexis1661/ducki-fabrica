// The edit plan of an episode: which knobs of the format it turns (src/fabrica/perillas.json).
// The writer returns it inside the script (spec.plan for the whole video and the intro /
// all-in-one / end sheets, spec.puntos[i].look for each point); this file checks it and
// fills what is missing with the format's own look, so a plan can be partial and an old
// script with no plan renders exactly as before.
import fs from 'node:fs';
import path from 'node:path';
import { PROMO } from './comun.mjs';

export const PERILLAS = JSON.parse(fs.readFileSync(path.join(PROMO, 'src', 'fabrica', 'perillas.json'), 'utf8'));
const K = PERILLAS;
const DIRS = ['derecha', 'arriba', 'izquierda', 'abajo'];

/** Scene ids in order (intro, each point's scene, the optional all-in-one, the end). */
export function escenasDe(spec, funciones) {
  const byId = Object.fromEntries(funciones.funciones.map((f) => [f.id, f]));
  return ['intro', ...spec.puntos.map((p) => byId[p.funcion]?.escena ?? p.funcion), ...(spec.cierre_todo ? ['todo'] : []), 'fin'];
}

function looksDe(spec) {
  const pl = spec.plan ?? {};
  return [pl.intro, ...spec.puntos.map((p) => p.look), ...(spec.cierre_todo ? [pl.todo] : []), pl.fin].map((l) => l ?? {});
}

/** Problems with the plan (empty when it is fine or absent). */
export function revisarPlan(spec, funciones) {
  const err = [];
  const e = spec.plan?.estilo ?? {};
  const one = (v, list, name) => { if (v != null && !list.includes(v)) err.push(`${name} «${v}» no existe (usa: ${list.join(', ')})`); };
  one(e.subtitulos, K.subtitulos, 'estilo.subtitulos');
  one(e.resaltado, K.resaltados, 'estilo.resaltado');
  one(e.contador, K.contadores, 'estilo.contador');
  one(e.presentador, K.presentador, 'estilo.presentador');
  const m = e.musica ?? {};
  if (m.bpm != null && (m.bpm < K.musica.bpm[0] || m.bpm > K.musica.bpm[1])) err.push(`musica.bpm fuera de ${K.musica.bpm.join('–')}`);
  if (m.tono != null && (m.tono < K.musica.tono[0] || m.tono > K.musica.tono[1])) err.push(`musica.tono fuera de ${K.musica.tono.join('…')}`);
  if (m.progresion != null && !(m.progresion >= 0 && m.progresion < K.musica.progresiones)) err.push(`musica.progresion va de 0 a ${K.musica.progresiones - 1}`);
  const ids = escenasDe(spec, funciones);
  looksDe(spec).forEach((l, i) => {
    const id = ids[i], def = K.escenas[id];
    if (!def) return;
    const where = i === 0 ? 'plan.intro' : id === 'fin' ? 'plan.fin' : id === 'todo' ? 'plan.todo' : `puntos[${i - 1}].look`;
    one(l.entrada, K.entradas, `${where}.entrada`);
    one(l.direccion, K.direcciones, `${where}.direccion`);
    one(l.titulo, K.titulos, `${where}.titulo`);
    one(l.impacto, K.impactos, `${where}.impacto`);
    if (l.hoja != null && !def.hojas.includes(l.hoja)) err.push(`${where}.hoja «${l.hoja}» no va en ${id} (usa: ${def.hojas.join(', ')})`);
    if (l.nota) {
      if (!def.nota) err.push(`${where}.nota: ${id} no tiene espacio para nota (déjala en null)`);
      else if ([...l.nota].length > K.nota_max) err.push(`${where}.nota tiene más de ${K.nota_max} caracteres`);
    }
  });
  return err;
}

/** The plan the template reads (Episode.plan): one look per scene, every knob set. */
export function planEpisodio(spec, funciones) {
  const e = spec.plan?.estilo ?? {};
  const ids = escenasDe(spec, funciones);
  const escenas = looksDe(spec).map((l, i) => {
    const def = K.escenas[ids[i]] ?? { hoja: 'paper', cuadricula: false, nota: null };
    return {
      entrada: l.entrada ?? 'deslizar',
      direccion: l.direccion ?? DIRS[i % 4],
      hoja: l.hoja ?? def.hoja,
      cuadricula: l.cuadricula ?? def.cuadricula,
      titulo: l.titulo ?? 'recortes',
      impacto: l.impacto ?? 'ninguno',
      mano: l.mano ?? true,
      nota: def.nota && l.nota ? { text: l.nota, x: def.nota[0], y: def.nota[1] } : null,
    };
  });
  return {
    estilo: {
      subtitulos: e.subtitulos ?? 'papel',
      resaltado: e.resaltado ?? 'lime',
      contador: e.contador ?? 'cinta',
      presentador: e.presentador ?? 'centro',
    },
    escenas,
  };
}

/** Music choices for audio.py (only the ones the plan sets). */
export function musicaDe(spec) {
  const m = spec.plan?.estilo?.musica ?? {};
  return Object.fromEntries(Object.entries({ bpm: m.bpm, tono: m.tono, progresion: m.progresion }).filter(([, v]) => v != null));
}
