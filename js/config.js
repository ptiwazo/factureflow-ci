/* =====================================================================
   FactureFlow CI — Configuration publique
   ---------------------------------------------------------------------
   ⚠️ AUCUN SECRET ICI. Seules figurent des valeurs publiques :
     - l'URL et la clé "anon" Supabase (conçues pour le navigateur, la
       sécurité réelle vient des politiques RLS) ;
     - l'URL du proxy IA Netlify.
   La clé ANTHROPIC_API_KEY reste exclusivement côté Netlify Function.
===================================================================== */

export const CONFIG = {
  // Supabase — URL RACINE du projet (sans /rest/v1). Le client supabase-js
  // construit lui-même les chemins /rest, /auth, /storage à partir d'elle.
  SUPABASE_URL: "https://cilceojlmqecqxkfexzk.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbGNlb2psbXFlY3F4a2ZleHprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwODA2MzgsImV4cCI6MjA5NzY1NjYzOH0.WEyevIWMko6py4vIKyGn6GPxhSPawjVoj_RSibiZUgY",

  // Proxy IA Netlify (sortie de `netlify deploy`)
  // En dev local via `netlify dev`, l'URL relative ci-dessous fonctionne.
  AI_PROXY_URL: "/.netlify/functions/ai-proxy",

  // Storage
  BUCKET: "factures",

  // Modèles IA (le proxy n'autorise que ces deux-là)
  MODEL_DEFAULT: "claude-sonnet-4-6",
  MODEL_FALLBACK: "claude-opus-4-8",

  // Métier — Côte d'Ivoire
  TVA_DEFAUT: 18,
  DEVISE_DEFAUT: "XOF",

  // Réseau (CI instable) : tentatives et délai de l'appel IA
  AI_RETRIES: 2,
  AI_TIMEOUT_MS: 60000,

  // Seuil en-dessous duquel un champ est considéré « incertain ».
  SEUIL_CONFIANCE: 0.75,
};

// Catégories de charge par NATURE (classification IFRS / IAS 1.102).
// ⚠️ IFRS ne définit pas de numéros de comptes : ces catégories servent à
// classer chaque ligne ; le numéro de compte réel est mappé par l'utilisateur
// dans Réglages (à valider par un expert-comptable).
export const CATEGORIES_CHARGE = [
  { code: "marchandises",   label: "Achats de marchandises" },
  { code: "matieres",       label: "Matières premières & consommables" },
  { code: "fournitures",    label: "Fournitures & petit matériel" },
  { code: "services",       label: "Services extérieurs (honoraires, sous-traitance)" },
  { code: "entretien",      label: "Entretien & réparations" },
  { code: "loyers",         label: "Loyers & charges locatives" },
  { code: "transport",      label: "Transport & logistique" },
  { code: "deplacements",   label: "Déplacements & missions" },
  { code: "energie",        label: "Énergie & fluides (eau, électricité, carburant)" },
  { code: "telecom",        label: "Télécoms & internet" },
  { code: "assurances",     label: "Assurances" },
  { code: "publicite",      label: "Publicité & marketing" },
  { code: "impots",         label: "Impôts & taxes" },
  { code: "immobilisation", label: "Immobilisation (à capitaliser, non charge)" },
  { code: "autres",         label: "Autres charges" },
];
export const CATEGORIE_DEFAUT = "autres";

