-- 20261021120000_images.sql — ScanDrinks : les images des codes (refonte du jalon 4).
--
-- Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.7, §6.3, §6.4)
--
-- Chaque code peut avoir une image : celle d'Open Food Facts, recopiée chez
-- nous, ou une photo de l'équipe. Les fichiers vont dans le compartiment privé
-- « photos », sous codes/<code>/<uuid>.jpg ; une nouvelle image a un nouveau
-- nom, et l'ancienne n'est jamais supprimée. L'image d'un produit est celle du
-- code de son pack Metro, sinon celle d'un autre de ses codes. Compatible avec
-- l'app des jalons 1 à 3 encore en service : colonnes ajoutées à la fin, mêmes
-- signatures, réponses seulement complétées. Rien n'est retiré.

-- ---------------------------------------------------------------------------
-- Image de chaque code
-- ---------------------------------------------------------------------------

-- Un chemin et sa provenance (« off » : Open Food Facts, « equipe » : photo de
-- l'équipe), ou ni l'un ni l'autre. Le chemin est dans le dossier de son code.
-- « is true » : une valeur vide rendrait la condition inconnue, et une
-- contrainte laisse passer ce qui est inconnu.
alter table public.barcodes
  add column photo_path text,
  add column photo_source text,
  add constraint barcodes_photo_check check (
    (photo_path is null and photo_source is null)
    or ((photo_source in ('off', 'equipe')
      and photo_path ~ ('^codes/' || code || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')) is true)
  );

-- La règle barcodes_update existe déjà : seules ces deux colonnes s'ajoutent.
grant update (photo_path, photo_source) on table public.barcodes to authenticated;

-- ---------------------------------------------------------------------------
-- Image du produit et recherche d'un code
-- ---------------------------------------------------------------------------

-- Celle du code dont les unités valent le pack Metro, sinon celle du premier
-- code qui en a une (par date d'ajout, puis par code), sinon rien. La colonne
-- s'ajoute à la fin : celles d'avant ne bougent pas.
create or replace view public.product_stock
with (security_invoker = true)
as
select
  p.id,
  p.name,
  p.pack_size,
  p.alert_threshold,
  p.target_stock,
  p.archived,
  p.created_at,
  p.updated_at,
  coalesce(sum(m.delta) filter (where m.cancelled_at is null), 0)::int as stock,
  (
    select b.photo_path
    from public.barcodes b
    where b.product_id = p.id and b.photo_path is not null
    order by b.units = p.pack_size desc, b.created_at, b.code
    limit 1
  ) as photo_path
from public.products p
left join public.movements m on m.product_id = p.id
group by p.id;

-- La recherche d'un code donne aussi son image (chemin et provenance) ; le
-- produit donne la sienne, par la vue.
create or replace function public.lookup_barcode(p_code text) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not private.is_allowed() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object('code', b.code, 'units', b.units, 'photo_path', b.photo_path, 'photo_source', b.photo_source,
      'product', to_jsonb(ps))
    from public.barcodes b
    join public.product_stock ps on ps.id = b.product_id
    where b.code = p_code
  );
end
$$;

-- Enregistre l'image d'un code, une fois le fichier envoyé dans « photos ».
-- Rejouée, elle renvoie la même réponse.
create function public.set_barcode_photo(p_code text, p_path text, p_source text) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_code text;
begin
  if not private.is_allowed() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select b.code into v_code from public.barcodes b where b.code = p_code for update;
  if v_code is null then
    raise exception 'invalid_input:code';
  end if;
  if p_source is null or p_source not in ('off', 'equipe') then
    raise exception 'invalid_input:source';
  end if;
  if p_path is null
     or p_path !~ ('^codes/' || v_code || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$') then
    raise exception 'invalid_input:path';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'photos' and o.name = p_path) then
    raise exception 'invalid_input:photo';
  end if;
  update public.barcodes set photo_path = p_path, photo_source = p_source where code = v_code;
  return jsonb_build_object('code', v_code, 'photo_path', p_path, 'photo_source', p_source);
end
$$;

revoke all on function public.set_barcode_photo(text, text, text) from public, anon;
grant execute on function public.set_barcode_photo(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Stockage
-- ---------------------------------------------------------------------------

-- Compartiment privé : les images se lisent par des liens signés d'une heure.
-- Des JPEG de 256 Ko au plus (l'app les envoie en 480 px de côté au plus).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 262144, array['image/jpeg'])
on conflict (id) do nothing;

-- Le compte du tabac lit et ajoute des images, sous codes/<code>/<uuid>.jpg.
-- Aucune règle de modification ni de suppression : personne ne modifie ni ne
-- supprime une image depuis l'app.
create policy photos_select on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (select private.is_allowed()));
create policy photos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos' and (select private.is_allowed())
    and name ~ '^codes/[0-9]{8,14}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
  );
