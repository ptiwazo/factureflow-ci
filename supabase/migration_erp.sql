-- =====================================================================
-- FactureFlow CI — Migration : ERP comptable de l'organisation (SAP / Sage)
-- ---------------------------------------------------------------------
-- L'administrateur indique l'ERP de l'organisation. Choix d'AFFICHAGE :
-- en mode 'sage', l'app montre l'équivalent OHADA/SYSCOHADA à côté du compte
-- de charge interne. N'affecte ni les données stockées ni les exports.
-- Idempotent.
-- =====================================================================

-- 1) Colonne erp ('sap' par défaut) + contrainte de valeurs.
alter table public.organisations
  add column if not exists erp text not null default 'sap';

do $$ begin
  alter table public.organisations
    add constraint organisations_erp_chk check (erp in ('sap','sage'));
exception when duplicate_object then null; end $$;

-- 2) RLS : l'organisation n'avait qu'une politique SELECT. On autorise sa
--    mise à jour (ici l'ERP) au seul administrateur de l'org.
drop policy if exists org_admin_update on public.organisations;
create policy org_admin_update on public.organisations
  for update using (id = public.current_org_id() and public.current_role()::text = 'admin')
  with check (id = public.current_org_id() and public.current_role()::text = 'admin');
