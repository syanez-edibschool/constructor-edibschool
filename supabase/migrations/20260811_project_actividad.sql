-- ─────────────────────────────────────────────────────────────────────────────
-- project_actividad — cuándo estuvo REALMENTE dentro cada alumno.
--
-- POR QUÉ EXISTE: auth.users.last_sign_in_at solo se actualiza al completar un
-- inicio de sesión (canjear el magic link). NO se actualiza al refrescar la
-- sesión, así que un alumno que entró hace semanas y sigue usando la app a
-- diario seguiría mostrando la fecha vieja. Esto mide la actividad de verdad.
--
-- Namespace project_* = app Acelerador (base compartida del ecosistema).
-- Migración ADITIVA e IDEMPOTENTE.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.project_actividad (
  usuario_id        uuid        primary key references auth.users (id) on delete cascade,
  ultima_actividad  timestamptz not null default now(),
  visitas           bigint      not null default 1,
  creado_en         timestamptz not null default now()
);

create index if not exists project_actividad_ultima_idx
  on public.project_actividad (ultima_actividad desc);

-- RLS activada y SIN políticas: nadie escribe la tabla directamente. Se toca
-- solo por la función de abajo (SECURITY DEFINER) y se lee por backend con
-- service_role. Así un alumno no puede falsear la actividad de otro.
alter table public.project_actividad enable row level security;

-- Registra actividad del usuario de la sesión actual. SECURITY DEFINER para
-- poder escribir con RLS activada, pero SOLO escribe auth.uid(): el llamante no
-- puede tocar la fila de nadie más aunque lo intente.
create or replace function public.project_registrar_actividad()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;   -- sin sesión no hay nada que registrar
  end if;

  insert into public.project_actividad (usuario_id, ultima_actividad, visitas)
  values (auth.uid(), now(), 1)
  on conflict (usuario_id) do update
    set ultima_actividad = now(),
        visitas = public.project_actividad.visitas + 1;
end;
$$;

revoke all on function public.project_registrar_actividad() from public;
grant execute on function public.project_registrar_actividad() to authenticated;
