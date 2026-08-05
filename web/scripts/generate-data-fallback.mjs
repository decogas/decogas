// Regenera web/public/data-*.js desde Supabase antes de cada build, para que
// el fallback (cuando Supabase no responde a tiempo en el navegador, o para
// el modo demo del panel) nunca tenga más de una semana de desfase respecto
// al catálogo real. Antes estos ficheros se editaban a mano y se quedaban
// desfasados en silencio (ver docs/HANDOFF-2026-08-04.md).
//
// Si Supabase no responde, deja los ficheros existentes tal cual (mejor un
// fallback antiguo que uno vacío) y avisa por consola sin romper el build.
// Nota: no importa src/lib/productos.mjs porque ese módulo usa `?raw` (una
// característica de Vite) y este script corre con Node "pelado" en el hook
// prebuild, antes de que Astro/Vite entren en juego. Se duplica aquí la
// misma llamada REST simple, ya con reintentos, como en scripts/backup-supabase.mjs.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

async function fetchProductosVisibles() {
  const cfgSrc = readFileSync(PUBLIC_DIR + 'config.js', 'utf8');
  const grab = (key) => (cfgSrc.match(new RegExp(key + String.raw`:\s*"([^"]*)"`)) || [])[1] || '';
  const url = grab('supabaseUrl').replace(/\/+$/, '');
  const key = grab('supabaseAnonKey');
  if (!url || !key) return [];
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const res = await fetch(`${url}/rest/v1/products?select=*&visible=eq.true&order=pop.asc`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const total = Number((res.headers.get('content-range') || '').split('/')[1]);
      const rows = await res.json();
      if (Number.isFinite(total) && rows.length !== total) {
        throw new Error(`respuesta parcial: ${rows.length}/${total} filas`);
      }
      return rows.filter((p) => p.slug && p.name && Number(p.price) > 0);
    } catch (e) {
      console.warn(`[generate-data-fallback] Intento ${intento}/3 fallido: ${e.message}`);
      if (intento === 3) return [];
      await new Promise((r) => setTimeout(r, 1500 * intento));
    }
  }
  return [];
}

const CATEGORIAS = [
  { category: 'calderas', file: 'data-calderas.js' },
  { category: 'aires', file: 'data-aires.js' },
  { category: 'termos', file: 'data-termos.js' },
  { category: 'aerotermia', file: 'data-aerotermia.js' },
];

function cabecera(file) {
  const path = PUBLIC_DIR + file;
  if (!existsSync(path)) return '';
  const actual = readFileSync(path, 'utf8');
  // Conserva los comentarios de cabecera existentes tal cual (documentan el propósito del archivo).
  const fin = actual.indexOf('window.DECOGAS_DATA');
  return fin === -1 ? '' : actual.slice(0, fin);
}

function metaCategoria(file) {
  const path = PUBLIC_DIR + file;
  if (!existsSync(path)) return { type: '', installNote: '' };
  const actual = readFileSync(path, 'utf8');
  const type = (actual.match(/type:\s*"([^"]*)"/) || [])[1] || '';
  const installNote = (actual.match(/installNote:\s*"([^"]*)"/) || [])[1] || '';
  return { type, installNote };
}

function esc(s) {
  return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function productoAJs(p) {
  const specs = JSON.stringify(Array.isArray(p.specs) ? p.specs : []);
  const features = JSON.stringify(Array.isArray(p.features) ? p.features : []);
  return `    { brand:"${esc(p.brand)}", slug:"${esc(p.slug)}", name:"${esc(p.name)}", specs:${specs}, price:${Number(p.price) || 0}, pop:${Number.isFinite(Number(p.pop)) ? Number(p.pop) : 999}${p.best ? ', best:true' : ''},
      description:"${esc(p.description)}",
      features:${features},
      idealFor:"${esc(p.ideal_for)}", efficiency:"${esc(p.efficiency)}"${p.img ? `, img:"${esc(p.img)}"` : ''} }`;
}

async function main() {
  const todos = await fetchProductosVisibles();
  if (!todos.length) {
    console.warn('[generate-data-fallback] Supabase no devolvió productos (o falló) — se dejan los data-*.js existentes sin tocar.');
    return;
  }
  for (const { category, file } of CATEGORIAS) {
    const productos = todos.filter((p) => p.category === category);
    if (!productos.length) {
      console.log(`[generate-data-fallback] ${category}: sin productos visibles, se deja ${file} tal cual.`);
      continue;
    }
    const { type, installNote } = metaCategoria(file);
    const js = `${cabecera(file)}window.DECOGAS_DATA = {
  page: "${category}",
  type: "${esc(type)}",
  installNote: "${esc(installNote)}",
  products: [
${productos.map(productoAJs).join(',\n')}
  ]
};
`;
    writeFileSync(PUBLIC_DIR + file, js, 'utf8');
    console.log(`[generate-data-fallback] ${category}: ${productos.length} productos → public/${file}`);
  }
}

main().catch((e) => {
  console.warn('[generate-data-fallback] Error inesperado, se dejan los data-*.js existentes sin tocar:', e.message);
});
