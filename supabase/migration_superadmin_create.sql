-- =====================================================================
-- FactureFlow CI — Migration : création d'entreprises par le super admin
-- ---------------------------------------------------------------------
-- Le super admin crée les entreprises depuis sa console (sans en être membre).
-- Le rattachement se fait ensuite UNIQUEMENT par code d'invitation : la 1ʳᵉ
-- personne qui rejoint une entreprise en devient l'ADMIN, les suivantes sont
-- en rôle 'saisie'. Idempotent.
-- =====================================================================

-- 1) Création d'une organisation par le super admin (ne l'attache pas).
--    Renvoie l'id et le code d'invitation généré.
create or replace function public.superadmin_creer_organisation(p_nom text, p_ncc text default null)
returns table(id uuid, code_invitation text)
language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_code text;
begin
  if not public.is_super_admin() then raise exception 'Réservé au super administrateur'; end if;
  if btrim(coalesce(p_nom, '')) = '' then raise exception 'Nom d''entreprise requis'; end if;
  v_code := public.gen_code_invitation();
  insert into public.organisations(nom, ncc, code_invitation)
    values (p_nom, p_ncc, v_code)
    returning organisations.id into v_org;
  return query select v_org, v_code;
end $$;

-- 2) Rejoindre par code : 1er membre => 'admin', sinon 'saisie'.
create or replace function public.rejoindre_organisation(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_role user_role;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  if exists (select 1 from public.users where id = auth.uid()) then
    raise exception 'Utilisateur déjà rattaché à une organisation'; end if;

  select id into v_org from public.organisations
   where code_invitation = upper(btrim(coalesce(p_code, '')));
  if v_org is null then raise exception 'Code d''invitation invalide'; end if;

  -- Première personne à rejoindre cette entreprise = administrateur.
  if exists (select 1 from public.users where org_id = v_org) then
    v_role := 'saisie';
  else
    v_role := 'admin';
  end if;

  insert into public.users(id, org_id, role, email)
    values (auth.uid(), v_org, v_role, (select email from auth.users where id = auth.uid()));
  return v_org;
end $$;
