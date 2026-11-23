// The voice of an episode and its word timings.
//
//   eleven   ElevenLabs text-to-speech with timestamps: the audio and, per character,
//            when it is said, so words and segment starts come out exact.
//   sapi     Windows' own voice (Helena, es-ES): free, robotic, only for testing the
//            pipeline without spending; timings come from faster-whisper.
//   <file>   an mp3/wav made elsewhere (e.g. by hand in ElevenLabs); timings from
//            faster-whisper, or from a words file given with --palabras.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ffmpeg, norm, python, readJson } from './comun.mjs';

/** Words (w, s, e) from ElevenLabs' character alignment. */
export function wordsFromAlignment(al) {
  const words = [];
  let cur = null;
  al.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) { if (cur) { words.push(cur); cur = null; } return; }
    if (!cur) cur = { w: '', s: al.character_start_times_seconds[i], e: 0 };
    cur.w += ch;
    cur.e = al.character_end_times_seconds[i];
  });
  if (cur) words.push(cur);
  return words.map((w) => ({ w: w.w, s: +w.s.toFixed(3), e: +w.e.toFixed(3) }));
}

/**
 * Where each segment of the script starts, in voice seconds. With the alignment
 * of the exact text it is read off the character offsets; otherwise each segment's
 * first words are looked up in the transcript, in order.
 */
export function segmentStarts(segments, words, al = null, joiner = '\n') {
  if (al && al.characters.join('') === segments.join(joiner)) {
    const out = [];
    let off = 0;
    for (const seg of segments) {
      let i = off;
      while (i < al.characters.length && /\s/.test(al.characters[i])) i++;
      out.push(al.character_start_times_seconds[Math.min(i, al.characters.length - 1)]);
      off += seg.length + joiner.length;
    }
    return out;
  }
  const W = words.map((w) => norm(w.w));
  const total = segments.reduce((a, s) => a + s.length, 0);
  const end = words.length ? words[words.length - 1].e : 0;
  const out = [0];
  let ptr = 0, chars = segments[0].length;
  for (let k = 1; k < segments.length; k++) {
    const toks = segments[k].split(/\s+/).map(norm).filter(Boolean).slice(0, 3);
    const same = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));
    let found = -1;
    for (let j = ptr; j < W.length && found < 0; j++) {
      if (!same(W[j], toks[0])) continue;
      const score = toks.reduce((sc, t, m) => sc + (W[j + m] && same(W[j + m], t) ? 1 : 0), 0);
      if (score >= Math.min(2, toks.length)) found = j;
    }
    if (found >= 0) { out.push(Math.max(0, words[found].s - 0.05)); ptr = found + 1; }
    else out.push((chars / total) * end);   // not found: by the share of text before it
    chars += segments[k].length;
  }
  return out;
}

export async function vozEleven(texto, outMp3) {
  const key = process.env.ELEVENLABS_API_KEY, voice = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voice) throw new Error('Faltan ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID en RecursosVideo/fabrica/.env');
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: texto,
      model_id: process.env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  fs.writeFileSync(outMp3, Buffer.from(data.audio_base64, 'base64'));
  return data.alignment;
}

/** Windows voice to a wav (free; for trying the pipeline). The text goes through a file to dodge quoting. */
export function vozSapi(texto, outWav) {
  const txt = outWav.replace(/\.wav$/, '.txt');
  fs.writeFileSync(txt, texto, 'utf8');
  const ps = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; ` +
    `try { $s.SelectVoice('Microsoft Helena Desktop') } catch {}; $s.Rate = 1; $s.SetOutputToWaveFile('${outWav.replace(/'/g, "''")}'); ` +
    `$s.Speak([IO.File]::ReadAllText('${txt.replace(/'/g, "''")}', [Text.Encoding]::UTF8)); $s.Dispose()`;
  const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
  if (r.status !== 0 || !fs.existsSync(outWav)) throw new Error(`La voz de Windows falló: ${r.stderr}`);
  fs.rmSync(txt);
}

/** faster-whisper words for any voice file (Spanish). */
export function palabrasWhisper(audio, dir) {
  const w16 = path.join(dir, 'voz16.wav');
  ffmpeg(['-i', audio, '-ac', '1', '-ar', '16000', w16]);
  const out = path.join(dir, 'palabras-whisper.json');
  python(['scripts/transcribe.py', w16, out]);
  fs.rmSync(w16);
  return readJson(out);
}
