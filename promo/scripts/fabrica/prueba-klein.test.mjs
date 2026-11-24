import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { credenciales, generarKlein, MODELO } from './klein.mjs';
import { ejecutarPrueba, clienteTelegram } from './prueba-klein.mjs';
import { guardar, leer, rutas, decidirKlein, reconciliarKlein } from './klein-estado.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK4kAAAAASUVORK5CYII=', 'base64');
const env = { CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_API_TOKEN: 'secret-test-token',
  TELEGRAM_BOT_TOKEN: 'telegram-test-token', TELEGRAM_CHAT_ID: '-123', TELEGRAM_TOPIC_FABRICA: '5',
  EPISODIOS_PRIVADOS: '1', FABRICA_TOKEN: 'factory-test-token' };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status });

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'klein-test-'));
  t.after(() => {
    const resolved = path.resolve(dir);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('klein-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const fab = path.join(dir, 'fabrica'), promo = path.join(dir, 'promo');
  fs.mkdirSync(path.join(fab, 'episodios', '.git'), { recursive: true });
  fs.mkdirSync(path.join(fab, 'pruebas', 'klein'), { recursive: true });
  fs.copyFileSync(path.join(root, 'fabrica/pruebas/klein/situaciones.json'), path.join(fab, 'pruebas/klein/situaciones.json'));
  fs.mkdirSync(path.join(promo, 'public/app'), { recursive: true });
  fs.writeFileSync(path.join(promo, 'public/app/duck-waving.png'), PNG);
  const generated = [], messages = [];
  const options = { lote: 'test-lote', env, fab, promo,
    procesar: (mode, src, dest) => { fs.copyFileSync(src, dest); return { w: 640, h: 480 }; },
    generar: async (o) => { generated.push(o); return PNG; },
    telegram: async (method, fields, file) => {
      messages.push({ method, fields, file });
      return { message_id: messages.length, document: { file_id: 'doc-' + messages.length } };
    },
  };
  return { dir, fab, promo, options, generated, messages, p: rutas({ fab, promo }),
    stateFile: path.join(fab, 'episodios/klein/test-lote/lote.json') };
}

test('credentials fail before making requests', async () => {
  assert.throws(() => credenciales({}), /ACCOUNT_ID/);
  assert.throws(() => credenciales({ CLOUDFLARE_ACCOUNT_ID: 'b'.repeat(32) }), /API_TOKEN/);
});

test('Cloudflare request uses fixed model, dimensions and reference bytes', async () => {
  let calls = 0;
  const bytes = await generarKlein({ referencia: PNG, prompt: 'Ducki leyendo', seed: 42, env,
    fetchImpl: async (url, options) => {
      calls++;
      assert.ok(url.endsWith('/' + MODELO));
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Authorization, 'Bearer secret-test-token');
      assert.equal(options.body.get('width'), '1024');
      assert.equal(options.body.get('height'), '1024');
      assert.equal(options.body.get('seed'), '42');
      assert.equal(options.body.get('steps'), null);
      assert.deepEqual(Buffer.from(await options.body.get('input_image_0').arrayBuffer()), PNG);
      return jsonResponse({ success: true, result: { image: PNG.toString('base64') } });
    } });
  assert.deepEqual(bytes, PNG);
  assert.equal(calls, 1);
});

test('Cloudflare 403 and 429 stop without retrying or exposing provider text', async () => {
  for (const status of [403, 429]) {
    let calls = 0;
    await assert.rejects(generarKlein({ referencia: PNG, prompt: 'pato', seed: 1, env,
      fetchImpl: async () => { calls++; return jsonResponse({ error: env.CLOUDFLARE_API_TOKEN }, status); } }),
    (e) => e.message.includes(String(status)) && !e.message.includes(env.CLOUDFLARE_API_TOKEN));
    assert.equal(calls, 1);
  }
});

test('malformed Cloudflare responses are rejected', async () => {
  for (const data of [{ success: false }, { result: { image: 'not base64!' } }, { result: { image: Buffer.from('not an image').toString('base64') } }]) {
    await assert.rejects(generarKlein({ referencia: PNG, prompt: 'pato', seed: 1, env,
      fetchImpl: async () => jsonResponse(data) }), /Cloudflare/);
  }
  await assert.rejects(generarKlein({ referencia: PNG, prompt: 'pato', seed: 1, env,
    fetchImpl: async () => { throw new Error('network ' + env.CLOUDFLARE_API_TOKEN); } }),
  (e) => e.message.includes('incierto') && !e.message.includes(env.CLOUDFLARE_API_TOKEN));
});

test('ten outputs stay private, use same reference and get exact callback IDs', async (t) => {
  const f = fixture(t), result = await ejecutarPrueba(f.options);
  assert.equal(result.solicitudes, 10);
  assert.equal(result.enviadas, 10);
  assert.equal(f.generated.length, 10);
  assert.ok(f.generated.every((g) => g.referencia.equals(PNG)));
  const docs = f.messages.filter((m) => m.method === 'sendDocument');
  assert.equal(docs.length, 11);
  for (const doc of docs.slice(1)) {
    for (const button of doc.fields.reply_markup.inline_keyboard[0])
      assert.ok(Buffer.byteLength(button.callback_data) <= 64);
  }
  const index = leer(f.p.indice);
  assert.equal(Object.keys(index).length, 10);
  assert.ok(Object.values(index).every((r) => r.w === 640 && r.h === 480 && r.estado === 'pendiente'));
  assert.equal(fs.existsSync(f.p.publico), false);
  assert.equal(fs.existsSync(f.p.catalogo), false);
});

test('resuming completed batch neither regenerates nor resends documents', async (t) => {
  const f = fixture(t);
  await ejecutarPrueba(f.options);
  f.generated.length = 0; f.messages.length = 0;
  await ejecutarPrueba(f.options);
  assert.equal(f.generated.length, 0);
  assert.equal(f.messages.filter((m) => m.method === 'sendDocument').length, 0);
});

test('failure on second generation retains first output and forbids ambiguous replay', async (t) => {
  const f = fixture(t);
  let calls = 0;
  const options = { ...f.options, generar: async () => { if (++calls === 2) throw new Error('Cloudflare timeout'); return PNG; } };
  await assert.rejects(ejecutarPrueba(options), /timeout/);
  assert.equal(calls, 2);
  const state = leer(f.stateFile);
  assert.equal(state.solicitudes, 2);
  assert.equal(state.escenas[0].envio, 'enviado');
  assert.equal(Object.keys(leer(f.p.indice)).length, 1);
  await assert.rejects(ejecutarPrueba(options), /incierta/);
  assert.equal(calls, 2);
});

test('confirmed Telegram rejection can resume from saved image', async (t) => {
  const f = fixture(t);
  let rejected = false;
  const telegram = f.options.telegram;
  f.options.telegram = async (...args) => {
    if (args[0] === 'sendDocument' && args[1].reply_markup && !rejected) {
      rejected = true; throw new Error('Telegram rechazó envío');
    }
    return telegram(...args);
  };
  await assert.rejects(ejecutarPrueba(f.options), /rechazó/);
  assert.equal(f.generated.length, 1);
  await ejecutarPrueba(f.options);
  assert.equal(f.generated.length, 10);
});

test('uncertain Telegram send blocks replay without another generation', async (t) => {
  const f = fixture(t), telegram = f.options.telegram;
  f.options.telegram = async (...args) => {
    if (args[1].reply_markup) throw Object.assign(new Error('envío incierto'), { incierto: true });
    return telegram(...args);
  };
  await assert.rejects(ejecutarPrueba(f.options), /incierto/);
  assert.equal(leer(f.stateFile).escenas[0].envio, 'incierto');
  await assert.rejects(ejecutarPrueba(f.options), /incierto/);
  assert.equal(f.generated.length, 1);
});

test('normalization failure recovers saved provider bytes without regeneration', async (t) => {
  const f = fixture(t), process = f.options.procesar;
  let failed = false;
  f.options.procesar = (...args) => {
    if (args[0] === 'resultado' && !failed) { failed = true; throw new Error('normalización'); }
    return process(...args);
  };
  await assert.rejects(ejecutarPrueba(f.options), /normalización/);
  await ejecutarPrueba(f.options);
  assert.equal(f.generated.length, 10);
});

test('missing private storage or changed source fails before generation', async (t) => {
  const f = fixture(t);
  await assert.rejects(ejecutarPrueba({ ...f.options, env: { ...env, EPISODIOS_PRIVADOS: '' } }), /privado/);
  assert.equal(f.generated.length, 0);
  await ejecutarPrueba(f.options);
  fs.appendFileSync(path.join(f.promo, 'public/app/duck-waving.png'), 'changed');
  await assert.rejects(ejecutarPrueba(f.options), /cambiaron/);
  assert.equal(f.generated.length, 10);
});

test('approval is idempotent, preserves dimensions and repairs a lost public copy', async (t) => {
  const f = fixture(t);
  await ejecutarPrueba(f.options);
  const id = Object.keys(leer(f.p.indice))[0];
  decidirKlein({ id, accion: 'aprobar', ...f });
  fs.rmSync(path.join(f.p.publico, id + '.png'));
  decidirKlein({ id, accion: 'aprobar', ...f });
  const cat = leer(f.p.catalogo);
  assert.equal(cat.recursos.length, 1);
  assert.equal(cat.recursos[0].w, 640);
  assert.equal(cat.recursos[0].h, 480);
  assert.equal(cat.recursos[0].tipo, 'imagen');
  decidirKlein({ id, accion: 'descartar', ...f });
  assert.equal(leer(f.p.indice)[id].estado, 'aprobada');
  assert.ok(fs.existsSync(path.join(f.p.publico, id + '.png')));
});

test('discard is idempotent and never publishes image', async (t) => {
  const f = fixture(t);
  await ejecutarPrueba(f.options);
  const id = Object.keys(leer(f.p.indice))[0], record = leer(f.p.indice)[id];
  decidirKlein({ id, accion: 'descartar', ...f });
  decidirKlein({ id, accion: 'descartar', ...f });
  decidirKlein({ id, accion: 'aprobar', ...f });
  assert.equal(fs.existsSync(path.join(f.p.privado, record.archivo)), false);
  assert.equal(leer(f.p.indice)[id].estado, 'descartada');
  assert.equal(fs.existsSync(f.p.publico), false);
});

test('decisions reject prefixes, invalid actions and unsafe image paths', async (t) => {
  const f = fixture(t);
  await ejecutarPrueba(f.options);
  const id = Object.keys(leer(f.p.indice))[0];
  assert.throws(() => decidirKlein({ id: id.slice(0, -1), accion: 'aprobar', ...f }), /exacto/);
  assert.throws(() => decidirKlein({ id, accion: 'otra', ...f }), /inválida/);
  const index = leer(f.p.indice); index[id].archivo = '../outside.png'; guardar(f.p.indice, index);
  assert.throws(() => decidirKlein({ id, accion: 'aprobar', ...f }), /Ruta/);
});

test('reconciliation recovers approvals lost from Actions pending queue', async (t) => {
  const f = fixture(t);
  await ejecutarPrueba(f.options);
  const ids = Object.keys(leer(f.p.indice));
  await reconciliarKlein({ ...f, env, fetchImpl: async (url, options) => {
    assert.equal(url.pathname, '/api/v1/fabrica/decisiones');
    assert.equal(options.headers.Authorization, 'Bearer factory-test-token');
    return jsonResponse({ data: { cursor: '123-1', decisiones: [
      { episodio: ids[0], accion: 'imagen-aprobar' },
      { episodio: ids[1], accion: 'imagen-descartar' },
      { episodio: 'k4b-unknown', accion: 'imagen-aprobar' },
    ] } });
  } });
  assert.equal(leer(f.p.indice)[ids[0]].estado, 'aprobada');
  assert.equal(leer(f.p.indice)[ids[1]].estado, 'descartada');
  assert.equal(leer(f.p.catalogo).recursos.length, 1);
});

test('Pillow prepares reference under 512px and preserves complete scene background', (t) => {
  const f = fixture(t), source = path.join(f.dir, 'source.png'), reference = path.join(f.dir, 'reference.png');
  const output = path.join(f.dir, 'output.png'), script = path.join(root, 'promo/scripts/fabrica/preparar-referencia.py');
  execFileSync('python', ['-c', 'from PIL import Image; import sys; Image.new("RGBA", (738,1436), (255,255,255,0)).save(sys.argv[1])', source]);
  const ref = JSON.parse(execFileSync('python', [script, 'referencia', source, reference], { encoding: 'utf8' }));
  assert.equal(ref.h, 480); assert.ok(ref.w < 512);
  const result = JSON.parse(execFileSync('python', [script, 'resultado', source, output], { encoding: 'utf8' }));
  assert.deepEqual(result, { w: 738, h: 1436 });
});


test('stored request count or scene IDs cannot bypass batch limit', async (t) => {
  const f = fixture(t);
  await ejecutarPrueba(f.options);
  const state = leer(f.stateFile);
  state.solicitudes = 11; guardar(f.stateFile, state);
  await assert.rejects(ejecutarPrueba(f.options), /Estado de lote inválido/);
  state.solicitudes = 10; state.escenas[0].id = '../outside'; guardar(f.stateFile, state);
  await assert.rejects(ejecutarPrueba(f.options), /Estado de lote inválido/);
  assert.equal(f.generated.length, 10);
});

test('Telegram adapter submits document and review keyboard to existing topic', async (t) => {
  const f = fixture(t);
  const client = clienteTelegram(env, async (url, options) => {
    assert.ok(url.endsWith('/sendDocument'));
    assert.equal(options.body.get('chat_id'), '-123');
    assert.equal(options.body.get('message_thread_id'), '5');
    assert.deepEqual(JSON.parse(options.body.get('reply_markup')), { inline_keyboard: [] });
    assert.ok(options.body.get('document') instanceof Blob);
    return jsonResponse({ ok: true, result: { message_id: 99, document: { file_id: 'test' } } });
  });
  const sent = await client('sendDocument', { caption: 'prueba', reply_markup: { inline_keyboard: [] } },
    path.join(f.promo, 'public/app/duck-waving.png'));
  assert.equal(sent.message_id, 99);
});

test('Telegram server failure is ambiguous and never automatically retried', async () => {
  let calls = 0;
  const client = clienteTelegram(env, async () => { calls++; return jsonResponse({ ok: false }, 502); });
  await assert.rejects(client('sendMessage', { text: 'test' }), (e) => e.incierto === true);
  assert.equal(calls, 1);
});

test('completed image file repairs interrupted state without another generation', async (t) => {
  const f = fixture(t);
  await ejecutarPrueba(f.options);
  const state = leer(f.stateFile), id = state.escenas[0].id;
  delete state.escenas[0].w; delete state.escenas[0].h;
  state.escenas[0].estado = 'solicitando'; guardar(f.stateFile, state);
  const index = leer(f.p.indice); delete index[id]; guardar(f.p.indice, index);
  f.generated.length = 0;
  await ejecutarPrueba(f.options);
  assert.equal(f.generated.length, 0);
  assert.equal(leer(f.p.indice)[id].w, 640);
});
