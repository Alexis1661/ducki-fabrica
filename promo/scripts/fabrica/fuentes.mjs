// Downloads the scrapbook kit's Google Fonts once into public/fuentes/ and writes
// src/todo/fuentes.json, so renders never fetch fonts from the internet (the network
// here drops often, and a render stalls when a font can't be fetched).
//   node scripts/fabrica/fuentes.mjs
import fs from 'node:fs';
import path from 'node:path';
import { PROMO } from './comun.mjs';

const FAMILIES = ['Abril Fatface', 'Anton', 'Archivo Black', 'Bebas Neue', 'Special Elite', 'Permanent Marker', 'Shrikhand', 'Gloock', 'Rubik Mono One', 'Caveat Brush'];
const SUBSETS = ['latin', 'latin-ext'];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const out = path.join(PROMO, 'public', 'fuentes');
fs.mkdirSync(out, { recursive: true });
const manifest = {};
for (const fam of FAMILIES) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam)}&display=block`, { headers: { 'User-Agent': UA } })).text();
  const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{([^}]*)}/g)];
  manifest[fam] = [];
  for (const [, subset, body] of blocks) {
    if (!SUBSETS.includes(subset)) continue;
    const url = body.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
    const range = body.match(/unicode-range:\s*([^;]+);/)?.[1]?.trim();
    if (!url) continue;
    const file = `${fam.toLowerCase().replace(/\s+/g, '-')}-${subset}.woff2`;
    fs.writeFileSync(path.join(out, file), Buffer.from(await (await fetch(url)).arrayBuffer()));
    manifest[fam].push({ file: `fuentes/${file}`, unicodeRange: range });
  }
  console.log(fam, manifest[fam].length, 'archivos');
}
fs.writeFileSync(path.join(PROMO, 'src', 'todo', 'fuentes.json'), JSON.stringify(manifest, null, 1));
