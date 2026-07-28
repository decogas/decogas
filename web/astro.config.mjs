import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// SITE y BASE se pueden sobreescribir por variable de entorno para publicar en
// otro dominio sin tocar código, p. ej. decogas.es:
//   SITE=https://decogas.es BASE=/ npm run build
const BASE = process.env.BASE || '/decogas';
// Ruta base sin barras extra: '/decogas' o '' (cuando BASE es '/').
const BASE_PATH = ('/' + BASE.replace(/^\/+|\/+$/g, '')).replace(/\/$/, '');

// Normaliza cada URL del sitemap para que sea IDÉNTICA al canonical de su página
// (si no coinciden, Google diluye las señales entre dos URLs):
//   · home           -> termina en '/'
//   · páginas .html  -> aires, calderas, producto/x, marcas/x -> con '.html'
//   · blog           -> .../blog/<id>/index -> .../blog/<id>/
function serialize(item) {
  const url = new URL(item.url);
  const path = url.pathname.replace(/\/+$/, ''); // sin barra final para comparar
  if (path === BASE_PATH) {
    url.pathname = (BASE_PATH || '') + '/';          // home con barra
  } else if (path.endsWith('/index')) {
    url.pathname = path.slice(0, -'/index'.length) + '/'; // blog: .../index -> .../
  } else if (!/\.[a-z0-9]+$/i.test(path)) {
    url.pathname = path + '.html';                   // páginas raíz/producto/marcas
  }
  item.url = url.toString();
  return item;
}

export default defineConfig({
  site: process.env.SITE || 'https://queren05.github.io',
  base: BASE,
  output: 'static',
  build: { format: 'file' },
  trailingSlash: 'ignore',
  // Fuera del sitemap los paneles privados y la demo del comparador (llevan
  // noindex): evita la contradicción sitemap↔robots que penaliza Google.
  integrations: [sitemap({
    filter: (page) => !/\/(admin|clientes|analiticas|comparador)(\.html)?$/.test(page),
    serialize,
  })],
});
