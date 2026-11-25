// Audio tags for ElevenLabs v3/v4 ([excited], [whispering], [short pause]…), like the «Enhance»
// button of ElevenLabs' studio (which has no API): a model adds the tags to the script without
// touching a word, and only the voice gets the tagged text. Captions, timings and Telegram keep
// the plain script. FABRICA_ETIQUETAS=no turns it off.
import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJson } from './comun.mjs';
import { MODELO_VOZ, quitarEtiquetas } from './voz.mjs';

const SISTEMA = `Eres director de voz para ElevenLabs v4. Recibes el guion de un video corto de Ducki (app social para universitarios de Cali; TikTok, español de Colombia), una frase por línea, y lo devuelves con etiquetas de audio para que la voz se sienta VIVA: como un creador de TikTok que cuenta algo que le emociona, no como alguien leyendo. Sin etiquetas, esta voz suena plana y lenta; tus etiquetas son las que le dan energía, cambios y contraste.

Etiquetas (en inglés, entre corchetes, justo antes del tramo que cambian; también valen en mitad de la línea):
- energía: [excited], [excitedly], [ecstatic], [delighted], [enthusiastic], [proudly], [shocked], [amazed], [surprised]
- complicidad y humor: [mischievously], [playfully], [sarcastic], [teasing], [laughs], [chuckles]
- bajar la voz: [whispering], [softly], [conspiratorially], [nervous]
- drama: [dramatic], [suspenseful], [gasps], [sighs]
- silencios: [short pause], [long pause]
Puedes usar otras descriptivas en inglés si encajan mejor ([fast-paced, hyped], [low, mysterious voice]).

Reglas:
1. Solo agregas etiquetas. No cambies, quites ni agregues ninguna palabra, mayúscula ni signo de puntuación: si quitas las etiquetas, cada línea tiene que quedar idéntica.
2. La primera línea arranca con energía alta ([excited], [excitedly], [enthusiastic]…): el primer segundo decide si la gente se queda.
3. Contraste: a lo largo del guion usa al menos 4 etiquetas de interpretación distintas (sin contar las pausas), y si el guion lo permite, un momento en voz baja ([whispering], [conspiratorially]) para un secreto, un chisme o algo vergonzoso.
4. Cambia la energía de una línea a otra: subir, bajar, sorprenderse, reírse. Nunca la misma etiqueta en dos líneas seguidas.
5. No uses [serious], [calm] ni [neutral]: apagan la voz.
6. De 1 a 3 etiquetas por línea; casi todas las líneas llevan al menos una. Pausas: como mucho 2 en todo el guion, justo antes de un remate o un dato que sorprende.
7. Devuelve las mismas líneas, en el mismo orden, en {"lineas": [...]}.`;

const TONO = {
  noticiero: 'Es un noticiero parodia de TikTok: el presentador da las noticias con MUCHA energía, como si cada dato fuera una bomba. Arranca [excited]; las «últimas horas» y alertas con [shocked] o [dramatic]; un chisme con [conspiratorially]; el remate con [laughs] o [mischievously]. La parodia está en la exageración, no en sonar formal.',
  chat: 'Un narrador cuenta una historia de chat como un chisme entre amigos: [excited] al arrancar, [whispering] o [conspiratorially] en lo vergonzoso, [laughs] en el remate.',
};

const APAGADAS = /^(serious|calm|neutral|calmly|monotone)$/i;
const PAUSA = /pause/i;

/** Same words and signs (spacing aside)? */
const igual = (a, b) => {
  const n = (s) => s.replace(/\s+/g, ' ').replace(/\s+([.,;:!?…»)])/g, '$1').replace(/([«(¿¡])\s+/g, '$1').trim();
  return n(a) === n(b);
};

const tagsDe = (l) => [...String(l).matchAll(/\[([^\]\n]+)\]/g)].map((m) => m[1].trim().toLowerCase());

/** Keeps each proposed line only if, without its tags, it is the original line (and drops the tags that flatten the voice). */
export function aplicarEtiquetas(lineas, propuestas) {
  const out = lineas.map((l, k) => {
    let t = propuestas?.[k];
    if (typeof t !== 'string') return l;
    t = t.replace(/\s*\[(serious|calm|neutral|calmly|monotone)\]\s*/gi, ' ').replace(/ {2,}/g, ' ').trim();
    return /\[[^\]\n]+\]/.test(t) && igual(quitarEtiquetas(t), l) ? t : l;
  });
  return { lineas: out, cambiadas: out.filter((l, k) => l !== lineas[k]).length };
}

/** What makes a tagged script still sound flat (empty when it is lively enough). */
export function revisarEtiquetas(lineas) {
  const err = [];
  const porLinea = lineas.map(tagsDe);
  const emociones = new Set(porLinea.flat().filter((t) => !PAUSA.test(t)));
  if (emociones.size < Math.min(4, lineas.length)) err.push(`solo hay ${emociones.size} etiquetas de interpretación distintas: usa al menos ${Math.min(4, lineas.length)}`);
  if (!porLinea[0]?.some((t) => /excit|enthusias|ecstatic|hyped|delight|amaz|shock|energ/.test(t))) err.push('la primera línea tiene que arrancar con energía alta ([excited], [enthusiastic]…)');
  const sin = porLinea.filter((ts) => !ts.some((t) => !PAUSA.test(t))).length;
  if (sin > Math.floor(lineas.length / 3)) err.push(`${sin} líneas no tienen ninguna etiqueta de interpretación: casi todas llevan al menos una`);
  if (porLinea.flat().filter((t) => PAUSA.test(t)).length > 2) err.push('más de 2 pausas: deja solo las de antes de un remate');
  for (let k = 1; k < porLinea.length; k++) {
    const rep = porLinea[k].filter((t) => !PAUSA.test(t) && porLinea[k - 1].includes(t));
    if (rep.length) { err.push(`las líneas ${k} y ${k + 1} repiten [${rep[0]}]: cambia la energía de una a otra`); break; }
  }
  if (porLinea.flat().some((t) => APAGADAS.test(t))) err.push('no uses [serious], [calm] ni [neutral]');
  return err;
}

/**
 * The script with audio tags for the voice (cached in the episode folder: the same script gets
 * the same tags). Falls back to the plain script on any trouble.
 */
export async function etiquetarVoz({ texto, spec, dir }) {
  if (process.env.FABRICA_ETIQUETAS === 'no' || !/^eleven_v[34]/.test(MODELO_VOZ())) return texto;
  const cache = path.join(dir, 'etiquetas-voz.json');
  if (fs.existsSync(cache)) {
    const c = readJson(cache);
    if (c.texto === texto && c.etiquetado && c.version === 2) return c.etiquetado;
  }
  const lineas = texto.split('\n');
  const esquema = { type: 'object', additionalProperties: false, required: ['lineas'], properties: { lineas: { type: 'array', items: { type: 'string' } } } };
  const base = [TONO[spec?.formato] ?? '', `Guion (${lineas.length} líneas):`, ...lineas].filter(Boolean).join('\n');
  const { pedirJson } = await import('./claude.mjs');
  let mejor = null;
  let mensaje = base;
  // twice at most: the second time with what still sounds flat
  for (let intento = 0; intento < 2; intento++) {
    let propuestas;
    try {
      propuestas = (await pedirJson({ sistema: SISTEMA, mensaje, esquema, esfuerzo: 'low' })).lineas;
    } catch (e) {
      console.log(`voz: sin etiquetas de interpretación (${String(e.message).slice(0, 140)})`);
      break;
    }
    const r = aplicarEtiquetas(lineas, propuestas);
    const problemas = revisarEtiquetas(r.lineas);
    if (!mejor || problemas.length < mejor.problemas.length) mejor = { ...r, problemas };
    if (!problemas.length) break;
    mensaje = `${base}\n\nTu propuesta anterior:\n${r.lineas.join('\n')}\n\nTodavía suena plana. Corrige esto y devuelve todas las líneas:\n- ${problemas.join('\n- ')}`;
  }
  if (!mejor) return texto;
  const etiquetado = mejor.lineas.join('\n');
  writeJson(cache, { texto, etiquetado, modelo: MODELO_VOZ(), version: 2 });
  // counts only: the logs of this repo are public
  const tags = tagsDe(etiquetado);
  console.log(`voz: ${tags.length} etiqueta(s) en ${mejor.cambiadas} de ${lineas.length} líneas, ${new Set(tags.filter((t) => !PAUSA.test(t))).size} distintas${mejor.problemas.length ? ` (quedó: ${mejor.problemas.length} aviso(s))` : ''}`);
  return etiquetado;
}
