// The factory's formats: fabrica/formatos/index.json lists them (the moderation bot
// reads the same file to offer them in /video) and each has its module here.
import fs from 'node:fs';
import path from 'node:path';
import { FAB } from '../comun.mjs';

export const POR_DEFECTO = 'lista-scrapbook';

export function listaFormatos() {
  return JSON.parse(fs.readFileSync(path.join(FAB, 'formatos', 'index.json'), 'utf8')).formatos;
}

/** The module of a format (by id; the default one for null/undefined). */
export async function cargarFormato(id) {
  const fid = id || POR_DEFECTO;
  const meta = listaFormatos().find((f) => f.id === fid);
  if (!meta) throw new Error(`No existe el formato «${fid}» (hay: ${listaFormatos().map((f) => f.id).join(', ')})`);
  const mod = await import(`./${fid}.mjs`);
  return { ...meta, ...mod };
}
