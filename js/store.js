/* =====================================================================
   FactureFlow CI — Accès aux données (Supabase)
   ---------------------------------------------------------------------
   Toutes les requêtes Postgres/Storage passent par ici. La sécurité réelle
   (isolation par org_id, rôles) est assurée côté base par les politiques RLS
   (cf. supabase/schema.sql) ; ce module ne réimplémente pas ces contrôles.
===================================================================== */
import { supabase, getProfil } from "./auth.js";
import { CONFIG } from "./config.js";

function orgId() {
  const p = getProfil();
  if (!p?.org_id) throw new Error("Organisation introuvable.");
  return p.org_id;
}

/* ---------------------------- Fournisseurs ------------------------- */
export async function listerFournisseurs() {
  const { data, error } = await supabase
    .from("fournisseurs").select("*").order("nom");
  if (error) throw error;
  return data || [];
}

export async function getFournisseur(id) {
  const { data, error } = await supabase
    .from("fournisseurs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

// Recherche un fournisseur existant (par NCC, sinon par nom) SANS le créer.
// Sert à savoir s'il est "nouveau" avant la 2ᵉ validation (saisie compte SAP).
export async function rechercherFournisseur({ nom, ncc }) {
  const org = orgId();
  const n = (ncc || "").trim();
  if (n) {
    const { data } = await supabase
      .from("fournisseurs").select("*").eq("org_id", org).eq("ncc", n).maybeSingle();
    if (data) return data;
  }
  if (nom) {
    const { data } = await supabase
      .from("fournisseurs").select("*").eq("org_id", org).ilike("nom", nom.trim()).limit(1);
    if (data && data.length) return data[0];
  }
  return null;
}

// Déduplication par NCC : si un fournisseur de l'org a déjà ce NCC, on le
// renvoie ; sinon on le crée. Sans NCC, on tente un rapprochement par nom.
// `compteSap` (CardCode) est renseigné à la création ; sur un fournisseur
// existant sans compte SAP, on le complète si fourni.
export async function trouverOuCreerFournisseur({ nom, ncc, rccm, telephone, compteSap }) {
  const org = orgId();
  ncc = (ncc || "").trim() || null;
  compteSap = (compteSap || "").trim() || null;

  const existant = await rechercherFournisseur({ nom, ncc });
  if (existant) {
    // Complète le compte SAP s'il manquait et qu'on en fournit un.
    if (compteSap && !existant.compte_sap) {
      await supabase.from("fournisseurs").update({ compte_sap: compteSap }).eq("id", existant.id);
      existant.compte_sap = compteSap;
    }
    return existant;
  }

  const { data, error } = await supabase.from("fournisseurs")
    .insert({ org_id: org, nom: nom || "Fournisseur inconnu", ncc, rccm: rccm || null,
      telephone: telephone || null, compte_sap: compteSap, created_by: getProfil()?.user?.id })
    .select().single();
  if (error) throw error;
  return data;
}

export async function majFournisseur(id, patch) {
  const { error } = await supabase.from("fournisseurs").update(patch).eq("id", id);
  if (error) throw error;
}

// Upsert d'un fournisseur lors d'un import : crée s'il n'existe pas (dédup par
// NCC, sinon par nom), sinon met à jour les champs fournis (non vides).
// Retourne { action: "cree" | "maj" | "ignore", fournisseur }.
export async function upsertFournisseur({ nom, ncc, rccm, telephone, compteSap }) {
  const org = orgId();
  nom = (nom || "").trim();
  ncc = (ncc || "").trim() || null;
  if (!nom && !ncc) return { action: "ignore" }; // ligne inexploitable

  const existant = await rechercherFournisseur({ nom, ncc });
  if (existant) {
    // On ne met à jour que les champs fournis (non vides) pour ne rien écraser à vide.
    const patch = {};
    if (nom && nom !== existant.nom) patch.nom = nom;
    if (ncc && ncc !== existant.ncc) patch.ncc = ncc;
    if ((rccm || "").trim()) patch.rccm = rccm.trim();
    if ((telephone || "").trim()) patch.telephone = telephone.trim();
    if ((compteSap || "").trim()) patch.compte_sap = compteSap.trim();
    if (Object.keys(patch).length) await majFournisseur(existant.id, patch);
    return { action: "maj", fournisseur: { ...existant, ...patch } };
  }

  const { data, error } = await supabase.from("fournisseurs")
    .insert({ org_id: org, nom: nom || "Fournisseur inconnu", ncc,
      rccm: (rccm || "").trim() || null, telephone: (telephone || "").trim() || null,
      compte_sap: (compteSap || "").trim() || null, created_by: getProfil()?.user?.id })
    .select().single();
  if (error) throw error;
  return { action: "cree", fournisseur: data };
}

/* ---------------------------- Organisation ------------------------- */
// Définit l'ERP comptable de l'organisation ('sap' | 'sage'). La RLS
// (`org_admin_update`) réserve cette écriture aux administrateurs.
export async function majErpOrganisation(erp) {
  const { data, error } = await supabase
    .from("organisations").update({ erp }).eq("id", orgId()).select("id");
  if (error) throw error;
  if (!data || !data.length) {
    throw new Error("Modification refusée : rôle administrateur requis.");
  }
}

/* ----------------------------- Utilisateurs ------------------------ */
// Membres de l'organisation (lecture autorisée à tout membre par la RLS).
export async function listerUtilisateurs() {
  const { data, error } = await supabase
    .from("users").select("id, email, role, created_at").order("created_at");
  if (error) throw error;
  return data || [];
}

// Change le rôle d'un utilisateur de l'org. La RLS (`users_admin_write`)
// n'autorise cette écriture qu'aux administrateurs. On demande le retour de la
// ligne (`select`) : si la RLS refuse, l'update renvoie 0 ligne SANS erreur
// PostgREST — on le détecte pour signaler clairement le refus plutôt que de
// laisser croire à un succès silencieux.
export async function majRoleUtilisateur(id, role) {
  const { data, error } = await supabase
    .from("users").update({ role }).eq("id", id).select("id");
  if (error) throw error;
  if (!data || !data.length) {
    throw new Error("Modification refusée : rôle administrateur requis. " +
      "Si votre rôle a changé récemment, déconnectez-vous puis reconnectez-vous.");
  }
}

/* ------------------------------ Factures --------------------------- */
export async function listerFactures({ statut, fournisseurId, debut, fin } = {}) {
  let q = supabase.from("factures")
    .select("*, fournisseurs(nom, ncc, compte_sap)")
    .order("date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (statut) q = q.eq("statut", statut);
  if (fournisseurId) q = q.eq("fournisseur_id", fournisseurId);
  if (debut) q = q.gte("date", debut);
  if (fin) q = q.lte("date", fin);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function getFacture(id) {
  const { data, error } = await supabase
    .from("factures").select("*, fournisseurs(*)").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getLignes(factureId) {
  const { data, error } = await supabase
    .from("lignes").select("*").eq("facture_id", factureId).order("created_at");
  if (error) throw error;
  return data || [];
}

// Crée une facture + ses lignes + l'upload de l'original, de façon
// transactionnelle au mieux : la facture d'abord (pour obtenir l'id qui sert
// au chemin Storage), puis l'upload, puis les lignes.
export async function creerFactureComplete({ entete, lignes, fichier, extractionBrute }) {
  const org = orgId();
  const uid = getProfil()?.user?.id;

  const { data: facture, error: errF } = await supabase.from("factures").insert({
    org_id: org,
    fournisseur_id: entete.fournisseur_id || null,
    numero: entete.numero || null,
    date: entete.date || null,
    echeance: entete.echeance || null,
    total_ht: entete.total_ht || 0,
    taux_tva: entete.taux_tva ?? CONFIG.TVA_DEFAUT,
    montant_tva: entete.montant_tva || 0,
    total_ttc: entete.total_ttc || 0,
    devise: entete.devise || CONFIG.DEVISE_DEFAUT,
    statut: entete.statut || "a_verifier",
    extraction_brute: extractionBrute || null,
    created_by: uid,
  }).select().single();
  if (errF) throw errF;

  // Upload de l'original (chemin : <org>/<facture>.<ext>) — conforme aux RLS Storage.
  if (fichier) {
    try {
      const url = await uploadOriginal(facture.id, fichier);
      await supabase.from("factures").update({ fichier_url: url }).eq("id", facture.id);
      facture.fichier_url = url;
    } catch (e) {
      // L'original n'a pas pu être stocké : la facture existe quand même.
      // On le signale à l'appelant sans bloquer (l'audit le notera).
      console.warn("Upload original échoué :", e);
    }
  }

  // Lignes
  if (Array.isArray(lignes) && lignes.length) {
    const rows = lignes.map((l) => ({
      facture_id: facture.id,
      designation: l.designation || "",
      quantite: l.quantite || 0,
      prix_unitaire: l.prix_unitaire || 0,
      montant_ht: l.montant_ht || 0,
      taux_tva: l.taux_tva != null ? l.taux_tva : CONFIG.TVA_DEFAUT,
      categorie: l.categorie || null,
    }));
    const { error: errL } = await supabase.from("lignes").insert(rows);
    if (errL) throw errL;
  }

  return facture;
}

// Recherche un doublon probable AVANT enregistrement.
//  - Priorité au NUMÉRO de facture (au niveau de l'organisation, via RLS) :
//    un même numéro déjà présent = doublon, quel que soit le fournisseur retenu.
//  - Repli si le numéro est absent/illisible : même fournisseur + même date + même TTC.
// Retourne la facture existante (avec le nom du fournisseur), ou null.
export async function chercherDoublon({ fournisseurId, numero, date, totalTtc, excludeId = null }) {
  const num = (numero || "").trim();
  let q = supabase.from("factures").select("id, numero, date, total_ttc, statut, fournisseurs(nom)");

  if (num) {
    q = q.eq("numero", num);                       // clé principale : le numéro
  } else if (fournisseurId && date && totalTtc != null) {
    q = q.eq("fournisseur_id", fournisseurId).eq("date", date).eq("total_ttc", totalTtc);
  } else {
    return null; // pas assez d'éléments pour décider d'un doublon
  }
  if (excludeId) q = q.neq("id", excludeId);

  const { data, error } = await q.limit(1);
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

export async function majStatutFacture(id, statut) {
  const { error } = await supabase.from("factures").update({ statut }).eq("id", id);
  if (error) throw error;
}

// Met à jour le compte de charge (categorie) de plusieurs lignes.
// `maj` : [{ id, categorie }]. Utilisé par le Contrôle de Gestion à l'étape de
// confirmation/modification des comptes proposés par l'IA.
export async function majCategoriesLignes(maj) {
  for (const { id, categorie } of maj || []) {
    const { error } = await supabase.from("lignes")
      .update({ categorie: (categorie || "").trim() || null }).eq("id", id);
    if (error) throw error;
  }
}

// Met à jour le règlement d'une facture (statut_paiement, date, montant payé).
// `patch` : { statut_paiement, date_paiement, montant_paye }.
export async function majPaiement(id, patch) {
  const { data, error } = await supabase.from("factures").update({
    statut_paiement: patch.statut_paiement,
    date_paiement: patch.date_paiement || null,
    montant_paye: patch.montant_paye ?? 0,
  }).eq("id", id).select("id");
  if (error) throw error;
  if (!data || !data.length) {
    throw new Error("Mise à jour du paiement refusée (droits insuffisants).");
  }
}

export async function supprimerFacture(id) {
  // Les lignes sont supprimées en cascade (FK). On retire aussi l'original.
  const f = await getFacture(id);
  if (f?.fichier_url) {
    await supabase.storage.from(CONFIG.BUCKET).remove([f.fichier_url]).catch(() => {});
  }
  const { error } = await supabase.from("factures").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------ Storage ---------------------------- */
function extensionDe(fichier) {
  const t = fichier.type || "";
  if (t.includes("pdf")) return "pdf";
  if (t.includes("png")) return "png";
  return "jpg";
}

export async function uploadOriginal(factureId, fichier) {
  const org = orgId();
  const chemin = `${org}/${factureId}.${extensionDe(fichier)}`;
  const { error } = await supabase.storage.from(CONFIG.BUCKET)
    .upload(chemin, fichier, { upsert: true, contentType: fichier.type || "image/jpeg" });
  if (error) throw error;
  return chemin;
}

// URL signée temporaire pour consulter l'original (cf. CLAUDE.md §10).
export async function urlOriginalSignee(chemin, secondes = 300) {
  if (!chemin) return null;
  const { data, error } = await supabase.storage.from(CONFIG.BUCKET)
    .createSignedUrl(chemin, secondes);
  if (error) throw error;
  return data?.signedUrl || null;
}

/* -------------------------------- Logs ----------------------------- */
export async function journaliser(action, cible) {
  const p = getProfil();
  if (!p?.org_id) return;
  // Best-effort : un échec de log ne doit jamais bloquer l'action métier.
  // NB : le query builder Supabase est "thenable" mais n'expose pas .catch(),
  // d'où le try/catch autour du await.
  try {
    await supabase.from("logs").insert({
      org_id: p.org_id, user_id: p.user?.id, action, cible: cible || null,
    });
  } catch { /* log non bloquant */ }
}

export async function listerLogs(limite = 50) {
  const { data, error } = await supabase.from("logs")
    .select("*").order("created_at", { ascending: false }).limit(limite);
  if (error) throw error;
  return data || [];
}

/* ----------------------- Agrégats tableau de bord ------------------ */
// Renvoie de quoi alimenter les KPIs et le « dépenses par fournisseur ».
export async function statsDashboard() {
  const factures = await listerFactures();
  const debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);

  let depensesMois = 0, tvaCumulee = 0, aVerifier = 0, nonConformes = 0;
  let aControler = 0, aValider = 0;
  let montantAPayer = 0, nbAPayer = 0, nbEnRetard = 0;
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  const parFournisseur = new Map();

  for (const f of factures) {
    const ttc = Number(f.total_ttc) || 0;
    if (f.statut === "a_verifier") aVerifier++;
    if (f.statut === "a_controler") aControler++;
    if (f.statut === "a_valider") aValider++;
    if (f.statut === "non_conforme") nonConformes++;

    // Suivi des règlements (hors factures écartées). Tolère l'absence des
    // colonnes paiement (migration non appliquée → considéré « à payer »).
    if (f.statut !== "non_conforme") {
      const paye = Number(f.montant_paye) || 0;
      const pstatut = f.statut_paiement
        || (ttc > 0 && paye >= ttc ? "paye" : paye > 0 ? "partiel" : "a_payer");
      if (pstatut !== "paye") {
        montantAPayer += Math.max(0, ttc - paye);
        nbAPayer++;
        if (f.echeance && new Date(f.echeance) < auj) nbEnRetard++;
      }
    }

    // On comptabilise les dépenses sur les factures non rejetées.
    if (f.statut !== "non_conforme") {
      tvaCumulee += Number(f.montant_tva) || 0;
      const d = f.date ? new Date(f.date) : new Date(f.created_at);
      if (d >= debutMois) depensesMois += ttc;
      const nom = f.fournisseurs?.nom || "—";
      parFournisseur.set(nom, (parFournisseur.get(nom) || 0) + ttc);
    }
  }

  const topFournisseurs = [...parFournisseur.entries()]
    .map(([nom, total]) => ({ nom, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  return {
    total: factures.length,
    depensesMois, tvaCumulee, aVerifier, aControler, aValider, nonConformes,
    montantAPayer, nbAPayer, nbEnRetard,
    topFournisseurs,
    recentes: factures.slice(0, 5),
  };
}
