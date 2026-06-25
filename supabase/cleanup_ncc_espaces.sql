-- =====================================================================
-- FactureFlow CI — Nettoyage : retirer les espaces des NCC fournisseurs
-- ---------------------------------------------------------------------
-- Supprime TOUS les caractères d'espacement (espaces, tabulations…) dans
-- fournisseurs.ncc pour les fiches déjà enregistrées. Si le NCC ne contenait
-- que des espaces, il devient NULL. Ponctuel et idempotent.
-- =====================================================================

-- 1) Aperçu : fiches dont le NCC contient un espace (à lancer avant).
-- select id, nom, ncc from public.fournisseurs where ncc ~ '\s';

-- 2) Nettoyage.
update public.fournisseurs
set ncc = nullif(regexp_replace(ncc, '\s', '', 'g'), '')
where ncc ~ '\s';

-- 3) Vérification : doit renvoyer 0.
-- select count(*) as restants from public.fournisseurs where ncc ~ '\s';
