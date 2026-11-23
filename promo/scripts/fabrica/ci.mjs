// Entry point for GitHub Actions (.github/workflows/episodio.yml): each run builds
// one video, posts it to the group's «Fábrica» topic and ends. Nothing waits for
// the answer here: the moderation bot (API) receives the buttons, and an
// adjustment comes back as a new run (repository_dispatch «fabrica-ajuste»).
//
//   node scripts/fabrica/ci.mjs nuevo [--encargo "…"]          the video of the day
//   node scripts/fabrica/ci.mjs nuevo --spec x.json --voz a.wav --palabras p.json   test, no keys
//   node scripts/fabrica/ci.mjs ajuste --episodio <id> --texto "…"
//
// Writes the folder it made to $GITHUB_OUTPUT (carpeta=…) so the workflow can keep
// its JSON in the repo and upload the video as an artifact.
import fs from 'node:fs';
import path from 'node:path';
import { FAB, loadEnv, readJson } from './comun.mjs';
import { armarEpisodio } from './episodio.mjs';
import { enviarPropuesta } from './telegram.mjs';

const DAILY = 'Elige tú el tema del video de hoy: un ángulo concreto y distinto a los episodios recientes (una función a fondo, un top, una situación de la U, un POV, una pregunta). Que enganche en el primer segundo.';

function args() {
  const a = process.argv.slice(3), o = {};
  for (let i = 0; i < a.length; i++) o[a[i].replace(/^--/, '')] = a[i + 1]?.startsWith('--') ? true : a[++i];
  return o;
}

function salida(dir) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `carpeta=${dir}\n`);
}

async function nuevo(o) {
  const encargo = o.spec ? undefined : (o.encargo && o.encargo !== true ? o.encargo : DAILY);
  const ep = await armarEpisodio({ ...o, encargo });
  salida(ep.dir);
  if (!ep.files.length) return;
  await enviarPropuesta({ dir: ep.dir, id: path.basename(ep.dir), spec: ep.spec, video: ep.files[0] });
  console.log(`enviado a Telegram: ${path.basename(ep.dir)}`);
}

async function ajuste(o) {
  if (!o.episodio || !o.texto) throw new Error('ajuste necesita --episodio y --texto');
  const dir = path.join(FAB, 'episodios', o.episodio);
  if (!fs.existsSync(path.join(dir, 'spec.json'))) throw new Error(`No encuentro ${o.episodio} en fabrica/episodios`);
  const prev = readJson(path.join(dir, 'spec.json'));
  const version = Number(o.episodio.match(/-v(\d+)$/)?.[1] ?? 1) + 1;
  const base = o.episodio.replace(/-v\d+$/, '');
  const { reescribirGuion } = await import('./guionista.mjs');
  const specObj = await reescribirGuion(prev, o.texto);
  const seed = fs.existsSync(path.join(dir, 'episodio.json')) ? readJson(path.join(dir, 'episodio.json')).seed : 1;
  const ep = await armarEpisodio({ specObj, salida: path.join(FAB, 'episodios', `${base}-v${version}`), semilla: String(seed + version) });
  salida(ep.dir);
  fs.writeFileSync(path.join(ep.dir, 'ajuste.txt'), `${o.texto}\n`);
  await enviarPropuesta({ dir: ep.dir, id: path.basename(ep.dir), spec: ep.spec, video: ep.files[0], version });
  console.log(`versión ${version} enviada: ${path.basename(ep.dir)}`);
}

loadEnv();
const cmd = process.argv[2];
const run = cmd === 'nuevo' ? nuevo : cmd === 'ajuste' ? ajuste : null;
if (!run) { console.error('uso: ci.mjs nuevo|ajuste …'); process.exit(2); }
run(args()).catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
