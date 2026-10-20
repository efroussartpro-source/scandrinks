-- supabase-stub.sql — Imitation minimale de Supabase pour lancer les tests SQL
-- sur un PostgreSQL local, sans toucher au vrai projet.
--
-- Reproduit seulement ce dont la migration et les tests dépendent : les rôles
-- de l'API, le schéma auth (auth.users, auth.sessions, auth.uid(), auth.jwt())
-- et les droits par défaut que Supabase accorde sur le schéma public. Ne sert
-- jamais en production.

-- Les rôles sont communs à toute l'instance : créés une seule fois.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end
$$;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text
);

-- Une ligne par téléphone connecté ; la déconnexion la retire. Comme sur
-- Supabase : RLS active sans aucune règle, donc fermée aux rôles de l'API ;
-- postgres, propriétaire de private.is_allowed(), la contourne (BYPASSRLS).
create table auth.sessions (
  id uuid primary key,
  user_id uuid not null,
  not_after timestamptz
);
alter table auth.sessions enable row level security;

-- Comme Supabase : l'identifiant du compte connecté vient des claims du jeton.
create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

-- Recopie de la fonction du vrai projet : les claims du jeton, ou null sans jeton.
create function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;

-- Droits par défaut de Supabase sur le schéma public : tout est ouvert aux
-- rôles de l'API, et c'est la migration qui doit le refermer.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
