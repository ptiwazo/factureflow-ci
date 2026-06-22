-- =====================================================================
-- FactureFlow CI — Migration : catégorie de charge (IFRS par nature)
-- À exécuter dans Supabase → SQL Editor (après les migrations précédentes).
-- Idempotent.
-- =====================================================================

-- Catégorie de charge (classification IFRS par nature, IAS 1) proposée par
-- l'IA pour chaque ligne. Sert à proposer le compte de charge à l'export,
-- via le mapping catégorie → compte défini côté application.
alter table public.lignes
  add column if not exists categorie text;
