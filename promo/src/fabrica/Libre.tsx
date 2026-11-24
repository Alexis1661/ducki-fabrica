// Free scenes of a director's episode (scripts/fabrica/director/): what each sheet shows is
// decided for that video — resources from the catalog, text, speech bubbles, notes, hand
// drawn icons and doodles, the presenter — each piece appearing on the word that names it.
// The look (paper, stop-motion, letters, the sheet coming in) is the scrapbook's own.
import React, { useMemo } from 'react';
import { Sequence } from 'remotion';
import { icons } from 'lucide-react';
import {
  ARROW, AbsoluteFill, At, BURST, Doodle, ENTER, FONTS, FPS, HEART, Hand, HostDuck, Img, OffthreadVideo, P, Print, Ransom,
  SCRIBBLE_CIRCLE, SQUIGGLE, STAR, STEP, Sticker, Tape, Torn, easeOut, isDark, makePose, pop, rnd, staticFile, stepIn, stepped,
  tornPath, useCurrentFrame, useEp, useL, useLookAt,
} from './head';
import type { FaceKey } from './head';
import { Phone, Pop, Slam, Sheet } from './Lista';

export type Elemento = {
  tipo: 'titulo' | 'texto' | 'nota' | 'bocadillo' | 'imagen' | 'clip' | 'sticker' | 'pato' | 'icono' | 'garabato' | 'contador';
  /** Voice seconds when it appears / leaves. */
  en: number;
  sale?: number | null;
  /** Centre of the piece on the 1080×1920 canvas. */
  x: number;
  y: number;
  w?: number;
  h?: number;
  tam?: number;
  rot?: number;
  entrada?: 'pop' | 'golpe' | 'mano-izq' | 'mano-der' | 'mano-abajo' | 'deslizar' | 'escribir' | 'aparecer';
  texto?: string;
  estilo?: string;
  color?: string;
  fondo?: string;
  cola?: string;
  /** Resource (path in public/) and its natural size. */
  src?: string;
  w0?: number;
  h0?: number;
  marco?: string;
  pie?: string;
  desde?: number;
  velocidad?: number;
  cabeza?: string;
  cuerpo?: string;
  nombre?: string;
  forma?: string;
  n?: number;
  total?: number;
};
export type EscenaLibre = {
  prefab?: string | null;
  camara?: { mover?: string; foco?: [number, number]; golpe?: number | null } | null;
  presentador?: { x: number; y: number; w: number; en: number; sale?: number | null } | null;
  elementos: Elemento[];
};

const PAL = P as Record<string, string>;
const NOTE_COLORS: Record<string, string> = { amarillo: '#FFE46B', rosado: '#FFB3CF', verde: P.lime, crema: P.cream, naranja: P.orange };

/** A colour name of the palette, or the default for the sheet (light text on dark sheets). */
function color(name: string | undefined, dark: boolean, light = P.ink, onDark = P.cream) {
  if (name && PAL[name]) return PAL[name];
  return dark ? onDark : light;
}

// ------------------------------------------------------------------ text pieces
/** Big title: the scrapbook's cut-out letters, marker, rubber stamp, label tape or typewriter. */
const Rotulo: React.FC<{ e: Elemento; start: number; dark: boolean; seed: number }> = ({ e, start, dark, seed }) => {
  const text = e.texto ?? '';
  const size = e.tam ?? 110;
  const maxWidth = e.w ?? 980;
  const box: React.CSSProperties = { maxWidth, textAlign: 'center', lineHeight: 1.05, width: 'max-content' };
  switch (e.estilo) {
    case 'marcador':
      return <div style={{ ...box, fontFamily: FONTS.marker, fontSize: size * 0.95, color: color(e.color, dark, P.ink, P.lime), filter: 'url(#boil)' }}>{text}</div>;
    case 'sello': {
      const c = color(e.color, dark, P.red, P.cream);
      return <div style={{ ...box, fontFamily: FONTS.rubik, fontSize: size * 0.6, color: c, border: `10px solid ${c}`, borderRadius: 14, padding: '10px 26px', filter: 'url(#edge)' }}>{text}</div>;
    }
    case 'etiqueta':
      return <div style={{ ...box, fontFamily: FONTS.bebas, fontSize: size * 0.95, letterSpacing: 8, color: dark ? P.ink : P.white, background: dark ? P.cream : P.ink, padding: '4px 26px 0', borderRadius: 8, boxShadow: '6px 9px 0 rgba(0,0,0,.25)' }}>{text}</div>;
    case 'maquina':
      return <div style={{ ...box, fontFamily: FONTS.elite, fontSize: size * 0.7, color: color(e.color, dark), background: dark ? 'transparent' : 'rgba(255,248,234,.85)', padding: '6px 18px' }}>{text}</div>;
    default:
      return <Ransom text={text} size={size} seed={seed} start={start} maxWidth={maxWidth} palette={dark ? [P.lime, P.cream, P.white, P.orange, P.pink, P.ink] : undefined} />;
  }
};

/** Running text: handwriting, typewriter or heavy; optionally on paper, tape or black. */
const Texto: React.FC<{ e: Elemento; start: number; dark: boolean; seed: number }> = ({ e, start, dark, seed }) => {
  const f = useCurrentFrame();
  let text = e.texto ?? '';
  if (e.entrada === 'escribir') text = text.slice(0, Math.max(1, Math.floor(((stepped(f) - start) / STEP) * 3)));
  const size = e.tam ?? 62;
  const onPaper = e.fondo === 'papel' || e.fondo === 'cinta';
  const onBlack = e.fondo === 'negro';
  const c = onBlack ? color(e.color, true, P.ink, P.lime) : onPaper ? color(e.color, false) : color(e.color, dark, P.ink, P.cream);
  const font = e.estilo === 'maquina' ? FONTS.elite : e.estilo === 'grueso' ? FONTS.archivo : e.estilo === 'caveat' ? FONTS.caveat : FONTS.marker;
  const inner = (
    <div style={{ fontFamily: font, fontSize: size, color: c, lineHeight: 1.15, textAlign: 'center', maxWidth: e.w ?? 900, width: 'max-content', whiteSpace: 'pre-wrap', filter: e.estilo === 'maquina' ? undefined : 'url(#boil)' }}>
      {text}
    </div>
  );
  if (e.fondo === 'cinta') return <div style={{ background: 'rgba(255,244,196,.93)', padding: '12px 30px', clipPath: tornPath(seed, 10, { t: false, r: true, b: false, l: true }) }}>{inner}</div>;
  if (onPaper) return <Torn color={P.cream} seed={seed} pad="14px 30px">{inner}</Torn>;
  if (onBlack) return <Torn color={P.ink} seed={seed} pad="14px 30px">{inner}</Torn>;
  if (e.fondo === 'resaltado') return <div style={{ background: PAL[e.color ?? ''] ? P.lime : P.lime, padding: '0 14px', transform: 'rotate(-1.5deg)' }}>{inner}</div>;
  return inner;
};

/** A sticky note with handwriting and a strip of tape. */
const Nota: React.FC<{ e: Elemento; seed: number }> = ({ e, seed }) => (
  <div style={{ width: e.w ?? 380, minHeight: (e.w ?? 380) * 0.8, background: NOTE_COLORS[e.color ?? ''] ?? NOTE_COLORS.amarillo, boxShadow: '8px 12px 0 rgba(0,0,0,.2)', padding: '34px 28px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
    <Hand size={e.tam ?? 52} color={P.ink} style={{ textAlign: 'center', lineHeight: 1.1, whiteSpace: 'normal', maxWidth: (e.w ?? 380) - 56 }}>{e.texto}</Hand>
    <div style={{ position: 'absolute', left: '50%', top: -20, transform: 'translateX(-50%) rotate(-4deg)' }}><Tape w={150} seed={seed} /></div>
  </div>
);

/** A comic speech bubble; the tail points to whoever speaks. */
const Bocadillo: React.FC<{ e: Elemento }> = ({ e }) => {
  const cola = e.cola ?? 'abajo-izq';
  const tail: Record<string, React.CSSProperties> = {
    'abajo-izq': { left: '18%', bottom: -54, transform: 'none' },
    'abajo-der': { right: '18%', bottom: -54, transform: 'scaleX(-1)' },
    izq: { left: -50, top: '40%', transform: 'rotate(90deg)' },
    der: { right: -50, top: '40%', transform: 'rotate(-90deg) scaleX(-1)' },
    arriba: { left: '45%', top: -54, transform: 'rotate(180deg)' },
  };
  const font = e.estilo === 'maquina' ? FONTS.elite : e.estilo === 'grueso' ? FONTS.archivo : FONTS.marker;
  return (
    <div style={{ position: 'relative', background: P.white, border: `7px solid ${P.ink}`, borderRadius: 46, padding: '26px 36px', maxWidth: e.w ?? 580, width: 'max-content', boxShadow: '8px 10px 0 rgba(0,0,0,.2)' }}>
      <div style={{ fontFamily: font, fontSize: e.tam ?? 52, color: P.ink, lineHeight: 1.12, textAlign: 'center' }}>{e.texto}</div>
      <svg width={64} height={60} viewBox="0 0 64 60" style={{ position: 'absolute', overflow: 'visible', ...tail[cola] }}>
        <path d="M 6 0 L 18 56 L 44 0" fill={P.white} stroke={P.ink} strokeWidth={7} strokeLinejoin="round" />
        <rect x={4} y={-8} width={44} height={12} fill={P.white} />
      </svg>
    </div>
  );
};

// ------------------------------------------------------------------ pictures and video
function medida(e: Elemento, defW: number) {
  const w = e.w ?? defW;
  const ratio = e.w0 && e.h0 ? e.h0 / e.w0 : 1;
  return { w, h: e.h ?? Math.round(w * ratio) };
}

const Foto: React.FC<{ e: Elemento; start: number; seed: number }> = ({ e, start, seed }) => {
  const isClip = e.tipo === 'clip';
  const marco = e.marco ?? 'polaroid';
  const { w, h } = medida(e, marco === 'celular' ? 340 : 520);
  const media = (mw: number, mh: number) =>
    isClip ? (
      <Sequence from={start} layout="none">
        <OffthreadVideo src={staticFile(e.src ?? '')} startFrom={Math.round((e.desde ?? 0) * FPS)} playbackRate={e.velocidad ?? 1} muted style={{ width: mw, height: mh, objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
      </Sequence>
    ) : (
      <Img src={staticFile(e.src ?? '')} style={{ width: mw, height: mh, objectFit: 'cover', objectPosition: 'top', display: 'block', filter: 'contrast(1.04) saturate(.94)' }} />
    );
  if (marco === 'celular') {
    const sw = w * 0.92, sh = w * 2.05 * 0.94;
    return <Phone w={w}><div style={{ width: sw, height: sh, overflow: 'hidden', borderRadius: w * 0.09 }}>{media(sw, sh)}</div></Phone>;
  }
  if (marco === 'recorte') {
    return <div style={{ filter: 'drop-shadow(8px 12px 0 rgba(0,0,0,.25))' }}><div style={{ width: w, height: h, clipPath: tornPath(seed, 14), overflow: 'hidden' }}>{media(w, h)}</div></div>;
  }
  if (marco === 'ninguno') return <div style={{ boxShadow: '8px 12px 0 rgba(0,0,0,.22)' }}>{media(w, h)}</div>;
  return (
    <div style={{ position: 'relative' }}>
      <Print w={w} h={h} caption={e.pie} bottom={e.pie ? 8 : undefined}>{media(w, h)}</Print>
      {marco === 'cinta' || marco === 'polaroid' ? <div style={{ position: 'absolute', left: '50%', top: -22, transform: `translateX(-50%) rotate(${(rnd(seed) - 0.5) * 10}deg)` }}><Tape w={Math.min(200, w * 0.4)} seed={seed} /></div> : null}
    </div>
  );
};

/** A duck put together from catalog pieces: a head over a body. */
const Pato: React.FC<{ e: Elemento }> = ({ e }) => {
  const w = e.w ?? 300;
  return (
    <div style={{ filter: 'drop-shadow(8px 0 0 #fff) drop-shadow(-8px 0 0 #fff) drop-shadow(0 8px 0 #fff) drop-shadow(0 -8px 0 #fff) drop-shadow(8px 12px 0 rgba(0,0,0,.25))' }}>
      {e.cabeza ? <Img src={staticFile(`fabrica/piezas/${e.cabeza}.png`)} style={{ width: w, display: 'block' }} /> : null}
      {e.cuerpo ? <Img src={staticFile(`fabrica/piezas/${e.cuerpo}.png`)} style={{ width: w, display: 'block' }} /> : null}
    </div>
  );
};

/** A line icon drawn in marker, boiling like the doodles. */
const Icono: React.FC<{ e: Elemento; dark: boolean }> = ({ e, dark }) => {
  const Ic = (icons as Record<string, React.FC<{ size?: number; color?: string; strokeWidth?: number; absoluteStrokeWidth?: boolean }>>)[e.nombre ?? ''];
  if (!Ic) return null;
  const size = e.w ?? 200;
  const onLight = e.fondo === 'circulo' || e.fondo === 'sticker';
  // on its cream circle a light colour would vanish: then it goes in ink
  const light = ['cream', 'white', 'paper', 'lime', 'pink', 'kraft'].includes(e.color ?? '');
  const c = onLight && (light || !e.color) ? (e.color && !light ? PAL[e.color] : P.ink) : color(e.color, dark && !onLight, P.ink, P.cream);
  const icon = <div style={{ filter: 'url(#boil)', lineHeight: 0 }}><Ic size={size} color={c} strokeWidth={2.1} /></div>;
  if (e.fondo === 'circulo') {
    return <div style={{ width: size * 1.45, height: size * 1.45, borderRadius: '50%', background: P.cream, border: `7px solid ${P.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '6px 9px 0 rgba(0,0,0,.2)' }}>{icon}</div>;
  }
  if (e.fondo === 'sticker') return <div style={{ filter: 'drop-shadow(6px 0 0 #fff) drop-shadow(-6px 0 0 #fff) drop-shadow(0 6px 0 #fff) drop-shadow(0 -6px 0 #fff)' }}>{icon}</div>;
  return icon;
};

const Garabato: React.FC<{ e: Elemento; start: number; dark: boolean }> = ({ e, start, dark }) => {
  const w = e.w ?? 260, h = e.h ?? Math.round(w * 0.6);
  const c = color(e.color, dark, P.ink, P.lime);
  const paths: Record<string, [string, number, number]> = {
    flecha: [ARROW(w, h), w, h],
    circulo: [SCRIBBLE_CIRCLE(w, h), w, h],
    subrayado: [SQUIGGLE(w, Math.max(20, h * 0.3)), w, Math.max(20, h * 0.3)],
    corazon: [HEART(w), w, w],
    estrella: [STAR(w), w, w],
    explosion: [BURST(w), w, w],
    rayas: [`M 0 ${h * 0.15} L ${w * 0.55} ${h * 0.15} M ${w * 0.15} ${h * 0.5} L ${w} ${h * 0.5} M 0 ${h * 0.85} L ${w * 0.7} ${h * 0.85}`, w, h],
  };
  if (e.forma === 'pregunta' || e.forma === 'exclamacion') {
    return <Hand size={e.tam ?? w * 0.8} color={c}>{e.forma === 'pregunta' ? '?' : '!'}</Hand>;
  }
  const [d, dw, dh] = paths[e.forma ?? 'flecha'] ?? paths.flecha;
  return <Doodle d={d} w={dw} h={dh} color={c} stroke={e.tam ?? 9} start={start} dur={8} strong={e.forma === 'explosion'} />;
};

const Contador: React.FC<{ e: Elemento; seed: number }> = ({ e, seed }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
    <Torn color={P.ink} seed={seed} pad="6px 22px"><div style={{ fontFamily: FONTS.abril, fontSize: e.tam ?? 150, color: P.lime, lineHeight: 1 }}>{e.n}</div></Torn>
    {e.total ? <div style={{ fontFamily: FONTS.marker, fontSize: (e.tam ?? 150) * 0.42, color: P.ink, filter: 'url(#boil)', marginBottom: 10, background: P.cream, padding: '0 10px', transform: 'rotate(6deg)' }}>/{e.total}</div> : null}
  </div>
);

function Cuerpo({ e, start, dark, seed }: { e: Elemento; start: number; dark: boolean; seed: number }) {
  switch (e.tipo) {
    case 'titulo': return <Rotulo e={e} start={start} dark={dark} seed={seed} />;
    case 'texto': return <Texto e={e} start={start} dark={dark} seed={seed} />;
    case 'nota': return <Nota e={e} seed={seed} />;
    case 'bocadillo': return <Bocadillo e={e} />;
    case 'imagen': case 'clip': return <Foto e={e} start={start} seed={seed} />;
    case 'sticker': return <Sticker src={e.src ?? ''} w={e.w ?? 260} />;
    case 'pato': return <Pato e={e} />;
    case 'icono': return <Icono e={e} dark={dark} />;
    case 'garabato': return <Garabato e={e} start={start} dark={dark} />;
    case 'contador': return <Contador e={e} seed={seed} />;
    default: return null;
  }
}

const DEFAULT_IN: Record<string, Elemento['entrada']> = {
  titulo: 'aparecer', texto: 'pop', nota: 'mano-der', bocadillo: 'pop', imagen: 'mano-abajo', clip: 'mano-abajo', sticker: 'pop',
  pato: 'golpe', icono: 'pop', garabato: 'aparecer', contador: 'golpe',
};

/** One piece: placed, brought in on its word, and taken out if it leaves. */
const Pieza: React.FC<{ e: Elemento; i: number; k: number; dark: boolean }> = ({ e: raw, i, k, dark }) => {
  const f = useCurrentFrame();
  const L = useL(i);
  const scene = useEp().SC[i];
  const cam = React.useContext(CamCtx);
  const e = { ...raw, ...enCamara(cam, raw.x, raw.y) };
  const start = Math.max(ENTER, L(e.en - scene.t));
  const end = e.sale != null ? L(e.sale - scene.t) : null;
  if (end != null && f >= end + 2 * STEP) return null;
  const out = end != null && f >= end ? [0.65, 0.3][Math.floor((f - end) / STEP)] ?? 0 : 1;
  const seed = i * 37 + k * 11 + 3;
  const rot = e.rot ?? (rnd(seed) - 0.5) * 7;
  const zoom = out * cam.s;
  const body = <div style={{ transform: zoom !== 1 ? `scale(${zoom})` : undefined }}><Cuerpo e={e} start={start} dark={dark} seed={seed} /></div>;
  const ent = e.entrada ?? DEFAULT_IN[e.tipo] ?? 'pop';
  if (ent === 'golpe') return <Slam start={start} x={e.x} y={e.y} rot={rot} seed={seed}>{body}</Slam>;
  if (ent === 'mano-izq' || ent === 'mano-der' || ent === 'mano-abajo') {
    return <Pop start={start} x={e.x} y={e.y} rot={rot} seed={seed} hand={ent === 'mano-izq' ? 'L' : ent === 'mano-der' ? 'R' : 'B'}>{body}</Pop>;
  }
  if (f < start) return null;
  if (ent === 'deslizar') {
    const t = easeOut(stepIn(f, start, 6));
    const dx = (1 - t) * (e.x < 540 ? -1000 : 1000);
    return <At x={e.x + dx} y={e.y} rot={rot} seed={seed}>{body}</At>;
  }
  if (ent === 'aparecer' || ent === 'escribir') return <At x={e.x} y={e.y} rot={rot} seed={seed}>{body}</At>;
  return <At x={e.x} y={e.y} rot={rot} seed={seed} scale={pop(f, start)}>{body}</At>;
};

const FACE: FaceKey[] = [[0, { pupilS: 1.05 }]];

/** The presenter, popping in on a free sheet to react; it talks with the voice. */
const Presentador: React.FC<{ i: number; p: NonNullable<EscenaLibre['presentador']> }> = ({ i, p }) => {
  const f = useCurrentFrame();
  const { ep, chunks, SC } = useEp();
  const L = useL(i);
  const pose = useMemo(() => makePose(chunks, SC), [chunks, SC]);
  const start = Math.max(ENTER, L(p.en - SC[i].t));
  const end = p.sale != null ? L(p.sale - SC[i].t) : null;
  if (f < start || (end != null && f >= end)) return null;
  const k = Math.floor((f - start) / STEP);
  const dy = [260, 40, -12, 0][k] ?? 0;
  return (
    <div style={{ position: 'absolute', left: p.x - p.w / 2, top: p.y + dy, transformOrigin: '50% 30%' }}>
      <HostDuck face={FACE} v0={ep.v0} width={p.w} pose={pose} mouth={ep.mouth} />
    </div>
  );
};

/** The camera of a sheet at a frame: a zoom around a point and a shift. */
type Cam = { s: number; fx: number; fy: number; dx: number; dy: number };
const NO_CAM: Cam = { s: 1, fx: 540, fy: 860, dx: 0, dy: 0 };
/** Slow camera moves over the whole sheet, and a punch-in on a word. */
function camara(c: EscenaLibre['camara'], f: number, dur: number, hit: number | null): Cam {
  if (!c) return NO_CAM;
  const p = Math.min(1, Math.max(0, (stepped(f) - ENTER) / Math.max(1, dur - ENTER)));
  const [fx, fy] = c.foco ?? [540, 860];
  const cam: Cam = { s: 1, fx, fy, dx: 0, dy: 0 };
  switch (c.mover) {
    case 'acercar': cam.s = 1 + 0.1 * p; break;
    case 'alejar': cam.s = 1.1 - 0.1 * p; break;
    case 'paneo-izq': cam.s = 1.06; cam.dx = 40 - 80 * p; break;
    case 'paneo-der': cam.s = 1.06; cam.dx = -40 + 80 * p; break;
    case 'subir': cam.s = 1.06; cam.dy = 40 - 80 * p; break;
    case 'bajar': cam.s = 1.06; cam.dy = -40 + 80 * p; break;
    default: break;
  }
  if (hit != null && f >= hit) {
    const k = Math.floor((f - hit) / STEP);
    cam.s *= [1.08, 1.05, 1.025, 1][k] ?? 1;
  }
  return cam;
}
const CamCtx = React.createContext<Cam>(NO_CAM);
/** Where a point of the sheet lands with the camera. */
const enCamara = (cam: Cam, x: number, y: number) => ({ x: cam.fx + (x - cam.fx) * cam.s + cam.dx, y: cam.fy + (y - cam.fy) * cam.s + cam.dy });

export const Libre: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame();
  const { ep, SC } = useEp();
  const L = useL(i);
  const esc = ep.libre?.[i];
  const look = useLookAt(i);
  const scene = SC[i];
  const dark = look ? isDark(look.hoja) : false;
  if (!esc) return null;
  const dur = scene.to - scene.from + (i === 0 ? 0 : ENTER);
  const hit = esc.camara?.golpe != null ? L(esc.camara.golpe - scene.t) : null;
  const order = esc.elementos.map((e, k) => ({ e, k }));
  return (
    <Sheet i={i} color={look ? PAL[look.hoja] : P.paper} grid={look?.cuadricula}>
      <CamCtx.Provider value={camara(esc.camara, f, dur, hit)}>
        {order.map(({ e, k }) => <Pieza key={k} e={e} i={i} k={k} dark={dark} />)}
        {esc.presentador ? <Presentador i={i} p={esc.presentador} /> : null}
      </CamCtx.Provider>
    </Sheet>
  );
};
