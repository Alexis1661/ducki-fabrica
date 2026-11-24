// «Historia en chat»: a chat conversation that moves on while the duck narrates it
// (scripts/fabrica/formatos/chat.mjs). Messages pop in on their moment, the contact types
// before answering, the list scrolls as it grows; a hook card opens it and an end card closes.
import React, { useMemo } from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import {
  BoilDefs, Captions, EpProvider, Episode, FONTS, FPS, HostDuck, P, Paper, Ransom, STEP, Tape, Torn, makeCtx, makePose, pop, stepped,
} from './head';
import type { FaceKey } from './head';

type Msg = { de: 'yo' | 'otro' | 'sistema'; tipo: 'texto' | 'sticker' | 'foto'; texto: string | null; src: string | null; w0: number | null; h0: number | null; en: number };
type ChatData = { contacto: { nombre: string; avatar: string }; tema: 'claro' | 'oscuro' | 'papel'; burbuja: string; lineas: { t: number; t1: number; mensajes: Msg[] }[]; fin: number };

const SANS = 'Inter, "Helvetica Neue", Arial, "Liberation Sans", "DejaVu Sans", sans-serif';
const BUBBLE: Record<string, [string, string]> = { naranja: [P.orange, P.ink], lima: [P.lime, P.ink], rosa: [P.pink, P.ink], cobalto: [P.cobalt, P.white] };
const TOP = 290, BOTTOM = 1510, MAXW = 840, FS = 54, GAP = 24;

/** Rough size of a message, for the layout and the scroll. */
function size(m: Msg) {
  if (m.tipo === 'sticker') return { w: 340, h: Math.min(420, 340 * ((m.h0 ?? 1) / (m.w0 ?? 1))) };
  if (m.tipo === 'foto') { const w = 520; return { w, h: Math.min(640, w * ((m.h0 ?? 1) / (m.w0 ?? 1))) }; }
  if (m.de === 'sistema') return { w: 0, h: 74 };
  const len = [...(m.texto ?? '')].length;
  const perLine = Math.floor((MAXW - 76) / (FS * 0.53));
  const lines = Math.max(1, Math.ceil(len / perLine));
  return { w: Math.min(MAXW, len * FS * 0.53 + 76), h: lines * FS * 1.27 + 44 };
}

const Bubble: React.FC<{ m: Msg; theme: ChatData['tema']; burbuja: string }> = ({ m, theme, burbuja }) => {
  const dark = theme === 'oscuro';
  if (m.de === 'sistema') {
    return <div style={{ fontFamily: SANS, fontSize: 34, color: dark ? '#cfc7da' : '#6b6273', background: dark ? 'rgba(255,255,255,.08)' : 'rgba(22,19,29,.07)', padding: '10px 22px', borderRadius: 24 }}>{m.texto}</div>;
  }
  if (m.tipo === 'sticker' && m.src) {
    const { w } = size(m);
    return <Img src={staticFile(m.src)} style={{ width: w, display: 'block', filter: 'drop-shadow(5px 0 0 #fff) drop-shadow(-5px 0 0 #fff) drop-shadow(0 5px 0 #fff) drop-shadow(0 -5px 0 #fff) drop-shadow(5px 8px 0 rgba(0,0,0,.18))' }} />;
  }
  if (m.tipo === 'foto' && m.src) {
    const { w, h } = size(m);
    return <div style={{ width: w, height: h, borderRadius: 28, overflow: 'hidden', border: `8px solid ${dark ? '#2A2433' : '#fff'}`, boxShadow: '0 6px 14px rgba(0,0,0,.18)' }}><Img src={staticFile(m.src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} /></div>;
  }
  const mine = m.de === 'yo';
  const [bg, fg] = mine ? BUBBLE[burbuja] ?? BUBBLE.naranja : dark ? ['#2A2433', '#F4EFE6'] : ['#FFFFFF', P.ink];
  return (
    <div style={{ maxWidth: MAXW, background: bg, color: fg, fontFamily: SANS, fontSize: FS, fontWeight: 600, lineHeight: 1.27, padding: '22px 38px', borderRadius: 44, [mine ? 'borderBottomRightRadius' : 'borderBottomLeftRadius']: 10, boxShadow: '0 4px 10px rgba(0,0,0,.12)', width: 'max-content' }}>
      {m.texto}
      {mine ? <span style={{ fontSize: 26, marginLeft: 14, opacity: 0.7 }}>✓✓</span> : null}
    </div>
  );
};

const Typing: React.FC<{ theme: ChatData['tema'] }> = ({ theme }) => {
  const f = useCurrentFrame();
  const k = Math.floor(stepped(f) / (STEP * 3)) % 3;
  return (
    <div style={{ background: theme === 'oscuro' ? '#2A2433' : '#fff', borderRadius: 38, borderBottomLeftRadius: 10, padding: '26px 30px', display: 'flex', gap: 12, boxShadow: '0 4px 10px rgba(0,0,0,.12)' }}>
      {[0, 1, 2].map((d) => <div key={d} style={{ width: 18, height: 18, borderRadius: 9, background: theme === 'oscuro' ? '#cfc7da' : '#9a92a3', transform: `translateY(${d === k ? -8 : 0}px)` }} />)}
    </div>
  );
};

const FACE: FaceKey[] = [[0, { pupilS: 1.05 }]];

export const Chat: React.FC<{ episode: Episode & { chat?: ChatData } }> = ({ episode }) => {
  const ctx = useMemo(() => makeCtx(episode), [episode]);
  const pose = useMemo(() => makePose(ctx.chunks, ctx.SC), [ctx]);
  const frame = useCurrentFrame();
  const chat = episode.chat as ChatData;
  const t = stepped(frame) / FPS - episode.v0;
  const theme = chat.tema;
  const bg = theme === 'oscuro' ? '#141019' : theme === 'papel' ? P.kraft : '#EFE7DA';
  const msgs = chat.lineas.flatMap((l) => l.mensajes);
  // what is on screen now: the messages already sent, and the contact typing the next one
  const shown = msgs.filter((m) => t >= m.en);
  const next = msgs.find((m) => t < m.en);
  const typing = next && next.de === 'otro' && t >= next.en - 0.9;
  const total = shown.reduce((a, m) => a + size(m).h + GAP, 0) + (typing ? 90 + GAP : 0);
  const scroll = Math.max(0, total - (BOTTOM - TOP));
  let y = TOP - scroll;
  const hookOut = chat.lineas[0] ? Math.min(2.4, chat.lineas[0].t1) : 2.4;
  const finFrame = Math.round((chat.fin + episode.v0) * FPS);
  const end = frame >= finFrame;
  const endK = end ? Math.min(1, (stepped(frame) - finFrame) / 8) : 0;
  return (
    <EpProvider ctx={ctx}>
      <AbsoluteFill style={{ background: bg }}>
        <BoilDefs />
        {theme === 'papel' ? <AbsoluteFill style={{ opacity: 0.5 }}><Paper color={P.kraft} /></AbsoluteFill> : null}
        {/* the chat bar */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 240, background: theme === 'oscuro' ? '#1E1826' : '#FFFFFF', boxShadow: '0 4px 16px rgba(0,0,0,.12)', display: 'flex', alignItems: 'center', gap: 26, padding: '60px 40px 0' }}>
          <div style={{ fontFamily: SANS, fontSize: 64, color: theme === 'oscuro' ? '#F4EFE6' : P.ink, marginRight: 4 }}>‹</div>
          <div style={{ width: 118, height: 118, borderRadius: 59, background: P.orange, overflow: 'hidden', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', border: '5px solid #fff' }}>
            <Img src={staticFile(chat.contacto.avatar)} style={{ width: 130, marginBottom: -30 }} />
          </div>
          <div>
            <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 52, color: theme === 'oscuro' ? '#F4EFE6' : P.ink }}>{chat.contacto.nombre}</div>
            <div style={{ fontFamily: SANS, fontSize: 34, color: typing ? '#2fa84f' : '#8a8293' }}>{typing ? 'escribiendo…' : 'en línea'}</div>
          </div>
        </div>
        {/* the messages */}
        {shown.map((m, i) => {
          const s = size(m);
          const top = y;
          y += s.h + GAP;
          if (top + s.h < 240) return null;
          const k = pop(frame, Math.round((m.en + episode.v0) * FPS));
          const align = m.de === 'sistema' ? 'center' : m.de === 'yo' ? 'flex-end' : 'flex-start';
          return (
            <div key={i} style={{ position: 'absolute', left: 40, right: 40, top, display: 'flex', justifyContent: align, transform: `scale(${k})`, transformOrigin: m.de === 'yo' ? '100% 100%' : m.de === 'otro' ? '0% 100%' : '50% 50%' }}>
              <Bubble m={m} theme={theme} burbuja={chat.burbuja} />
            </div>
          );
        })}
        {typing ? <div style={{ position: 'absolute', left: 40, top: y }}><Typing theme={theme} /></div> : null}
        {/* the hook: a torn card over the chat, then it is pulled away */}
        {t < hookOut ? (
          <AbsoluteFill style={{ background: 'rgba(22,19,29,.55)', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ transform: `rotate(-3deg) scale(${pop(frame, 2)})`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
              <Ransom text={episode.hook.title} size={Math.max(100, Math.min(170, 1000 / (episode.hook.title.length * 1.05)))} seed={episode.seed} start={2} maxWidth={980} />
              <Torn color={P.cream} seed={5} pad="10px 30px"><div style={{ fontFamily: FONTS.elite, fontSize: 52, color: P.ink }}>{episode.hook.sub}</div></Torn>
            </div>
            <div style={{ position: 'absolute', left: 30, top: 1080 }}><HostDuck face={FACE} v0={episode.v0} width={420} pose={pose} mouth={episode.mouth} /></div>
          </AbsoluteFill>
        ) : null}
        {/* the end card */}
        {end ? (
          <AbsoluteFill style={{ transform: `translateY(${(1 - endK) * 1900}px)` }}>
            <Paper color={P.orange}>
              <div style={{ position: 'absolute', left: 0, right: 0, top: 170, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34 }}>
                <Img src={staticFile('app/icon.png')} style={{ width: 230, borderRadius: 54, boxShadow: '8px 12px 0 rgba(0,0,0,.2)' }} />
                <Ransom text="DESCARGA DUCKI" size={104} seed={7} start={finFrame + 4} maxWidth={980} />
                <div style={{ display: 'flex', gap: 20, background: P.cream, padding: '18px 24px', boxShadow: '6px 9px 0 rgba(0,0,0,.2)', position: 'relative' }}>
                  <Img src={staticFile('stores/app-store.svg')} style={{ height: 86 }} />
                  <Img src={staticFile('stores/google-play.png')} style={{ height: 86 }} />
                  <div style={{ position: 'absolute', left: '40%', top: -22 }}><Tape w={140} seed={3} /></div>
                </div>
              </div>
              <div style={{ position: 'absolute', left: 310, top: 860 }}><HostDuck face={FACE} v0={episode.v0} width={460} pose={pose} mouth={episode.mouth} /></div>
            </Paper>
          </AbsoluteFill>
        ) : null}
        <Captions big={false} />
      </AbsoluteFill>
    </EpProvider>
  );
};
