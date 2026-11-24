// The app's numbers (aggregates, nobody named) from the API: GET /api/v1/fabrica/datos.
// The writer and the weekly plan use them for «comunidad» videos and real figures.
import { loadEnv } from './comun.mjs';

let cache = null;

/** The numbers, or null when the API cannot be reached (the writer goes on without them). */
export async function datosApp() {
  if (cache !== null) return cache || null;
  loadEnv();
  const token = process.env.FABRICA_TOKEN;
  if (!token) { cache = false; return null; }
  const api = (process.env.FABRICA_API || 'https://api.duck-i.app').replace(/\/$/, '');
  try {
    const res = await fetch(`${api}/api/v1/fabrica/datos`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cache = (await res.json()).data ?? false;
    // the universities that grew the most first
    cache?.usuarios?.nuevos_por_universidad_7d?.sort((a, b) => b.nuevos - a.nuevos);
  } catch (e) {
    console.log(`datos: no pude leer los datos de la app (${String(e.message ?? e).slice(0, 120)}); sigo sin ellos`);
    cache = false;
  }
  return cache || null;
}
