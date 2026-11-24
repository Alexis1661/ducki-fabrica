// Cloudflare-hosted inference only. Never retry an ambiguous generation.
export const MODELO = '@cf/black-forest-labs/flux-2-klein-4b';

export function credenciales(env = process.env) {
  if (!/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID ?? ''))
    throw new Error('Falta CLOUDFLARE_ACCOUNT_ID válido (32 caracteres hexadecimales).');
  if (!env.CLOUDFLARE_API_TOKEN?.trim()) throw new Error('Falta CLOUDFLARE_API_TOKEN.');
  return { cuenta: env.CLOUDFLARE_ACCOUNT_ID, token: env.CLOUDFLARE_API_TOKEN };
}

export async function generarKlein({ referencia, prompt, seed, env = process.env, fetchImpl = fetch }) {
  const { cuenta, token } = credenciales(env);
  const form = new FormData();
  form.set('prompt', prompt);
  form.set('width', '1024');
  form.set('height', '1024');
  form.set('seed', String(seed));
  form.set('input_image_0', new Blob([referencia], { type: 'image/png' }), 'ducki.png');
  let res;
  try {
    res = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${cuenta}/ai/run/${MODELO}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
      signal: AbortSignal.timeout(240_000),
    });
  } catch {
    throw new Error('Cloudflare: conexión interrumpida o timeout; resultado incierto. No se reintentará.');
  }
  if (!res.ok) {
    const motivo = { 401: 'token inválido', 403: 'sin permiso Workers AI o acceso a cuenta', 429: 'cuota o límite alcanzado' }[res.status] ?? 'solicitud rechazada';
    throw new Error(`Cloudflare HTTP ${res.status}: ${motivo}. No se reintentará.`);
  }
  let body;
  try { body = await res.json(); } catch { throw new Error('Cloudflare: respuesta inválida; no se reintentará.'); }
  const image = body.result?.image;
  if (body.success === false || typeof image !== 'string') throw new Error('Cloudflare: respuesta sin imagen; no se reintentará.');
  const b64 = image.replace(/^data:image\/(?:png|jpeg|webp);base64,/, '');
  if (!b64.length || b64.length > 28_000_000 || b64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64))
    throw new Error('Cloudflare: imagen Base64 inválida; no se reintentará.');
  const bytes = Buffer.from(b64, 'base64');
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!png && !jpeg && !webp) throw new Error('Cloudflare: formato de imagen desconocido.');
  return bytes;
}
