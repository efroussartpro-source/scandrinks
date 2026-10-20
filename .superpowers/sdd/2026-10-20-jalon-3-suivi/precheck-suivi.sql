-- precheck-suivi.sql — Essai à blanc du contrôle de session de la migration du suivi (jalon 3).
--
-- À lancer sur le vrai projet (outil execute_sql) juste avant d'appliquer
-- 20261020180000_suivi.sql. Le nouveau corps de private.is_allowed(), créé sous
-- un nom temporaire avec les mêmes réglages (security definer, propriétaire
-- postgres), doit reconnaître la session d'un téléphone connecté au compte du
-- tabac. Rien n'est gardé, et rien de la session n'est affiché. Dernière ligne : OK.

begin;

-- La fonction de la migration appartiendra à postgres : il doit lire auth.sessions (droit de lecture)
-- et passer la RLS de cette table, active sans aucune règle (BYPASSRLS).
do $$
begin
  if current_user <> 'postgres' then
    raise exception 'ÉCHEC : essai à lancer en tant que postgres, pas %', current_user;
  end if;
  if not has_table_privilege('postgres', 'auth.sessions', 'select') then
    raise exception 'ÉCHEC : postgres ne peut pas lire auth.sessions';
  end if;
  if not (select rolbypassrls from pg_roles where rolname = 'postgres') then
    raise exception 'ÉCHEC : postgres ne passe pas la RLS de auth.sessions';
  end if;
end
$$;

create function pg_temp.is_allowed_suivi() returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from auth.sessions s
    where s.id = (auth.jwt() ->> 'session_id')::uuid and (s.not_after is null or s.not_after > now())
  ) then
    raise exception 'session_revoked' using errcode = 'PT401';
  end if;
  return exists (select 1 from public.allowed_users where user_id = (select auth.uid()));
end
$$;

-- Les claims d'un téléphone connecté au compte du tabac, comme PostgREST les poserait.
do $$
begin
  perform set_config('request.jwt.claims', coalesce((
    select json_build_object('sub', s.user_id, 'role', 'authenticated', 'session_id', s.id)::text
    from auth.sessions s
    join public.allowed_users a on a.user_id = s.user_id
    where s.not_after is null or s.not_after > now()
    limit 1
  ), '{}'), true);
end
$$;

set local role authenticated;
do $$
begin
  if not pg_temp.is_allowed_suivi() then
    raise exception 'ÉCHEC : la session du compte du tabac n''est pas reconnue';
  end if;
end
$$;
reset role;

rollback;

select 'OK' as resultat;
