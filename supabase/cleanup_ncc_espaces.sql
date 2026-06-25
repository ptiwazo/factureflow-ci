-- =====================================================================
-- FactureFlow CI — Nettoyage des espaces dans les NCC fournisseurs
-- ---------------------------------------------------------------------
-- 1) Fusionne d'abord les fournisseurs qui DEVIENDRAIENT en doublon une fois
--    les espaces retirés (même org_id + même NCC nettoyé) : on garde la fiche
--    déjà « propre » (sinon la plus ancienne), on y repointe les factures et on
--    complète ses champs manquants, puis on supprime les doublons.
-- 2) Retire ensuite tous les espaces des NCC restants.
-- Transactionnel (bloc DO) et idempotent.
--
-- ⚠️ Sauvegarde conseillée (Supabase → Database → Backups) : suppression de
--    fiches fournisseurs en double.
-- =====================================================================

-- Aperçu des doublons potentiels (facultatif, à lancer avant) :
-- select org_id, regexp_replace(ncc,'\s','','g') as ncc_clean,
--        count(*) nb, array_agg(nom) noms, array_agg(ncc) nccs
-- from public.fournisseurs
-- where ncc is not null and regexp_replace(ncc,'\s','','g') <> ''
-- group by 1,2 having count(*) > 1;

do $$
declare
  grp      record;
  v_keeper uuid;
begin
  for grp in
    select org_id, regexp_replace(ncc, '\s', '', 'g') as ncc_clean
    from public.fournisseurs
    where ncc is not null and regexp_replace(ncc, '\s', '', 'g') <> ''
    group by org_id, regexp_replace(ncc, '\s', '', 'g')
    having count(*) > 1
  loop
    -- Keeper : priorité à la fiche déjà sans espace, sinon la plus ancienne.
    select id into v_keeper
    from public.fournisseurs
    where org_id = grp.org_id
      and regexp_replace(ncc, '\s', '', 'g') = grp.ncc_clean
    order by (ncc !~ '\s') desc, created_at
    limit 1;

    -- Complète les champs manquants du keeper depuis les doublons.
    update public.fournisseurs k
    set compte_sap = coalesce(k.compte_sap, d.compte_sap),
        rccm       = coalesce(k.rccm, d.rccm),
        telephone  = coalesce(k.telephone, d.telephone)
    from public.fournisseurs d
    where k.id = v_keeper
      and d.org_id = grp.org_id
      and regexp_replace(d.ncc, '\s', '', 'g') = grp.ncc_clean
      and d.id <> v_keeper;

    -- Repointe les factures des doublons vers le keeper.
    update public.factures f
    set fournisseur_id = v_keeper
    from public.fournisseurs d
    where d.org_id = grp.org_id
      and regexp_replace(d.ncc, '\s', '', 'g') = grp.ncc_clean
      and d.id <> v_keeper
      and f.fournisseur_id = d.id;

    -- Supprime les doublons.
    delete from public.fournisseurs d
    where d.org_id = grp.org_id
      and regexp_replace(d.ncc, '\s', '', 'g') = grp.ncc_clean
      and d.id <> v_keeper;
  end loop;

  -- Nettoyage final des espaces (plus aucune collision possible).
  update public.fournisseurs
  set ncc = nullif(regexp_replace(ncc, '\s', '', 'g'), '')
  where ncc ~ '\s';
end $$;

-- Vérification : doit renvoyer 0.
-- select count(*) as restants from public.fournisseurs where ncc ~ '\s';
