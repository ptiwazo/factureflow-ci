-- =====================================================================
-- FactureFlow CI — Migration : suivi des paiements / échéancier
-- ---------------------------------------------------------------------
-- Ajoute le suivi de règlement des factures : statut de paiement, date et
-- montant payé (gère aussi les paiements partiels). N'affecte pas le circuit
-- comptable (a_controler → a_valider → validee). Idempotent.
-- L'écriture est régie par les RLS factures existantes (admin/saisie/CG).
-- =====================================================================

alter table public.factures
  add column if not exists statut_paiement text not null default 'a_payer';
alter table public.factures
  add column if not exists date_paiement date;
alter table public.factures
  add column if not exists montant_paye numeric(14,2) not null default 0;

do $$ begin
  alter table public.factures
    add constraint factures_statut_paiement_chk
    check (statut_paiement in ('a_payer','partiel','paye'));
exception when duplicate_object then null; end $$;

-- Accélère l'échéancier (par org, par statut de paiement, trié par échéance).
create index if not exists idx_factures_paiement
  on public.factures(org_id, statut_paiement, echeance);
