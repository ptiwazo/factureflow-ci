-- =====================================================================
-- FactureFlow CI — Migration : factures récurrentes / abonnements
-- ---------------------------------------------------------------------
-- Modèles d'abonnement (charges fixes : loyer, internet, électricité…) qui
-- génèrent automatiquement une facture chaque mois (statut a_controler).
-- Idempotent. RLS : org + écriture admin/saisie/controle_gestion.
-- =====================================================================

create table if not exists public.recurrences (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organisations(id) on delete cascade,
  fournisseur_id  uuid references public.fournisseurs(id) on delete set null,
  designation     text not null,
  montant_ht      numeric(14,2) not null default 0,
  taux_tva        numeric(5,2)  not null default 18,
  categorie       text,                                   -- compte de charge (plan IFRS)
  devise          text not null default 'XOF',
  jour            smallint not null default 1 check (jour between 1 and 28),
  actif           boolean not null default true,
  date_debut      date,
  date_fin        date,
  derniere_periode text,                                  -- 'AAAA-MM' déjà générée
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);
create index if not exists idx_recurrences_org on public.recurrences(org_id);

drop trigger if exists trg_recurrences_updated on public.recurrences;
create trigger trg_recurrences_updated before update on public.recurrences
  for each row execute function public.set_updated_at();

alter table public.recurrences enable row level security;

drop policy if exists rec_select on public.recurrences;
create policy rec_select on public.recurrences
  for select using (org_id = public.current_org_id());
drop policy if exists rec_write on public.recurrences;
create policy rec_write on public.recurrences
  for all using (org_id = public.current_org_id() and public.current_role()::text in ('admin','saisie','controle_gestion'))
  with check (org_id = public.current_org_id() and public.current_role()::text in ('admin','saisie','controle_gestion'));
