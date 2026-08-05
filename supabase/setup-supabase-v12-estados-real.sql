-- ============================================================
-- setup-supabase-v12-estados-real.sql
-- ------------------------------------------------------------
-- El archivo v7 documentaba el CHECK de `estado` como
-- ('pendiente','llamado','presupuestado','cerrado'), pero en
-- algún momento se amplió a mano en el panel de Supabase a los
-- 5 valores que el código realmente usa (clientes.js:31) y
-- "cerrado" quedó sin uso. Este script deja el CHECK real
-- documentado y sincronizado con el código. Es idempotente:
-- se puede ejecutar aunque el CHECK ya esté así.
--
-- CÓMO: Supabase → SQL Editor → pegar TODO → Run.
-- ============================================================

alter table public.leads
  drop constraint if exists leads_estado_check;
alter table public.leads
  add constraint leads_estado_check
  check (estado in ('pendiente', 'llamado', 'presupuestado', 'aprobado', 'denegado'));
