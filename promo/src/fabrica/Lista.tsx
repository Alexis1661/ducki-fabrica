// «Lista scrapbook»: the scenes of «9 cosas que puedes hacer en Ducki» (src/todo/Todo.tsx),
// reading their timing from the Episode (scripts/fabrica/episodio.mjs) instead of
// the fixed marks of that one video. Shared pieces live in ./head.
import React, { createContext, useContext, useMemo } from 'react';
import { Sequence } from 'remotion';
import {
  ARROW, AbsoluteFill, At, BURST, BoilDefs, Captions, Counter, Doodle, ENTER, EndLine, EpProvider, Episode, FONTS, FPS, HAND_W, HEART, Hand,
  HostDuck, Img, OffthreadVideo, P, Paper, Print, Ransom, SCRIBBLE_CIRCLE, SQUIGGLE, STAR, STEP, Spoken, Sticker, Tape, Torn, easeOut,
  handPaths, hostFace, hostPlace, makeCtx, makePose, pick, pop, rnd, staticFile, stepIn, stepped, tornPath, useCurrentFrame, useEp, useL,
  useScene, wobble, Look, isDark, useLookAt,
} from './head';
import { Libre } from './Libre';

// ------------------------------------------------------------------ a sheet coming in
// How it comes in, its colour, its title style, its hit and its note come from the
// episode's plan (head.tsx Look; perillas.json); with no plan each scene keeps the
// colour it passes and sheets slide in from the four sides in turn.
const DIRS = ['right', 'top', 'left', 'bottom'] as const;
const DIR_OF = { derecha: 'right', arriba: 'top', izquierda: 'left', abajo: 'bottom' } as const;
/** The scene's look, for the pieces inside its sheet (null without a plan). */
export const LookCtx = createContext<Look | null>(null);
/** Which anchor of each scene is its big moment (where `impacto` hits and the note lands). */
const MOMENT: Record<string, string> = {
  intro: 'ducki', publica: 'anon', mapa: 'amigos', pato: 'cientos', arte: 'celular', parche: 'gente', carta: 'carta',
  crush: 'match', sala: 'duckisala', juegos: 'kart', todo: 'app', fin: 'gratis',
};
/** A torn vertical gap that opens from the middle: the new sheet shows through it. */
function ripReveal(t: number, seed: number) {
  const half = 540 * t + 4, n = 24, left: string[] = [], right: string[] = [];
  for (let k = 0; k <= n; k++) {
    const y = (k / n) * 1920;
    left.push(`${540 - half + (rnd(seed + k) - 0.5) * 46}px ${y}px`);
    right.unshift(`${540 + half + (rnd(seed + 50 + k) - 0.5) * 46}px ${y}px`);
  }
  return `polygon(${[...left, ...right].join(', ')})`;
}
export const Sheet: React.FC<{ i: number; color: string; grid?: boolean; children: React.ReactNode }> = ({ i, color, grid, children }) => {
  const f = useCurrentFrame();
  const look = useLookAt(i);
  const scene = useScene(i);
  const L = useL(i);
  const t = i === 0 ? 1 : easeOut(stepIn(f, 0, ENTER));
  const dir = look ? DIR_OF[look.direccion] : DIRS[i % 4];
  const entrada = i === 0 ? 'none' : look?.entrada ?? 'deslizar';
  const off = (1 - t) * 1150;
  let tr = '', clip: string | undefined, origin = '50% 50%';
  if (entrada === 'deslizar') {
    tr = dir === 'right' ? `translateX(${off}px)` : dir === 'left' ? `translateX(${-off}px)` : dir === 'top' ? `translateY(${-off}px)` : `translateY(${off}px)`;
    clip = t < 1 ? tornPath(i * 9 + 2, 22, { t: dir === 'bottom', r: dir === 'left', b: dir === 'top', l: dir === 'right' }) : undefined;
  } else if (entrada === 'caer') {
    tr = `translateY(${-(1 - t) * 1500}px) rotate(${(1 - t) * (dir === 'left' ? 10 : -10)}deg)`;
  } else if (entrada === 'zoom') {
    tr = `scale(${0.12 + 0.88 * t}) rotate(${(1 - t) * (dir === 'left' ? -28 : 28)}deg)`;
  } else if (entrada === 'voltear') {
    const vertical = dir === 'top' || dir === 'bottom';
    origin = dir === 'right' ? '100% 50%' : dir === 'left' ? '0% 50%' : dir === 'top' ? '50% 0%' : '50% 100%';
    tr = `perspective(2200px) ${vertical ? 'rotateX' : 'rotateY'}(${(1 - t) * (dir === 'right' || dir === 'top' ? 92 : -92)}deg)`;
  } else if (entrada === 'rasgar') {
    clip = t < 1 ? ripReveal(t, i * 7 + 3) : undefined;
  }
  const hoja = look ? P[look.hoja] : color;
  const cuadricula = look ? look.cuadricula : grid;
  // the scene's big moment: a shake or a punch-in when its anchor word is said
  const key = scene.kind === 'feature' ? scene.feature ?? '' : scene.kind;
  const moment = MOMENT[key] ? L(MOMENT[key]) : -1;
  let hit = '';
  if (look && moment >= 0 && f >= moment) {
    const k = Math.floor((f - moment) / STEP);
    if (look.impacto === 'sacudida') hit = `translate(${[16, -13, 9, -6, 3][k] ?? 0}px, ${[-6, 8, -5, 3, 0][k] ?? 0}px)`;
    if (look.impacto === 'zoom') hit = `scale(${[1.08, 1.05, 1.03, 1.015][k] ?? 1})`;
  }
  const dark = look ? isDark(look.hoja) : false;
  // the note lands after the big moment, but never so late it flashes by
  const sheetEnd = scene.to - scene.from + (i === 0 ? 0 : ENTER);
  const noteAt = Math.max(ENTER + 12, Math.min(moment >= 0 ? moment + 10 : ENTER + 14, sheetEnd - 40));
  return (
    <LookCtx.Provider value={look}>
      <AbsoluteFill style={{ transform: tr || undefined, transformOrigin: origin, filter: t < 1 ? 'drop-shadow(0 0 30px rgba(0,0,0,.35))' : undefined }}>
        <AbsoluteFill style={{ clipPath: clip }}>
          <Paper color={hoja} grid={cuadricula}>
            <AbsoluteFill style={{ transform: hit || undefined }}>
              {children}
              {look?.nota ? (
                <Pop start={noteAt} x={look.nota.x} y={look.nota.y} rot={(rnd(i + 91) - 0.5) * 10} seed={900 + i}>
                  <Hand size={52} color={dark ? P.lime : P.ink}>{look.nota.text}</Hand>
                  <div style={{ position: 'absolute', left: '10%', bottom: -16 }}>
                    <Doodle d={SQUIGGLE(260, 26)} w={260} h={26} color={dark ? P.cream : P.cobalt} stroke={5} start={noteAt + 4} dur={6} />
                  </div>
                </Pop>
              ) : null}
            </AbsoluteFill>
          </Paper>
        </AbsoluteFill>
      </AbsoluteFill>
    </LookCtx.Provider>
  );
};

// titles sit right of the counter; long ones wrap onto two lines. The plan picks the
// style: cut-out letters (the format's own), marker, rubber stamp or label-maker tape.
const Title: React.FC<{ text: string; seed: number; x?: number; y?: number; size?: number; start?: number; palette?: string[]; maxWidth?: number }> = ({ text: own, seed, x: ownX = 690, y = 175, size: ownSize = 96, start = ENTER, palette, maxWidth: ownMax = 700 }) => {
  const f = useCurrentFrame();
  const look = useContext(LookCtx);
  // outside a list the sheet is titled by its moment, and with no counter it centres
  const text = look?.rotulo ?? own;
  const x = look?.rotulo ? 540 : ownX;
  const maxWidth = look?.rotulo ? 980 : ownMax;
  const size = look?.rotulo ? Math.max(76, Math.min(110, 1000 / ([...text].length * 0.95))) : ownSize;
  const style = look?.titulo ?? 'recortes';
  if (style === 'recortes') {
    return (
      <At x={x} y={y} rot={(rnd(seed) - 0.5) * 6} seed={seed}>
        <Ransom text={text} size={size} seed={seed} start={start} palette={palette} maxWidth={maxWidth} />
      </At>
    );
  }
  if (f < start) return null;
  const dark = look ? isDark(look.hoja) : false;
  // lime reads on the dark sheets but not on the hot orange one
  const ink = dark ? (look?.hoja === 'hot' ? P.cream : P.lime) : P.ink;
  const box: React.CSSProperties = { maxWidth, textAlign: 'center', lineHeight: 1.05, width: 'max-content' };
  let el: React.ReactNode;
  if (style === 'marcador') {
    el = <div style={{ ...box, fontFamily: FONTS.marker, fontSize: size * 0.95, color: ink, filter: 'url(#boil)' }}>{text}</div>;
  } else if (style === 'sello') {
    el = <div style={{ ...box, fontFamily: FONTS.rubik, fontSize: size * 0.6, color: dark ? P.cream : P.red, border: `10px solid ${dark ? P.cream : P.red}`, borderRadius: 14, padding: '10px 26px', filter: 'url(#edge)' }}>{text}</div>;
  } else {
    el = (
      <div style={{ ...box, fontFamily: FONTS.bebas, fontSize: size * 0.95, letterSpacing: 8, color: dark ? P.ink : P.white, background: dark ? P.cream : P.ink, padding: '4px 26px 0', borderRadius: 8, boxShadow: '6px 9px 0 rgba(0,0,0,.25)' }}>{text}</div>
    );
  }
  return (
    <At x={x} y={y} rot={(rnd(seed) - 0.5) * 8} seed={seed} scale={pop(f, start)}>{el}</At>
  );
};

/** A piece that pops in at `start` and keeps its stop-motion wobble. */
// ------------------------------------------------------------------ the duck's hand (from ¡Al maíz!)
// A piece with `hand` is carried in by the duck's hand from that edge, set down
// on its beat (`start`) and let go; then the hand goes back out.
type Edge = 'L' | 'R' | 'B';
const APPROACH = 8, HOLD = 3, LEAVE = 8;
const HAND_U = 420; // points per hand-drawing unit
const HAND_LEN = 4.2; // a long arm, so it always reaches past the edge
const HAND_D = handPaths(HAND_LEN);
function handOrigin(edge: Edge, x: number, y: number) {
  if (edge === 'L') return { x: -300, y: y + 260 };
  if (edge === 'R') return { x: 1380, y: y + 260 };
  return { x: x * 0.7 + 160, y: 2250 };
}
/** 0 = off screen, 1 = on the piece; and whether the piece is still held. */
function handProgress(f: number, start: number) {
  if (f < start - APPROACH) return { p: 0, held: true, on: false };
  if (f < start) return { p: easeOut(stepIn(f, start - APPROACH, APPROACH)), held: true, on: true };
  if (f < start + HOLD) return { p: 1, held: false, on: true };
  if (f < start + HOLD + LEAVE) return { p: 1 - Math.pow(stepIn(f, start + HOLD, LEAVE), 2), held: false, on: true };
  return { p: 0, held: false, on: false };
}
const DuckHand: React.FC<{ x: number; y: number; from: { x: number; y: number } }> = ({ x, y, from }) => {
  const ang = (Math.atan2(y - from.y, x - from.x) * 180) / Math.PI + 90;
  const w = HAND_W * HAND_U, h = HAND_LEN * HAND_U;
  return (
    <div style={{ position: 'absolute', left: x - w / 2, top: y - 0.03 * HAND_U, width: w, height: h, transform: `rotate(${ang}deg)`, transformOrigin: `50% ${0.03 * HAND_U}px`, filter: 'drop-shadow(8px 12px 0 rgba(0,0,0,.22))' }}>
      <svg width={w} height={h} viewBox={`0 0 ${HAND_W} ${HAND_LEN}`}>
        <path d={HAND_D.outer} fill="#141414" />
        <path d={HAND_D.inner} fill="#FFFFFF" />
        <path d={HAND_D.shade} fill="#000" opacity={0.16} />
      </svg>
    </div>
  );
};
/** Where a carried piece is, and the hand over it. */
const Carried: React.FC<{ start: number; x: number; y: number; edge: Edge; rot: number; seed: number; scale: number; land: number[]; children: React.ReactNode }> = ({ start, x, y, edge, rot, seed, scale, land, children }) => {
  const f = useCurrentFrame();
  const { p, held, on } = handProgress(f, start);
  if (f < start - APPROACH) return null;
  const o = handOrigin(edge, x, y);
  const hx = o.x + (x - o.x) * p, hy = o.y + (y - o.y) * p;
  const k = Math.floor((f - start) / STEP);
  const sc = held ? 1.08 : land[k] ?? 1;
  return (
    <>
      <At x={held ? hx : x} y={held ? hy : y} rot={rot + (held ? (edge === 'L' ? -8 : edge === 'R' ? 8 : 0) : 0)} seed={seed} scale={sc * scale}>{children}</At>
      {on ? <DuckHand x={hx} y={hy} from={o} /> : null}
    </>
  );
};

/** A piece that pops in at `start` and keeps its stop-motion wobble (or is carried in by the hand). */
export const Pop: React.FC<{ start: number; x: number; y: number; rot?: number; seed?: number; children: React.ReactNode; scale?: number; hand?: Edge }> = ({ start, x, y, rot = 0, seed = 1, children, scale = 1, hand: edge }) => {
  const f = useCurrentFrame();
  const look = useContext(LookCtx);
  const hand = look && !look.mano ? undefined : edge;
  if (hand) return <Carried start={start} x={x} y={y} edge={hand} rot={rot} seed={seed} scale={scale} land={[0.94, 1.03, 1]}>{children}</Carried>;
  if (f < start) return null;
  return <At x={x} y={y} rot={rot} seed={seed} scale={pop(f, start) * scale}>{children}</At>;
};

/** A piece that slams down (big → its size in two drawings), or is slammed down by the hand. */
export const Slam: React.FC<{ start: number; x: number; y: number; rot?: number; seed?: number; children: React.ReactNode; hand?: Edge }> = ({ start, x, y, rot = 0, seed = 1, children, hand: edge }) => {
  const f = useCurrentFrame();
  const look = useContext(LookCtx);
  const hand = look && !look.mano ? undefined : edge;
  if (hand) return <Carried start={start} x={x} y={y} edge={hand} rot={rot} seed={seed} scale={1} land={[0.88, 1.05, 0.98, 1]}>{children}</Carried>;
  if (f < start) return null;
  const k = Math.floor((f - start) / STEP);
  const s = [2.1, 1.35, 0.96, 1][k] ?? 1;
  return <At x={x} y={y} rot={rot} seed={seed} scale={s}>{children}</At>;
};

export const Shot: React.FC<{ src: string; w: number; h: number; pos?: string }> = ({ src, w, h, pos = 'top' }) => (
  <Img src={staticFile(src)} style={{ width: w, height: h, objectFit: 'cover', objectPosition: pos, display: 'block', filter: 'contrast(1.05) saturate(.92)' }} />
);
export const Clip: React.FC<{ src: string; w: number; h: number; from: number; rate?: number; pos?: string }> = ({ src, w, h, from, rate = 1, pos = 'top' }) => (
  <OffthreadVideo src={staticFile(src)} startFrom={Math.round(from * FPS)} playbackRate={rate} muted style={{ width: w, height: h, objectFit: 'cover', objectPosition: pos, display: 'block' }} />
);

// ------------------------------------------------------------------ scenes
const FLOCK_ALL = ['artista', 'astro', 'basket', 'chef', 'code', 'conejita', 'cool', 'doctor', 'estudiante', 'fiesta', 'flores', 'grad', 'invierno', 'obrero', 'pirata', 'reina', 'rock', 'vaquero'].map((n) => `ducks/${n}.png`);
/** Eight dressed-up ducks for the stickers, picked by the episode seed. */
const useFlock = () => pick(FLOCK_ALL, 8, useEp().ep.seed);
// catalog pieces copied by scripts/fabrica/catalogo.py
const N_HEADS = 162, N_BODIES = 150;
const pad3 = (k: number) => String(k).padStart(3, '0');
/** Ten heads and six bodies from the whole catalog, picked by the episode seed. */
const usePieces = () => {
  const seed = useEp().ep.seed;
  return {
    heads: pick(Array.from({ length: N_HEADS }, (_, k) => `fabrica/piezas/h${pad3(k)}.png`), 10, seed),
    bodies: pick(Array.from({ length: N_BODIES }, (_, k) => `fabrica/piezas/b${pad3(k)}.png`), 6, seed + 7),
  };
};

export const Intro: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame();
  const L = useL(i);
  const { ep } = useEp();
  const FLOCK = useFlock();
  // the hook: the cream page tears open in three drawings
  const rip = Math.min(1, stepped(f) / 6);
  return (
    <Sheet i={i} color={P.orange}>
      {FLOCK.slice(0, 4).map((src, k) => (
        <Pop key={k} start={4 + k * 2} x={[110, 980, 70, 1010][k]} y={[860, 900, 1340, 1380][k]} rot={[-14, 12, 8, -10][k]} seed={k + 20}>
          <Sticker src={src} w={150} />
        </Pop>
      ))}
      <Title text={ep.hook.title} seed={4 + ep.seed} x={540} y={250} size={Math.max(90, Math.min(150, 1060 / (ep.hook.title.length * 1.08)))} start={2} maxWidth={1020} />
      <Pop start={L(0.95)} x={540} y={420} rot={-3} seed={7}>
        <Torn color={P.ink} seed={8} pad="10px 28px"><div style={{ fontFamily: FONTS.elite, fontSize: 50, color: P.cream }}>{ep.hook.sub}</div></Torn>
      </Pop>
      <Slam start={L('ducki')} x={860} y={560} rot={12} seed={9} hand="R">
        <div style={{ borderRadius: 60, overflow: 'hidden', width: 210, height: 210, border: '10px solid #fff', boxShadow: '8px 12px 0 rgba(0,0,0,.25)' }}>
          <Img src={staticFile('app/icon.png')} style={{ width: '100%', height: '100%' }} />
        </div>
      </Slam>
      {ep.hook.tag ? (
        <>
          <Pop start={L('fav')} x={250} y={590} rot={-9} seed={10} hand="L">
            <Torn color={P.lime} seed={11} pad="12px 26px"><div style={{ fontFamily: FONTS.marker, fontSize: 46, color: P.ink }}>{ep.hook.tag}</div></Torn>
          </Pop>
          <At x={95} y={500} seed={12}><Doodle d={STAR(110)} w={110} h={110} color={P.ink} stroke={7} start={L('fav') + 4} dur={8} /></At>
        </>
      ) : null}
      {rip < 1 ? (
        <>
          <div style={{ position: 'absolute', left: -rip * 600, top: 0, width: 560, height: 1920, background: P.cream, clipPath: tornPath(3, 26, { t: false, r: true, b: false, l: false }), boxShadow: '0 0 40px rgba(0,0,0,.3)' }} />
          <div style={{ position: 'absolute', left: 520 + rip * 600, top: 0, width: 560, height: 1920, background: P.cream, clipPath: tornPath(5, 26, { t: false, r: false, b: false, l: true }) }} />
        </>
      ) : null}
    </Sheet>
  );
};

export const Publica: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame();
  const L = useL(i);
  const on = f >= L('anon');
  return (
    <Sheet i={i} color={P.paper}>
      <Title text="PUBLICA" seed={21} />
      <Pop start={ENTER + 8} x={370} y={880} rot={-5} seed={22} hand="B">
        <Print w={520} h={900}><Shot src="screens/feed.jpg" w={520} h={900} /></Print>
        <div style={{ position: 'absolute', left: 180, top: -24, transform: 'rotate(4deg)' }}><Tape w={190} seed={23} /></div>
      </Pop>
      <Pop start={ENTER + 10} x={820} y={520} rot={6} seed={24}>
        <Torn color={P.white} seed={25} pad="24px 32px">
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <div style={{ fontFamily: FONTS.archivo, fontSize: 42, color: P.ink }}>Anónimo</div>
            <div style={{ width: 124, height: 66, borderRadius: 40, background: on ? P.lime : '#CFC8BA', border: '5px solid #16131D', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 5, left: on ? 62 : 6, width: 46, height: 46, borderRadius: 30, background: P.ink }} />
            </div>
          </div>
        </Torn>
      </Pop>
      <At x={820} y={520} seed={26}><Doodle d={SCRIBBLE_CIRCLE(450, 200)} w={450} h={200} color={P.cobalt} stroke={9} start={L('anon')} dur={8} /></At>
      <Pop start={L('anon') + 2} x={850} y={930} rot={9} seed={27} hand="R"><Sticker src="app/duck-anon.png" w={230} /></Pop>
      <At x={760} y={700} seed={29}><Doodle d={ARROW(160, 140)} w={160} h={140} color={P.ink} stroke={7} start={L('anon') + 4} dur={6} /></At>
      <Pop start={L('anon') + 8} x={540} y={1460} rot={-4} seed={28}>
        <Hand size={64} color={P.ink}>nadie sabrá que eres tú</Hand>
      </Pop>
    </Sheet>
  );
};

export const Mapa: React.FC<{ i: number }> = ({ i }) => {
  const FLOCK = useFlock();
  const L = useL(i);
  const pins = [[287, 693], [655, 590], [483, 969], [816, 900], [241, 1165]];
  return (
    <Sheet i={i} color={P.cobalt}>
      <Title text="MAPA" seed={31} palette={[P.lime, P.cream, P.white, P.ink, P.orange]} />
      <Pop start={ENTER + 8} x={540} y={900} rot={3} seed={32} hand="L">
        <div style={{ filter: 'drop-shadow(10px 14px 0 rgba(0,0,0,.3))' }}>
          <div style={{ width: 960, height: 1000, clipPath: tornPath(33, 18), overflow: 'hidden' }}>
            <Img src={staticFile('map/cali.png')} style={{ width: 1600, marginLeft: -360, marginTop: -1100, filter: 'saturate(.9) contrast(1.05)' }} />
          </div>
        </div>
      </Pop>
      <div style={{ position: 'absolute', left: 290, top: 610 }}><Doodle d={SQUIGGLE(380, 90)} w={380} h={90} color={P.hot} stroke={9} start={L('mapa')} dur={10} /></div>
      {pins.map(([x, y], k) => (
        <Pop key={k} start={L('mapa') - 4 + k * 3} x={x} y={y} rot={(rnd(k) - 0.5) * 16} seed={34 + k}>
          <Sticker src={FLOCK[(k + 3) % FLOCK.length]} w={110} outline={6} />
        </Pop>
      ))}
      <At x={816} y={900} seed={40}><Doodle d={SCRIBBLE_CIRCLE(220, 300)} w={220} h={300} color={P.lime} stroke={11} start={L('amigos')} dur={8} /></At>
      <Pop start={L('amigos') + 4} x={790} y={1250} rot={-6} seed={41}><Hand size={70} color={P.lime}>¡aquí andan!</Hand></Pop>
    </Sheet>
  );
};

export const Pato: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame();
  const L = useL(i);
  const k = Math.floor(f / 4);
  const { heads, bodies } = usePieces();
  const hi = k % heads.length, bi = Math.floor(k / 2) % bodies.length;
  const burst = L('cientos');
  return (
    <Sheet i={i} color={P.lime}>
      <Title text="ARMA TU PATO" seed={41} size={96} palette={[P.ink, P.cream, P.white, P.orange, P.cobalt]} />
      <Pop start={ENTER + 8} x={540} y={900} rot={-3} seed={42} scale={1.45} hand="B">
        <div style={{ filter: 'drop-shadow(9px 0 0 #fff) drop-shadow(-9px 0 0 #fff) drop-shadow(0 9px 0 #fff) drop-shadow(0 -9px 0 #fff) drop-shadow(9px 13px 0 rgba(0,0,0,.25))' }}>
          <Img src={staticFile(heads[hi])} style={{ width: 330, display: 'block' }} />
          <Img src={staticFile(bodies[bi])} style={{ width: 330, display: 'block' }} />
        </div>
      </Pop>
      {Array.from({ length: 10 }, (_, j) => {
        const a = (j / 10) * Math.PI * 2 - Math.PI / 2;
        return (
          <Pop key={j} start={burst + j} x={540 + Math.cos(a) * 420} y={900 + Math.sin(a) * 500} rot={(rnd(j + 3) - 0.5) * 30} seed={50 + j}>
            <Sticker src={heads[(j + 3) % heads.length]} w={170} outline={6} />
          </Pop>
        );
      })}
      <Pop start={burst + 10} x={540} y={1500} rot={-4} seed={61} hand="L">
        <Torn color={P.ink} seed={62} pad="12px 30px"><div style={{ fontFamily: FONTS.marker, fontSize: 66, color: P.lime }}>+ cientos de accesorios</div></Torn>
      </Pop>
    </Sheet>
  );
};

export const Phone: React.FC<{ w: number; children: React.ReactNode }> = ({ w, children }) => (
  <div style={{ width: w, height: w * 2.05, borderRadius: w * 0.14, background: '#111', padding: w * 0.04, boxShadow: '10px 14px 0 rgba(0,0,0,.25)' }}>
    <div style={{ width: '100%', height: '100%', borderRadius: w * 0.11, overflow: 'hidden', position: 'relative', background: 'linear-gradient(160deg,#FDA646,#FF6A3D 55%,#7B4DFF)' }}>{children}</div>
  </div>
);

export const Arte: React.FC<{ i: number }> = ({ i }) => {
  const L = useL(i);
  const sheets = [['duckart/weekly/drawing-01.jpeg', 300, 560, -7, 400], ['duckart/weekly/drawing-03.jpeg', 790, 530, 6, 380], ['duckart/weekly/drawing-05.jpeg', 620, 1000, -2, 420]] as const;
  return (
    <Sheet i={i} color={P.paper} grid>
      <Title text="DIBUJA" seed={71} />
      {sheets.map(([src, x, y, r, w], k) => (
        <Pop key={k} start={ENTER + k * 4} x={x} y={y} rot={r} seed={72 + k}>
          <Print w={w} h={w}><Img src={staticFile(src)} style={{ width: w, height: w, objectFit: 'cover' }} /></Print>
          <div style={{ position: 'absolute', left: w / 2 - 50, top: -22, transform: `rotate(${-r}deg)` }}><Tape w={120} seed={73 + k} /></div>
        </Pop>
      ))}
      <At x={900} y={1000} seed={76}><Doodle d={STAR(190)} w={190} h={190} color={P.hot} stroke={11} start={L('dibuja')} dur={14} /></At>
      <Slam start={L('celular')} x={250} y={1150} rot={-7} seed={77} hand="B">
        <Phone w={310}>
          <div style={{ color: '#fff', fontFamily: FONTS.archivo, fontSize: 66, textAlign: 'center', marginTop: 40 }}>9:41</div>
          <div style={{ margin: '26px 20px', background: '#fff', borderRadius: 26, padding: 12, boxShadow: '0 6px 0 rgba(0,0,0,.2)' }}>
            <Img src={staticFile('duckart/weekly/drawing-01.jpeg')} style={{ width: '100%', borderRadius: 16, display: 'block' }} />
            <div style={{ fontFamily: FONTS.archivo, fontSize: 22, color: P.ink, marginTop: 8 }}>DuckiArt · ganador</div>
          </div>
        </Phone>
      </Slam>
      <At x={250} y={1080} seed={78}><Doodle d={BURST(540)} w={540} h={540} color={P.cobalt} stroke={10} start={L('celular') + 4} dur={6} strong /></At>
    </Sheet>
  );
};

const CATS = ['musica', 'deportes', 'gaming', 'fiesta', 'estudio', 'comida', 'arte', 'viajes', 'series'];
const UNIS = ['icesi', 'javeriana', 'autonoma', 'univalle', 'sanbue', 'libre', 'santiago', 'camacho', 'end'];
export const Parche: React.FC<{ i: number }> = ({ i }) => {
  const L = useL(i);
  return (
    <Sheet i={i} color={P.hot}>
      <Title text="TU PARCHE" seed={81} palette={[P.ink, P.cream, P.white, P.lime, P.cobalt]} />
      {CATS.map((c, k) => (
        <Pop key={c} start={ENTER + k * 2} x={200 + (k % 3) * 340} y={480 + Math.floor(k / 3) * 310} rot={(rnd(k + 9) - 0.5) * 22} seed={82 + k}>
          <Sticker src={`parches/cat/${c}.png`} w={250} />
        </Pop>
      ))}
      <Pop start={L('gente')} x={540} y={1340} rot={-4} seed={92}><Hand size={68} color={P.cream}>gente con tus gustos</Hand></Pop>
      {UNIS.map((u, k) => (
        <Pop key={u} start={L('cualquier') + k} x={100 + k * 110} y={1490 + (k % 2) * 30} rot={(rnd(k + 30) - 0.5) * 20} seed={93 + k}>
          <div style={{ width: 98, height: 98, borderRadius: 49, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '5px 7px 0 rgba(0,0,0,.25)' }}>
            <Img src={staticFile(`logos/${u}.png`)} style={{ width: 76, height: 76, objectFit: 'contain' }} />
          </div>
        </Pop>
      ))}
    </Sheet>
  );
};

const Envelope: React.FC = () => (
  <div style={{ width: 360, height: 240, background: '#FFF6E2', position: 'relative', boxShadow: '8px 12px 0 rgba(0,0,0,.22)', border: '4px solid #16131D' }}>
    <svg width={360} height={240} style={{ position: 'absolute', inset: 0 }}><path d="M 4 4 L 180 130 L 356 4" fill="none" stroke="#16131D" strokeWidth={5} /></svg>
    <div style={{ position: 'absolute', left: 148, top: 100, width: 64, height: 64, borderRadius: 32, background: P.red, border: '4px solid #8f1e22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={34} height={34}><path d={HEART(34)} fill="#ffd2d6" /></svg>
    </div>
  </div>
);

export const Carta: React.FC<{ i: number }> = ({ i }) => {
  const L = useL(i);
  return (
    <Sheet i={i} color={P.kraft}>
      <Title text="CARTA" seed={101} />
      <Pop start={ENTER + 8} x={330} y={900} rot={-4} seed={102} hand="B">
        <Print w={470} h={960}><Clip src="v0110/carta.mp4" w={470} h={960} from={3.6} rate={1.25} /></Print>
        <div style={{ position: 'absolute', left: 160, top: -24, transform: 'rotate(-3deg)' }}><Tape w={180} seed={103} /></div>
      </Pop>
      <Slam start={L('carta')} x={810} y={600} rot={8} seed={104} hand="R"><Envelope /></Slam>
      <Pop start={L('firmada')} x={810} y={900} rot={-5} seed={105}><Hand size={70} font="caveat" color={P.ink}>con cariño, Juan</Hand></Pop>
      <At x={810} y={955} seed={106}><Doodle d={SQUIGGLE(300, 30)} w={300} h={30} color={P.ink} stroke={5} start={L('firmada') + 4} dur={6} /></At>
      <Slam start={L('anonima')} x={800} y={1170} rot={-12} seed={107} hand="R">
        <div style={{ border: '10px solid #D7262C', color: '#D7262C', fontFamily: FONTS.rubik, fontSize: 70, padding: '8px 24px', borderRadius: 14, opacity: 0.9, filter: 'url(#edge)', background: 'rgba(255,255,255,.12)' }}>ANÓNIMA</div>
      </Slam>
    </Sheet>
  );
};

export const Crush: React.FC<{ i: number }> = ({ i }) => {
  const L = useL(i);
  const hearts = [[140, 420, 90], [940, 620, 110], [930, 1420, 90], [130, 1430, 80], [560, 360, 60]];
  return (
    <Sheet i={i} color={P.pink}>
      <Title text="CRUSH" seed={111} palette={[P.ink, P.cream, P.white, P.red, P.lime]} />
      <Pop start={ENTER + 8} x={340} y={900} rot={-5} seed={112} hand="L">
        <Print w={470} h={960}><Shot src="todo/stills/crush-menu.jpg" w={470} h={960} pos="center 70%" /></Print>
        <div style={{ position: 'absolute', left: 150, top: -24 }}><Tape w={180} seed={113} /></div>
      </Pop>
      {hearts.map(([x, y, w], k) => (
        <At key={k} x={x} y={y} seed={114 + k}><Doodle d={HEART(w)} w={w} h={w} color={P.red} stroke={8} start={L('crush') + k * 3} dur={6} /></At>
      ))}
      <Slam start={L('match')} x={720} y={900} rot={7} seed={120} hand="R">
        <Print w={460} h={560}><Shot src="todo/stills/match.jpg" w={460} h={560} pos="center 42%" /></Print>
      </Slam>
      <Slam start={L('match') + 4} x={540} y={1460} rot={-6} seed={121}>
        <Ransom text="¡MATCH!" size={120} seed={122} start={0} palette={[P.red, P.ink, P.cream, P.white]} />
      </Slam>
    </Sheet>
  );
};

export const Sala: React.FC<{ i: number }> = ({ i }) => {
  const L = useL(i);
  return (
    <Sheet i={i} color={P.night}>
      <Title text="DUCKISALA" seed={131} size={96} palette={[P.lime, P.cream, P.white, P.orange, P.pink]} />
      <Pop start={ENTER + 8} x={330} y={900} rot={-4} seed={132} hand="B">
        <Print w={470} h={960}><Shot src="todo/stills/sala.jpg" w={470} h={960} /></Print>
        <div style={{ position: 'absolute', left: 150, top: -24 }}><Tape w={180} seed={133} /></div>
      </Pop>
      <Pop start={L('duckisala')} x={800} y={650} rot={7} seed={134} hand="R"><Sticker src="parches/duckisalas-ducks.png" w={430} /></Pop>
      {[0, 1, 2].map((k) => (
        <At key={k} x={760 + k * 45} y={1000} seed={135 + k}>
          <Doodle d={`M 0 ${-60 - k * 30} Q ${50 + k * 25} 0 0 ${60 + k * 30}`} w={120} h={200} color={P.lime} stroke={10} start={L('voz') + k * 2} dur={4} />
        </At>
      ))}
    </Sheet>
  );
};

export const Juegos: React.FC<{ i: number }> = ({ i }) => {
  const FLOCK = useFlock();
  const L = useL(i);
  const fav = useScene(i).fav;
  return (
    <Sheet i={i} color={P.cobalt}>
      {fav ? (
        <>
          <Pop start={ENTER} x={360} y={420} rot={-6} seed={141}>
            <Torn color={P.lime} seed={142} pad="14px 30px"><div style={{ fontFamily: FONTS.marker, fontSize: 68, color: P.ink }}>mi favorita</div></Torn>
          </Pop>
          <At x={140} y={370} seed={143}><Doodle d={STAR(150)} w={150} h={150} color={P.lime} stroke={9} start={ENTER + 4} dur={8} /></At>
        </>
      ) : null}
      <Title text="JUEGOS" seed={144} x={650} y={180} size={120} start={L('juegos')} palette={[P.lime, P.cream, P.white, P.orange, P.pink, P.ink]} />
      <Slam start={L('kart')} x={510} y={680} rot={-6} seed={145} hand="L">
        <Print w={700} h={395} caption="Ducki Kart" bottom={8}><Clip src="parches/games/kart.mp4" w={700} h={395} from={0.4} pos="center" /></Print>
      </Slam>
      <Slam start={L('golf')} x={810} y={1110} rot={7} seed={146} hand="R">
        <Print w={370} h={480} caption="minigolf" bottom={8}><Clip src="parches/games/golf.mp4" w={370} h={480} from={0} pos="center" /></Print>
      </Slam>
      <Slam start={L('impostor')} x={290} y={1150} rot={-8} seed={147} hand="L">
        <Print w={380} h={440} caption="el impostor" bottom={8}>
          <div style={{ width: 380, height: 440, background: '#2a2440', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4, paddingBottom: 20 }}>
            {[0, 1, 2].map((k) => (
              <Img key={k} src={staticFile(FLOCK[k + 4])} style={{ width: 106, filter: k === 1 ? 'brightness(0)' : undefined }} />
            ))}
          </div>
        </Print>
      </Slam>
      <Pop start={L('impostor') + 6} x={570} y={990} rot={8} seed={148}><Hand size={130} color={P.red}>?</Hand></Pop>
      <Slam start={L('quien')} x={480} y={1490} rot={4} seed={149} hand="B">
        <Torn color={P.cream} seed={150} pad="14px 34px"><div style={{ fontFamily: FONTS.shrikhand, fontSize: 76, color: P.ink }}>¿Quién soy?</div></Torn>
      </Slam>
      {[0, 1, 2].map((k) => (
        <At key={k} x={860 + k * 42} y={1470} seed={151 + k}>
          <Doodle d={`M 0 ${-50 - k * 25} Q ${45 + k * 20} 0 0 ${50 + k * 25}`} w={110} h={180} color={P.lime} stroke={9} start={L('porvoz') + k * 2} dur={4} />
        </At>
      ))}
    </Sheet>
  );
};

const PILE = [
  ['app/duck-anon.png', 0], ['todo/pieces/h3.png', 1], ['duckart/weekly/drawing-03.jpeg', 2], ['parches/cat/musica.png', 3],
  ['todo/stills/kart.jpg', 4], ['parches/cat/gaming.png', 5], ['todo/pieces/h6.png', 6], ['ducks/reina.png', 7], ['parches/duckisalas-ducks.png', 8],
] as const;
export const Todo: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame();
  const L = useL(i);
  return (
    <Sheet i={i} color={P.paper} grid>
      <Title text="EN 1 SOLA APP" seed={161} size={96} x={540} maxWidth={900} start={L('app') - 6} />
      <At x={540} y={880} seed={162}>
        <Phone w={470}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 44 }}>
            <Img src={staticFile('app/icon.png')} style={{ width: 170, borderRadius: 38 }} />
          </div>
        </Phone>
      </At>
      {PILE.map(([src, k]) => {
        const start = ENTER + k * 3;
        if (f < start) return null;
        const t = easeOut(stepIn(f, start, 8));
        const a = rnd(k + 70) * Math.PI * 2;
        const sx = 540 + Math.cos(a) * 900, sy = 880 + Math.sin(a) * 1200;
        const ex = 540 + (rnd(k + 80) - 0.5) * 320, ey = 880 + (rnd(k + 90) - 0.3) * 480;
        const isPhoto = src.endsWith('.jpeg') || src.endsWith('.jpg');
        return (
          <At key={k} x={sx + (ex - sx) * t} y={sy + (ey - sy) * t} rot={(rnd(k + 60) - 0.5) * 50} seed={170 + k}>
            {isPhoto ? <Print w={220} h={220} border={10}><Img src={staticFile(src)} style={{ width: 220, height: 220, objectFit: 'cover' }} /></Print> : <Sticker src={src} w={190} outline={6} />}
          </At>
        );
      })}
      <Pop start={L('cali') - 4} x={540} y={1490} rot={-4} seed={180}><Hand size={68} color={P.cobalt}>universitarios de Cali</Hand></Pop>
    </Sheet>
  );
};

export const Fin: React.FC<{ i: number }> = ({ i }) => {
  const FLOCK = useFlock();
  const L = useL(i);
  return (
    <Sheet i={i} color={P.orange}>
      <Title text="DESCARGA DUCKI" seed={191} x={540} y={190} size={100} maxWidth={1000} />
      <Slam start={L('gratis')} x={540} y={380} rot={-3} seed={192}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', background: P.cream, padding: '18px 24px', clipPath: tornPath(193, 8), boxShadow: '6px 9px 0 rgba(0,0,0,.2)' }}>
          <Img src={staticFile('stores/app-store.svg')} style={{ height: 86 }} />
          <Img src={staticFile('stores/google-play.png')} style={{ height: 86 }} />
        </div>
      </Slam>
      <Slam start={L('gratis') + 4} x={900} y={520} rot={14} seed={194} hand="R">
        <div style={{ border: '9px solid #16131D', color: P.ink, fontFamily: FONTS.rubik, fontSize: 54, padding: '6px 18px', borderRadius: 12, filter: 'url(#edge)' }}>GRATIS</div>
      </Slam>
      {FLOCK.map((src, k) => (
        <Pop key={k} start={L('aqui') + k * 2} x={[90, 990, 60, 1020, 150, 930, 260, 820][k]} y={[1250, 1230, 1560, 1540, 1830, 1820, 1700, 1690][k]} rot={(rnd(k + 5) - 0.5) * 24} seed={200 + k}>
          <Sticker src={src} w={170} />
        </Pop>
      ))}
    </Sheet>
  );
};


export const FEATURES: Record<string, React.FC<{ i: number }>> = {
  publica: Publica, mapa: Mapa, pato: Pato, arte: Arte, parche: Parche, carta: Carta, crush: Crush, sala: Sala, juegos: Juegos,
};
/** Scene ids the template can show (scripts/fabrica checks specs against this). */
export const ESCENAS = Object.keys(FEATURES);

export const Lista: React.FC<{ episode: Episode }> = ({ episode }) => {
  const ctx = useMemo(() => makeCtx(episode), [episode]);
  const face = useMemo(() => hostFace(ctx.SC), [ctx]);
  const pose = useMemo(() => makePose(ctx.chunks, ctx.SC), [ctx]);
  const frame = useCurrentFrame();
  const place = hostPlace(stepped(frame), ctx.SC);
  const side = { centro: 0, izquierda: -120, derecha: 120 }[episode.plan?.estilo.presentador ?? 'centro'];
  const hostIn = pop(frame, 2);
  const w = wobble(301, frame, 1.2, 4);
  const fin = ctx.SC.find((s) => s.kind === 'fin');
  const capsUntil = fin && fin.ev.aqui !== undefined ? ctx.T(fin.ev.aqui) : 1e9;
  return (
    <EpProvider ctx={ctx}>
      <AbsoluteFill style={{ background: P.ink }}>
        <BoilDefs />
        {ctx.SC.map((s, i) => {
          // a director's episode composes its own scenes; the prefabricated ones keep their component
          const C = s.kind === 'libre' ? Libre : s.kind === 'intro' ? Intro : s.kind === 'todo' ? Todo : s.kind === 'fin' ? Fin : FEATURES[s.feature ?? ''];
          if (!C) return null;
          return (
            <Sequence key={i} from={i === 0 ? 0 : s.from - ENTER} durationInFrames={s.to - s.from + ENTER + 2}>
              <C i={i} />
            </Sequence>
          );
        })}
        <Counter />
        {place.visible ? (
          <div style={{ position: 'absolute', left: place.x + side - place.w / 2 + w.x, top: place.y + w.y, transform: `rotate(${w.r}deg) scale(${hostIn})`, transformOrigin: '50% 30%' }}>
            <HostDuck face={face} v0={episode.v0} width={place.w} pose={pose} mouth={episode.mouth} />
          </div>
        ) : null}
        <Spoken />
        {frame < capsUntil ? <Captions big={place.visible} /> : null}
        <EndLine />
      </AbsoluteFill>
    </EpProvider>
  );
};
