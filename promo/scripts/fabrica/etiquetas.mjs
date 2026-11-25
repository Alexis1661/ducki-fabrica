// Audio tags for ElevenLabs v3/v4 ([excited], [whispers], [short pause]…), like the «Enhance»
// button of ElevenLabs' studio (which has no API): a model adds the tags to the script without
// touching a word, and only the voice gets the tagged text. Captions, timings and Telegram keep
// the plain script. FABRICA_ETIQUETAS=no turns it off.
import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJson } from './comun.mjs';
import { MODELO_VOZ, quitarEtiquetas } from './voz.mjs';

const SISTEMA = `Eres director de voz para ElevenLabs v4. Recibes el guion de un video corto de Ducki (app social para universitarios de Cali; TikTok, español de Colombia), una frase por línea, y lo devuelves con etiquetas de audio para que la voz se interprete mejor.

Etiquetas (en inglés, entre corchetes, antes del tramo que afectan):
- emoción: [excited], [happy], [curious], [serious], [dramatic], [sarcastic], [surprised], [proudly], [mischievously], [nervous]
- forma de decir: [whispers], [laughs], [chuckles], [sighs], [gasps]
- silencios: [short pause], [long pause]

Reglas:
1. Solo agregas etiquetas. No cambies, quites ni agregues ninguna palabra ni signo de puntuación: si quitas las etiquetas, cada línea tiene que quedar idéntica.
2. Máximo 2 etiquetas por línea, y no todas las líneas llevan. Menos es más.
3. Que sirvan a lo que se cuenta: emoción en el gancho, un susurro para un secreto o algo vergonzoso, una pausa antes del remate, una risa donde de verdad hay chiste. Nada que cambie el sentido.
4. Devuelve las mismas líneas, en el mismo orden, en {"lineas": [...]}.`;

const TONO = {
  noticiero: 'Es un noticiero parodia: el presentador lee serio y solemne ([serious]), con [dramatic] en las alertas y alguna [short pause] antes del dato que sorprende.',
  chat: 'Un narrador cuenta una historia de chat: cómplice, con [whispers] o [mischievously] en lo chismoso y [laughs] en el remate.',
};

/** Same words and signs (spacing aside)? */
const igual = (a, b) => {
  const n = (s) => s.replace(/\s+/g, ' ').replace(/\s+([.,;:!?…»)])/g, '$1').replace(/([«(¿¡])\s+/g, '$1').trim();
  return n(a) === n(b);
};

/** Keeps each proposed line only if, without its tags, it is the original line; returns the lines and how many changed. */
export function aplicarEtiquetas(lineas, propuestas) {
  const out = lineas.map((l, k) => {
    const t = propuestas?.[k];
    return typeof t === 'string' && /\[[^\]\n]+\]/.test(t) && igual(quitarEtiquetas(t), l) ? t.trim() : l;
  });
  return { lineas: out, cambiadas: out.filter((l, k) => l !== lineas[k]).length };
}

/**
 * The script with audio tags for the voice (cached in the episode folder: the same script gets
 * the same tags, so a retry reuses the paid voice). Falls back to the plain script on any trouble.
 */
export async function etiquetarVoz({ texto, spec, dir }) {
  if (process.env.FABRICA_ETIQUETAS === 'no' || !/^eleven_v[34]/.test(MODELO_VOZ())) return texto;
  const cache = path.join(dir, 'etiquetas-voz.json');
  if (fs.existsSync(cache)) {
    const c = readJson(cache);
    if (c.texto === texto && c.etiquetado) return c.etiquetado;
  }
  const lineas = texto.split('\n');
  let propuestas;
  try {
    const { pedirJson } = await import('./claude.mjs');
    propuestas = (await pedirJson({
      sistema: SISTEMA,
      mensaje: [TONO[spec?.formato] ?? '', `Guion (${lineas.length} líneas):`, ...lineas].filter(Boolean).join('\n'),
      esquema: { type: 'object', additionalProperties: false, required: ['lineas'], properties: { lineas: { type: 'array', items: { type: 'string' } } } },
      esfuerzo: 'low',
    })).lineas;
  } catch (e) {
    console.log(`voz: sin etiquetas de interpretación (${String(e.message).slice(0, 140)})`);
    return texto;
  }
  const { lineas: out, cambiadas } = aplicarEtiquetas(lineas, propuestas);
  const etiquetado = out.join('\n');
  writeJson(cache, { texto, etiquetado, modelo: MODELO_VOZ() });
  // counts only: the logs of this repo are public
  const n = (etiquetado.match(/\[[^\]\n]+\]/g) ?? []).length;
  console.log(`voz: ${n} etiqueta(s) de interpretación en ${cambiadas} de ${lineas.length} líneas`);
  return etiquetado;
}
