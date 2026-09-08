-- ============================================================
-- COSTES de las máquinas (lo que nos cuesta a nosotros)
-- Ejecutar una vez en: Supabase -> SQL Editor -> Run
--
-- IMPORTANTE: esto NO va en la tabla "products", que es PÚBLICA (la lee
-- cualquiera que entre en la web para ver el catálogo). Si el coste
-- estuviera ahí, se verían nuestros márgenes desde fuera.
-- ============================================================

-- Tabla de SOLO INSERTAR: cada cambio de precio añade una fila nueva y
-- nunca se pisa la anterior. Así queda el histórico completo de lo que
-- costaba cada máquina en cada momento, que es justo lo que se pidió.
-- El coste vigente de una máquina es simplemente su fila más reciente.
create table if not exists public.costes (
  id             bigint generated always as identity primary key,
  producto_slug  text        not null,
  coste          numeric     not null check (coste >= 0),
  creado_at      timestamptz not null default now(),
  creado_por     text,
  nota           text
);

create index if not exists costes_slug_fecha_idx
  on public.costes (producto_slug, creado_at desc);

alter table public.costes enable row level security;

drop policy if exists "costes solo autenticados" on public.costes;
create policy "costes solo autenticados"
  on public.costes for all to authenticated
  using (true) with check (true);

-- El pedido guarda LO QUE COSTÓ EN SU MOMENTO. Si el proveedor sube el
-- precio después, el pedido viejo debe seguir diciendo lo que se pagó.
alter table public.pedidos add column if not exists coste numeric;
