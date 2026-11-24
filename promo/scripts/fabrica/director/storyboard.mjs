// The director's storyboard: what each scene of an episode shows, written by the director
// (fabrica/formatos/lista-scrapbook/DIRECTOR.md) against the numbered words of the voice.
// This file checks it and turns it into the Episode the template renders (Libre.tsx for
// the free scenes; the scrapbook's own components for the prefabricated ones).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { FAB } from '../comun.mjs';
import { ESCENAS, anchors } from '../linea.mjs';
import { PERILLAS, musicaDe } from '../plan.mjs';

const require = createRequire(import.meta.url);
let ICONOS = null;
/** Every icon name lucide-react knows (loaded once). */
export function iconosValidos() {
  if (!ICONOS) ICONOS = new Set(Object.keys(require('lucide-react').icons));
  return ICONOS;
}

export function cargarCatalogo() {
  const c = JSON.parse(fs.readFileSync(path.join(FAB, 'catalogo', 'catalogo.json'), 'utf8'));
  // the images made with AI and approved in Telegram (imagenes.mjs)
  const gen = path.join(FAB, 'catalogo', 'generados.json');
  if (fs.existsSync(gen)) c.recursos = [...c.recursos, ...JSON.parse(fs.readFileSync(gen, 'utf8')).recursos];
  const porRuta = new Map(), porId = new Map();
  for (const r of c.recursos) { porRuta.set(r.ruta, r); if (!porId.has(r.id)) porId.set(r.id, r); }
  return { ...c, buscar: (x) => porRuta.get(x) ?? porId.get(x) ?? null };
}

export const TIPOS = ['titulo', 'texto', 'nota', 'bocadillo', 'imagen', 'clip', 'sticker', 'pato', 'icono', 'garabato', 'contador'];
export const ENTRADAS = ['pop', 'golpe', 'mano-izq', 'mano-der', 'mano-abajo', 'deslizar', 'escribir', 'aparecer'];
export const PREFABS = ['intro', 'fin', 'todo', ...ESCENAS];
export const FORMAS = ['flecha', 'circulo', 'subrayado', 'corazon', 'estrella', 'explosion', 'rayas', 'pregunta', 'exclamacion'];
export const MARCOS = ['polaroid', 'cinta', 'celular', 'recorte', 'ninguno'];
export const MOVIMIENTOS = ['quieta', 'acercar', 'alejar', 'paneo-izq', 'paneo-der', 'subir', 'bajar'];
const COLORES = ['ink', 'paper', 'cream', 'kraft', 'orange', 'hot', 'cobalt', 'lime', 'pink', 'red', 'green', 'night', 'white'];
const HOJAS = ['paper', 'cream', 'kraft', 'orange', 'hot', 'cobalt', 'lime', 'pink', 'red', 'green', 'night'];
const NOTAS = ['amarillo', 'rosado', 'verde', 'crema', 'naranja'];
const LARGO = { titulo: 30, texto: 90, nota: 45, bocadillo: 100 };
/** Bottom of the band where the captions go: nothing may reach below this line. */
const SUBTITULOS = 1590;

/** Rough height of a piece, when it can be known from its size (for the captions check). */
function altoAprox(e, rec) {
  const ratio = rec?.w && rec?.h ? rec.h / rec.w : 1;
  switch (e.tipo) {
    case 'imagen': case 'clip': {
      if (e.marco === 'celular') return (e.w ?? 340) * 2.05;
      const w = e.w ?? 520;
      return (e.h ?? w * ratio) + 36 + (e.pie ? 60 : 0);
    }
    case 'sticker': return (e.w ?? 260) * ratio;
    case 'pato': return (e.w ?? 300) * ((e.cabeza ? 0.9 : 0) + (e.cuerpo ? 1.07 : 0));
    case 'icono': return (e.w ?? 200) * (e.fondo === 'circulo' ? 1.45 : 1);
    case 'nota': return (e.w ?? 380) * 0.8 + 40;
    case 'garabato': return e.h ?? (e.w ?? 260) * 0.6;
    default: return 0;
  }
}

/** Problems with a storyboard, given the voice's words (with their times). */
export function revisarStoryboard(sb, words, catalogo = cargarCatalogo()) {
  const err = [];
  const nWords = words.length;
  const at_ = (w) => words[Math.min(Math.max(0, w | 0), nWords - 1)];
  const esc = sb?.escenas;
  if (!Array.isArray(esc) || esc.length < 2) return ['storyboard.escenas tiene que ser una lista de al menos 2 escenas'];
  if (esc.length > 24) err.push(`hay ${esc.length} escenas: máximo 24`);
  if (esc[0].desde !== 0) err.push('la primera escena tiene que empezar en la palabra 0');
  if (esc[esc.length - 1].prefab !== 'fin') err.push('la última escena tiene que ser "prefab": "fin" (el cierre con las tiendas)');
  // the prefabricated scenes look the same in every video: one at most, besides the close
  const prefabs = esc.slice(0, -1).filter((s) => s.prefab).map((s) => s.prefab);
  if (prefabs.length > 1) err.push(`usaste ${prefabs.length} prefabs (${prefabs.join(', ')}): máximo uno por video además de "fin". Compón esas escenas tú, con las capturas y clips de esa función`);
  const iconos = iconosValidos();
  esc.forEach((s, i) => {
    const at = `escenas[${i}]`;
    const next = i + 1 < esc.length ? esc[i + 1].desde : nWords;
    if (!Number.isInteger(s.desde) || s.desde < 0 || s.desde >= nWords) err.push(`${at}.desde tiene que ser un número de palabra entre 0 y ${nWords - 1}`);
    if (i > 0 && !(s.desde > esc[i - 1].desde)) err.push(`${at}.desde (${s.desde}) tiene que ser mayor que el de la escena anterior (${esc[i - 1].desde})`);
    if (s.prefab != null && !PREFABS.includes(s.prefab)) err.push(`${at}.prefab «${s.prefab}» no existe (usa: ${PREFABS.join(', ')})`);
    const h = s.hoja ?? {};
    if (h.color != null && !HOJAS.includes(h.color)) err.push(`${at}.hoja.color «${h.color}» no existe (usa: ${HOJAS.join(', ')})`);
    if (h.entrada != null && !PERILLAS.entradas.includes(h.entrada)) err.push(`${at}.hoja.entrada «${h.entrada}» no existe (usa: ${PERILLAS.entradas.join(', ')})`);
    if (h.direccion != null && !PERILLAS.direcciones.includes(h.direccion)) err.push(`${at}.hoja.direccion «${h.direccion}» no existe`);
    if (s.prefab) return;
    const within = (w, name) => {
      if (!Number.isInteger(w) || w < s.desde || w >= next) err.push(`${at}.${name} (${w}) tiene que ser una palabra de esta escena: de ${s.desde} a ${next - 1}`);
    };
    if (s.camara) {
      if (s.camara.mover != null && !MOVIMIENTOS.includes(s.camara.mover)) err.push(`${at}.camara.mover «${s.camara.mover}» no existe (usa: ${MOVIMIENTOS.join(', ')})`);
      if (s.camara.golpe != null) within(s.camara.golpe, 'camara.golpe');
    }
    if (s.presentador) {
      const p = s.presentador;
      within(p.en, 'presentador.en');
      if (p.sale != null && !(p.sale > p.en)) err.push(`${at}.presentador.sale tiene que ser después de en`);
      if (!(p.w >= 200 && p.w <= 900)) err.push(`${at}.presentador.w va de 200 a 900`);
      if (p.y + p.w * 1.6 < 400 || p.y > 1700) err.push(`${at}.presentador queda fuera de cuadro (y es el borde de arriba de su cabeza)`);
    }
    const els = s.elementos ?? [];
    if (!Array.isArray(els) || !els.length) err.push(`${at} no tiene elementos (o usa un prefab)`);
    else if (els.length + (s.presentador ? 1 : 0) < 2) err.push(`${at} tiene una sola pieza: pon una protagonista y al menos una de apoyo`);
    // a sheet must not sit empty while the voice already talks
    const first = Math.min(...els.map((e) => (Number.isInteger(e.en) ? e.en : 1e9)), s.presentador ? s.presentador.en : 1e9);
    if (els.length && first > s.desde + 3) err.push(`${at} arranca vacía: la primera pieza entra en la palabra ${first} y la escena empieza en ${s.desde}; que la protagonista entre en las primeras 3 palabras`);
    if (els.length > 9) err.push(`${at} tiene ${els.length} elementos: máximo 9, que se lea`);
    els.forEach((e, k) => {
      const ae = `${at}.elementos[${k}] (${e.tipo})`;
      if (!TIPOS.includes(e.tipo)) { err.push(`${ae}: tipo desconocido (usa: ${TIPOS.join(', ')})`); return; }
      within(e.en, `elementos[${k}].en`);
      if (e.sale != null && !(Number.isInteger(e.sale) && e.sale > e.en && e.sale < nWords)) err.push(`${ae}.sale tiene que ser una palabra después de en`);
      if (e.entrada != null && !ENTRADAS.includes(e.entrada)) err.push(`${ae}.entrada «${e.entrada}» no existe (usa: ${ENTRADAS.join(', ')})`);
      if (e.color != null && !COLORES.includes(e.color) && !(e.tipo === 'nota' && NOTAS.includes(e.color))) err.push(`${ae}.color «${e.color}» no existe`);
      if (!(e.x >= 0 && e.x <= 1080 && e.y >= 0 && e.y <= 1920)) err.push(`${ae}: x va de 0 a 1080 y y de 0 a 1920 (es el centro de la pieza)`);
      if (LARGO[e.tipo] && !(e.texto ?? '').trim()) err.push(`${ae} sin texto`);
      if (LARGO[e.tipo] && [...(e.texto ?? '')].length > LARGO[e.tipo]) err.push(`${ae}: texto de más de ${LARGO[e.tipo]} caracteres`);
      let rec = null;
      if (['imagen', 'clip', 'sticker'].includes(e.tipo)) {
        rec = e.recurso ? catalogo.buscar(e.recurso) : null;
        if (!rec) err.push(`${ae}: recurso «${e.recurso}» no está en el catálogo`);
        else if (e.tipo === 'clip' && rec.tipo !== 'clip') err.push(`${ae}: «${e.recurso}» no es un clip`);
        else if (e.tipo !== 'clip' && rec.tipo === 'clip') err.push(`${ae}: «${e.recurso}» es un clip: usa tipo clip`);
        else if (e.tipo === 'sticker' && rec.tipo === 'imagen') err.push(`${ae}: «${e.recurso}» es una imagen rectangular: usa tipo imagen`);
        if (e.marco != null && !MARCOS.includes(e.marco)) err.push(`${ae}.marco «${e.marco}» no existe (usa: ${MARCOS.join(', ')})`);
        if (rec?.tipo === 'clip' && Number.isInteger(e.en)) {
          // the stretch of the clip that will be on screen
          const until = e.sale != null ? at_(e.sale).s : (next < nWords ? at_(next).s : at_(nWords - 1).e + 1.5);
          const a0 = e.desde ?? 0, a1 = a0 + Math.max(0, until - at_(e.en).s) * (e.velocidad ?? 1);
          for (const [a, b] of rec.prohibido ?? []) if (a0 < b && a1 > a) err.push(`${ae}: mostraría de ${a0.toFixed(1)} a ${a1.toFixed(1)} s del clip y el tramo ${a}–${b} s está prohibido (${rec.evitar ?? ''}); cambia desde, sale o velocidad`);
          if (a1 > (rec.segundos ?? 999) + 0.3) err.push(`${ae}: el clip dura ${rec.segundos} s y se mostraría hasta el segundo ${a1.toFixed(1)}: que salga antes (sale) o empiece antes (desde)`);
        }
      }
      if (e.tipo === 'pato') {
        if (!e.cabeza && !e.cuerpo) err.push(`${ae}: pon cabeza (h000–h161) y/o cuerpo (b000–b149)`);
        if (e.cabeza && !catalogo.buscar(e.cabeza)) err.push(`${ae}: la cabeza «${e.cabeza}» no existe`);
        if (e.cuerpo && !catalogo.buscar(e.cuerpo)) err.push(`${ae}: el cuerpo «${e.cuerpo}» no existe`);
      }
      if (e.tipo === 'icono' && !iconos.has(e.nombre)) err.push(`${ae}: el ícono «${e.nombre}» no existe en lucide-react`);
      if (e.tipo === 'garabato' && !FORMAS.includes(e.forma)) err.push(`${ae}.forma «${e.forma}» no existe (usa: ${FORMAS.join(', ')})`);
      if (e.tipo === 'contador' && !Number.isInteger(e.n)) err.push(`${ae}: el contador necesita n`);
      const alto = altoAprox(e, rec);
      if (e.y > 1560 || (alto && e.y + alto / 2 > SUBTITULOS)) err.push(`${ae}: llega hasta y≈${Math.round(e.y + alto / 2)} y tapa los subtítulos (nada puede bajar de y=${SUBTITULOS})`);
    });
  });
  return err;
}

const secs = (words, w) => +words[Math.min(Math.max(0, w), words.length - 1)].s.toFixed(3);

/** The Episode the template renders, from the script, the voice timings and the storyboard. */
export function episodioLibre({ spec, words, vozDur, funciones, seed, mouth, storyboard, catalogo = cargarCatalogo(), v0 = 0.15, tail = 1.7 }) {
  const fixed = funciones.escenas_fijas;
  const byScene = Object.fromEntries(funciones.funciones.filter((f) => f.escena).map((f) => [f.escena, f]));
  const esc = storyboard.escenas;
  const scenes = [], libre = [], looks = [];
  esc.forEach((s, i) => {
    const t = i === 0 ? 0 : Math.max(0, words[s.desde].s - 0.05);
    const t1 = i + 1 < esc.length ? words[esc[i + 1].desde].s - 0.05 : vozDur;
    let sc;
    if (s.prefab) {
      const kind = ['intro', 'todo', 'fin'].includes(s.prefab) ? s.prefab : 'feature';
      const defs = kind === 'feature' ? byScene[s.prefab]?.anclas : fixed[s.prefab]?.anclas;
      const { ev } = anchors(defs ?? {}, words, t, t1);
      sc = { kind, t: +t.toFixed(3), ev: Object.fromEntries(Object.entries(ev).map(([k, v]) => [k, +v.toFixed(3)])) };
      if (kind === 'feature') sc.feature = s.prefab;
      libre.push({ prefab: s.prefab, elementos: [] });
    } else {
      sc = { kind: 'libre', t: +t.toFixed(3), ev: {} };
      const elementos = (s.elementos ?? []).map((e) => {
        const out = { ...e, en: secs(words, e.en), sale: e.sale != null ? secs(words, e.sale) : null };
        delete out.recurso;
        if (e.recurso) {
          const rec = catalogo.buscar(e.recurso);
          if (rec) Object.assign(out, { src: rec.ruta, w0: rec.w, h0: rec.h });
        }
        return out;
      });
      const p = s.presentador ? { ...s.presentador, en: secs(words, s.presentador.en), sale: s.presentador.sale != null ? secs(words, s.presentador.sale) : null } : null;
      const camara = s.camara ? { ...s.camara, golpe: s.camara.golpe != null ? secs(words, s.camara.golpe) : null } : null;
      libre.push({ prefab: null, camara, presentador: p, elementos });
    }
    scenes.push(sc);
    const def = PERILLAS.escenas[s.prefab ?? ''] ?? null;
    looks.push({
      entrada: s.hoja?.entrada ?? 'deslizar',
      direccion: s.hoja?.direccion ?? ['derecha', 'arriba', 'izquierda', 'abajo'][i % 4],
      hoja: s.hoja?.color ?? def?.hoja ?? 'paper',
      cuadricula: s.hoja?.cuadricula ?? def?.cuadricula ?? false,
      titulo: 'recortes', impacto: 'ninguno', mano: s.mano ?? true, nota: null, rotulo: null,
    });
  });
  const e = spec.plan?.estilo ?? {};
  return {
    fps: 30, v0, total: +(vozDur + v0 + tail).toFixed(3), words, mouth, scenes,
    N: 0,
    hook: { title: spec.gancho?.titulo ?? '', sub: spec.gancho?.sub ?? '', tag: spec.gancho?.etiqueta || null },
    spoken: [], endLine: spec.frase_final || 'aquí todos somos patos', seed,
    plan: {
      estilo: { subtitulos: e.subtitulos ?? 'papel', resaltado: e.resaltado ?? 'lime', contador: 'cinta', presentador: e.presentador ?? 'centro', estructura: 'historia' },
      escenas: looks,
    },
    libre,
    musica: musicaDe(spec),
  };
}

/** The voice's words numbered, one per line, with the script line each belongs to (for the director). */
export function palabrasNumeradas(words, segs, starts) {
  const lines = ['# n\tsegundo\tpalabra   (línea del guion entre corchetes cuando empieza)'];
  let seg = 0;
  words.forEach((w, n) => {
    let mark = '';
    while (seg < starts.length && w.s >= starts[seg] - 0.06) { mark = `   [línea ${seg + 1}: ${segs[seg].slice(0, 60)}${segs[seg].length > 60 ? '…' : ''}]`; seg += 1; }
    lines.push(`${n}\t${w.s.toFixed(2)}\t${w.w}${mark}`);
  });
  return lines.join('\n') + '\n';
}
