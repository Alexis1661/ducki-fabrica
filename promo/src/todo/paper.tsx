// Scrapbook kit for «9 cosas que puedes hacer en Ducki»: paper, torn strips,
// tape, cut-out stickers, ransom-note letters and hand-drawn doodles that "boil".
// Everything moves in stop-motion: drawings are held for STEP frames.
import React from 'react';
import { AbsoluteFill, Img, continueRender, delayRender, staticFile, useCurrentFrame } from 'remotion';
import FUENTES from './fuentes.json';

// The kit's Google Fonts, served from public/fuentes/ (scripts/fabrica/fuentes.mjs
// downloads them once): a render never waits on the network for a font.
function localFont(family: string): string {
  if (typeof window !== 'undefined' && typeof FontFace !== 'undefined') {
    for (const f of (FUENTES as Record<string, { file: string; unicodeRange?: string }[]>)[family] ?? []) {
      const handle = delayRender(`font ${family}`);
      new FontFace(family, `url(${staticFile(f.file)}) format('woff2')`, { display: 'block', unicodeRange: f.unicodeRange })
        .load()
        .then((face) => { document.fonts.add(face); continueRender(handle); })
        .catch((err) => { console.error(`no cargó ${f.file}`, err); continueRender(handle); });
    }
  }
  return `"${family}"`;
}

export const FONTS = {
  abril: localFont('Abril Fatface'),
  anton: localFont('Anton'),
  archivo: localFont('Archivo Black'),
  bebas: localFont('Bebas Neue'),
  elite: localFont('Special Elite'),
  marker: localFont('Permanent Marker'),
  shrikhand: localFont('Shrikhand'),
  gloock: localFont('Gloock'),
  rubik: localFont('Rubik Mono One'),
  caveat: localFont('Caveat Brush'),
};

export const P = {
  ink: '#16131D',
  paper: '#F4EFE6',
  cream: '#FFF8EA',
  kraft: '#D7B488',
  orange: '#FDA646',
  hot: '#FF7A1A',
  cobalt: '#2846F0',
  lime: '#C8F046',
  pink: '#FF8FBA',
  red: '#F0373C',
  green: '#2F6B36',
  night: '#1B1726',
  white: '#FFFFFF',
};

/** Frames each drawing is held: 2 = 15 drawings per second at 30 fps. */
export const STEP = 2;
export const stepped = (f: number, step = STEP) => f - (((f % step) + step) % step);
export const useStep = (step = STEP) => stepped(useCurrentFrame(), step);

/** Deterministic pseudo-random in [0, 1). */
export function rnd(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
/** Small stop-motion wobble: changes every `every` frames. */
export function wobble(seed: number, frame: number, amp = 1, every = 4) {
  const k = Math.floor(frame / every);
  return {
    x: (rnd(seed * 3.1 + k) - 0.5) * 2 * amp,
    y: (rnd(seed * 5.7 + k * 1.3) - 0.5) * 2 * amp,
    r: (rnd(seed * 7.3 + k * 0.7) - 0.5) * 2 * amp * 0.35,
  };
}

/** Stop-motion pop: four held drawings that overshoot, from `start` (frames). */
export function pop(frame: number, start: number) {
  const k = Math.floor((frame - start) / STEP);
  if (k < 0) return 0;
  return [0.35, 1.18, 0.94, 1.04][k] ?? 1;
}
/** 0→1 over `dur` frames, in held drawings. */
export function stepIn(frame: number, start: number, dur: number) {
  const f = stepped(frame - start);
  return Math.max(0, Math.min(1, f / dur));
}
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** The SVG filters that make lines and edges boil (roughen + turbulent displace). */
export const BoilDefs: React.FC = () => {
  const f = useCurrentFrame();
  const seed = Math.floor(f / 3);
  return (
    <svg width={0} height={0} style={{ position: 'absolute' }}>
      <defs>
        <filter id="boil" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={seed} />
          <feDisplacementMap in="SourceGraphic" scale={5} />
        </filter>
        <filter id="boil2" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves={2} seed={seed + 50} />
          <feDisplacementMap in="SourceGraphic" scale={9} />
        </filter>
        <filter id="edge" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves={3} seed={seed % 3} />
          <feDisplacementMap in="SourceGraphic" scale={6} />
        </filter>
      </defs>
    </svg>
  );
};

/** A full sheet of coloured paper with grain. */
export const Paper: React.FC<{ color: string; grid?: boolean; children?: React.ReactNode }> = ({ color, grid, children }) => (
  <AbsoluteFill style={{ background: color, overflow: 'hidden' }}>
    {grid ? (
      <AbsoluteFill
        style={{
          backgroundImage: 'linear-gradient(rgba(40,70,240,.16) 2px, transparent 2px), linear-gradient(90deg, rgba(40,70,240,.16) 2px, transparent 2px)',
          backgroundSize: '64px 64px',
        }}
      />
    ) : null}
    {children}
    <Img src={staticFile('todo/paper.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: 'multiply', opacity: 0.55 }} />
  </AbsoluteFill>
);

/** Jagged polygon for torn paper, as a CSS clip-path. */
export function tornPath(seed: number, tooth = 9, sides = { t: true, r: true, b: true, l: true }) {
  const pts: string[] = [];
  const n = 26;
  const j = (k: number) => (rnd(seed + k * 1.37) * tooth).toFixed(1);
  for (let i = 0; i <= n; i++) pts.push(`${(i / n) * 100}% ${sides.t ? j(i) : 0}px`);
  for (let i = 1; i <= n; i++) pts.push(`calc(100% - ${sides.r ? j(i + 40) : 0}px) ${(i / n) * 100}%`);
  for (let i = n - 1; i >= 0; i--) pts.push(`${(i / n) * 100}% calc(100% - ${sides.b ? j(i + 80) : 0}px)`);
  for (let i = n - 1; i >= 1; i--) pts.push(`${sides.l ? j(i + 120) : 0}px ${(i / n) * 100}%`);
  return `polygon(${pts.join(',')})`;
}

type Box = { x: number; y: number; rot?: number; scale?: number; style?: React.CSSProperties; children?: React.ReactNode };

/** Positions a piece by its centre, with the stop-motion wobble. */
export const At: React.FC<Box & { seed?: number; wob?: number }> = ({ x, y, rot = 0, scale = 1, seed = 1, wob = 1, style, children }) => {
  const f = useCurrentFrame();
  const w = wobble(seed, f, wob);
  return (
    <div
      style={{
        position: 'absolute', left: x + w.x, top: y + w.y, width: 'max-content',
        transform: `translate(-50%, -50%) rotate(${rot + w.r}deg) scale(${scale})`, ...style,
      }}
    >
      {children}
    </div>
  );
};

/** A torn strip of paper holding text or anything else. */
export const Torn: React.FC<{ color?: string; seed?: number; pad?: string; style?: React.CSSProperties; children?: React.ReactNode }> = ({ color = P.cream, seed = 3, pad = '18px 34px', style, children }) => (
  <div style={{ filter: 'drop-shadow(5px 7px 0 rgba(0,0,0,.22))' }}>
    <div style={{ background: color, padding: pad, clipPath: tornPath(seed), ...style }}>{children}</div>
  </div>
);

/** Masking tape. */
export const Tape: React.FC<{ w?: number; color?: string; seed?: number }> = ({ w = 170, color = 'rgba(236,222,180,.86)', seed = 9 }) => (
  <div
    style={{
      width: w, height: 46, background: color,
      clipPath: tornPath(seed, 7, { t: false, r: true, b: false, l: true }),
      boxShadow: 'inset 0 0 12px rgba(120,100,60,.25)',
    }}
  />
);

/** A cut-out sticker: the image with a thick white outline and a hard shadow. */
export const Sticker: React.FC<{ src: string; w: number; outline?: number; shadow?: boolean; style?: React.CSSProperties }> = ({ src, w, outline = 9, shadow = true, style }) => {
  const o = outline;
  const ds = [
    `drop-shadow(${o}px 0 0 #fff)`, `drop-shadow(-${o}px 0 0 #fff)`, `drop-shadow(0 ${o}px 0 #fff)`, `drop-shadow(0 -${o}px 0 #fff)`,
    shadow ? 'drop-shadow(7px 10px 0 rgba(0,0,0,.25))' : '',
  ].join(' ');
  return <Img src={src.startsWith('http') ? src : staticFile(src)} style={{ width: w, display: 'block', filter: ds, ...style }} />;
};

/** A printed photo (polaroid by default) with grain over the picture. */
export const Print: React.FC<{ w: number; h: number; children: React.ReactNode; border?: number; bottom?: number; caption?: string; tint?: boolean }> = ({ w, h, children, border = 18, bottom, caption, tint = true }) => (
  <div style={{ background: '#FBFAF6', padding: border, paddingBottom: bottom ?? border, boxShadow: '8px 12px 0 rgba(0,0,0,.22)', width: w + border * 2 }}>
    <div style={{ width: w, height: h, overflow: 'hidden', position: 'relative', background: '#222' }}>
      {children}
      {tint ? <Img src={staticFile('todo/paper.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: 'multiply', opacity: 0.35 }} /> : null}
    </div>
    {caption ? <div style={{ fontFamily: FONTS.caveat, fontSize: 46, color: P.ink, textAlign: 'center', marginTop: 6 }}>{caption}</div> : null}
  </div>
);

const RANSOM_FONTS = ['abril', 'anton', 'archivo', 'bebas', 'shrikhand', 'gloock', 'rubik', 'elite'] as const;
const RANSOM_BG = [P.cream, P.ink, P.lime, P.white, P.orange, P.cobalt, P.pink, '#EDE3CF'];

/** Ransom-note letters, each cut from a different magazine; they land one per drawing. */
export const Ransom: React.FC<{ text: string; size?: number; seed?: number; start?: number; palette?: string[]; gap?: number; maxWidth?: number }> = ({ text, size = 120, seed = 1, start = 0, palette = RANSOM_BG, gap = 6, maxWidth = 940 }) => {
  const f = useCurrentFrame();
  const words = text.split(' ');
  let idx = 0;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', columnGap: size * 0.3, rowGap: gap * 2, width: 'max-content', maxWidth }}>
      {words.map((word, wi) => (
        <div key={wi} style={{ display: 'flex', gap, alignItems: 'center' }}>
          {[...word].map((ch) => {
            const i = idx++;
            const s = seed * 31 + i * 7;
            const font = FONTS[RANSOM_FONTS[Math.floor(rnd(s) * RANSOM_FONTS.length)]];
            const bg = palette[Math.floor(rnd(s + 1) * palette.length)];
            const dark = bg === P.ink || bg === P.cobalt;
            const fg = dark ? (rnd(s + 2) > 0.5 ? P.white : P.lime) : rnd(s + 2) > 0.75 ? P.red : P.ink;
            const sc = pop(f, start + i * STEP);
            const w = wobble(s, f, 1.2, 6);
            return (
              <div
                key={i}
                style={{
                  background: bg, color: fg, fontFamily: font, fontSize: size * (0.82 + rnd(s + 3) * 0.3), lineHeight: 1,
                  padding: `${size * 0.08}px ${size * 0.1}px`, transform: `rotate(${(rnd(s + 4) - 0.5) * 16 + w.r}deg) scale(${sc}) translateY(${(rnd(s + 5) - 0.5) * size * 0.16}px)`,
                  clipPath: tornPath(s, 4), boxShadow: '4px 6px 0 rgba(0,0,0,.2)', textTransform: rnd(s + 6) > 0.3 ? 'uppercase' : 'none',
                }}
              >
                {ch}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export const Doodle: React.FC<{ d: string; w: number; h: number; color?: string; stroke?: number; start?: number; dur?: number; strong?: boolean; fill?: string }> = ({ d, w, h, color = P.lime, stroke = 10, start = 0, dur = 8, strong, fill = 'none' }) => {
  const f = useCurrentFrame();
  const t = stepIn(f, start, dur);
  if (f < start) return null;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible', filter: `url(#${strong ? 'boil2' : 'boil'})` }}>
      <path d={d} fill={fill} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} />
    </svg>
  );
};

/** Handwriting that boils. */
export const Hand: React.FC<{ children: React.ReactNode; size?: number; color?: string; font?: 'marker' | 'caveat'; style?: React.CSSProperties }> = ({ children, size = 60, color = P.ink, font = 'marker', style }) => (
  <div style={{ fontFamily: FONTS[font], fontSize: size, color, lineHeight: 1.05, filter: 'url(#boil)', whiteSpace: 'nowrap', ...style }}>{children}</div>
);

// Hand-drawn shapes, in their own boxes
export const SCRIBBLE_CIRCLE = (w: number, h: number) =>
  `M ${w * 0.55} ${h * 0.06} C ${w * 0.95} ${h * 0.02}, ${w * 1.02} ${h * 0.7}, ${w * 0.6} ${h * 0.95} C ${w * 0.2} ${h * 1.05}, ${-w * 0.04} ${h * 0.55}, ${w * 0.1} ${h * 0.25} C ${w * 0.22} ${h * 0.02}, ${w * 0.62} ${-h * 0.02}, ${w * 0.85} ${h * 0.14}`;
export const ARROW = (w: number, h: number) =>
  `M ${w * 0.05} ${h * 0.9} C ${w * 0.3} ${h * 0.4}, ${w * 0.6} ${h * 0.25}, ${w * 0.92} ${h * 0.12} M ${w * 0.7} ${h * 0.04} L ${w * 0.93} ${h * 0.11} L ${w * 0.8} ${h * 0.33}`;
export const STAR = (w: number) => {
  const c = w / 2, R = w * 0.48, r = w * 0.2;
  return Array.from({ length: 11 }, (_, i) => {
    const a = (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 ? r : R;
    return `${i ? 'L' : 'M'} ${c + Math.cos(a) * rr} ${c + Math.sin(a) * rr}`;
  }).join(' ');
};
export const HEART = (w: number) =>
  `M ${w / 2} ${w * 0.88} C ${-w * 0.25} ${w * 0.4}, ${w * 0.18} ${-w * 0.12}, ${w / 2} ${w * 0.26} C ${w * 0.82} ${-w * 0.12}, ${w * 1.25} ${w * 0.4}, ${w / 2} ${w * 0.88}`;
export const SQUIGGLE = (w: number, h: number) => {
  let d = `M 0 ${h / 2}`;
  for (let i = 1; i <= 8; i++) d += ` Q ${(i - 0.5) * (w / 8)} ${i % 2 ? 0 : h} ${i * (w / 8)} ${h / 2}`;
  return d;
};
export const BURST = (w: number) => {
  const c = w / 2;
  return Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return `M ${c + Math.cos(a) * w * 0.28} ${c + Math.sin(a) * w * 0.28} L ${c + Math.cos(a) * w * 0.48} ${c + Math.sin(a) * w * 0.48}`;
  }).join(' ');
};
