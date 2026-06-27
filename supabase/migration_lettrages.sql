-- =====================================================================
-- FactureFlow CI — Migration : lettrage multi-factures (allocations)
-- ---------------------------------------------------------------------
-- Une opération bancaire peut être répartie sur PLUSIEURS factures. Chaque
-- allocation = (operation, facture, montant). Idempotent. RLS org + rôles.
-- =====================================================================

create table if not exists public.lettrages (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organisations(id) on delete cascade,
  operation_id  uuid not null references public.operations_bancaires(id) on delete cascade,
  facture_id    uuid not null references public.factures(id) on delete cascade,
  montant       numeric(14,2) not null default 0,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);
create index if not exists idx_lettrages_op on public.lettrages(operation_id);
create index if not exists idx_lettrages_org on public.lettrages(org_id);

alter table public.lettrages enable row level security;
drop policy if exists let_select on public.lettrages;
create policy let_select on public.lettrages
  for select using (org_id = public.current_org_id());
drop policy if exists let_write on public.lettrages;
create policy let_write on public.lettrages
  for all using (org_id = public.current_org_id() and public.current_role()::text in ('admin','saisie','controle_gestion'))
  with check (org_id = public.current_org_id() and public.current_role()::text in ('admin','saisie','controle_gestion'));
