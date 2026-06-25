-- =====================================================================
-- FactureFlow CI — Migration : workflow Contrôle de Gestion
-- ---------------------------------------------------------------------
-- Ajoute le rôle 'controle_gestion' et deux statuts intermédiaires
-- ('a_controler', 'a_valider') pour le circuit :
--   scan/saisie (vérif OCR) → a_controler → (CG confirme les comptes) →
--   a_valider → (CG valide) → validee → exportee.
-- Idempotent.
--
-- ⚠️ IMPORTANT — exécuter dans Supabase → SQL Editor en DEUX TEMPS :
--   1) Lancer d'abord SEULE l'ÉTAPE 1 (ajout des valeurs d'enum). Postgres
--      interdit d'utiliser une valeur d'enum nouvellement ajoutée dans la
--      MÊME transaction que sa création.
--   2) Lancer ensuite l'ÉTAPE 2 (politiques RLS).
-- =====================================================================

-- =====================================================================
-- ÉTAPE 1 — à exécuter SEULE en premier
-- =====================================================================
alter type user_role     add value if not exists 'controle_gestion';
alter type facture_statut add value if not exists 'a_controler';
alter type facture_statut add value if not exists 'a_valider';

-- =====================================================================
-- ÉTAPE 2 — à exécuter après l'étape 1
-- ---------------------------------------------------------------------
-- Le Contrôle de Gestion doit pouvoir mettre à jour le statut de la facture
-- et la catégorie (compte de charge) de ses lignes. On ajoute donc le rôle
-- 'controle_gestion' aux politiques d'écriture des tables `factures` et
-- `lignes`. La comparaison se fait sur le TEXTE du rôle (::text) afin de ne
-- pas dépendre d'un littéral d'enum éventuellement créé dans la même session.
-- =====================================================================

-- FACTURES : écriture pour admin / saisie / controle_gestion.
drop policy if exists fact_write on public.factures;
create policy fact_write on public.factures
  for all using (
    org_id = public.current_org_id()
    and public.current_role()::text in ('admin','saisie','controle_gestion'))
  with check (
    org_id = public.current_org_id()
    and public.current_role()::text in ('admin','saisie','controle_gestion'));

-- LIGNES : écriture pour admin / saisie / controle_gestion (compte de charge).
drop policy if exists lignes_write on public.lignes;
create policy lignes_write on public.lignes
  for all using (exists (
    select 1 from public.factures f
    where f.id = lignes.facture_id and f.org_id = public.current_org_id()
      and public.current_role()::text in ('admin','saisie','controle_gestion')))
  with check (exists (
    select 1 from public.factures f
    where f.id = lignes.facture_id and f.org_id = public.current_org_id()
      and public.current_role()::text in ('admin','saisie','controle_gestion')));
