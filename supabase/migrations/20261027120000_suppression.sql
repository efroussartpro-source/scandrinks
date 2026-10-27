-- Jalon 6 : la suppression définitive d'un produit (RG-15).
--
-- Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.4, RG-15, §6.3, §6.4, §11 du 27/10/2026)
--
-- « Supprimer le produit » efface, en une seule transaction, ses mouvements
-- (annulés et ventes compris), ses codes, puis la fiche. Ses images restent
-- dans le stockage, sans servir. Il n'y a pas de retour possible.
--
-- Une seule porte pour effacer : public.delete_product (security invoker,
-- comme les autres fonctions de l'app) fait les contrôles, puis appelle
-- private.erase_product. Celle-ci est en security definer, dans le schéma non
-- exposé par l'API, comme private.is_allowed : elle seule a le droit
-- d'effacer, et seulement un produit entier. Le rôle de l'app ne reçoit donc
-- aucun droit de suppression sur products ni sur movements (§6.4) : une ligne
-- d'historique ne s'efface jamais seule.
--
-- Cette migration contient des effacements : le porteur du projet la lance
-- dans l'éditeur SQL de Supabase (§9, « Mise en service (jalon 6) »).

-- Efface un produit entier. Un produit absent (déjà supprimé, ou inconnu) ne
-- change rien : l'appel peut être rejoué.
create function private.erase_product(p_product_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_allowed() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- Les verrous d'abord, dans l'ordre de cancel_movement (un mouvement, puis son produit) : ses mouvements, dans
  -- l'ordre des identifiants, puis la fiche. Une annulation commencée passe donc avant, sans interblocage. Un mouvement
  -- envoyé au même moment (scan, comptage, fin de journée, qui verrouillent le produit) passe avant, et il est effacé
  -- avec le produit, ou bien il attend, puis il est refusé (« produit » inconnu ou clé étrangère).
  perform 1 from public.movements where product_id = p_product_id order by id for update;
  perform 1 from public.products where id = p_product_id for update;
  if not found then
    return;
  end if;

  delete from public.movements where product_id = p_product_id;
  delete from public.barcodes where product_id = p_product_id;
  delete from public.products where id = p_product_id;
end
$$;

-- RG-15 : supprime le produit pour de bon. Rejouée, ou envoyée par deux
-- téléphones, elle répond pareil.
create function public.delete_product(p_product_id uuid) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.is_allowed() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_product_id is null then
    raise exception 'invalid_input:product';
  end if;

  perform private.erase_product(p_product_id);
  return jsonb_build_object('status', 'deleted');
end
$$;

revoke all on function private.erase_product(uuid) from public, anon;
grant execute on function private.erase_product(uuid) to authenticated;
revoke all on function public.delete_product(uuid) from public, anon;
grant execute on function public.delete_product(uuid) to authenticated;
