-- =====================================================================
-- FactureFlow CI — Migration : SUPER ADMIN de plateforme (codes d'invitation)
-- ---------------------------------------------------------------------
-- Le propriétaire de la plateforme (super admin) gère SEUL les codes
-- d'invitation de chaque entreprise. Les admins d'entreprise voient leur code
-- (lecture seule) mais ne le régénèrent plus. Idempotent.
--
-- ⚠️ À lancer de préférence par petites étapes si la passerelle SQL expire.
-- =====================================================================

-- 1) Table des super admins (peuplée UNIQUEMENT en SQL → pas d'écriture client).
create table if not exists public.super_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.super_admins enable row level security;

-- Un utilisateur peut seulement vérifier sa propre présence (pour l'UI).
drop policy if exists super_admins_self on public.super_admins;
create policy super_admins_self on public.super_admins
  for select using (user_id = auth.uid());

-- 2) Déclare le super admin (ADAPTEZ l'e-mail si besoin).
insert into public.super_admins(user_id)
select id from auth.users where lower(email) = lower('jocelinsoumahoro@outlook.fr')
on conflict do nothing;

-- 3) Helper : l'appelant est-il super admin ? (SECURITY DEFINER → hors RLS)
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.super_admins where user_id = auth.uid());
$$;

-- 4) RLS : le super admin accède à TOUTES les organisations (lecture + écriture).
--    S'ajoute (OR) aux policies par org existantes.
drop policy if exists org_superadmin_all on public.organisations;
create policy org_superadmin_all on public.organisations
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- 5) Génération/rotation d'un code pour une organisation donnée (super admin only).
create or replace function public.superadmin_generer_code(p_org uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.is_super_admin() then
    raise exception 'Réservé au super administrateur';
  end if;
  v_code := public.gen_code_invitation();
  update public.organisations set code_invitation = v_code where id = p_org;
  if not found then raise exception 'Organisation introuvable'; end if;
  return v_code;
end $$;

-- 6) Retire l'auto-régénération côté admin d'entreprise (devient prérogative
--    du super admin). La création d'org génère toujours un code initial.
drop function if exists public.regenerer_code_invitation();
