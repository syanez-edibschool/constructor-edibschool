-- ─────────────────────────────────────────────────────────────────────────────
-- Límite de intentos del acceso directo con el correo (api/login-directo.ts).
--
-- Las funciones serverless NO comparten estado: un Map en memoria se pierde en
-- cada arranque en frío y no se comparte entre instancias. Hace falta esta tabla
-- para que el límite sea real.
--
-- Namespacing del ecosistema: la Supabase es COMPARTIDA con Seguimiento (seg_*)
-- y Mentorías (tut_*) → el Acelerador usa el prefijo `project_`.
--
-- Aditiva e idempotente: no toca nada existente.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.project_login_attempt (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  ip          text not null,
  created_at  timestamptz not null default now()
);

-- No son opcionales: sin ellos las dos consultas del límite recorren la tabla
-- entera en CADA intento de login.
create index if not exists project_login_attempt_email_created_idx
  on public.project_login_attempt (email, created_at desc);
create index if not exists project_login_attempt_ip_created_idx
  on public.project_login_attempt (ip, created_at desc);

-- RLS activado y SIN NINGUNA POLÍTICA a propósito: el único acceso es el
-- endpoint con service_role, que se salta RLS. Con la clave anon:
--   lectura → [] con 200 (no ve filas; no es un error)
--   escritura → 401 «violates row-level security policy»
alter table public.project_login_attempt enable row level security;
