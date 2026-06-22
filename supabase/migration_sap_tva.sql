-- =====================================================================
-- FactureFlow CI — Migration : compte SAP fournisseur + TVA par ligne
-- À exécuter dans Supabase → SQL Editor (après le schema.sql initial).
-- Idempotent : peut être relancé sans risque.
-- =====================================================================

-- 1) Compte SAP (CardCode / compte fournisseur) rattaché à chaque fournisseur.
--    Utilisé en priorité dans l'export SAP (écritures FI) pour la ligne crédit.
alter table public.fournisseurs
  add column if not exists compte_sap text;

-- 2) Taux de TVA par ligne (gestion des factures à taux mixtes / exonérations).
--    18 % par défaut (CI). Le montant de TVA de la facture est recalculé à partir
--    des taux de chaque ligne côté application.
alter table public.lignes
  add column if not exists taux_tva numeric(5,2) not null default 18;
