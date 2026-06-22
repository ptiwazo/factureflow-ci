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
// Liste enrichie. Les codes existants sont conservés (compatibilité des lignes
// déjà enregistrées) ; chaque catégorie porte un `groupe` pour l'affichage.
// Libellés et groupes en ANGLAIS (terminologie IFRS / IAS 1 « expenses by nature »).
// Les `code` sont inchangés (compatibilité des lignes déjà enregistrées).
export const CATEGORIES_CHARGE = [
  // Purchases & inventory
  { code: "marchandises",   groupe: "Purchases & inventory",  label: "Purchases of goods for resale" },
  { code: "matieres",       groupe: "Purchases & inventory",  label: "Raw materials & consumables used" },
  { code: "fournitures",    groupe: "Purchases & inventory",  label: "Office supplies & small equipment" },
  { code: "emballages",     groupe: "Purchases & inventory",  label: "Packaging materials" },
  { code: "pieces",         groupe: "Purchases & inventory",  label: "Spare parts & technical consumables" },

  // External services
  { code: "services",       groupe: "External services",      label: "External services (general)" },
  { code: "honoraires",     groupe: "External services",      label: "Professional fees (consulting, legal, audit)" },
  { code: "soustraitance",  groupe: "External services",      label: "Subcontracting" },
  { code: "interim",        groupe: "External services",      label: "Temporary & outsourced staff" },
  { code: "entretien",      groupe: "External services",      label: "Repairs & maintenance" },
  { code: "maintenance",    groupe: "External services",      label: "Maintenance & technical support" },
  { code: "nettoyage",      groupe: "External services",      label: "Cleaning services" },
  { code: "securite",       groupe: "External services",      label: "Security & guarding" },
  { code: "logiciels",      groupe: "External services",      label: "Software, licences & SaaS subscriptions" },
  { code: "documentation",  groupe: "External services",      label: "Documentation & subscriptions" },
  { code: "formation",      groupe: "External services",      label: "Training" },
  { code: "publicite",      groupe: "External services",      label: "Advertising, marketing & communication" },
  { code: "restauration",   groupe: "External services",      label: "Catering & hospitality" },

  // Leases & rentals
  { code: "loyers",         groupe: "Leases & rentals",       label: "Rent & lease charges" },
  { code: "location_mat",   groupe: "Leases & rentals",       label: "Equipment & vehicle rental" },

  // Logistics & travel
  { code: "transport",      groupe: "Logistics & travel",     label: "Freight & logistics on purchases" },
  { code: "deplacements",   groupe: "Logistics & travel",     label: "Travel & business trips" },
  { code: "carburant",      groupe: "Logistics & travel",     label: "Fuel" },
  { code: "douane",         groupe: "Logistics & travel",     label: "Customs duties & clearance" },

  // Energy & utilities
  { code: "energie",        groupe: "Energy & utilities",     label: "Energy & utilities (combined)" },
  { code: "electricite",    groupe: "Energy & utilities",     label: "Electricity" },
  { code: "eau",            groupe: "Energy & utilities",     label: "Water" },

  // Communications
  { code: "telecom",        groupe: "Communications",         label: "Telecom & internet" },
  { code: "poste",          groupe: "Communications",         label: "Postage & courier" },

  // Financial & other
  { code: "assurances",     groupe: "Financial & other",      label: "Insurance" },
  { code: "banque",         groupe: "Financial & other",      label: "Bank fees & commissions" },
  { code: "medical",        groupe: "Financial & other",      label: "Medical & health expenses" },
  { code: "impots",         groupe: "Financial & other",      label: "Taxes & duties" },

  // Non-expense
  { code: "immobilisation", groupe: "Non-expense",            label: "Capital expenditure (capitalise, not an expense)" },
  { code: "autres",         groupe: "Non-expense",            label: "Other expenses" },
];
export const CATEGORIE_DEFAUT = "autres";

// Catégories regroupées par `groupe`, dans l'ordre d'apparition (pour optgroups
// et sous-titres). [{ groupe, items: [{code,label,...}] }]
export const CATEGORIES_GROUPES = CATEGORIES_CHARGE.reduce((acc, c) => {
  let g = acc.find((x) => x.groupe === c.groupe);
  if (!g) { g = { groupe: c.groupe, items: [] }; acc.push(g); }
  g.items.push(c);
  return acc;
}, []);

