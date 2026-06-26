-- =====================================================================
-- FactureFlow CI — Migration : bons de commande + rapprochement facture↔commande
-- ---------------------------------------------------------------------
-- Ajoute la gestion des bons de commande (en-tête + lignes) et le lien
-- factures.commande_id pour le rapprochement par montant (commandé vs facturé).
-- Idempotent. RLS : isolation par org ; écriture admin/saisie/controle_gestion.
-- =====================================================================

-- 1) En-tête de commande.
create table if not exists public.commandes (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organisations(id) on delete cascade,
  fournisseur_id uuid references public.fournisseurs(id) on delete set null,
  numero         text,
  date           date,
  devise         text not null default 'XOF',
  total_ht       numeric(14,2) not null default 0,
  statut         text not null default 'ouverte' check (statut in ('ouverte','soldee','annulee')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id)
);
create index if not exists idx_commandes_org on public.commandes(org_id);
create index if not exists idx_commandes_fourn on public.commandes(fournisseur_id);

-- 2) Lignes de commande.
create table if not exists public.commandes_lignes (
  id            uuid primary key default gen_random_uuid(),
  commande_id   uuid not null references public.commandes(id) on delete cascade,
  designation   text,
  quantite      numeric(14,3) not null default 0,
  prix_unitaire numeric(14,2) not null default 0,
  montant_ht    numeric(14,2) not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_commandes_lignes on public.commandes_lignes(commande_id);

-- 3) Lien facture → commande (rapprochement).
alter table public.factures
  add column if not exists commande_id uuid references public.commandes(id) on delete set null;
create index if not exists idx_factures_commande on public.factures(commande_id);

-- 4) updated_at automatique sur commandes.
drop trigger if exists trg_commandes_updated on public.commandes;
create trigger trg_commandes_updated before update on public.commandes
  for each row execute function public.set_updated_at();

-- 5) RLS.
alter table public.commandes        enable row level security;
alter table public.commandes_lignes enable row level security;

drop policy if exists cmd_select on public.commandes;
create policy cmd_select on public.commandes
  for select using (org_id = public.current_org_id());
drop policy if exists cmd_write on public.commandes;
create policy cmd_write on public.commandes
  for all using (org_id = public.current_org_id() and public.current_role()::text in ('admin','saisie','controle_gestion'))
  with check (org_id = public.current_org_id() and public.current_role()::text in ('admin','saisie','controle_gestion'));

drop policy if exists cmd_lignes_select on public.commandes_lignes;
create policy cmd_lignes_select on public.commandes_lignes
  for select using (exists (
    select 1 from public.commandes c
    where c.id = commandes_lignes.commande_id and c.org_id = public.current_org_id()));
drop policy if exists cmd_lignes_write on public.commandes_lignes;
create policy cmd_lignes_write on public.commandes_lignes
  for all using (exists (
    select 1 from public.commandes c
    where c.id = commandes_lignes.commande_id and c.org_id = public.current_org_id()
      and public.current_role()::text in ('admin','saisie','controle_gestion')))
  with check (exists (
    select 1 from public.commandes c
    where c.id = commandes_lignes.commande_id and c.org_id = public.current_org_id()
      and public.current_role()::text in ('admin','saisie','controle_gestion')));
