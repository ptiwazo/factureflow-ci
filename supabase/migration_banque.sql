-- =====================================================================
-- FactureFlow CI — Migration : rapprochement bancaire (lettrage)
-- ---------------------------------------------------------------------
-- Opérations d'un relevé bancaire importé. Le lettrage d'un débit à une facture
-- enregistre un paiement (via l'app) et marque l'opération lettrée. Idempotent.
-- RLS : org + écriture admin/saisie/controle_gestion.
-- =====================================================================

create table if not exists public.operations_bancaires (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organisations(id) on delete cascade,
  date        date,
  libelle     text,
  montant     numeric(14,2) not null default 0,                 -- montant positif
  sens        text not null default 'debit' check (sens in ('debit','credit')),
  reference   text,
  lettree     boolean not null default false,
  facture_id  uuid references public.factures(id) on delete set null,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);
create index if not exists idx_operations_org on public.operations_bancaires(org_id, lettree);

alter table public.operations_bancaires enable row level security;

drop policy if exists op_select on public.operations_bancaires;
create policy op_select on public.operations_bancaires
  for select using (org_id = public.current_org_id());
drop policy if exists op_write on public.operations_bancaires;
create policy op_write on public.operations_bancaires
  for all using (org_id = public.current_org_id() and public.current_role()::text in ('admin','saisie','controle_gestion'))
  with check (org_id = public.current_org_id() and public.current_role()::text in ('admin','saisie','controle_gestion'));
