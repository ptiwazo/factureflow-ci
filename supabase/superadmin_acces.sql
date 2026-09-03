-- =====================================================================
-- FactureFlow CI — Diagnostic et octroi de l'accès SUPER ADMIN
-- ---------------------------------------------------------------------
-- À exécuter dans le SQL Editor Supabase (projet cilceojlmqecqxkfexzk).
-- Remplacez l'e-mail ci-dessous par celui du compte concerné.
-- Exécutez les étapes UNE PAR UNE et lisez le résultat de chacune.
-- =====================================================================

-- ÉTAPE 1 — Diagnostic : la migration super admin est-elle en place ?
select
  to_regclass('public.super_admins')            is not null as table_super_admins_ok,
  to_regprocedure('public.is_super_admin()')    is not null as fonction_is_super_admin_ok,
  to_regprocedure('public.superadmin_creer_organisation(text,text)') is not null as fonction_creer_org_ok,
  to_regprocedure('public.superadmin_generer_code(uuid)')            is not null as fonction_generer_code_ok;
-- Si une colonne renvoie false : rejouez d'abord supabase/migration_superadmin.sql
-- puis supabase/migration_superadmin_create.sql.

-- ÉTAPE 2 — Qui est déjà super admin aujourd'hui ?
select sa.user_id, u.email, sa.created_at
from public.super_admins sa
join auth.users u on u.id = sa.user_id
order by sa.created_at;

-- ÉTAPE 3 — Le compte visé existe-t-il, et est-il rattaché à une entreprise ?
-- ⚠️ ADAPTEZ l'e-mail.
select
  au.id,
  au.email,
  au.email_confirmed_at is not null as email_confirme,
  pu.org_id,
  pu.role,
  o.nom as organisation
from auth.users au
left join public.users pu on pu.id = au.id
left join public.organisations o on o.id = pu.org_id
where lower(au.email) = lower('jocelinsoumahoro@outlook.fr');
-- Si aucune ligne : le compte n'existe pas → créez-le d'abord via l'écran
-- d'inscription de l'application, puis reprenez ici.

-- ÉTAPE 4 — Octroi du droit super admin. ⚠️ ADAPTEZ l'e-mail.
insert into public.super_admins(user_id)
select id from auth.users where lower(email) = lower('jocelinsoumahoro@outlook.fr')
on conflict do nothing;

-- ÉTAPE 5 — IMPORTANT : rattacher le super admin à une organisation.
-- Sans ligne dans public.users, chargerProfil() (js/auth.js) sort avant
-- d'appeler is_super_admin() : l'application affiche l'onboarding et la
-- console reste invisible, même avec le droit accordé à l'étape 4.
--
-- Option A (recommandée, sans SQL) : depuis l'écran d'onboarding de l'appli,
--   créez une organisation, ou rejoignez-en une avec son code d'invitation.
--
-- Option B (en SQL) : rattacher comme admin d'une organisation existante.
-- ⚠️ ADAPTEZ l'e-mail et le nom de l'organisation.
-- insert into public.users(id, org_id, role, email)
-- select au.id, o.id, 'admin', au.email
-- from auth.users au, public.organisations o
-- where lower(au.email) = lower('jocelinsoumahoro@outlook.fr')
--   and o.nom = 'NOM DE L''ORGANISATION'
-- on conflict (id) do nothing;

-- ÉTAPE 6 — Vérification finale : le compte doit apparaître ici avec une org.
select au.email, (sa.user_id is not null) as super_admin, pu.org_id, pu.role
from auth.users au
left join public.super_admins sa on sa.user_id = au.id
left join public.users pu on pu.id = au.id
where lower(au.email) = lower('jocelinsoumahoro@outlook.fr');
