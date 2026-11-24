// «Ducki Noticias»: a parody newscast (scripts/fabrica/formatos/noticiero.mjs). The duck reads
// the news behind a desk, a big screen shows each story, a lower third carries the headline,
// a ticker crawls below. Opens with the show's title card and closes on the app.
import React, { useMemo } from 'react';
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { BoilDefs, Captions, EpProvider, Episode, FONTS, FPS, HostDuck, P, Ransom, STEP, Torn, easeOut, makeCtx, makePose, pop, stepIn, stepped } from './head';
import type { FaceKey } from './head';

type Pantalla = { src: string | null; tipo: string | null; w0: number | null; h0: number | null; texto: string | null };
type Seg = { t: number; titular: string; bajada: string; plano: 'presentador' | 'pantalla' | 'dividido'; urgente: boolean; pantalla: Pantalla };
type News = { segmentos: Seg[]; ticker: string[]; fin: number };

const SANS = 'Inter, "Helvetica Neue", Arial, "Liberation Sans", "DejaVu Sans", sans-serif';
const NAVY = '#0E1430', BLUE = '#1C2C78', RED = '#E5262D';
const FACE: FaceKey[] = [[0, { pupilS: 1.05 }]];

/** Where the screen and the anchor go in each shot. */
const PLANOS = {
  presentador: { screen: { x: 600, y: 330, w: 440, h: 560 }, anchor: { x: 330, y: 560, w: 640 } },
  pantalla: { screen: { x: 60, y: 260, w: 960, h: 880 }, anchor: { x: 860, y: 900, w: 330 } },
  dividido: { screen: { x: 40, y: 360, w: 520, h: 760 }, anchor: { x: 790, y: 600, w: 520 } },
} as const;

const Studio: React.FC = () => {
  const f = useCurrentFrame();
  const s = stepped(f);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 30%, ${BLUE} 0%, ${NAVY} 70%)`, overflow: 'hidden' }}>
      {[0, 1, 2, 3, 4].map((k) => (
        <div key={k} style={{ position: 'absolute', left: -400 + k * 380 + ((s * 1.5) % 380), top: -200, width: 120, height: 2600, background: 'linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,0))', transform: 'rotate(18deg)' }} />
      ))}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1180, height: 760, background: 'linear-gradient(180deg, rgba(253,166,70,.18), rgba(14,20,48,0) 60%)' }} />
    </AbsoluteFill>
  );
};

const Logo: React.FC<{ scale?: number }> = ({ scale = 1 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14 * scale, background: P.orange, padding: `${8 * scale}px ${20 * scale}px ${8 * scale}px ${10 * scale}px`, borderRadius: 14 * scale, boxShadow: '0 6px 0 rgba(0,0,0,.25)' }}>
    <Img src={staticFile('app/icon.png')} style={{ width: 64 * scale, height: 64 * scale, borderRadius: 14 * scale }} />
    <div style={{ fontFamily: FONTS.bebas, fontSize: 56 * scale, color: P.ink, letterSpacing: 3 * scale, lineHeight: 1 }}>DUCKI NOTICIAS</div>
  </div>
);

const EnVivo: React.FC = () => {
  const f = useCurrentFrame();
  const on = Math.floor(stepped(f) / 15) % 2 === 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: RED, padding: '10px 22px', borderRadius: 10, fontFamily: SANS, fontWeight: 900, fontSize: 34, color: '#fff', letterSpacing: 2 }}>
      <div style={{ width: 18, height: 18, borderRadius: 9, background: on ? '#fff' : 'rgba(255,255,255,.35)' }} />EN VIVO
    </div>
  );
};

/** The big screen: a picture, a clip, a sticker on the brand gradient, or a big figure. */
const Screen: React.FC<{ p: Pantalla; w: number; h: number; start: number }> = ({ p, w, h, start }) => {
  const inner = (() => {
    if (p.src && p.tipo === 'clip') {
      return <Sequence from={start} layout="none"><OffthreadVideo src={staticFile(p.src)} muted style={{ width: w, height: h, objectFit: 'cover', objectPosition: 'top' }} /></Sequence>;
    }
    if (p.src && p.tipo === 'imagen') return <Img src={staticFile(p.src)} style={{ width: w, height: h, objectFit: 'cover', objectPosition: 'top' }} />;
    return (
      <div style={{ width: w, height: h, background: `linear-gradient(160deg, ${P.orange}, ${P.hot} 55%, #7B4DFF)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20 }}>
        {p.src ? <Img src={staticFile(p.src)} style={{ maxWidth: w * 0.8, maxHeight: h * (p.texto ? 0.62 : 0.86), objectFit: 'contain', filter: 'drop-shadow(0 10px 0 rgba(0,0,0,.18))' }} /> : null}
        {p.texto ? <div style={{ fontFamily: FONTS.anton, fontSize: Math.min(w / Math.max(3, p.texto.length * 0.62), p.src ? 140 : 300), color: '#fff', textShadow: '0 8px 0 rgba(0,0,0,.25)', lineHeight: 1 }}>{p.texto}</div> : null}
      </div>
    );
  })();
  return (
    <div style={{ width: w, height: h, borderRadius: 26, overflow: 'hidden', border: '10px solid #0B0F22', boxShadow: '0 0 0 4px rgba(253,166,70,.6), 0 30px 60px rgba(0,0,0,.45)', position: 'relative' }}>
      {inner}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,0) 35%)' }} />
    </div>
  );
};

const LowerThird: React.FC<{ seg: Seg; start: number }> = ({ seg, start }) => {
  const f = useCurrentFrame();
  const k = easeOut(stepIn(f, start + 2, 6));
  return (
    <div style={{ position: 'absolute', left: 40, right: 40, top: 1330, transform: `translateX(${(1 - k) * -1100}px)` }}>
      {seg.urgente ? <div style={{ display: 'inline-block', background: RED, color: '#fff', fontFamily: SANS, fontWeight: 900, fontSize: 32, letterSpacing: 3, padding: '8px 18px', marginBottom: -2 }}>ÚLTIMA HORA</div> : null}
      <div style={{ background: '#fff', padding: '14px 26px', boxShadow: '0 8px 0 rgba(0,0,0,.25)' }}>
        <div style={{ fontFamily: FONTS.archivo, fontSize: 50, color: P.ink, lineHeight: 1.08, textTransform: 'uppercase' }}>{seg.titular}</div>
      </div>
      <div style={{ background: NAVY, padding: '10px 26px', borderLeft: `10px solid ${P.orange}` }}>
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 32, color: '#E9E6F2' }}>{seg.bajada}</div>
      </div>
    </div>
  );
};

const Ticker: React.FC<{ items: string[] }> = ({ items }) => {
  const f = useCurrentFrame();
  const text = items.join('   •   ') + '   •   ';
  const x = -((stepped(f) * 6) % (text.length * 19));
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1540, height: 70, background: P.orange, display: 'flex', alignItems: 'center', overflow: 'hidden', boxShadow: '0 -4px 0 rgba(0,0,0,.2)' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 2, background: P.ink, color: P.orange, fontFamily: FONTS.bebas, fontSize: 46, padding: '10px 22px', letterSpacing: 2 }}>DUCKI</div>
      <div style={{ whiteSpace: 'nowrap', fontFamily: SANS, fontWeight: 800, fontSize: 34, color: P.ink, transform: `translateX(${x + 200}px)` }}>{text}{text}</div>
    </div>
  );
};

const Desk: React.FC<{ x: number; w: number }> = ({ x, w }) => (
  <div style={{ position: 'absolute', left: x - w * 0.62, top: 1130, width: w * 1.24, height: 1920 - 1130, background: 'linear-gradient(180deg, #24346F, #121A3D)', borderTop: `8px solid ${P.orange}`, borderRadius: '30px 30px 0 0', boxShadow: '0 -10px 30px rgba(0,0,0,.35)', display: 'flex', justifyContent: 'center', paddingTop: 34 }}>
    <div style={{ fontFamily: FONTS.bebas, fontSize: 64, color: P.orange, letterSpacing: 6, opacity: 0.9 }}>DN</div>
  </div>
);

export const Noticiero: React.FC<{ episode: Episode & { noticiero?: News } }> = ({ episode }) => {
  const ctx = useMemo(() => makeCtx(episode), [episode]);
  const pose = useMemo(() => makePose(ctx.chunks, ctx.SC), [ctx]);
  const frame = useCurrentFrame();
  const news = episode.noticiero as News;
  const T = (sec: number) => Math.round((sec + episode.v0) * FPS);
  const t = stepped(frame) / FPS - episode.v0;
  const k = news.segmentos.reduce((acc, s, i) => (t >= s.t - 0.05 ? i : acc), -1);
  const seg = k >= 0 ? news.segmentos[k] : null;
  const intro = k < 0;
  const end = t >= news.fin;
  const plano = PLANOS[seg?.plano ?? 'presentador'];
  const segStart = seg ? T(seg.t) : 0;
  // a quick orange wipe between stories
  const wipe = seg && frame >= segStart - 4 && frame < segStart + 6 ? (frame - (segStart - 4)) / 10 : null;
  const finStart = T(news.fin);
  const anchor = end ? { x: 540, y: 600, w: 560 } : plano.anchor;
  return (
    <EpProvider ctx={ctx}>
      <AbsoluteFill>
        <BoilDefs />
        <Studio />
        {/* the anchor behind the desk (in front of the screen when it is the small corner) */}
        {!intro && (end || seg?.plano !== 'pantalla') ? (
          <>
            <div style={{ position: 'absolute', left: anchor.x - anchor.w / 2, top: anchor.y, transform: `scale(${pop(frame, end ? finStart : segStart)})`, transformOrigin: '50% 100%' }}>
              <HostDuck face={FACE} v0={episode.v0} width={anchor.w} pose={pose} mouth={episode.mouth} />
            </div>
            <Desk x={anchor.x} w={Math.max(anchor.w, 420)} />
          </>
        ) : null}
        {/* the screen with the story */}
        {seg && !end ? (
          <div style={{ position: 'absolute', left: plano.screen.x, top: plano.screen.y, transform: `scale(${pop(frame, segStart)})`, transformOrigin: '50% 50%' }}>
            <Screen p={seg.pantalla} w={plano.screen.w} h={plano.screen.h} start={segStart} />
          </div>
        ) : null}
        {/* the end: the app on the screen */}
        {end ? (
          <div style={{ position: 'absolute', left: 140, top: 230, transform: `scale(${pop(frame, finStart)})` }}>
            <div style={{ width: 800, height: 400, borderRadius: 26, background: `linear-gradient(160deg, ${P.orange}, ${P.hot})`, border: '10px solid #0B0F22', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, boxShadow: '0 30px 60px rgba(0,0,0,.45)' }}>
              <Img src={staticFile('app/icon.png')} style={{ width: 170, borderRadius: 40 }} />
              <div style={{ display: 'flex', gap: 18 }}>
                <Img src={staticFile('stores/app-store.svg')} style={{ height: 80 }} />
                <Img src={staticFile('stores/google-play.png')} style={{ height: 80 }} />
              </div>
            </div>
          </div>
        ) : null}
        {!intro && !end && seg?.plano === 'pantalla' ? (
          <>
            <div style={{ position: 'absolute', left: anchor.x - anchor.w / 2, top: anchor.y, transform: `scale(${pop(frame, segStart + 4)})`, transformOrigin: '50% 100%' }}>
              <HostDuck face={FACE} v0={episode.v0} width={anchor.w} pose={pose} mouth={episode.mouth} />
            </div>
            <div style={{ position: 'absolute', left: anchor.x - 190, top: 1240, width: 380, height: 1920 - 1240, background: 'linear-gradient(180deg, #24346F, #121A3D)', borderTop: `6px solid ${P.orange}`, borderRadius: '20px 20px 0 0' }} />
          </>
        ) : null}
        {seg && !end ? <LowerThird key={k} seg={seg} start={segStart} /> : null}
        {end ? <LowerThird key="fin" seg={{ t: news.fin, titular: 'DESCARGA DUCKI', bajada: 'gratis · aquí todos somos patos', plano: 'presentador', urgente: false, pantalla: { src: null, tipo: null, w0: null, h0: null, texto: null } }} start={finStart} /> : null}
        {/* the show's bugs */}
        <div style={{ position: 'absolute', left: 40, top: 120 }}><Logo scale={0.78} /></div>
        <div style={{ position: 'absolute', right: 40, top: 128 }}><EnVivo /></div>
        {!intro ? <Ticker items={news.ticker} /> : null}
        {/* the title card */}
        {intro ? (
          <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 40 }}>
            <div style={{ transform: `scale(${pop(frame, 2)}) rotate(-2deg)` }}><Logo scale={1.5} /></div>
            <div style={{ transform: `scale(${pop(frame, 10)})`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
              <div style={{ background: RED, color: '#fff', fontFamily: SANS, fontWeight: 900, fontSize: 40, letterSpacing: 4, padding: '10px 26px' }}>ÚLTIMA HORA</div>
              <Ransom text={episode.hook.title} size={Math.max(90, Math.min(150, 980 / (episode.hook.title.length * 1.0)))} seed={episode.seed} start={12} maxWidth={980} />
              <Torn color={P.cream} seed={9} pad="10px 30px"><div style={{ fontFamily: FONTS.elite, fontSize: 50, color: P.ink }}>{episode.hook.sub}</div></Torn>
            </div>
            <div style={{ position: 'absolute', left: 300, top: 1150, transform: `translateY(${(1 - easeOut(stepIn(frame, 6, 10))) * 700}px)` }}>
              <HostDuck face={FACE} v0={episode.v0} width={480} pose={pose} mouth={episode.mouth} />
            </div>
          </AbsoluteFill>
        ) : null}
        {wipe != null ? <div style={{ position: 'absolute', top: -200, bottom: -200, width: 700, left: -800 + wipe * 2700, background: P.orange, transform: 'skewX(-18deg)', boxShadow: '0 0 0 30px rgba(14,20,48,.6)' }} /> : null}
        <Captions big={false} />
      </AbsoluteFill>
    </EpProvider>
  );
};
