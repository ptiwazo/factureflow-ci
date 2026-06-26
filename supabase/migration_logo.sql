-- =====================================================================
-- FactureFlow CI — Migration : logo d'organisation (en-tête des relevés)
-- ---------------------------------------------------------------------
-- Stocke le logo en data URL (image redimensionnée côté client). Mise à jour
-- réservée à l'admin via la policy org_admin_update existante. Idempotent.
-- =====================================================================

alter table public.organisations
  add column if not exists logo text;   -- data URL (image base64), facultatif
