// Fábrica de videos: arma un episodio completo con la plantilla «Lista scrapbook».
//
//   node scripts/fabrica/episodio.mjs --encargo "3 cosas para declararte a tu crush"
//   node scripts/fabrica/episodio.mjs --spec ruta/spec.json
//
// Opciones:
//   --voz eleven|sapi|<archivo>   eleven (por defecto si hay llave), sapi (voz de Windows, para
//                                  probar gratis) o un mp3/wav ya hecho
//   --palabras <archivo.json>     tiempos por palabra ya hechos (para --voz <archivo>)
//   --cuadros 1,5.5,12            solo saca esos cuadros (segundos) para revisar, sin video
//   --sin-render                  arma todo menos el video
//   --semilla N                   cambia las piezas, stickers y música elegidas
//   --salida <carpeta>            por defecto RecursosVideo/fabrica/episodios/<fecha>-<slug>
//   --telegram                    al terminar, lo manda al tema «Fábrica» del grupo y espera
//                                  Aprobar / Ajustar / Descartar; un ajuste rehace el video
//   --revisar <carpeta>           manda a revisión un episodio ya hecho (y sigue igual)
//
// Llaves en RecursosVideo/fabrica/.env (ver .env.example).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAB, duration, ffmpeg, loadEnv, norm, python, readJson, slugify, writeJson } from './comun.mjs';
import { cargarFormato } from './formatos/index.mjs';
import { MODELO_VOZ, alineacionSinEtiquetas, palabrasWhisper, quitarEtiquetas, segmentStarts, vozEleven, vozSapi, wordsFromAlignment } from './voz.mjs';

function args() {
  const a = process.argv.slice(2), o = {};
  for (let i = 0; i < a.length; i++) {
    const k = a[i].replace(/^--/, '');
    if (k === 'sin-render') o.sinRender = true;
    else if (k === 'telegram') o.telegram = true;
    else o[k] = a[++i];
  }
  return o;
}

/**
 * Whisper hears «Dookie» for Ducki and drops punctuation; the script is known, so
 * its words replace the transcript's, keeping whisper's timing (aligned word by word).
 */
function conTextoDelGuion(words, texto) {
  const S = texto.split(/\s+/).filter(Boolean), A = S.map(norm), B = words.map((w) => norm(w.w));
  const n = A.length, m = B.length;
  const D = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
  const pairs = [];
  for (let i = n, j = m; i > 0 || j > 0;) {
    if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1)) { pairs.push([i - 1, j - 1]); i--; j--; }
    else if (i > 0 && D[i][j] === D[i - 1][j] + 1) { pairs.push([i - 1, -1]); i--; }
    else { pairs.push([-1, j - 1]); j--; }
  }
  pairs.reverse();
  const out = [];
  let pending = [];
  for (const [i, j] of pairs) {
    if (j < 0) { pending.push(S[i]); continue; }
    if (i < 0) continue;
    if (pending.length) {
      // script words with no sound of their own share the next word's time
      const w = words[j], step = (w.e - w.s) / (pending.length + 1);
      pending.forEach((t, k) => out.push({ w: t, s: +(w.s + k * step).toFixed(3), e: +(w.s + (k + 1) * step).toFixed(3) }));
      out.push({ w: S[i], s: +(w.s + pending.length * step).toFixed(3), e: w.e });
      pending = [];
    } else out.push({ w: S[i], s: words[j].s, e: words[j].e });
  }
  if (pending.length && out.length) pending.forEach((t) => out.push({ w: t, s: out[out.length - 1].e, e: out[out.length - 1].e + 0.2 }));
  return out;
}

/** Builds one episode (script → voice → timings → audio → video); returns where it is. */
export async function armarEpisodio(o) {
  const funciones = readJson(path.join(FAB, 'funciones.json'));
  let spec = o.specObj;
  if (spec) { /* given (a new version after an adjustment) */ }
  else if (o.spec) spec = readJson(o.spec);
  const fmt = await cargarFormato(spec?.formato ?? o.formato);
  if (!spec && o.encargo) {
    const { escribirGuion } = await import('./guionista.mjs');
    console.log(`guionista: escribiendo (${fmt.id})…`);
    spec = await escribirGuion(o.encargo, fmt);
  } else if (!spec) throw new Error('Usa --encargo "…" o --spec archivo.json');
  spec.formato = fmt.id;
  const problems = fmt.revisar(spec, funciones);
  if (problems.length) throw new Error('El guion no sirve para la plantilla:\n- ' + problems.join('\n- '));

  const fecha = new Date().toISOString().slice(0, 10);
  const slug = slugify(spec.slug || spec.gancho.titulo);
  const dir = path.resolve(o.salida ?? path.join(FAB, 'episodios', `${fecha}-${slug}`));
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'spec.json'), spec);
  const segs = fmt.segmentos(spec);
  const texto = segs.join('\n');
  fs.writeFileSync(path.join(dir, 'guion.txt'), texto);
  console.log(`episodio: ${dir}`);

  // new AI images made for this video: the director uses them; a format may place them itself
  if (fmt.director || fmt.pedidosDeImagen) {
    const { imagenesParaEpisodio } = await import('./imagenes.mjs');
    const nuevas = await imagenesParaEpisodio({ dir, spec, fmt });
    if (nuevas.length && fmt.usarImagenes) {
      spec = fmt.usarImagenes(spec, nuevas);
      writeJson(path.join(dir, 'spec.json'), spec);
    }
  }

  // voice + word timings
  // the Windows voice is only for trying things on a PC; anywhere else it is ElevenLabs
  const modo = o.voz ?? (process.env.ELEVENLABS_API_KEY || process.platform !== 'win32' ? 'eleven' : 'sapi');
  let vozFile, words, starts;
  if (modo === 'eleven') {
    vozFile = path.join(dir, 'voz.mp3');
    // what was voiced (the voice id only as a hash: it is a secret): the same words with the same
    // model and voice coming back (a run that failed after the voice, a new look for the same
    // script) reuse the paid audio, with or without audio tags, instead of paying again
    const modelo = MODELO_VOZ(), hashVoz = crypto.createHash('sha1').update(process.env.ELEVENLABS_VOICE_ID ?? '').digest('hex').slice(0, 10);
    const metaVoz = path.join(dir, 'voz.json');
    const previa = fs.existsSync(vozFile) && fs.existsSync(metaVoz) ? readJson(metaVoz) : null;
    let al;
    // version 2: the expressive settings and audio tags (an older, flatter voice is made again)
    if (previa && previa.version === 2 && quitarEtiquetas(previa.texto) === texto && previa.modelo === modelo && previa.voz === hashVoz) {
      al = fs.existsSync(path.join(dir, 'alineacion.json')) ? readJson(path.join(dir, 'alineacion.json')) : null;
      console.log(`voz: reuso la de ElevenLabs ya pagada (mismo texto, ${modelo})`);
    } else {
      // the voice reads the script with audio tags ([excited], [whispers]…); everything else uses the plain one
      const { etiquetarVoz } = await import('./etiquetas.mjs');
      const textoVoz = await etiquetarVoz({ texto, spec, dir });
      al = alineacionSinEtiquetas(await vozEleven(textoVoz, vozFile));
      writeJson(metaVoz, { texto: textoVoz, modelo, voz: hashVoz, version: 2 });
    }
    if (al) {
      writeJson(path.join(dir, 'alineacion.json'), al);
      words = wordsFromAlignment(al);
      starts = segmentStarts(segs, words, al);
    } else {
      // no alignment from this model: whisper hears the timings, the script gives the words
      words = conTextoDelGuion(palabrasWhisper(vozFile, dir), texto);
      starts = segmentStarts(segs, words);
    }
  } else {
    if (modo === 'sapi') { vozFile = path.join(dir, 'voz-windows.wav'); vozSapi(texto, vozFile); }
    else { vozFile = path.join(dir, `voz-original${path.extname(modo)}`); fs.copyFileSync(path.resolve(modo), vozFile); }
    const raw = o.palabras ? readJson(o.palabras) : palabrasWhisper(vozFile, dir);
    words = conTextoDelGuion(Array.isArray(raw) ? raw : raw.words, texto);
    starts = segmentStarts(segs, words);
  }
  writeJson(path.join(dir, 'palabras.json'), { words });
  const wav = path.join(dir, 'voz.wav');
  ffmpeg(['-i', vozFile, '-ar', '48000', '-ac', '1', wav]);
  const vozDur = duration(wav);
  python(['scripts/fabrica/boca.py', wav, path.join(dir, 'palabras.json'), path.join(dir, 'boca.json')]);

  const seed = Number(o.semilla ?? [...`${fecha}${slug}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7));
  const mouth = readJson(path.join(dir, 'boca.json'));
  // what each scene shows: decided by the director for this script, or the format's fixed scenes
  let episode;
  const { directorDisponible } = await import('./director/director.mjs');
  const reuse = o.storyboard ? path.resolve(o.storyboard) : null;
  if (fmt.director && (reuse || directorDisponible())) {
    const { dirigir } = await import('./director/director.mjs');
    const { episodioLibre, revisarStoryboard } = await import('./director/storyboard.mjs');
    // a format with its own storyboard (the newscast's TV) checks and builds it itself; and no
    // capture or clip the last videos showed (the same feed post every time gets old)
    const { capturasRecientes, revisarRepetidas } = await import('./recientes.mjs');
    const prohibidos = capturasRecientes(dir);
    const revisarBase = fmt.revisarStoryboard ? (sb) => fmt.revisarStoryboard(sb, { words, starts, spec }) : (sb) => revisarStoryboard(sb, words);
    const revisarSb = (sb) => [...revisarBase(sb), ...revisarRepetidas(sb, prohibidos)];
    let storyboard;
    if (reuse) {
      storyboard = readJson(reuse);
      const problems = revisarSb(storyboard);
      if (problems.length) throw new Error(`El storyboard ${reuse} tiene problemas:\n- ${problems.join('\n- ')}`);
    } else {
      storyboard = await dirigir({ dir, spec, words, vozDur, seed, mouth, segs, starts, formato: fmt.id, revisar: revisarSb, prohibidos });
    }
    writeJson(path.join(dir, 'storyboard.json'), storyboard);
    episode = fmt.conStoryboard
      ? fmt.conStoryboard({ spec, words, starts, vozDur, seed, mouth, storyboard })
      : episodioLibre({ spec, words, vozDur, funciones, seed, mouth, storyboard });
  } else {
    if (fmt.director) console.log('director: no disponible aquí (sin CLAUDE_CODE_OAUTH_TOKEN); uso las escenas fijas del formato');
    episode = fmt.construir({ spec, words, starts, vozDur, funciones, seed, mouth });
  }
  writeJson(path.join(dir, 'episodio.json'), episode);
  console.log(python(['scripts/fabrica/audio.py', path.join(dir, 'episodio.json'), dir]).trim());
  fs.writeFileSync(path.join(dir, 'texto.txt'), `${spec.caption}\n\n${(spec.hashtags ?? []).join(' ')}\n`);
  console.log(`escenas: ${episode.scenes.map((s) => `${s.feature ?? s.kind}@${s.t.toFixed(1)}`).join(' · ')} — ${episode.total.toFixed(1)} s`);

  if (o.sinRender) return { dir, slug, spec, files: [], episode, seed };
  const { renderEpisodio } = await import('./render.mjs');
  const stills = o.cuadros ? o.cuadros.split(',').map(Number) : null;
  const files = await renderEpisodio({ episode, dir, slug, stills, fmt });
  console.log(stills ? `cuadros en ${dir}` : `listo:\n  ${files.join('\n  ')}\n  ${path.join(dir, 'texto.txt')}`);
  return { dir, slug, spec, files, episode, seed };
}

/**
 * Sends an episode to the group's «Fábrica» topic and waits for the team:
 * Aprobar and Descartar are written next to the video (aprobado.json /
 * descartado.json); Ajustar rewrites the script with the request and builds a
 * new version (<carpeta>-v2, -v3…), which goes back for review.
 */
export async function revisar(ep, o = {}) {
  const { enviarPropuesta, esperarDecision } = await import('./telegram.mjs');
  let version = Number(ep.dir.match(/-v(\d+)$/)?.[1] ?? 1);
  const base = ep.dir.replace(/-v\d+$/, '');
  for (;;) {
    const id = path.basename(ep.dir);
    const short = await enviarPropuesta({ dir: ep.dir, id, spec: ep.spec, video: ep.files[0], version });
    console.log(`telegram: ${id} enviado; esperando a que el equipo responda…`);
    const d = await esperarDecision(short);
    console.log(`telegram: ${d.accion} por ${d.por}${d.texto ? `: «${d.texto}»` : ''}`);
    if (d.accion === 'aprobar' || d.accion === 'descartar') {
      writeJson(path.join(ep.dir, d.accion === 'aprobar' ? 'aprobado.json' : 'descartado.json'), { ...d, videos: ep.files });
      return d;
    }
    const { reescribirGuion } = await import('./guionista.mjs');
    console.log('guionista: aplicando el ajuste…');
    const specObj = await reescribirGuion(ep.spec, d.texto, await cargarFormato(ep.spec.formato));
    version += 1;
    ep = await armarEpisodio({
      ...o, specObj, spec: undefined, encargo: undefined, cuadros: undefined,
      salida: `${base}-v${version}`, semilla: String((ep.seed ?? 1) + version),
    });
  }
}

async function main() {
  loadEnv();
  const o = args();
  if (o.revisar) {
    const dir = path.resolve(o.revisar);
    const spec = readJson(path.join(dir, 'spec.json'));
    const files = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.mp4') && !f.includes('sin-musica') && f !== 'vista-previa.mp4' && f !== 'telegram-1080p.mp4')
      .map((f) => path.join(dir, f));
    if (!files.length) throw new Error(`No hay video en ${dir}`);
    const seed = fs.existsSync(path.join(dir, 'episodio.json')) ? readJson(path.join(dir, 'episodio.json')).seed : 1;
    await revisar({ dir, slug: slugify(spec.slug), spec, files, seed }, o);
    return;
  }
  const ep = await armarEpisodio(o);
  if (o.telegram && ep.files.length) await revisar(ep, o);
}

// run as a command, not when imported (revisar re-enters armarEpisodio)
if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
}
