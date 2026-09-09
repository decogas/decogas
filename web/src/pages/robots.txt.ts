import type { APIRoute } from 'astro';

// robots.txt generado en el build para que las rutas y el sitemap sigan a
// SITE/BASE (antes era estático y apuntaba a un sitemap.xml que no existe:
// @astrojs/sitemap genera sitemap-index.xml).
export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const lines = [
    'User-agent: *',
    'Allow: /',
    `Disallow: ${base}/admin`,
    `Disallow: ${base}/clientes`,
    '',
    `Sitemap: ${new URL(`${base}/sitemap-index.xml`, site).href}`,
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
