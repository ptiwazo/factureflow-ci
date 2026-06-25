-- =====================================================================
-- FactureFlow CI — Migration : rattachement sécurisé par CODE D'INVITATION
-- ---------------------------------------------------------------------
-- Remplace le « rejoindre par nom » (devinable) par un code secret propre à
-- chaque organisation. Créer une entreprise génère un code ; rejoindre exige
-- ce code (rôle 'saisie'). Idempotent.
-- =====================================================================

-- 1) Colonne code d'invitation.
alter table public.organisations
  add column if not exists code_invitation text;

-- 2) Génère un code unique (8 caractères). SECURITY DEFINER pour que le test
--    d'unicité voie toutes les organisations (hors RLS).
create or replace function public.gen_code_invitation()
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  loop
    c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.organisations where code_invitation = c);
  end loop;
  return c;
end $$;

-- 3) Backfill des organisations existantes (codes uniques au sein de la même
--    transaction : chaque itération voit les codes déjà posés).
do $$
declare r record;
begin
  for r in select id from public.organisations where code_invitation is null loop
    update public.organisations set code_invitation = public.gen_code_invitation() where id = r.id;
  end loop;
end $$;

-- 4) Unicité du code.
create unique index if not exists uq_org_code_invitation
  on public.organisations(code_invitation) where code_invitation is not null;

-- 5) creer_organisation : CRÉATION SEULEMENT (plus de jointure par nom).
--    L'utilisateur devient 'admin' ; un code d'invitation est généré.
create or replace function public.creer_organisation(p_nom text, p_ncc text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  if exists (select 1 from public.users where id = auth.uid()) then
    raise exception 'Utilisateur déjà rattaché à une organisation'; end if;
  if btrim(coalesce(p_nom, '')) = '' then raise exception 'Nom d''organisation requis'; end if;

  insert into public.organisations(nom, ncc, code_invitation)
    values (p_nom, p_ncc, public.gen_code_invitation())
    returning id into v_org;
  insert into public.users(id, org_id, role, email)
    values (auth.uid(), v_org, 'admin', (select email from auth.users where id = auth.uid()));
  return v_org;
end $$;

-- 6) rejoindre_organisation : rattachement par code (rôle 'saisie').
create or replace function public.rejoindre_organisation(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  if exists (select 1 from public.users where id = auth.uid()) then
    raise exception 'Utilisateur déjà rattaché à une organisation'; end if;

  select id into v_org from public.organisations
   where code_invitation = upper(btrim(coalesce(p_code, '')));
  if v_org is null then
    raise exception 'Code d''invitation invalide';
  end if;

  insert into public.users(id, org_id, role, email)
    values (auth.uid(), v_org, 'saisie', (select email from auth.users where id = auth.uid()));
  return v_org;
end $$;

-- 7) regenerer_code_invitation : rotation du code (admin uniquement).
create or replace function public.regenerer_code_invitation()
returns text language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_code text;
begin
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Non rattaché à une organisation'; end if;
  if public.current_role()::text <> 'admin' then
    raise exception 'Réservé à l''administrateur';
  end if;
  v_code := public.gen_code_invitation();
  update public.organisations set code_invitation = v_code where id = v_org;
  return v_code;
end $$;
