# Estado real de la base de datos (verificado 05/08/2026)

> Los archivos `setup-supabase-v3.sql` a `v11...sql` de esta carpeta son el
> **historial** de cómo se fue construyendo la base de datos, pero varios
> quedaron desactualizados respecto a lo que hay realmente en producción
> (parches aplicados a mano desde el SQL Editor sin volver a guardarlos en
> el repo). Este documento es la foto REAL, sacada directamente de Supabase
> con una consulta a `information_schema`/`pg_catalog`, no de memoria ni de
> los `.sql` viejos. Si hay contradicción entre este documento y un `.sql`
> anterior, manda este documento.
>
> `setup-supabase-v12-estados-real.sql` sigue siendo válido y ya refleja lo
> de abajo (el CHECK de `estado` con los 5 valores reales).

## Tablas (todas con RLS activado)

`admins`, `change_log`, `leads`, `products`, `web_events` — las 5 tienen
Row Level Security **activado**. Ninguna tabla del proyecto está desprotegida.

## Políticas de seguridad (RLS) reales

Todas dependen de una función `is_admin()` (comprueba si el usuario
autenticado está en la tabla `admins`) — su definición SQL no está volcada
aquí, vive en la base de datos.

| Tabla | Quién puede | Acción |
|---|---|---|
| `products` | `anon` + `authenticated` | **SELECT** (catálogo público) |
| `products` | `authenticated` + `is_admin()` | INSERT / UPDATE / DELETE |
| `leads` | `anon` + `authenticated` | **INSERT** (formulario público) |
| `leads` | `authenticated` + `is_admin()` | SELECT / UPDATE / DELETE |
| `web_events` | `anon` + `authenticated` | **INSERT** (analítica propia) |
| `web_events` | `authenticated` + `is_admin()` | SELECT |
| `change_log` | `authenticated` + `is_admin()` | SELECT / INSERT / UPDATE |
| `admins` | `authenticated` + `is_admin()` | SELECT |

**Conclusión de seguridad**: correcto y sin agujeros. El formulario público
solo puede *crear* leads, nunca leerlos; la analítica solo puede *crear*
eventos, nunca leerlos; el registro de cambios no es accesible por `anon`
en ningún caso (la duda que planteaba la auditoría de hoy queda resuelta:
sí está protegido).

## Columnas y restricciones reales por tabla

### `leads`
- `id uuid` (pk, `gen_random_uuid()`), `created_at`, `name`, `phone`,
  `email`, `interest`, `message`, `estado` (default `'pendiente'`)
- CHECK `leads_estado_check`: `estado in ('pendiente','llamado','presupuestado','aprobado','denegado')`
  — coincide exactamente con `ESTADOS` en `clientes.js:31`. Sin drift.
- CHECK `leads_email_valido`: vacío o formato de email válido
- CHECK `leads_longitudes`: `name` 2-80 car., `phone` ≤25, `email` ≤120,
  `interest` ≤60, `message` ≤2000

### `products`
- `slug`, `name`, `brand`, `category`, `price numeric`, `specs jsonb`,
  `features jsonb`, `description`, `ideal_for`, `pop int` (default 999),
  `best bool`, `visible bool` (default true), `efficiency`, `img`,
  `updated_at`
- CHECK `products_price_check`: `0 < price < 100000`

### `web_events`
- `id bigint`, `created_at`, `type`, `path`, `referrer`, `source`,
  `session`, `device`
- CHECK `web_events_type_check`: `type in ('pageview','call','whatsapp','lead')`
- CHECK `web_events_device_check`: `device in ('movil','escritorio')` o NULL
- Límites de longitud en `path` (200), `referrer` (300), `source` (120),
  `session` (64)

### `change_log`
- `id bigint`, `created_at`, `user_email`, `action`, `entity`, `entity_id`,
  `label`, `before_data jsonb`, `after_data jsonb`, `reverted bool`
  (default false)
- Sin restricciones CHECK.

### `admins`
- `email text` (pk implícita, sin NULL), `added_at` (default `now()`)
