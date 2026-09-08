-- ============================================================
-- Cantidad por pedido
-- Ejecutar una vez en: Supabase -> SQL Editor -> Run
--
-- Antes cada pedido era siempre 1 unidad: pedir tres calderas iguales
-- obligaba a repetir la operación tres veces y salían tres líneas.
-- ============================================================
alter table public.pedidos
  add column if not exists cantidad integer not null default 1
  check (cantidad > 0);
