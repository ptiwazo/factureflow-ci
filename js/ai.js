/* =====================================================================
   FactureFlow CI — Extraction IA (appel proxy + parsing)
   ---------------------------------------------------------------------
   Envoie l'image (base64) au proxy Netlify, qui relaie vers Claude en
   VISION + TOOL_USE. Le contrat de sortie est imposé par le `tool` défini
   ci-dessous (schéma strict, cf. CLAUDE.md §7). Aucune clé ici : le JWT
   Supabase est joint en Bearer pour authentifier l'appel.
===================================================================== */
import { CONFIG, COMPTE_DEBOURS, INDICES_FOURNISSEUR_DEBOURS } from "./config.js";
import { getAccessToken } from "./auth.js";
import { calculerTotaux } from "./ui.js";
import { PLAN_COMPTABLE_IFRS, COMPTES_PAR_NUMERO, LIBELLE_SECTION } from "./comptes-charge-ifrs.js";

// La classification d'une ligne = un COMPTE du plan comptable de référence
// (js/comptes-charge-ifrs.js). On l'enregistre dans le champ `categorie` de la
// ligne (compat. base existante), mais sa valeur est désormais un n° de compte.
const CODES_CATEGORIE = PLAN_COMPTABLE_IFRS.map((c) => c.compte);

// Outil tool_use : force Claude à répondre par un JSON conforme au schéma §7.
const OUTIL_EXTRACTION = {
  name: "enregistrer_facture",
  description: "Enregistre les données structurées extraites d'une facture fournisseur ivoirienne.",
  input_schema: {
    type: "object",
    properties: {
      fournisseur: {
        type: "object",
        properties: {
          nom: { type: "string", description: "Raison sociale du fournisseur (émetteur)." },
          ncc: { type: "string", description: "Numéro de Compte Contribuable. Vide si absent." },
          rccm: { type: "string", description: "Numéro RCCM si présent." },
          telephone: { type: "string" },
        },
        required: ["nom", "ncc", "rccm", "telephone"],
      },
      facture: {
        type: "object",
        properties: {
          numero: { type: "string" },
          date: { type: "string", description: "Date d'émission au format AAAA-MM-JJ." },
          echeance: { type: "string", description: "Date d'échéance AAAA-MM-JJ, vide si absente." },
          devise: { type: "string", description: "Code devise, XOF par défaut." },
        },
        required: ["numero", "date", "echeance", "devise"],
      },
      lignes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            designation: { type: "string" },
            quantite: { type: "number" },
            prix_unitaire: { type: "number" },
            montant_ht: { type: "number" },
            taux_tva: { type: "number", description: "Taux de TVA de la ligne en %, 18 par défaut en CI ; 0 si exonérée." },
            categorie: {
              type: "string",
              enum: [...CODES_CATEGORIE, ""],
              description: "Numéro de COMPTE de charge du plan de référence (voir la liste fournie dans le prompt système) dont la NATURE correspond le mieux à cette ligne. Laisse vide (\"\") si aucun compte ne correspond clairement.",
            },
          },
          required: ["designation", "quantite", "prix_unitaire", "montant_ht", "taux_tva", "categorie"],
        },
      },
      totaux: {
        type: "object",
        properties: {
          total_ht: { type: "number" },
          taux_tva: { type: "number", description: "Taux de TVA en %, 18 par défaut en CI." },
          montant_tva: { type: "number" },
          total_ttc: { type: "number" },
        },
        required: ["total_ht", "taux_tva", "montant_tva", "total_ttc"],
      },
      est_debours: {
        type: "boolean",
        description: "true SI le fournisseur est un armateur, un acconier, un terminal portuaire ou un consignataire, OU si la facture concerne le transit MARITIME ou AÉRIEN (fret, connaissement/BL, manifeste, THC, acconage, consignation). Dans ce cas, toutes les lignes seront imputées au compte de débours. Sinon false.",
      },
      confiance: {
        type: "object",
        properties: {
          global: { type: "number", description: "Confiance globale entre 0 et 1." },
          champs_incertains: {
            type: "array", items: { type: "string" },
            description: "Chemins des champs peu sûrs, ex: 'facture.numero', 'totaux.total_ttc'.",
          },
        },
        required: ["global", "champs_incertains"],
      },
    },
    required: ["fournisseur", "facture", "lignes", "totaux", "est_debours", "confiance"],
  },
};

const SYSTEM_BASE = `Tu es un assistant d'extraction de factures fournisseurs pour des PME en Côte d'Ivoire.
Lis l'image de la facture et renseigne l'outil "enregistrer_facture".
Règles :
- Devise par défaut XOF (FCFA). Montants en nombres, sans séparateur de milliers.
- TVA usuelle 18 % en Côte d'Ivoire ; n'invente aucune règle fiscale.
- NCC = Numéro de Compte Contribuable du fournisseur ; laisse vide si introuvable.
- Dates au format AAAA-MM-JJ ; laisse vide si illisible plutôt que de deviner.
- Reporte précisément les lignes (désignation, quantité, prix unitaire, montant HT).
- Pour chaque ligne, renseigne "categorie" avec le NUMÉRO DE COMPTE du plan de charge de
  référence (liste ci-dessous) dont la nature correspond le mieux à la désignation. Appuie-toi
  sur le libellé ET la nature de chaque compte. Si aucun compte ne correspond clairement,
  laisse "categorie" vide ("") — l'utilisateur classera manuellement.
- RÈGLE DÉBOURS (prioritaire) : si le fournisseur est un ARMATEUR, un ACCONIER, un
  TERMINAL portuaire ou un CONSIGNATAIRE, OU si la facture concerne le TRANSIT
  MARITIME OU AÉRIEN (fret, connaissement/BL, manifeste, THC, acconage, consignation),
  alors mets "est_debours" à true et affecte TOUTES les lignes au compte ${COMPTE_DEBOURS}
  (Débours, avances pour le compte du client). Sinon "est_debours" = false.
- Dans champs_incertains, liste tout champ que tu n'as pas pu lire avec certitude
  (photo floue, manuscrit, ambiguïté) en utilisant des chemins comme "facture.date".
  Ajoute aussi le chemin de la ligne (ex: "lignes.0.categorie") si le compte choisi est incertain.
N'écris aucun texte hors de l'appel d'outil.`;

// Référentiel des comptes de charge fourni au modèle pour le classement par ligne.
// Bloc volumineux mais IDENTIQUE à chaque appel → marqué pour le prompt caching
// (réduit fortement le coût des extractions suivantes).
const PLAN_TEXT = `PLAN DE COMPTES DE CHARGES (référentiel interne IFRS / OHADA — secteur logistique / transport / transit).
Choisis pour chaque ligne le compte dont la NATURE correspond le mieux à la désignation. Format : « numéro — libellé : nature ».
${PLAN_COMPTABLE_IFRS.map((c) => `- ${c.compte} — ${c.labelFr} [${LIBELLE_SECTION[c.section] || c.section}] : ${c.nature}`).join("\n")}`;

// `system` en tableau de blocs : instructions + référentiel (mis en cache).
const SYSTEM = [
  { type: "text", text: SYSTEM_BASE },
  { type: "text", text: PLAN_TEXT, cache_control: { type: "ephemeral" } },
];

// Appel bas niveau du proxy, avec timeout et tentatives (réseau CI instable).
async function appelProxy(payload, { retries = CONFIG.AI_RETRIES } = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error("Session expirée. Reconnectez-vous.");

  let lastErr;
  for (let essai = 0; essai <= retries; essai++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CONFIG.AI_TIMEOUT_MS);
    try {
      const res = await fetch(CONFIG.AI_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // On remonte le message précis. `data.error` peut être :
        //  - une chaîne (erreur émise par notre proxy : JWT, CORS, config) ;
        //  - un OBJET { type, message } (erreur de l'API Anthropic relayée telle
        //    quelle) — dans ce cas `new Error(objet)` afficherait "[object Object]".
        // On extrait donc toujours un texte lisible.
        const e = data?.error;
        const msg = typeof e === "string" ? e
          : (e?.message || e?.type || (e ? JSON.stringify(e) : ""))
          || `Erreur IA (${res.status}).`;
        throw new Error(msg);
      }
      return data;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      // On retente seulement sur erreurs réseau/abort, pas sur 401/400.
      const recuperable = e.name === "AbortError" || /Failed to fetch|network/i.test(e.message || "");
      if (!recuperable || essai === retries) break;
      await new Promise((r) => setTimeout(r, 800 * (essai + 1)));
    }
  }
  throw lastErr || new Error("Échec de l'appel IA.");
}

/* Extrait les champs d'une facture (image ou PDF).
   @param source  { base64, mediaType, kind:"image"|"pdf" } (base64 sans préfixe data:)
   @param complexe  true → utilise le modèle de repli (factures complexes)
   @returns l'objet structuré (schéma §7). */
export async function extraireFacture(source, { complexe = false } = {}) {
  const { base64, mediaType, kind } = source;

  // Bloc visuel : "image" pour JPEG/PNG, "document" pour PDF (vision Claude).
  const blocVisuel = kind === "pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: base64 } };

  const payload = {
    model: complexe ? CONFIG.MODEL_FALLBACK : CONFIG.MODEL_DEFAULT,
    max_tokens: 4000,
    system: SYSTEM,
    tools: [OUTIL_EXTRACTION],
    tool_choice: { type: "tool", name: OUTIL_EXTRACTION.name },
    messages: [{
      role: "user",
      content: [
        blocVisuel,
        { type: "text", text: "Extrais les données de cette facture fournisseur." },
      ],
    }],
  };

  const data = await appelProxy(payload);

  // Récupère le bloc tool_use renvoyé par Claude.
  const bloc = (data.content || []).find((c) => c.type === "tool_use" && c.name === OUTIL_EXTRACTION.name);
  if (!bloc) {
    throw new Error("L'IA n'a pas renvoyé de données exploitables. Réessayez ou saisissez manuellement.");
  }
  return normaliser(bloc.input);
}

// Garantit la présence de tous les champs attendus et recalcule les totaux
// pour cohérence (l'IA peut se tromper sur l'arithmétique).
function normaliser(raw = {}) {
  // Règle DÉBOURS : déclenchée par l'IA (est_debours) OU par un indice dans le
  // nom du fournisseur (armateur / acconier / terminal / consignataire…).
  const nomFourn = (raw.fournisseur?.nom || "").toLowerCase();
  const indiceDebours = INDICES_FOURNISSEUR_DEBOURS.some((k) => nomFourn.includes(k));
  const estDebours = raw.est_debours === true || indiceDebours;

  const out = {
    est_debours: estDebours,
    fournisseur: {
      nom: raw.fournisseur?.nom || "",
      ncc: (raw.fournisseur?.ncc || "").trim(),
      rccm: raw.fournisseur?.rccm || "",
      telephone: raw.fournisseur?.telephone || "",
    },
    facture: {
      numero: raw.facture?.numero || "",
      date: raw.facture?.date || "",
      echeance: raw.facture?.echeance || "",
      devise: raw.facture?.devise || CONFIG.DEVISE_DEFAUT,
    },
    lignes: Array.isArray(raw.lignes) ? raw.lignes.map((l) => ({
      designation: l.designation || "",
      quantite: Number(l.quantite) || 0,
      prix_unitaire: Number(l.prix_unitaire) || 0,
      montant_ht: Number(l.montant_ht) || (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0),
      // Taux de TVA de la ligne : repli sur le taux global puis 18 % (CI).
      taux_tva: l.taux_tva != null ? Number(l.taux_tva)
        : (raw.totaux?.taux_tva != null ? Number(raw.totaux.taux_tva) : CONFIG.TVA_DEFAUT),
      // Débours prioritaire ; sinon compte du plan de référence (vide si inconnu).
      categorie: estDebours ? COMPTE_DEBOURS
        : (COMPTES_PAR_NUMERO[l.categorie] ? l.categorie : ""),
    })) : [],
    totaux: {
      total_ht: Number(raw.totaux?.total_ht) || 0,
      taux_tva: raw.totaux?.taux_tva != null ? Number(raw.totaux.taux_tva) : CONFIG.TVA_DEFAUT,
      montant_tva: Number(raw.totaux?.montant_tva) || 0,
      total_ttc: Number(raw.totaux?.total_ttc) || 0,
    },
    confiance: {
      global: Number(raw.confiance?.global) || 0,
      champs_incertains: Array.isArray(raw.confiance?.champs_incertains) ? raw.confiance.champs_incertains : [],
    },
  };

  // Si les totaux extraits sont vides/incohérents mais qu'on a des lignes,
  // on propose un recalcul (l'utilisateur validera de toute façon en §5).
  if ((!out.totaux.total_ht || !out.totaux.total_ttc) && out.lignes.length) {
    const t = calculerTotaux(out.lignes, out.totaux.taux_tva);
    out.totaux.total_ht = out.totaux.total_ht || t.total_ht;
    out.totaux.montant_tva = out.totaux.montant_tva || t.montant_tva;
    out.totaux.total_ttc = out.totaux.total_ttc || t.total_ttc;
  }

  return out;
}
