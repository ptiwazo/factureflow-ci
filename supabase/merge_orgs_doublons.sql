-- =====================================================================
-- FactureFlow CI — Fusion des organisations en double (même nom normalisé)
-- ---------------------------------------------------------------------
-- Correctif de données PONCTUEL. Pour chaque groupe d'organisations de même
-- nom (casse/espaces ignorés), conserve la plus ANCIENNE (« keeper ») et y
-- rattache tout : fournisseurs (dédupliqués par NCC), factures, lignes (via
-- factures), logs, utilisateurs. Les organisations vidées sont supprimées.
--
-- Transactionnel (bloc DO) : en cas d'erreur, tout est annulé.
--
-- ⚠️ AVANT de lancer : faites une sauvegarde (Supabase → Database → Backups).
-- ⚠️ Rôles : les 'admin' des organisations absorbées deviennent 'saisie'
--    (le keeper garde son admin). Réajustable ensuite dans Réglages.
-- ⚠️ Storage : le 1er segment du chemin des originaux (= org_id) est recalé
--    sur le keeper. Vérifiez ensuite qu'un original s'ouvre ; sinon, ré-importez.
-- =====================================================================

do $$
declare
  rec        record;
  v_keeper   uuid;
  v_orgs     uuid[];
  v_orgs_txt text[];
begin
  for rec in
    select lower(regexp_replace(btrim(nom), '\s+', ' ', 'g')) as norm
    from public.organisations
    group by 1
    having count(*) > 1
  loop
    -- Orgs du groupe (ordre chronologique) ; keeper = la plus ancienne.
    select array_agg(id order by created_at), (array_agg(id order by created_at))[1]
      into v_orgs, v_keeper
    from public.organisations
    where lower(regexp_replace(btrim(nom), '\s+', ' ', 'g')) = rec.norm;
    v_orgs_txt := array(select unnest(v_orgs)::text);

    -- 1) Fournisseurs — déduplication par NCC.
    --    Canonique = celui du keeper s'il existe, sinon le plus ancien du groupe.
    --    a) Repointer les factures des doublons vers le fournisseur canonique.
    update public.factures fa
    set fournisseur_id = c.canon_id
    from public.fournisseurs f
    join (
      select distinct on (ncc) ncc, id as canon_id
      from public.fournisseurs
      where org_id = any(v_orgs) and coalesce(ncc, '') <> ''
      order by ncc, (org_id = v_keeper) desc, created_at
    ) c on c.ncc = f.ncc
    where f.org_id = any(v_orgs)
      and coalesce(f.ncc, '') <> ''
      and f.id <> c.canon_id
      and fa.fournisseur_id = f.id;

    --    b) Supprimer les fournisseurs doublons (NCC déjà couvert par le canonique).
    delete from public.fournisseurs f
    using (
      select distinct on (ncc) ncc, id as canon_id
      from public.fournisseurs
      where org_id = any(v_orgs) and coalesce(ncc, '') <> ''
      order by ncc, (org_id = v_keeper) desc, created_at
    ) c
    where f.org_id = any(v_orgs)
      and coalesce(f.ncc, '') <> ''
      and c.ncc = f.ncc
      and f.id <> c.canon_id;

    --    c) Déplacer les fournisseurs restants vers le keeper.
    update public.fournisseurs set org_id = v_keeper
    where org_id = any(v_orgs) and org_id <> v_keeper;

    -- 2) Factures → keeper.
    update public.factures set org_id = v_keeper
    where org_id = any(v_orgs) and org_id <> v_keeper;

    -- 2bis) Recaler le chemin Storage des originaux (1er segment = org_id).
    update public.factures
    set fichier_url = v_keeper::text || substring(fichier_url from position('/' in fichier_url))
    where org_id = v_keeper and fichier_url is not null
      and fichier_url not like v_keeper::text || '/%';

    update storage.objects
    set name = v_keeper::text || substring(name from position('/' in name))
    where bucket_id = 'factures'
      and split_part(name, '/', 1) = any(v_orgs_txt)
      and split_part(name, '/', 1) <> v_keeper::text;

    -- 3) Logs → keeper.
    update public.logs set org_id = v_keeper
    where org_id = any(v_orgs) and org_id <> v_keeper;

    -- 4) Utilisateurs → keeper (les admins absorbés repassent en 'saisie').
    update public.users
    set org_id = v_keeper,
        role   = case when role::text = 'admin' then 'saisie'::user_role else role end
    where org_id = any(v_orgs) and org_id <> v_keeper;

    -- 5) Supprimer les organisations vidées.
    delete from public.organisations
    where id = any(v_orgs) and id <> v_keeper;
  end loop;
end $$;
