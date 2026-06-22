-- =====================================================================
-- FactureFlow CI — Schéma Postgres (Supabase)
-- Tables + Row Level Security (isolation stricte par organisation)
-- =====================================================================
-- À exécuter dans Supabase → SQL Editor.
-- L'isolation repose sur la table `users` qui relie auth.uid() à une org.
-- Chaque politique RLS vérifie que la ligne appartient à l'org de l'appelant.
-- =====================================================================

-- Extension pour générer des UUID
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Types énumérés
-- ---------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'saisie', 'lecture');
exception when duplicate_object then null; end $$;

do $$ begin
  create type facture_statut as enum ('a_verifier', 'validee', 'exportee', 'non_conforme');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table if not exists public.organisations (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  ncc         text,
  plan        text not null default 'free',
  created_at  timestamptz not null default now()
);

-- Lie un utilisateur Supabase Auth (auth.users.id) à une organisation + rôle.
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid not null references public.organisations(id) on delete cascade,
  role        user_role not null default 'saisie',
  email       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_users_org on public.users(org_id);

create table if not exists public.fournisseurs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organisations(id) on delete cascade,
  nom         text not null,
  ncc         text,
  rccm        text,
  telephone   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);
-- Déduplication des fournisseurs par (org, NCC) lorsque le NCC est présent.
create unique index if not exists uq_fournisseur_org_ncc
  on public.fournisseurs(org_id, ncc) where ncc is not null and ncc <> '';
create index if not exists idx_fournisseurs_org on public.fournisseurs(org_id);

create table if not exists public.factures (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organisations(id) on delete cascade,
  fournisseur_id  uuid references public.fournisseurs(id) on delete set null,
  numero          text,
  date            date,
  echeance        date,
  total_ht        numeric(14,2) not null default 0,
  taux_tva        numeric(5,2)  not null default 18,
  montant_tva     numeric(14,2) not null default 0,
  total_ttc       numeric(14,2) not null default 0,
  devise          text not null default 'XOF',
  statut          facture_statut not null default 'a_verifier',
  fichier_url     text,                 -- chemin du fichier dans Storage (bucket "factures")
  extraction_brute jsonb,               -- sortie IA brute, conservée pour audit
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);
create index if not exists idx_factures_org on public.factures(org_id);
create index if not exists idx_factures_statut on public.factures(org_id, statut);
create index if not exists idx_factures_date on public.factures(org_id, date);
create index if not exists idx_factures_fournisseur on public.factures(fournisseur_id);

create table if not exists public.lignes (
  id            uuid primary key default gen_random_uuid(),
  facture_id    uuid not null references public.factures(id) on delete cascade,
  designation   text,
  quantite      numeric(14,3) not null default 0,
  prix_unitaire numeric(14,2) not null default 0,
  montant_ht    numeric(14,2) not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_lignes_facture on public.lignes(facture_id);

create table if not exists public.logs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organisations(id) on delete cascade,
  user_id     uuid references auth.users(id),
  action      text not null,           -- ex: 'validation', 'export', 'suppression'
  cible       text,                    -- ex: 'facture:<id>'
  created_at  timestamptz not null default now()
);
create index if not exists idx_logs_org on public.logs(org_id, created_at desc);

-- ---------------------------------------------------------------------
-- Triggers : updated_at automatique
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_fournisseurs_updated on public.fournisseurs;
create trigger trg_fournisseurs_updated before update on public.fournisseurs
  for each row execute function public.set_updated_at();

drop trigger if exists trg_factures_updated on public.factures;
create trigger trg_factures_updated before update on public.factures
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Helper : org de l'utilisateur courant (SECURITY DEFINER pour éviter
-- la récursion RLS lors de la lecture de la table users dans les policies)
-- ---------------------------------------------------------------------
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.users where id = auth.uid();
$$;

create or replace function public.current_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.organisations enable row level security;
alter table public.users         enable row level security;
alter table public.fournisseurs  enable row level security;
alter table public.factures      enable row level security;
alter table public.lignes        enable row level security;
alter table public.logs          enable row level security;

-- ORGANISATIONS : on ne voit que la sienne.
drop policy if exists org_select on public.organisations;
create policy org_select on public.organisations
  for select using (id = public.current_org_id());

-- USERS : on voit les membres de son org ; un admin peut gérer.
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select using (org_id = public.current_org_id());
drop policy if exists users_admin_write on public.users;
create policy users_admin_write on public.users
  for all using (org_id = public.current_org_id() and public.current_role() = 'admin')
  with check (org_id = public.current_org_id() and public.current_role() = 'admin');

-- FOURNISSEURS : lecture par org ; écriture si rôle admin/saisie.
drop policy if exists fourn_select on public.fournisseurs;
create policy fourn_select on public.fournisseurs
  for select using (org_id = public.current_org_id());
drop policy if exists fourn_write on public.fournisseurs;
create policy fourn_write on public.fournisseurs
  for all using (org_id = public.current_org_id() and public.current_role() in ('admin','saisie'))
  with check (org_id = public.current_org_id() and public.current_role() in ('admin','saisie'));

-- FACTURES : lecture par org ; écriture si rôle admin/saisie.
drop policy if exists fact_select on public.factures;
create policy fact_select on public.factures
  for select using (org_id = public.current_org_id());
drop policy if exists fact_write on public.factures;
create policy fact_write on public.factures
  for all using (org_id = public.current_org_id() and public.current_role() in ('admin','saisie'))
  with check (org_id = public.current_org_id() and public.current_role() in ('admin','saisie'));

-- LIGNES : rattachées à une facture de l'org.
drop policy if exists lignes_select on public.lignes;
create policy lignes_select on public.lignes
  for select using (exists (
    select 1 from public.factures f
    where f.id = lignes.facture_id and f.org_id = public.current_org_id()));
drop policy if exists lignes_write on public.lignes;
create policy lignes_write on public.lignes
  for all using (exists (
    select 1 from public.factures f
    where f.id = lignes.facture_id and f.org_id = public.current_org_id()
      and public.current_role() in ('admin','saisie')))
  with check (exists (
    select 1 from public.factures f
    where f.id = lignes.facture_id and f.org_id = public.current_org_id()
      and public.current_role() in ('admin','saisie')));

-- LOGS : lecture par org ; insertion par tout membre de l'org.
drop policy if exists logs_select on public.logs;
create policy logs_select on public.logs
  for select using (org_id = public.current_org_id());
drop policy if exists logs_insert on public.logs;
create policy logs_insert on public.logs
  for insert with check (org_id = public.current_org_id());

-- ---------------------------------------------------------------------
-- Storage : bucket privé "factures" (originaux). URL signées côté client.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('factures', 'factures', false)
  on conflict (id) do nothing;

-- Convention de nommage des objets : "<org_id>/<facture_id>.<ext>"
-- Les politiques vérifient que le 1er segment du chemin == org de l'appelant.
drop policy if exists storage_factures_select on storage.objects;
create policy storage_factures_select on storage.objects
  for select using (
    bucket_id = 'factures'
    and (storage.foldername(name))[1] = public.current_org_id()::text);

drop policy if exists storage_factures_insert on storage.objects;
create policy storage_factures_insert on storage.objects
  for insert with check (
    bucket_id = 'factures'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.current_role() in ('admin','saisie'));

drop policy if exists storage_factures_delete on storage.objects;
create policy storage_factures_delete on storage.objects
  for delete using (
    bucket_id = 'factures'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.current_role() = 'admin');

-- ---------------------------------------------------------------------
-- Onboarding : crée une organisation + rattache le 1er utilisateur (admin).
-- Appelée par le client juste après l'inscription (RPC sécurisée).
-- ---------------------------------------------------------------------
create or replace function public.creer_organisation(p_nom text, p_ncc text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;
  -- Un utilisateur déjà rattaché ne peut pas recréer d'org.
  if exists (select 1 from public.users where id = auth.uid()) then
    raise exception 'Utilisateur déjà rattaché à une organisation';
  end if;

  insert into public.organisations(nom, ncc) values (p_nom, p_ncc) returning id into v_org;
  insert into public.users(id, org_id, role, email)
    values (auth.uid(), v_org, 'admin', (select email from auth.users where id = auth.uid()));
  return v_org;
end $$;
