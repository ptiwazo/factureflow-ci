-- =====================================================================
-- FactureFlow CI — Migration : clôture / verrouillage de période
-- ---------------------------------------------------------------------
-- Un mois « clôturé » fige les factures de ce mois : plus de modification,
-- suppression, paiement ni insertion (selon la DATE de la facture). Géré
-- côté serveur par RLS. Réversible (réouverture) par l'admin. Idempotent.
-- =====================================================================

-- 1) Périodes clôturées (une ligne = un mois fermé pour l'org).
create table if not exists public.clotures (
  org_id     uuid not null references public.organisations(id) on delete cascade,
  periode    text not null,                         -- 'AAAA-MM'
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  primary key (org_id, periode)
);
alter table public.clotures enable row level security;

-- Lecture par tout membre de l'org ; ouverture/fermeture réservée à l'admin.
drop policy if exists clot_select on public.clotures;
create policy clot_select on public.clotures
  for select using (org_id = public.current_org_id());
drop policy if exists clot_write on public.clotures;
create policy clot_write on public.clotures
  for all using (org_id = public.current_org_id() and public.current_role()::text = 'admin')
  with check (org_id = public.current_org_id() and public.current_role()::text = 'admin');

-- 2) La période d'une date est-elle verrouillée pour l'org courante ?
create or replace function public.periode_verrouillee(p_date date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clotures
    where org_id = public.current_org_id()
      and p_date is not null
      and periode = to_char(p_date, 'YYYY-MM'));
$$;

-- 3) On bloque l'écriture des factures (et lignes) dont la DATE tombe dans un
--    mois clôturé, en plus des contrôles d'org/rôle existants.
drop policy if exists fact_write on public.factures;
create policy fact_write on public.factures
  for all using (
    org_id = public.current_org_id()
    and public.current_role()::text in ('admin','saisie','controle_gestion')
    and not public.periode_verrouillee(date))
  with check (
    org_id = public.current_org_id()
    and public.current_role()::text in ('admin','saisie','controle_gestion')
    and not public.periode_verrouillee(date));

drop policy if exists lignes_write on public.lignes;
create policy lignes_write on public.lignes
  for all using (exists (
    select 1 from public.factures f
    where f.id = lignes.facture_id and f.org_id = public.current_org_id()
      and public.current_role()::text in ('admin','saisie','controle_gestion')
      and not public.periode_verrouillee(f.date)))
  with check (exists (
    select 1 from public.factures f
    where f.id = lignes.facture_id and f.org_id = public.current_org_id()
      and public.current_role()::text in ('admin','saisie','controle_gestion')
      and not public.periode_verrouillee(f.date)));
