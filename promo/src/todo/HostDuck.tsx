// The host: a catalog duck (headphones head + default body) that talks into a
// microphone. Same face layer as prototipo-caras/: clean eyes, pupils, lids and
// a lower beak that bends open, all clipped by the head's masks. The beak follows
// the loudness of the voice (mouth.json); the expression follows the script.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { continueRender, delayRender, staticFile, useCurrentFrame } from 'remotion';
import FACE from './face.json';
import MOUTH from './mouth.json';
import { rnd, stepped } from './paper';

const HW = 495, HH = 446, BODY_H = 529;
export const DUCK_W = HW, DUCK_H = HH + BODY_H;
const HEAD = (FACE.heads as Array<{ id: string; skin: number[]; offset: number[]; gender: string }>).find((h) => h.id === 'audifonos')!;

export type Face = {
  lookX: number; lookY: number; pupilS: number; heart: number; lidL: number; lidR: number;
  tilt: number; lower: number; beak: number; blush: number;
};
const REST: Face = { lookX: 0, lookY: 0, pupilS: 1, heart: 0, lidL: 0, lidR: 0, tilt: 0, lower: 0, beak: 0, blush: 0 };
export type FaceKey = [number, Partial<Face>];
export type Pose = { tilt: number; nod: number };
const PIVOT = [247, 446];

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
/** Face at time t (s): every channel eases between the keys that set it; heart is held. */
export function faceAt(keys: FaceKey[], t: number): Face {
  const out = { ...REST };
  for (const name of Object.keys(REST) as (keyof Face)[]) {
    const ks = keys.filter(([, v]) => v[name] !== undefined) as [number, Partial<Face>][];
    if (!ks.length) continue;
    // a key at t0 means: from t0, move to this value in 0.22 s (the heart pupils switch at once)
    let v = REST[name];
    for (const [t0, a] of ks) {
      if (t < t0) break;
      const target = a[name] as number;
      const k = name === 'heart' ? 1 : Math.min(1, (t - t0) / 0.22);
      v = v + (target - v) * ease(k);
    }
    out[name] = v;
  }
  return out;
}

// blinks: every 2.2–4.2 s, 0.2 s long
const BLINKS: number[] = [];
for (let t = 1.2, i = 0; t < 70; i++) { BLINKS.push(t); t += 2.2 + rnd(i * 3.7) * 2; }
function blinkAt(t: number) {
  for (const b of BLINKS) {
    const d = t - b;
    if (d >= 0 && d < 0.2) return d < 0.07 ? d / 0.07 : d < 0.1 ? 1 : 1 - (d - 0.1) / 0.1;
  }
  return 0;
}

type Imgs = Record<'head' | 'body' | 'eyes' | 'jaw' | 'mouth' | 'mEyes' | 'mBeak', HTMLImageElement>;
let cache: Promise<Imgs> | null = null;
function loadAll(): Promise<Imgs> {
  if (cache) return cache;
  const files = { head: 'head_audifonos.png', body: 'body.png', eyes: 'eyes_clean.png', jaw: 'jaw.png', mouth: 'mouth.png', mEyes: 'mask_eyes_audifonos.png', mBeak: 'mask_beak_audifonos.png' };
  cache = Promise.all(Object.entries(files).map(([k, f]) => new Promise<[string, HTMLImageElement]>((res, rej) => {
    const i = new Image(); i.onload = () => res([k, i]); i.onerror = rej; i.src = staticFile(`todo/duck/${f}`);
  }))).then((xs) => Object.fromEntries(xs) as Imgs);
  return cache;
}

function heart(c: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  c.save(); c.translate(x, y); c.scale(s / 16, s / 16); c.fillStyle = color; c.strokeStyle = '#111014'; c.lineWidth = 2.6;
  c.beginPath(); c.moveTo(0, 6); c.bezierCurveTo(-16, -4, -9, -16, 0, -8); c.bezierCurveTo(9, -16, 16, -4, 0, 6); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(-5, -7, 2.4, 0, Math.PI * 2); c.fill(); c.restore();
}

function drawDuck(cv: HTMLCanvasElement, L: { eye: HTMLCanvasElement; beak: HTMLCanvasElement }, im: Imgs, v: Face, mic: boolean, round: number, pose: Pose) {
  const c = cv.getContext('2d')!;
  const [ox, oy] = HEAD.offset;
  c.clearRect(0, 0, cv.width, cv.height);
  c.drawImage(im.body, 0, HH);
  // the head tilts and nods on the neck; a stretched copy of its last rows fills the seam
  c.save();
  c.translate(PIVOT[0], PIVOT[1] + pose.nod); c.rotate((pose.tilt * Math.PI) / 180); c.translate(-PIVOT[0], -PIVOT[1]);
  c.drawImage(im.head, 0, HH - 14, HW, 14, 0, HH - 14, HW, 44);
  c.drawImage(im.head, 0, 0);
  // beak
  if (v.beak > 0.01) {
    const b = L.beak.getContext('2d')!, J = FACE.jaw;
    b.globalCompositeOperation = 'source-over'; b.clearRect(0, 0, HW, HH);
    b.drawImage(im.mouth, ox, oy);
    const half = (J.right - J.left) / 2;
    for (let x = J.left - 3; x <= J.right + 3; x += 2) {
      // wide vowels open the whole beak, round ones (o, u) only the middle
      const t = Math.min(Math.abs(x - J.cx) / half, 1), w = Math.pow(1 - t * t, 0.9 + round * 2.6);
      b.drawImage(im.jaw, x, 0, 2, HH, x + ox, oy + v.beak * J.openMax * w, 2, HH);
    }
    b.globalCompositeOperation = 'destination-in'; b.drawImage(im.mBeak, 0, 0); b.globalCompositeOperation = 'source-over';
    c.drawImage(L.beak, 0, 0);
  }
  // eyes
  const e = L.eye.getContext('2d')!;
  e.globalCompositeOperation = 'source-over'; e.clearRect(0, 0, HW, HH);
  e.drawImage(im.eyes, ox, oy);
  const skin = `rgb(${HEAD.skin.join(',')})`;
  // one offset for both pupils, clamped by whichever eye runs out of room first,
  // so the eyes always move together
  const E2 = [FACE.eyes.r, FACE.eyes.l];
  const rxM = Math.min(...E2.map((g) => (g.right - g.left) / 2)), ryM = Math.min(...E2.map((g) => (g.bottom - g.top) / 2));
  const dxLo = Math.max(...E2.map((g) => g.left + g.pupil.rx + 6 - g.pupil.x)), dxHi = Math.min(...E2.map((g) => g.right - g.pupil.rx - 6 - g.pupil.x));
  const dyLo = Math.max(...E2.map((g) => g.top + g.pupil.ry + 6 - g.pupil.y)), dyHi = Math.min(...E2.map((g) => g.bottom - g.pupil.ry - 6 - g.pupil.y));
  const dx = Math.max(dxLo, Math.min(dxHi, v.lookX * rxM * 0.48)), dy = Math.max(dyLo, Math.min(dyHi, v.lookY * ryM * 0.42));
  for (const side of ['r', 'l'] as const) {
    const g = FACE.eyes[side], Pp = g.pupil;
    const px = Pp.x + dx + ox, py = Pp.y + dy + oy;
    if (v.heart > 0.5) heart(e, px, py, 23 * v.pupilS, '#e8344e');
    else {
      e.fillStyle = '#0b0b0f'; e.beginPath(); e.ellipse(px, py, Pp.rx * v.pupilS, Pp.ry * v.pupilS, 0, 0, Math.PI * 2); e.fill();
      e.fillStyle = '#fff'; e.beginPath(); e.arc(px + 2 * v.pupilS, py - Pp.ry * 0.45 * v.pupilS, 3.4 * v.pupilS, 0, Math.PI * 2); e.fill();
    }
    const lid = side === 'l' ? v.lidL : v.lidR;
    const inner = side === 'r' ? 1 : -1;
    const top = g.top + oy - 4, H_ = g.bottom - g.top + 8, bottom = g.bottom + oy + 4;
    const uOf = (x: number) => ((x - (g.left + ox)) / (g.right - g.left)) * 2 - 1;
    const closeY = (x: number) => { const u = uOf(x); return top + 0.6 * H_ + (1 - u * u) * 7; };
    const shut = lid > 0.45 ? ease((lid - 0.45) / 0.55) : 0;
    const x0 = g.left + ox - 8, x1 = g.right + ox + 8;
    const path = (fn: (x: number) => number) => { for (let x = x0, f = true; x <= x1; x += 3, f = false) f ? e.moveTo(x, fn(x)) : e.lineTo(x, fn(x)); };
    if (shut > 0.001) {
      e.fillStyle = skin; e.beginPath(); e.moveTo(x0, bottom + 20); path((x) => bottom + (closeY(x) - bottom) * shut + 1); e.lineTo(x1, bottom + 20); e.closePath(); e.fill();
    }
    if (lid > 0.005 || Math.abs(v.tilt) > 0.01) {
      const edge = (x: number) => { const u = uOf(x), inn = (u * inner + 1) / 2; return top + (closeY(x) - top) * lid + v.tilt * (inn - 0.35) * H_ * 0.42 * Math.max(lid, 0.35) * (1 - shut); };
      e.fillStyle = skin; e.beginPath(); e.moveTo(x0, top - 20); for (let x = x0; x <= x1; x += 3) e.lineTo(x, edge(x)); e.lineTo(x1, top - 20); e.closePath(); e.fill();
      e.strokeStyle = '#111014'; e.lineWidth = 5; e.lineCap = 'round'; e.beginPath(); path(edge); e.stroke();
    }
    if (v.lower > 0.01 && shut < 0.95) {
      const edge = (x: number) => { const u = uOf(x); return bottom - v.lower * H_ * (0.32 + 0.3 * (1 - u * u)); };
      e.fillStyle = skin; e.beginPath(); e.moveTo(x0, bottom + 20); for (let x = x0; x <= x1; x += 3) e.lineTo(x, edge(x)); e.lineTo(x1, bottom + 20); e.closePath(); e.fill();
      e.strokeStyle = '#111014'; e.lineWidth = 5; e.beginPath(); path(edge); e.stroke();
    }
  }
  e.globalCompositeOperation = 'destination-in'; e.drawImage(im.mEyes, 0, 0); e.globalCompositeOperation = 'source-over';
  c.drawImage(L.eye, 0, 0);
  // blush
  if (v.blush > 0.01) {
    c.save(); c.globalAlpha = 0.45 * v.blush; c.fillStyle = '#ff7a9a';
    const R = FACE.eyes.r, Lq = FACE.eyes.l;
    for (const [x, y] of [[R.left + 8, R.bottom - 6], [Lq.right - 8, Lq.bottom - 6]]) { c.beginPath(); c.ellipse(x + ox, y + oy, 28, 13, 0, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }
  c.restore();
  if (mic) drawMic(c);
}

/** Hand-held microphone in the duck's right wing (image right). */
function drawMic(c: CanvasRenderingContext2D) {
  c.save();
  c.lineJoin = 'round'; c.lineCap = 'round';
  // handle
  c.save(); c.translate(352, 560); c.rotate(-0.42);
  c.fillStyle = '#26222e'; c.strokeStyle = '#0d0b10'; c.lineWidth = 6;
  c.beginPath(); c.moveTo(-17, -70); c.lineTo(17, -70); c.lineTo(11, 78); c.lineTo(-11, 78); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#FF8A1F'; c.fillRect(-16, -50, 32, 22); c.strokeRect(-16, -50, 32, 22);
  c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-9, -20, 5, 80);
  // grille
  c.fillStyle = '#5b5866'; c.beginPath(); c.arc(0, -98, 38, 0, Math.PI * 2); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(20,18,26,.55)'; c.lineWidth = 2.5;
  for (let k = -30; k <= 30; k += 10) { c.beginPath(); c.moveTo(k, -98 - Math.sqrt(38 * 38 - k * k)); c.lineTo(k, -98 + Math.sqrt(38 * 38 - k * k)); c.stroke(); }
  for (let k = -30; k <= 30; k += 10) { c.beginPath(); c.moveTo(-Math.sqrt(38 * 38 - k * k), -98 + k); c.lineTo(Math.sqrt(38 * 38 - k * k), -98 + k); c.stroke(); }
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(-13, -112, 7, 0, Math.PI * 2); c.fill();
  c.restore();
  // wing wrapped around the handle
  c.fillStyle = '#ffffff'; c.strokeStyle = '#111014'; c.lineWidth = 7;
  c.beginPath();
  c.moveTo(398, 700); c.bezierCurveTo(430, 650, 420, 600, 392, 575); c.bezierCurveTo(372, 560, 340, 566, 338, 588);
  c.bezierCurveTo(336, 606, 356, 612, 366, 606); c.bezierCurveTo(352, 628, 352, 660, 372, 690); c.closePath();
  c.fill(); c.stroke();
  c.strokeStyle = 'rgba(17,16,20,.5)'; c.lineWidth = 4;
  c.beginPath(); c.moveTo(356, 592); c.quadraticCurveTo(372, 588, 384, 598); c.stroke();
  c.restore();
}

export type Mouth = { fps: number; open: number[]; round: number[] };
export const HostDuck: React.FC<{ face: FaceKey[]; v0: number; width: number; mic?: boolean; talkGain?: number; pose?: (t: number) => Pose; mouth?: Mouth }> = ({ face, v0, width, mic = true, talkGain = 1, pose, mouth = MOUTH }) => {
  const frame = useCurrentFrame();
  const f = stepped(frame);
  const ref = useRef<HTMLCanvasElement>(null);
  const layers = useRef<{ eye: HTMLCanvasElement; beak: HTMLCanvasElement } | null>(null);
  const [imgs, setImgs] = useState<Imgs | null>(null);
  const [handle] = useState(() => delayRender('host duck'));
  useEffect(() => { loadAll().then((x) => { setImgs(x); continueRender(handle); }); }, [handle]);
  useLayoutEffect(() => {
    if (!imgs || !ref.current) return;
    if (!layers.current) {
      const mk = () => { const x = document.createElement('canvas'); x.width = HW; x.height = HH; return x; };
      layers.current = { eye: mk(), beak: mk() };
    }
    const t = f / 30 - v0;
    const v = faceAt(face, t);
    const mi = Math.round(t * mouth.fps);
    const talk = mi >= 0 && mi < mouth.open.length ? mouth.open[mi] : 0;
    const round = mi >= 0 && mi < mouth.round.length ? mouth.round[mi] : 0;
    v.beak = Math.min(1, v.beak + talk * talkGain);
    const b = blinkAt(t);
    if (b > 0 && v.heart < 0.5 && v.lower < 0.5) { v.lidL = Math.max(v.lidL, b); v.lidR = Math.max(v.lidR, b); }
    drawDuck(ref.current, layers.current, imgs, v, mic, round, pose ? pose(t) : { tilt: 0, nod: 0 });
  }, [imgs, f, face, v0, mic, talkGain, pose, mouth]);
  const o = 9;
  return (
    <canvas
      ref={ref}
      width={DUCK_W}
      height={DUCK_H}
      style={{
        width, height: (width * DUCK_H) / DUCK_W, display: 'block',
        filter: `drop-shadow(${o}px 0 0 #fff) drop-shadow(-${o}px 0 0 #fff) drop-shadow(0 ${o}px 0 #fff) drop-shadow(0 -${o}px 0 #fff) drop-shadow(10px 14px 0 rgba(0,0,0,.25))`,
      }}
    />
  );
};
