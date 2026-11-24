// «Lista scrapbook» (fábrica de videos): the 9-cosas video turned into a template.
// Everything that video had baked in (the voice timing, the scenes, the number of
// points, the hook text) comes in as an Episode built by scripts/fabrica/episodio.mjs.
import React, { createContext, useContext } from 'react';
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import { HostDuck, FaceKey, Mouth } from '../todo/HostDuck';
import perillas from './perillas.json';
import { HAND_W, handPaths } from '../todo/hand';
import {
  ARROW, At, BURST, BoilDefs, Doodle, FONTS, HEART, Hand, P, Paper, Print, Ransom, SCRIBBLE_CIRCLE, SQUIGGLE, STAR, STEP,
  Sticker, Tape, Torn, easeOut, pop, rnd, stepIn, stepped, tornPath, wobble,
} from '../todo/paper';

export {
  ARROW, At, BURST, BoilDefs, Doodle, FONTS, HEART, Hand, P, Paper, Print, Ransom, SCRIBBLE_CIRCLE, SQUIGGLE, STAR, STEP,
  Sticker, Tape, Torn, easeOut, pop, rnd, stepIn, stepped, tornPath, wobble, HostDuck, HAND_W, handPaths, AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame,
};
export type { FaceKey };

export type Word = { w: string; s: number; e: number };
export type EpScene = {
  kind: 'intro' | 'feature' | 'todo' | 'fin';
  feature?: string;
  /** Voice seconds where the scene starts. */
  t: number;
  /** Its number in the list (feature scenes). */
  n?: number;
  /** Voice seconds of each anchor the scene animates on. */
  ev: Record<string, number>;
  /** Point marked as the favourite (gets the «mi favorita» tag). */
  fav?: boolean;
};
export type Episode = {
  fps: number;
  /** Seconds of silence before the voice starts. */
  v0: number;
  /** Length of the video, in seconds. */
  total: number;
  words: Word[];
  mouth: Mouth;
  scenes: EpScene[];
  /** How many points the list has (the «/N» of the counter). */
  N: number;
  hook: { title: string; sub: string; tag?: string | null };
  /** Spoken keywords written on screen, in voice seconds. */
  spoken: { t: number; text: string; x: number; y: number }[];
  endLine: string;
  /** Picks the pieces, the stickers and the letters, so each episode looks different. */
  seed: number;
  /** The edit plan (scripts/fabrica/plan.mjs): the knobs of perillas.json this episode turns. Absent = the format's own look. */
  plan?: Plan;
};

// ------------------------------------------------------------------ the edit plan
export type Look = {
  entrada: 'deslizar' | 'caer' | 'zoom' | 'voltear' | 'rasgar';
  direccion: 'derecha' | 'izquierda' | 'arriba' | 'abajo';
  hoja: keyof typeof P;
  cuadricula: boolean;
  titulo: 'recortes' | 'marcador' | 'sello' | 'etiqueta';
  impacto: 'ninguno' | 'sacudida' | 'zoom';
  mano: boolean;
  nota: { text: string; x: number; y: number } | null;
  /** The sheet's title instead of the function's name (historia, pov, pregunta). */
  rotulo?: string | null;
};
export type Estilo = {
  subtitulos: 'papel' | 'cinta' | 'marcador' | 'maquina';
  resaltado: 'lime' | 'pink' | 'orange';
  contador: 'cinta' | 'sello' | 'postit';
  presentador: 'centro' | 'izquierda' | 'derecha';
  /** lista: numbered points with the counter; historia / pov / pregunta: no numbers, each sheet titled by its moment. */
  estructura?: 'lista' | 'historia' | 'pov' | 'pregunta';
};
export type Plan = { estilo: Estilo; escenas: Look[] };
export const ESTILO_BASE: Estilo = { subtitulos: 'papel', resaltado: 'lime', contador: 'cinta', presentador: 'centro' };
export const useEstilo = (): Estilo => useEp().ep.plan?.estilo ?? ESTILO_BASE;
/** Scene i's look, or null when the episode has no plan (each scene then keeps its own). */
export const useLookAt = (i: number): Look | null => useEp().ep.plan?.escenas[i] ?? null;
/** Whether the episode is a numbered list (the counter and the flying numbers only show then). */
export const useIsList = () => (useEp().ep.plan?.estilo.estructura ?? 'lista') === 'lista';
export const isDark = (hoja: string) => (perillas.oscuras as string[]).includes(hoja);

export const FPS = 30;
export const ENTER = 6; // frames a new sheet takes to slide in

type Ctx = {
  ep: Episode;
  T: (sec: number) => number;
  SC: (EpScene & { from: number; to: number })[];
  chunks: Word[][];
};
const EpCtx = createContext<Ctx | null>(null);
export const useEp = () => useContext(EpCtx)!;

export function makeCtx(ep: Episode): Ctx {
  const T = (sec: number) => Math.round((sec + ep.v0) * FPS);
  const total = Math.round(ep.total * FPS);
  const SC = ep.scenes.map((s, i) => ({ ...s, from: T(s.t), to: i + 1 < ep.scenes.length ? T(ep.scenes[i + 1].t) : total }));
  const chunks: Word[][] = [];
  let cur: Word[] = [];
  for (const w of ep.words) {
    const gap = cur.length ? w.s - cur[cur.length - 1].e : 0;
    if (cur.length && (cur.length >= 4 || gap > 0.32)) { chunks.push(cur); cur = []; }
    cur.push(w);
    if (/[.,?!…:]$/.test(w.w)) { chunks.push(cur); cur = []; }
  }
  if (cur.length) chunks.push(cur);
  return { ep, T, SC, chunks };
}
export const EpProvider: React.FC<{ ctx: Ctx; children: React.ReactNode }> = ({ ctx, children }) => <EpCtx.Provider value={ctx}>{children}</EpCtx.Provider>;

/** Inside scene `i`'s Sequence: the local frame of an anchor (by name) or of N seconds after the scene starts. */
export function useL(i: number) {
  const { SC, T } = useEp();
  const s = SC[i];
  const seqFrom = s.from - (i === 0 ? 0 : ENTER);
  return (k: string | number) => (typeof k === 'number' ? T(s.t + k) : T(s.ev[k] ?? s.t)) - seqFrom;
}
export const useScene = (i: number) => useEp().SC[i];

/** Seeded picks, so the same episode always renders the same and two episodes differ. */
export function pick<T>(list: readonly T[], n: number, seed: number): T[] {
  const a = [...list];
  for (let k = a.length - 1; k > 0; k--) {
    const j = Math.floor(rnd(seed * 13.7 + k * 3.1) * (k + 1));
    [a[k], a[j]] = [a[j], a[k]];
  }
  return a.slice(0, n);
}

// ------------------------------------------------------------------ the host
// Only on screen for the hook and the end: drops off the bottom as point 1
// slides in, and pops back up for the close.
const HOST = { w: 760, x: 540, y: 560 };
export function hostPlace(frame: number, SC: Ctx['SC']) {
  const first = SC.findIndex((s) => s.kind !== 'intro');
  const fin = SC.findIndex((s) => s.kind === 'fin');
  const out = (SC[first]?.from ?? 1e9) - 4, back = (SC[fin]?.from ?? 1e9) - 2;
  let dy = 0;
  if (frame >= out && frame < back) dy = 1500 * Math.pow(stepIn(frame, out, 8), 2);
  if (frame >= back) dy = [1500, 700, -60, 20][Math.floor((frame - back) / STEP)] ?? 0;
  return { ...HOST, y: HOST.y + dy, visible: dy < 1450 };
}
/** Talks to camera; winks on the brand, glances at the tag, winks again at the end. */
export function hostFace(SC: Ctx['SC']): FaceKey[] {
  const intro = SC.find((s) => s.kind === 'intro');
  const fin = SC.find((s) => s.kind === 'fin');
  const keys: FaceKey[] = [[0, { pupilS: 1.05 }]];
  if (intro?.ev.ducki !== undefined) keys.push([intro.ev.ducki - 0.04, { lidL: 1, lower: 0.25 }], [intro.ev.ducki + 0.36, { lidL: 0, lower: 0 }]);
  if (intro?.ev.fav !== undefined) keys.push([intro.ev.fav - 0.45, { lookX: 0.5, lookY: -0.2, tilt: 0.25, lidL: 0.22, lidR: 0.22 }], [intro.ev.fav + 0.9, { lookX: 0, lookY: 0, tilt: 0, lidL: 0, lidR: 0, lower: 0.3 }]);
  if (fin) {
    keys.push([fin.t, { lower: 0, lookX: 0, lookY: 0, pupilS: 1.08 }]);
    if (fin.ev.aqui !== undefined) keys.push([fin.ev.aqui, { lidL: 1, lower: 0.4 }], [fin.ev.aqui + 0.7, { lidL: 0 }], [fin.ev.aqui + 1.3, { lower: 0.55 }]);
  }
  return keys.sort((a, b) => a[0] - b[0]);
}
const TILTS = [0, 2.2, -1.8, 1.4, -2.4, 1.8, -1.2];
const easeIO = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
/** Head tilts per phrase and nods on each phrase start and each number. */
export function makePose(chunks: Word[][], SC: Ctx['SC']) {
  const nods = [...chunks.map((c) => c[0].s), ...SC.filter((s) => s.n).map((s) => s.t)];
  return (t: number) => {
    let k = -1;
    for (let i = 0; i < chunks.length; i++) if (chunks[i][0].s <= t) k = i;
    const tgt = (i: number) => (i < 0 ? 0 : TILTS[i % TILTS.length]);
    const tilt = k < 0 ? 0 : tgt(k - 1) + (tgt(k) - tgt(k - 1)) * easeIO(Math.min(1, (t - chunks[k][0].s) / 0.25));
    let nod = 0;
    for (const s0 of nods) { const x = (t - s0 + 0.03) / 0.3; if (x > 0 && x < 1) nod = Math.max(nod, Math.sin(Math.PI * x) * 7); }
    return { tilt, nod };
  };
}

// ------------------------------------------------------------------ captions
export const Captions: React.FC<{ big: boolean }> = ({ big }) => {
  const frame = useCurrentFrame();
  const { ep, T, chunks } = useEp();
  const estilo = useEstilo();
  const hi = P[estilo.resaltado];
  const t = stepped(frame) / FPS - ep.v0;
  const i = chunks.findIndex((c, k) => t >= c[0].s - 0.05 && t < (chunks[k + 1] ? chunks[k + 1][0].s - 0.05 : c[c.length - 1].e + 0.6));
  if (i < 0) return null;
  const c = chunks[i];
  const sc = pop(frame, T(c[0].s - 0.05));
  const w = wobble(i + 1, frame, 1.5, 6);
  const place: React.CSSProperties = { position: 'absolute', left: 540, top: big ? 1640 : 1715, transform: `translate(-50%, -50%) rotate(${(rnd(i) - 0.5) * 5 + w.r}deg) scale(${sc})`, width: 'max-content', maxWidth: 920 };
  if (estilo.subtitulos === 'cinta') {
    return (
      <div style={place}>
        <div style={{ background: 'rgba(255,244,196,.93)', padding: '14px 34px', clipPath: tornPath(i * 5 + 2, 10, { t: false, r: true, b: false, l: true }), boxShadow: '0 6px 0 rgba(0,0,0,.18)' }}>
          <div style={{ fontFamily: FONTS.archivo, fontSize: 46, color: P.ink, lineHeight: 1.2, textAlign: 'center', textTransform: 'uppercase' }}>
            {c.map((x, k) => {
              const on = t >= x.s - 0.03, now = on && t < x.e + 0.08;
              return <span key={k} style={{ opacity: on ? 1 : 0.22, marginRight: 12, display: 'inline-block', borderBottom: now ? `9px solid ${hi}` : '9px solid transparent' }}>{x.w}</span>;
            })}
          </div>
        </div>
      </div>
    );
  }
  if (estilo.subtitulos === 'marcador') {
    return (
      <div style={place}>
        <div style={{ fontFamily: FONTS.marker, fontSize: 66, lineHeight: 1.15, textAlign: 'center' }}>
          {c.map((x, k) => {
            const on = t >= x.s - 0.03, now = on && t < x.e + 0.08;
            return (
              <span key={k} style={{ opacity: on ? 1 : 0.3, color: now ? hi : P.white, WebkitTextStroke: `12px ${P.ink}`, paintOrder: 'stroke fill', marginRight: 14, display: 'inline-block', transform: now ? 'scale(1.12) rotate(-3deg)' : undefined }}>{x.w}</span>
            );
          })}
        </div>
      </div>
    );
  }
  if (estilo.subtitulos === 'maquina') {
    return (
      <div style={place}>
        <Torn color={P.kraft} seed={i * 3 + 2} pad="16px 30px">
          <div style={{ fontFamily: FONTS.elite, fontSize: 50, color: P.ink, lineHeight: 1.15, textAlign: 'center' }}>
            {c.map((x, k) => {
              const on = t >= x.s - 0.03, now = on && t < x.e + 0.08;
              return <span key={k} style={{ visibility: on ? 'visible' : 'hidden', marginRight: 10, display: 'inline-block', textDecoration: now ? `underline ${hi} 6px` : undefined, textUnderlineOffset: 8 }}>{x.w}</span>;
            })}
          </div>
        </Torn>
      </div>
    );
  }
  return (
    <div style={{ position: 'absolute', left: 540, top: big ? 1640 : 1715, transform: `translate(-50%, -50%) rotate(${(rnd(i) - 0.5) * 5 + w.r}deg) scale(${sc})`, width: 'max-content', maxWidth: 920 }}>
      <Torn color={P.cream} seed={i * 3 + 1} pad="16px 30px">
        <div style={{ fontFamily: FONTS.elite, fontSize: 52, color: P.ink, lineHeight: 1.15, textAlign: 'center' }}>
          {c.map((x, k) => {
            const on = t >= x.s - 0.03;
            const now = on && t < x.e + 0.08;
            return (
              <span key={k} style={{ opacity: on ? 1 : 0.18, background: now ? hi : 'transparent', padding: '0 4px', marginRight: 6, display: 'inline-block', transform: now ? 'rotate(-2deg)' : undefined }}>{x.w}</span>
            );
          })}
        </div>
      </Torn>
    </div>
  );
};

// ------------------------------------------------------------------ numbers into the counter, keywords on the sheet
const NUMS = ['UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ'];
export const FLY = 12;
export const Spoken: React.FC = () => {
  const frame = useCurrentFrame();
  const { ep, T, SC } = useEp();
  const hi = P[useEstilo().resaltado];
  const isList = useIsList();
  const f = stepped(frame);
  const items = [
    ...SC.filter((s) => s.n && isList).map((s) => ({ t: s.t, text: NUMS[(s.n as number) - 1] ?? String(s.n), num: true, x: 0, y: 0 })),
    ...ep.spoken.map((s) => ({ ...s, num: false })),
  ];
  return (
    <>
      {items.map((w, i) => {
        const start = T(w.t);
        const life = w.num ? FLY : 36;
        if (f < start || f >= start + life + 4) return null;
        const out = f >= start + life ? [0.7, 0.3][Math.floor((f - start - life) / STEP)] ?? 0 : 1;
        if (w.num) {
          const k = easeOut(stepIn(frame, start, FLY));
          const x = 540 + (150 - 540) * k, y = 1980 + (170 - 1980) * k;
          return (
            <At key={i} x={x} y={y} rot={(rnd(i + 400 + ep.seed) - 0.5) * 14} seed={400 + i} scale={(0.6 + 0.4 * k) * out}>
              <Ransom text={w.text} size={96} seed={410 + i + ep.seed} start={start} palette={[P.ink, P.lime, P.cream, P.white, P.orange]} />
            </At>
          );
        }
        return (
          <At key={i} x={w.x} y={w.y} rot={(rnd(i + 400 + ep.seed) - 0.5) * 14} seed={400 + i} scale={pop(frame, start) * out}>
            <Torn color={hi} seed={420 + i} pad="10px 26px"><div style={{ fontFamily: FONTS.marker, fontSize: 70, color: P.ink, whiteSpace: 'nowrap' }}>{w.text}</div></Torn>
          </At>
        );
      })}
    </>
  );
};

export const Counter: React.FC = () => {
  const frame = useCurrentFrame();
  const { ep, SC } = useEp();
  const estilo = useEstilo();
  const isList = useIsList();
  const s = [...SC].reverse().find((x) => frame >= x.from);
  if (!s || !s.n || !isList) return null;
  if (frame < s.from + FLY) return null;
  if (estilo.contador === 'sello') {
    return (
      <At x={160} y={175} rot={-12} seed={s.n * 11} wob={1.2}>
        <div style={{ transform: `scale(${pop(frame, s.from + FLY)})`, width: 230, height: 230, borderRadius: 115, border: `11px solid ${P.red}`, background: 'rgba(255,248,234,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', filter: 'url(#edge)', boxShadow: '6px 9px 0 rgba(0,0,0,.2)' }}>
          <div style={{ fontFamily: FONTS.rubik, fontSize: 104, color: P.red, lineHeight: 1 }}>{s.n}</div>
          <div style={{ fontFamily: FONTS.rubik, fontSize: 36, color: P.red, alignSelf: 'flex-end', marginBottom: 52 }}>/{ep.N}</div>
        </div>
      </At>
    );
  }
  if (estilo.contador === 'postit') {
    return (
      <At x={160} y={180} rot={-6} seed={s.n * 11} wob={1.4}>
        <div style={{ transform: `scale(${pop(frame, s.from + FLY)})`, width: 230, height: 220, background: '#FFE46B', boxShadow: '8px 12px 0 rgba(0,0,0,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <div style={{ fontFamily: FONTS.marker, fontSize: 130, color: P.ink, lineHeight: 1 }}>{s.n}</div>
          <div style={{ fontFamily: FONTS.marker, fontSize: 50, color: P.ink, alignSelf: 'flex-end', marginBottom: 34 }}>/{ep.N}</div>
        </div>
        <div style={{ position: 'absolute', left: 50, top: -24, transform: 'rotate(4deg)' }}><Tape w={130} seed={s.n + 4} /></div>
      </At>
    );
  }
  return (
    <At x={150} y={170} rot={-8} seed={s.n * 11} wob={1.4}>
      <div style={{ transform: `scale(${pop(frame, s.from + FLY)})`, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
        <Torn color={P.ink} seed={s.n + ep.seed} pad="6px 22px">
          <div style={{ fontFamily: FONTS.abril, fontSize: 150, color: P.lime, lineHeight: 1 }}>{s.n}</div>
        </Torn>
        <div style={{ fontFamily: FONTS.marker, fontSize: 64, color: P.ink, filter: 'url(#boil)', marginBottom: 10, background: P.cream, padding: '0 10px', transform: 'rotate(6deg)' }}>/{ep.N}</div>
      </div>
      <div style={{ position: 'absolute', left: 30, top: -26, transform: 'rotate(-14deg)' }}><Tape w={130} seed={s.n + 4} /></div>
    </At>
  );
};

export const EndLine: React.FC = () => {
  const f = useCurrentFrame();
  const { ep, T, SC } = useEp();
  const fin = SC.find((s) => s.kind === 'fin');
  if (!fin || fin.ev.aqui === undefined) return null;
  const start = T(fin.ev.aqui);
  if (f < start) return null;
  return (
    <At x={540} y={1640} rot={-3} seed={210} scale={pop(f, start)}>
      <Torn color={P.ink} seed={211} pad="16px 36px"><div style={{ fontFamily: FONTS.marker, fontSize: 70, color: P.lime, whiteSpace: 'nowrap' }}>{ep.endLine}</div></Torn>
    </At>
  );
};
