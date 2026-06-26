-- =====================================================================
-- FactureFlow CI — Migration : activation / désactivation d'utilisateur
-- ---------------------------------------------------------------------
-- L'admin peut désactiver un membre. Un compte désactivé ne voit plus aucune
-- donnée : current_org_id() ne renvoie son org QUE s'il est actif, ce qui fait
-- échouer toutes les policies RLS basées sur l'org. Il peut néanmoins lire sa
-- PROPRE ligne (pour que l'app affiche « compte désactivé »). Idempotent.
-- =====================================================================

-- 1) Drapeau d'activité (actif par défaut).
alter table public.users add column if not exists actif boolean not null default true;

-- 2) L'org courante n'est résolue que pour un utilisateur ACTIF.
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.users where id = auth.uid() and actif = true;
$$;

-- 3) Lecture : membres de son org (s'il est actif) OU sa propre ligne (toujours,
--    pour permettre la détection de la désactivation côté client).
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select using (org_id = public.current_org_id() or id = auth.uid());
