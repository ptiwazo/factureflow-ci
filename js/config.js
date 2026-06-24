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

// Règle métier — DÉBOURS. Les factures de transit maritime / aérien et les
// fournisseurs de type armateur / acconier / terminal / consignataire sont des
// avances réglées pour le compte du client : elles s'imputent au COMPTE DE
// DÉBOURS du plan de référence (et non à une charge propre de l'entreprise).
export const COMPTE_DEBOURS = "90006000"; // Débours commissionnaire en douane
// Indices (recherchés dans le NOM du fournisseur, en minuscules) qui déclenchent
// le débours en complément de la détection par l'IA. Liste ajustable.
export const INDICES_FOURNISSEUR_DEBOURS = [
  "armateur", "acconier", "acconage", "consignataire", "consignation",
  "shipping", "terminal", "maersk", "cma cgm", "cma-cgm",
  "msc", "cosco", "hapag", "grimaldi", "bolloré", "bollore",
  "africa global", "apm terminal", "dp world",
];

// Correspondance SUGGÉRÉE entre chaque catégorie IFRS (par nature) et un compte
// du « Plan comptable de référence (IFRS / OHADA) » (js/comptes-charge-ifrs.js).
// Sert à pré-remplir le mapping dans Réglages via le bouton « Proposer depuis le
// plan de référence ». ⚠️ Suggestions à VALIDER par un expert-comptable :
//   - le plan de référence est orienté logistique / transport / transit ;
//   - certaines catégories n'ont pas d'équivalent direct (marchandises de
//     revente, immobilisations, « autres ») et restent volontairement non mappées.
export const MAPPING_IFRS_DEFAUT = {
  // Achats & stocks
  matieres:      "51040000", // Matériaux et consommables opérationnels
  fournitures:   "58508000", // Fournitures de bureau
  emballages:    "51040000", // Matériaux et consommables opérationnels
  pieces:        "51030000", // Maintenance, pièces détachées, réparations (op)
  // Services extérieurs
  services:      "58507000", // Services professionnels divers
  honoraires:    "58507000", // Services professionnels divers
  soustraitance: "51010000", // Sous-traitants opérationnels
  interim:       "59070000", // Main-d'œuvre temporaire
  entretien:     "51030000", // Maintenance, pièces détachées, réparations (op)
  maintenance:   "51000130", // Maintenance préventive
  nettoyage:     "58504002", // Nettoyage des bureaux
  securite:      "51000070", // Gardiennage / sécurité externe
  logiciels:     "58530200", // Logiciels - Autres (licences & SaaS)
  documentation: "58558000", // Abonnements et cotisations
  formation:     "58507000", // Services professionnels divers
  publicite:     "58568000", // Frais de publicité / marketing
  restauration:  "58566000", // Frais de représentation / réception
  // Locations
  loyers:        "58504100", // Loyer de bureaux
  location_mat:  "51060100", // Location d'équipements et machines
  // Logistique & déplacements
  transport:     "51010000", // Sous-traitants opérationnels (transport sur achats)
  deplacements:  "58540000", // Frais de voyage et déplacement
  carburant:     "51020000", // Carburant / combustible
  douane:        "52030000", // Frais de commissionnaire en douane
  // Énergie & fluides
  energie:       "51021000", // Électricité (énergie opérationnelle)
  electricite:   "51021000", // Électricité
  eau:           "51022000", // Eau
  // Communications
  telecom:       "58520200", // Téléphone et autres frais de communication
  poste:         "58527020", // Frais postaux divers
  // Financier & autres
  assurances:    "58570001", // Assurance Responsabilité Civile Générale
  banque:        "65518000", // Frais et commissions bancaires
  medical:       "59028000", // Frais médicaux
  impots:        "58553050", // Autres taxes indirectes
  // marchandises / immobilisation / autres : pas d'équivalent direct → non mappés
};

// Catégories regroupées par `groupe`, dans l'ordre d'apparition (pour optgroups
// et sous-titres). [{ groupe, items: [{code,label,...}] }]
export const CATEGORIES_GROUPES = CATEGORIES_CHARGE.reduce((acc, c) => {
  let g = acc.find((x) => x.groupe === c.groupe);
  if (!g) { g = { groupe: c.groupe, items: [] }; acc.push(g); }
  g.items.push(c);
  return acc;
}, []);

