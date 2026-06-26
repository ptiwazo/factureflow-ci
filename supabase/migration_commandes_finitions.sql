-- =====================================================================
-- FactureFlow CI — Migration : finitions commandes
-- ---------------------------------------------------------------------
-- Association manuelle d'une ligne de facture à une ligne de commande (quand
-- les libellés diffèrent). Le passage auto en « soldée » est géré côté
-- application (aucune colonne supplémentaire). Idempotent.
-- =====================================================================

alter table public.lignes
  add column if not exists commande_ligne_id uuid
  references public.commandes_lignes(id) on delete set null;
