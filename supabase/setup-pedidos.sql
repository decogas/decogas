-- ============================================================
-- Tabla de PEDIDOS a proveedores (panel interno)
-- Ejecutar una sola vez en: Supabase -> SQL Editor -> Run
-- ============================================================

create table if not exists public.pedidos (
  id             bigint generated always as identity primary key,
  created_at     timestamptz  not null default now(),
  producto_slug  text,
  producto       text         not null,
  marca          text,
  categoria      text,
  proveedor      text,
  precio         numeric,
  estado         text         not null default 'pedido'
                 check (estado in ('pedido','confirmado','pagado','recibido','instalado','cancelado')),
  nota           text
);

create index if not exists pedidos_created_at_idx on public.pedidos (created_at desc);
create index if not exists pedidos_estado_idx     on public.pedidos (estado);

-- Seguridad: son datos internos del negocio, NO pueden quedar abiertos al
-- público como el catálogo. Solo los usuarios que han iniciado sesión en el
-- panel pueden verlos o tocarlos.
alter table public.pedidos enable row level security;

drop policy if exists "pedidos solo autenticados" on public.pedidos;
create policy "pedidos solo autenticados"
  on public.pedidos
  for all
  to authenticated
  using (true)
  with check (true);
