-- =====================================================================
-- FactureFlow CI — Migration : partage d'organisation par nom d'entreprise
-- ---------------------------------------------------------------------
-- Les utilisateurs qui s'inscrivent avec le MÊME nom d'entreprise (normalisé :
-- casse et espaces ignorés) rejoignent la MÊME organisation et voient donc les
-- mêmes factures. Le 1er inscrit reste 'admin' ; les suivants rejoignent en
-- 'saisie'. Idempotent.
--
-- ⚠️ Sécurité : le rattachement se fait sur le seul NOM d'entreprise. Toute
-- personne connaissant le nom exact peut rejoindre l'organisation. À encadrer
-- côté process (ou faire évoluer vers un rattachement par NCC / invitation).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Onboarding « rejoindre ou créer »
-- ---------------------------------------------------------------------
create or replace function public.creer_organisation(p_nom text, p_ncc text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_nom_norm text;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;
  if exists (select 1 from public.users where id = auth.uid()) then
    raise exception 'Utilisateur déjà rattaché à une organisation';
  end if;

  v_nom_norm := lower(regexp_replace(btrim(coalesce(p_nom, '')), '\s+', ' ', 'g'));
  if v_nom_norm = '' then
    raise exception 'Nom d''organisation requis';
  end if;

  select id into v_org
  from public.organisations
  where lower(regexp_replace(btrim(nom), '\s+', ' ', 'g')) = v_nom_norm
  order by created_at
  limit 1;

  if v_org is not null then
    insert into public.users(id, org_id, role, email)
      values (auth.uid(), v_org, 'saisie', (select email from auth.users where id = auth.uid()));
    return v_org;
  end if;

  insert into public.organisations(nom, ncc) values (p_nom, p_ncc) returning id into v_org;
  insert into public.users(id, org_id, role, email)
    values (auth.uid(), v_org, 'admin', (select email from auth.users where id = auth.uid()));
  return v_org;
end $$;

-- ---------------------------------------------------------------------
-- 2) INSPECTION des doublons déjà existants (à lancer, puis m'envoyer le résultat)
--    Regroupe les organisations par nom normalisé et compte combien partagent
--    ce nom (n > 1 = doublons à fusionner).
-- ---------------------------------------------------------------------
-- select
--   lower(regexp_replace(btrim(nom), '\s+', ' ', 'g')) as nom_normalise,
--   count(*)                                            as nb_orgs,
--   array_agg(id order by created_at)                   as org_ids,
--   array_agg(nom order by created_at)                  as noms
-- from public.organisations
-- group by 1
-- having count(*) > 1
-- order by nb_orgs desc;

-- ---------------------------------------------------------------------
-- 3) La FUSION des doublons est fournie séparément, une fois l'inspection
--    connue (repointage factures/fournisseurs/lignes/logs/users vers l'org
--    « keeper » la plus ancienne, en gérant la déduplication des fournisseurs
--    par NCC et le chemin Storage des originaux). NE PAS improviser ici.
-- ---------------------------------------------------------------------
