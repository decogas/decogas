-- ============================================================
-- setup-supabase-v13-rate-limit-leads.sql
-- ------------------------------------------------------------
-- El freno actual del formulario (localStorage, 20s) es solo del
-- lado del navegador: cualquiera con la anon key (pública por
-- diseño) puede insertar leads en bucle directamente contra la
-- API REST, sin pasar por la web ni por ese freno.
--
-- Este script añade un límite duro EN LA BASE DE DATOS: si se
-- insertan más de 15 leads en los últimos 10 minutos (contando
-- todos los orígenes), la petición número 16 se rechaza con un
-- error claro. 15/10min es generoso para tráfico real (Decogas
-- recibe pocos leads reales al día) pero corta un ataque de
-- inundación en seco.
--
-- No sustituye a un WAF/Cloudflare por IP (eso bloquearía por
-- IP concreta, esto es un límite global), pero es la protección
-- real más fuerte posible sin añadir infraestructura nueva.
--
-- CÓMO: Supabase → SQL Editor → pegar TODO → Run. Es idempotente
-- (se puede ejecutar más de una vez sin duplicar nada).
-- ============================================================

create or replace function public.leads_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recientes int;
begin
  select count(*) into recientes
  from public.leads
  where created_at > now() - interval '10 minutes';

  if recientes >= 15 then
    raise exception 'Demasiadas solicitudes en poco tiempo. Inténtalo de nuevo en unos minutos.'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

drop trigger if exists leads_rate_limit_trigger on public.leads;
create trigger leads_rate_limit_trigger
  before insert on public.leads
  for each row
  execute function public.leads_rate_limit();
