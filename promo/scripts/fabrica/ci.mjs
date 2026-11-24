// Entry point for GitHub Actions (.github/workflows/episodio.yml). Each run does
// one step and ends; nothing waits here for an answer: the moderation bot (API)
// receives the team's buttons and replies and starts the next run with a
// repository_dispatch.
//
// With the voice made by hand (FABRICA_VOZ=manual, the default):
//   node scripts/fabrica/ci.mjs nuevo [--formato id] [--encargo "…"]   writes the script, posts it to the topic
//   («Aprobar guion» → «fabrica-generar»; or someone replies with their own audio → «fabrica-voz»)
//   node scripts/fabrica/ci.mjs generar --episodio <id>     ElevenLabs voices the script, builds the video
//   node scripts/fabrica/ci.mjs voz --episodio <id> --archivo <telegram file_id>
//                                                            builds the video, posts it for review
//   node scripts/fabrica/ci.mjs ajuste --episodio <id> --texto "…"
//                                                            new script version, posted for a new voice:
//                                                            the script's own lines edited by hand are
//                                                            taken as they are; anything else is an
//                                                            instruction for the writer
//
// With FABRICA_VOZ=eleven (ElevenLabs API on a paid plan), nuevo and ajuste build
// the video straight away.
//
//   node scripts/fabrica/ci.mjs nuevo --spec x.json --voz a.wav --palabras p.json   test, no keys
//
// Writes the folder it made to $GITHUB_OUTPUT (carpeta=…) so the workflow keeps its
// JSON in the repo.
import fs from 'node:fs';
import path from 'node:path';
import { FAB, loadEnv, readJson, slugify, writeJson } from './comun.mjs';
import { armarEpisodio } from './episodio.mjs';
import { cargarFormato } from './formatos/index.mjs';
import { bajarArchivo, enviarGuion, enviarPropuesta } from './telegram.mjs';

const DAILY = 'Elige tú el tema del video de hoy: un ángulo concreto y distinto a los episodios recientes (una función a fondo, un top, una situación de la U, un POV, una pregunta). Que enganche en el primer segundo.';
const manual = () => (process.env.FABRICA_VOZ || 'manual') !== 'eleven';
const EPIS = path.join(FAB, 'episodios');

function args() {
  const a = process.argv.slice(3), o = {};
  for (let i = 0; i < a.length; i++) o[a[i].replace(/^--/, '')] = a[i + 1]?.startsWith('--') ? true : a[++i];
  return o;
}

function salida(dir) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `carpeta=${dir}\n`);
}

/** The episode folder for an id; the buttons carry ids cut to 59 bytes, so a prefix is enough. */
function carpeta(id) {
  if (!id || /[/\\]|\.\./.test(id)) throw new Error(`Episodio inválido: ${id}`);
  if (fs.existsSync(path.join(EPIS, id, 'spec.json'))) return path.join(EPIS, id);
  const hits = fs.existsSync(EPIS) ? fs.readdirSync(EPIS).filter((d) => d.startsWith(id) && fs.existsSync(path.join(EPIS, d, 'spec.json'))) : [];
  const exact = hits.filter((d) => !/-v\d+$/.test(d.slice(id.length)));
  if (exact.length === 1 || hits.length === 1) return path.join(EPIS, (exact[0] ?? hits[0]));
  throw new Error(hits.length ? `«${id}» coincide con varios episodios: ${hits.join(', ')}` : `No encuentro ${id} en fabrica/episodios`);
}

/** The script edited by hand: the reply has exactly the script's lines. Null when it is an instruction. */
function editadoAMano(spec, texto, fmt) {
  const lines = String(texto).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!fmt.aplicarTexto || lines.length < 3) return null;
  return fmt.aplicarTexto(spec, lines);
}

/** Saves a script and posts it to the topic, waiting for someone's voice. */
async function guardarGuion(spec, dir, version = 1) {
  const fmt = await cargarFormato(spec.formato);
  spec.formato = fmt.id;
  const problems = fmt.revisar(spec, readJson(path.join(FAB, 'funciones.json')));
  if (problems.length) throw new Error('El guion no sirve para la plantilla:\n- ' + problems.join('\n- '));
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'spec.json'), spec);
  const texto = fmt.segmentos(spec).join('\n');
  fs.writeFileSync(path.join(dir, 'guion.txt'), `${texto}\n`);
  salida(dir);
  await enviarGuion({ dir, id: path.basename(dir), spec, texto, version });
  console.log(`guion enviado a Telegram: ${path.basename(dir)} (esperando la voz)`);
}

async function nuevo(o) {
  if (manual() && !o.spec) {
    let encargo = o.encargo && o.encargo !== true ? o.encargo : null;
    let formato = o.formato && o.formato !== true ? o.formato : null;
    let extra = {};
    // nothing asked: the day's idea of the weekly plan (the chosen ones first)
    let idea = null;
    if (!encargo) {
      const { ideaDeHoy } = await import('./semana.mjs');
      idea = await ideaDeHoy();
      if (idea) {
        encargo = idea.encargo;
        formato = formato ?? idea.formato;
        extra = { tipo: idea.tipo, pilar: idea.pilar };
        console.log(`plan: idea ${idea.id} · ${idea.pilar} · ${idea.formato}`);
      }
    }
    const fmt = await cargarFormato(formato);
    const { escribirGuion } = await import('./guionista.mjs');
    const spec = await escribirGuion(encargo ?? DAILY, fmt, extra);
    const fecha = new Date().toISOString().slice(0, 10);
    const dir = path.join(EPIS, `${fecha}-${slugify(spec.slug || spec.gancho?.titulo || 'video')}`);
    await guardarGuion(spec, dir);
    if (idea) (await import('./semana.mjs')).anotarEpisodio(idea.id, path.basename(dir));
    return;
  }
  const encargo = o.spec ? undefined : (o.encargo && o.encargo !== true ? o.encargo : DAILY);
  const ep = await armarEpisodio({ ...o, encargo });
  salida(ep.dir);
  if (!ep.files.length) return;
  await enviarPropuesta({ dir: ep.dir, id: path.basename(ep.dir), spec: ep.spec, video: ep.files[0] });
  console.log(`enviado a Telegram: ${path.basename(ep.dir)}`);
}

async function voz(o) {
  if (!o.archivo) throw new Error('voz necesita --episodio y --archivo');
  const dir = carpeta(o.episodio);
  const spec = readJson(path.join(dir, 'spec.json'));
  const audio = await bajarArchivo(o.archivo, path.join(dir, 'voz-telegram'));
  console.log(`voz: ${path.basename(audio)} (${Math.round(fs.statSync(audio).size / 1024)} KB)`);
  const version = Number(path.basename(dir).match(/-v(\d+)$/)?.[1] ?? 1);
  const ep = await armarEpisodio({ specObj: spec, voz: audio, salida: dir });
  if (!ep.files.length) return;
  await enviarPropuesta({ dir: ep.dir, id: path.basename(ep.dir), spec: ep.spec, video: ep.files[0], version });
  console.log(`video enviado a Telegram: ${path.basename(ep.dir)}`);
}

/** The script was approved: ElevenLabs voices it and the video goes for review. */
async function generar(o) {
  const dir = carpeta(o.episodio);
  const spec = readJson(path.join(dir, 'spec.json'));
  const version = Number(path.basename(dir).match(/-v(\d+)$/)?.[1] ?? 1);
  const ep = await armarEpisodio({ specObj: spec, voz: 'eleven', salida: dir });
  salida(ep.dir);
  if (!ep.files.length) return;
  await enviarPropuesta({ dir: ep.dir, id: path.basename(ep.dir), spec: ep.spec, video: ep.files[0], version });
  console.log(`video enviado a Telegram: ${path.basename(ep.dir)}`);
}

async function ajuste(o) {
  if (!o.texto || o.texto === true) throw new Error('ajuste necesita --episodio y --texto');
  const dir = carpeta(o.episodio);
  const id = path.basename(dir);
  const prev = readJson(path.join(dir, 'spec.json'));
  const version = Number(id.match(/-v(\d+)$/)?.[1] ?? 1) + 1;
  const nueva = path.join(EPIS, `${id.replace(/-v\d+$/, '')}-v${version}`);
  const fmt = await cargarFormato(prev.formato);
  let specObj = manual() ? editadoAMano(prev, o.texto, fmt) : null;
  if (specObj) console.log('ajuste: el guion editado a mano, línea por línea');
  else {
    const { reescribirGuion } = await import('./guionista.mjs');
    specObj = await reescribirGuion(prev, o.texto, fmt);
  }
  if (manual()) {
    await guardarGuion(specObj, nueva, version);
    fs.writeFileSync(path.join(nueva, 'ajuste.txt'), `${o.texto}\n`);
    return;
  }
  const seed = fs.existsSync(path.join(dir, 'episodio.json')) ? readJson(path.join(dir, 'episodio.json')).seed : 1;
  const ep = await armarEpisodio({ specObj, salida: nueva, semilla: String(seed + version) });
  salida(ep.dir);
  fs.writeFileSync(path.join(ep.dir, 'ajuste.txt'), `${o.texto}\n`);
  await enviarPropuesta({ dir: ep.dir, id: path.basename(ep.dir), spec: ep.spec, video: ep.files[0], version });
  console.log(`versión ${version} enviada: ${path.basename(ep.dir)}`);
}

loadEnv();
const cmd = process.argv[2];
const run = { nuevo, voz, generar, ajuste }[cmd];
if (!run) { console.error('uso: ci.mjs nuevo|voz|generar|ajuste …'); process.exit(2); }
run(args()).catch((e) => {
  const cause = e.cause ? ` (${e.cause.code ?? ''} ${e.cause.message ?? e.cause})` : '';
  console.error(String(e.message ?? e) + cause);
  process.exit(1);
});
