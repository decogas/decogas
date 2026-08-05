# `supabase/` — SQL de la base de datos

**Empieza por [`ESTADO-ACTUAL.md`](./ESTADO-ACTUAL.md)**: es la foto real y
verificada (05/08/2026) de tablas, políticas de seguridad y restricciones
tal como están HOY en producción, sacada directamente de la base de datos.

Los `setup-supabase-v*.sql` son el historial de cómo se fue construyendo la
base de datos con el tiempo. Varios quedaron desactualizados respecto a lo
que hay realmente en Supabase (parches aplicados a mano desde el SQL Editor
sin volver a guardarlos aquí) — no asumas que reflejan el estado actual sin
contrastarlo con `ESTADO-ACTUAL.md`.

- `arreglo-storage-admin.sql` — sigue vigente, ya ejecutado (04/08/2026).
- `setup-supabase-v12-estados-real.sql` — sigue vigente, ya ejecutado y
  coincide con `ESTADO-ACTUAL.md`.
