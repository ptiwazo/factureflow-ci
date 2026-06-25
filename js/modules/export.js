/* =====================================================================
   Module 6.6 — Export comptable
   ---------------------------------------------------------------------
   Sans dépendance externe (contrainte stack §3) :
     - CSV (séparateur ';', BOM UTF-8) → ouvrable Excel & importable Sage*
     - Excel (.xls) via table HTML (ouverte nativement par Excel)
     - PDF récapitulatif via fenêtre d'impression (Enregistrer en PDF)
   * Le mapping exact des colonnes Sage dépend du paramétrage comptable :
     format générique fourni, à valider/adapter par l'expert-comptable.
===================================================================== */
import { fcfa, dateFr, esc } from "../ui.js";
import { journaliser, getLignes } from "../store.js";
import { getProfil } from "../auth.js";
import { COMPTES_PAR_NUMERO } from "../comptes-charge-ifrs.js";
import { telechargerXlsx } from "../xlsx.js";

// En-têtes du relevé comptable.
const COLS = [
  "Date", "N° facture", "Fournisseur", "NCC", "RCCM",
  "Total HT", "Taux TVA", "Montant TVA", "Total TTC", "Devise", "Statut",
];

function lignesExport(factures) {
  return factures.map((f) => [
    f.date || "",
    f.numero || "",
    f.fournisseurs?.nom || "",
    f.fournisseurs?.ncc || "",
    f.fournisseurs?.rccm || "",
    Number(f.total_ht) || 0,
    Number(f.taux_tva) || 0,
    Number(f.montant_tva) || 0,
    Number(f.total_ttc) || 0,
    f.devise || "XOF",
    f.statut || "",
  ]);
}

function telecharger(contenu, nomFichier, mime) {
  const blob = new Blob([contenu], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nomFichier;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function horodatage() {
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------------- CSV ------------------------------- */
export async function exporterCSV(factures) {
  const sep = ";"; // séparateur FR (Excel/Sage en locale française)
  const echappe = (v) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lignes = [COLS.join(sep), ...lignesExport(factures).map((r) => r.map(echappe).join(sep))];
  const contenu = "﻿" + lignes.join("\r\n"); // BOM pour Excel
  telecharger(contenu, `factureflow_${horodatage()}.csv`, "text/csv;charset=utf-8");
  await journaliser("export_csv", `${factures.length} factures`);
}

/* ------------------------------ Excel ------------------------------ */
// Table HTML enregistrée en .xls : Excel l'ouvre nativement (pas de lib).
export async function exporterExcel(factures) {
  const ths = COLS.map((c) => `<th>${esc(c)}</th>`).join("");
  const trs = lignesExport(factures).map((r) =>
    `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head><meta charset="utf-8" /></head>
    <body><table border="1"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></body></html>`;
  telecharger("﻿" + html, `factureflow_${horodatage()}.xls`, "application/vnd.ms-excel");
  await journaliser("export_excel", `${factures.length} factures`);
}

/* ------------------------- SAP — écritures FI ---------------------- */
// Paramètres comptables (comptes GL, société, code TVA…). Stockés localement
// par organisation. ⚠️ Le plan comptable et les codes relèvent de votre
// configuration SAP / expert-comptable : l'app ne les invente pas.
const CLE_SAP = "ff_sap_compta";
const PARAMS_SAP_DEFAUT = {
  societe: "",            // Code société SAP (BUKRS)
  compteCharge: "",       // Compte de charge / achats (débit)
  compteTva: "",          // Compte TVA déductible (débit)
  codeTva: "",            // Indicateur de TVA (MWSKZ), ex. "V1"
  typePiece: "KR",        // Type de pièce (BLART), KR = facture fournisseur
  // NB : le compte crédit fournisseur n'est plus collectif — il provient du
  // compte SAP (CardCode) propre à chaque fournisseur (fournisseurs.compte_sap).
};

export function getParamsSAP() {
  const org = getProfil()?.org_id || "default";
  try {
    return { ...PARAMS_SAP_DEFAUT, ...(JSON.parse(localStorage.getItem(`${CLE_SAP}:${org}`)) || {}) };
  } catch { return { ...PARAMS_SAP_DEFAUT }; }
}
export function setParamsSAP(p) {
  const org = getProfil()?.org_id || "default";
  localStorage.setItem(`${CLE_SAP}:${org}`, JSON.stringify({ ...PARAMS_SAP_DEFAUT, ...p }));
}

// Mapping catégorie de charge (IFRS) → numéro de compte, propre à chaque org.
// L'utilisateur le renseigne dans Réglages (l'app n'invente aucun numéro).
const CLE_COMPTES = "ff_comptes_charge";
export function getComptesCharge() {
  const org = getProfil()?.org_id || "default";
  try { return JSON.parse(localStorage.getItem(`${CLE_COMPTES}:${org}`)) || {}; }
  catch { return {}; }
}
export function setComptesCharge(map) {
  const org = getProfil()?.org_id || "default";
  localStorage.setItem(`${CLE_COMPTES}:${org}`, JSON.stringify(map || {}));
}
// Compte de charge à utiliser pour une ligne. Le champ `categorie` de la ligne
// porte désormais DIRECTEMENT un numéro de compte du plan de référence (choisi
// par l'IA puis validé). Ordre de résolution :
//   1) la valeur est un compte du plan de référence → on l'utilise telle quelle ;
//   2) rétro-compat : ancienne valeur "par nature" → mapping de l'org (Réglages) ;
//   3) repli : compte par défaut (paramètre SAP, ou `fallback` fourni).
export function comptePourCategorie(categorie, fallback) {
  const v = (categorie || "").trim();
  if (COMPTES_PAR_NUMERO[v]) return v;
  const map = getComptesCharge();
  const def = (fallback != null ? fallback : getParamsSAP().compteCharge) || "";
  return (map[v] || "").trim() || String(def).trim();
}

/* ----------------------- Paramètres comptables Sage ---------------- */
// Sage (contexte SYSCOHADA en CI). Le mapping catégorie → compte de charge
// (getComptesCharge) est partagé ; ici on définit le journal, les comptes TVA
// et fournisseur collectif, et un compte de charge par défaut Sage.
const CLE_SAGE = "ff_sage_compta";
const PARAMS_SAGE_DEFAUT = {
  journalAchats: "ACH",     // Code journal des achats
  compteChargeDefaut: "",   // Compte de charge par défaut (si catégorie non mappée)
  compteTva: "",            // Compte TVA déductible
  compteFournisseur: "",    // Compte fournisseur collectif (ex. 401...)
};
export function getParamsSage() {
  const org = getProfil()?.org_id || "default";
  try { return { ...PARAMS_SAGE_DEFAUT, ...(JSON.parse(localStorage.getItem(`${CLE_SAGE}:${org}`)) || {}) }; }
  catch { return { ...PARAMS_SAGE_DEFAUT }; }
}
export function setParamsSage(p) {
  const org = getProfil()?.org_id || "default";
  localStorage.setItem(`${CLE_SAGE}:${org}`, JSON.stringify({ ...PARAMS_SAGE_DEFAUT, ...p }));
}

const COLS_SAGE = ["Journal", "Date", "NumPiece", "Compte", "CompteTiers", "Libelle", "Debit", "Credit", "CodeTVA"];

// Export d'écritures Sage en partie double (Débit/Crédit), une ligne de charge
// par article (compte = mapping catégorie IFRS), TVA déductible, crédit fournisseur.
export async function exporterSageEcritures(factures) {
  const p = getParamsSage();
  if (!p.compteFournisseur) {
    throw new Error("Configurez le compte fournisseur collectif Sage dans Réglages → Paramètres comptables Sage.");
  }

  const sep = ";";
  const num = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
  const echappe = (v) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const out = [];
  let piece = 1;
  for (const f of factures) {
    const date = f.date || "";
    const ref = f.numero || String(piece);
    const nomFourn = f.fournisseurs?.nom || "";
    const tiers = (f.fournisseurs?.compte_sap || "").trim() || f.fournisseurs?.ncc || "";
    const tva = Number(f.montant_tva) || 0;
    const ttc = Number(f.total_ttc) || 0;
    const codeTva = ""; // Sage gère la TVA par le compte ; laissé vide par défaut

    let articles = [];
    try { articles = await getLignes(f.id); } catch { articles = []; }
    const base = [p.journalAchats, date, ref];

    // Débit charge : une ligne par article (compte selon catégorie IFRS).
    if (articles.length) {
      for (const a of articles) {
        const compte = comptePourCategorie(a.categorie, p.compteChargeDefaut);
        out.push([...base, compte, "", a.designation || nomFourn, num(a.montant_ht), "0.00", codeTva]);
      }
    } else {
      out.push([...base, p.compteChargeDefaut, "", nomFourn, num(f.total_ht), "0.00", codeTva]);
    }
    // Débit TVA déductible.
    if (tva > 0 && p.compteTva) {
      out.push([...base, p.compteTva, "", "TVA deductible", num(tva), "0.00", codeTva]);
    }
    // Crédit fournisseur (compte collectif + compte tiers auxiliaire).
    out.push([...base, p.compteFournisseur, tiers, nomFourn, "0.00", num(ttc), ""]);
    piece++;
  }

  const contenu = "﻿" + [COLS_SAGE.join(sep), ...out.map((r) => r.map(echappe).join(sep))].join("\r\n");
  telecharger(contenu, `sage_ecritures_${horodatage()}.csv`, "text/csv;charset=utf-8");
  await journaliser("export_sage_ecritures", `${factures.length} factures`);
}

const COLS_SAP = [
  "NumPiece", "TypePiece", "DatePiece", "DateCompta", "Societe", "Devise",
  "Reference", "CleCompta", "Compte", "Tiers", "Montant", "CodeTVA", "Texte",
];

// Génère un CSV d'écritures FI en partie double, prêt pour un import LSMW/FB01.
// Pour chaque facture : une ligne de débit charge (40) PAR LIGNE D'ARTICLE
// (Texte = désignation de la facture), puis débit TVA déductible (40, si TVA)
// et crédit fournisseur (31). Toutes les lignes d'une facture partagent un NumPiece.
export async function exporterSAP(factures) {
  const c = getParamsSAP();
  if (!c.compteCharge) {
    throw new Error("Configurez d'abord le compte de charge dans Réglages → Paramètres comptables SAP.");
  }
  // Le crédit utilise le compte SAP propre à chaque fournisseur : on bloque si
  // certains fournisseurs n'en ont pas (à compléter sur leur fiche).
  const sansCompte = [...new Set(
    factures.filter((f) => !(f.fournisseurs?.compte_sap || "").trim())
            .map((f) => f.fournisseurs?.nom || "Fournisseur inconnu")
  )];
  if (sansCompte.length) {
    throw new Error("Compte SAP manquant pour : " + sansCompte.join(", ") +
      ". Renseignez-le sur la fiche fournisseur avant l'export.");
  }

  const sep = ";";
  const num = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
  const echappe = (v) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lignes = [];
  let piece = 1;
  for (const f of factures) {
    const datePiece = f.date || "";
    const ref = f.numero || "";
    const tiers = f.fournisseurs?.ncc || f.fournisseurs?.nom || "";
    const nomFourn = f.fournisseurs?.nom || "";
    const devise = f.devise || "XOF";
    const tva = Number(f.montant_tva) || 0;
    const ttc = Number(f.total_ttc) || 0;

    // Compte crédit = compte SAP (CardCode) du fournisseur (garanti présent).
    const compteFourn = (f.fournisseurs?.compte_sap || "").trim();

    // Lignes d'articles de la facture (pour le texte = désignation).
    let articles = [];
    try { articles = await getLignes(f.id); } catch { articles = []; }

    const base = [piece, c.typePiece, datePiece, datePiece, c.societe, devise, ref];

    // Débit charge : une ligne par article, Texte = sa désignation, compte
    // proposé selon la catégorie IFRS de la ligne (sinon compte par défaut).
    if (articles.length) {
      for (const a of articles) {
        const tauxL = a.taux_tva != null ? a.taux_tva : (f.taux_tva ?? "");
        const compteL = comptePourCategorie(a.categorie) || c.compteCharge;
        lignes.push([...base, "40", compteL, "", num(a.montant_ht),
          tauxL !== "" ? c.codeTva : "", a.designation || nomFourn]);
      }
    } else {
      // Repli : pas de lignes détaillées → une seule ligne de charge sur le total HT.
      lignes.push([...base, "40", c.compteCharge, "", num(f.total_ht), c.codeTva, nomFourn]);
    }

    // Débit TVA déductible (montant total de TVA de la facture).
    if (tva > 0 && c.compteTva) {
      lignes.push([...base, "40", c.compteTva, "", num(tva), c.codeTva, "TVA deductible"]);
    }
    // Crédit fournisseur (TTC).
    lignes.push([...base, "31", compteFourn, tiers, num(ttc), "", nomFourn]);
    piece++;
  }

  const contenu = "﻿" + [
    COLS_SAP.join(sep),
    ...lignes.map((r) => r.map(echappe).join(sep)),
  ].join("\r\n");

  telecharger(contenu, `sap_fi_${horodatage()}.csv`, "text/csv;charset=utf-8");
  await journaliser("export_sap_fi", `${factures.length} factures`);
}

/* ---------------- SAP — Journal Upload (.xlsx, template LOG_0100) --- */
// Reproduit fidèlement le template « JOURNAL_UPLOAD_TEMPLATE_LOG_0100
// FOURNISSEUR » : 112 colonnes, 2 lignes d'en-tête (libellés conviviaux
// puis noms techniques SAP), une ligne par poste d'écriture à partir de la 3e.
// Chaque facture = un document FI en partie double :
//   - débit charge (BSCHL 40, KOART S) : une ligne par article ;
//   - débit TVA déductible (BSCHL 40, KOART S) si TVA ;
//   - crédit fournisseur TTC (BSCHL 31, KOART K, LIFNR = compte SAP fournisseur).
// ⚠️ Les comptes, code TVA et type de pièce proviennent des Réglages SAP de
// l'organisation : l'app n'invente aucun paramétrage comptable.

// Ordre EXACT des 112 colonnes (noms techniques = ligne 2 du template).
const SAP_JU_FIELDS = [
  "BUKRS", "XBLNR", "BARCODE", "BLART", "BKTXT", "BLDAT", "BUDAT", "LDGRP", "MONAT", "VALUT",
  "KURSF", "XREF1_HD", "XREF2_HD", "XNEG", "ZZFIRSTAPPOVER", "BSCHL", "SAKNR", "LIFNR", "KUNNR", "KOART",
  "UMSKZ", "WAERS", "WRBTR", "DMBTR", "SHKZG", "RCOMP", "XREF", "AUFNR", "KOSTL", "PRCTR",
  "BUPLA", "KSCHL", "KTOSL", "MWSKZ", "WMWST", "MWSTS", "FWBAS", "HWBAS", "WT_TAX_TYPE", "WTAX",
  "WT_AMOUNT", "WT_AMOUNT_LC", "WT_BASE_AMT_TC", "WT_BASE_AMT_LC", "TXJCD", "ZFBDT", "ZTERM", "ZLSCH", "ZLSPR", "ZUONR",
  "RSTGR", "SGTXT", "MEINS", "MENGE", "XREF1", "XREF2", "XREF3", "ZZCHRCD", "ZZOBLN", "ZZBLN",
  "ZZEVSL", "ZZEVYG", "ZZEVID", "ZZIVSL", "ZZIVYG", "ZZIVID", "ZZCTNN", "ZZMCURR", "ZZMAMT", "ZZPRT",
  "ZZALOC", "ZZEXPCD", "ZZTRM", "ZZPONUMBER", "ZZSRDATE", "ZZSRSDATE", "ZZSREDATE", "COPA_KOSTL", "WWACT", "WWBL",
  "WWBND", "WWBST", "WWBUC", "WWCLT", "WWCNC", "WWCNF", "WWCNI", "WWCNS", "WWCNT", "WWCOM",
  "WWCTN", "WWHLD", "WWMOR", "WWMSO", "WWOTP", "WWPLR", "WWRPR", "WWRPT", "WWRTE", "WWSCT",
  "WWSRC", "WWSVC", "VAT", "XSNET", "LONG_HEADER_TEXT_ID", "LONG_HEADER_TEXT_LANG", "LONG_HEADER_TEXT", "SECCO", "HSN_SAC", "PLC_SUP",
  "GST_PART", "WWLCA",
];

// Libellés conviviaux (ligne 1 du template), même ordre que SAP_JU_FIELDS.
const SAP_JU_LABELS = [
  "Comp. Code", "Reference No.", "W/ Barcode", "Doc. Type", "Header Text", "Doc. Date", "Posting Date", "Ledger Group", "Fiscal Month", "Value Date",
  "Exchange Rate", "Reference Key 1", "Reference Key 2", "Negative Posting", "First Approver", "Posting Key", "Account No.", "Vendor", "Customer", "Account Type",
  "Special G/L", "Trn Currency", "Trn. Amt", "Ccode Amt", "D/C Ind.", "Trading Partner", "Reference Key", "Internal Order", "Cost Ctr.", "Profit Ctr.",
  "Business Place", "Condition Type", "Transaction Type", "Tax Code", "Tax Amount - Trn Currency", "Tax Amount - Local Currency", "Tax Amount Base - Trn Currency", "Tax Amount Base - Local Currency", "Withholding Tax Type", "Withholding Tax Code",
  "Withholding Tax Amount - Trn Currency", "Withholding Tax Amount - Local Currency", "Withholding Tax Base Amt - Trn Currency", "Withholding Tax Base Amt - Local Currency", "Tax Jurisdiction Code", "Baseline Date", "Payment Term", "Pay Mth.", "Pay. Block", "Assignment",
  "Reason Code for Payments", "Line Item Text", "Base Unit of Measure", "Quantity", "Reference 1", "Reference 2", "Reference 3", "Charge code", "Original B/L Number", "B/L",
  "Export Vessel", "Export Voyage No", "Export Voyage ID", "Import Vessel", "Import Voyage No", "Import Voyage ID", "Container number", "Manifested currency", "Manifested amount", "Port",
  "Allocation Number", "Expense Code", "Terminal/Depot Code", "External PO number", "Service Rendered Date", "Service rendered start date", "Service rendered end date", "Cost center", "Activity Code", "Bill of Lading",
  "Bundle", "Business Type", "BU Country", "Client type", "Container Category", "Full/Empty", "Container ISO Code", "Container Size", "Container Type", "Commodity",
  "Container Number", "Holding", "Operation reference", "Sales order", "Orig.Tr.Partner", "Pillar Code", "Period/year", "Repair type", "Route", "Subcontracting",
  "Service Country", "Service Code", "Tax Code", "G/L account amounts entered exclude tax", "Header Text - ID", "Header Text - Language", "Header Text", "Section Code", "HSN/SAC Code", "Place of Supply",
  "GST Partner Code", "Local Attribute  - Marco Polo Logistics",
];

// ISO (yyyy-mm-dd) -> jj/mm/aaaa attendu par le template. Renvoie "" si vide.
function dateSap(iso) {
  if (!iso) return "";
  const [a, m, j] = String(iso).slice(0, 10).split("-");
  return j && m && a ? `${j}/${m}/${a}` : String(iso);
}
// Numéro de mois (1-12) à partir d'une date ISO, pour MONAT (Fiscal Month).
function moisSap(iso) {
  const m = String(iso || "").slice(5, 7);
  return m ? Number(m) : "";
}

export async function exporterSAPJournalUpload(factures) {
  const c = getParamsSAP();
  if (!c.compteCharge) {
    throw new Error("Configurez d'abord le compte de charge dans Réglages → Paramètres comptables SAP.");
  }
  // Le crédit fournisseur utilise le compte SAP (LIFNR) propre à chaque fiche.
  const sansCompte = [...new Set(
    factures.filter((f) => !(f.fournisseurs?.compte_sap || "").trim())
            .map((f) => f.fournisseurs?.nom || "Fournisseur inconnu")
  )];
  if (sansCompte.length) {
    throw new Error("Compte SAP fournisseur manquant pour : " + sansCompte.join(", ") +
      ". Renseignez-le sur la fiche fournisseur avant l'export.");
  }

  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  // Construit une ligne d'écriture : objet partiel -> tableau aligné sur SAP_JU_FIELDS.
  const ligne = (champs) => SAP_JU_FIELDS.map((f) => (f in champs ? champs[f] : ""));

  const lignes = [SAP_JU_LABELS, SAP_JU_FIELDS]; // 2 lignes d'en-tête
  for (const f of factures) {
    const bldat = dateSap(f.date);
    const budat = bldat;                 // date de comptabilisation = date pièce
    const monat = moisSap(f.date);
    const devise = f.devise || "XOF";
    const nomFourn = f.fournisseurs?.nom || "";
    const ref = f.numero || "";
    const ttc = round2(f.total_ttc);
    const tva = round2(f.montant_tva);
    const compteFourn = (f.fournisseurs?.compte_sap || "").trim();
    const bktxt = `${nomFourn}${ref ? " " + ref : ""}`.trim().slice(0, 25);

    // Champs d'en-tête répétés sur chaque poste du document.
    const entete = {
      BUKRS: c.societe, XBLNR: ref, BLART: c.typePiece, BKTXT: bktxt,
      BLDAT: bldat, BUDAT: budat, MONAT: monat, WAERS: devise, ZFBDT: bldat,
    };

    let articles = [];
    try { articles = await getLignes(f.id); } catch { articles = []; }

    // Débit charge : une ligne par article (compte selon catégorie IFRS).
    if (articles.length) {
      for (const a of articles) {
        const compteL = comptePourCategorie(a.categorie) || c.compteCharge;
        const taxe = (a.taux_tva != null ? a.taux_tva : f.taux_tva) ? c.codeTva : "";
        lignes.push(ligne({
          ...entete, BSCHL: "40", KOART: "S", SAKNR: compteL, SHKZG: "D",
          WRBTR: round2(a.montant_ht), DMBTR: round2(a.montant_ht),
          MWSKZ: taxe, SGTXT: (a.designation || nomFourn).slice(0, 50),
        }));
      }
    } else {
      lignes.push(ligne({
        ...entete, BSCHL: "40", KOART: "S", SAKNR: c.compteCharge, SHKZG: "D",
        WRBTR: round2(f.total_ht), DMBTR: round2(f.total_ht),
        MWSKZ: c.codeTva, SGTXT: nomFourn.slice(0, 50),
      }));
    }

    // Débit TVA déductible (montant total de TVA de la facture).
    if (tva > 0 && c.compteTva) {
      lignes.push(ligne({
        ...entete, BSCHL: "40", KOART: "S", SAKNR: c.compteTva, SHKZG: "D",
        WRBTR: tva, DMBTR: tva, MWSKZ: c.codeTva, SGTXT: "TVA deductible",
      }));
    }

    // Crédit fournisseur (TTC) — LIFNR = compte SAP de la fiche fournisseur.
    lignes.push(ligne({
      ...entete, BSCHL: "31", KOART: "K", LIFNR: compteFourn, SHKZG: "C",
      WRBTR: ttc, DMBTR: ttc, SGTXT: nomFourn.slice(0, 50),
    }));
  }

  telechargerXlsx(`sap_journal_upload_${horodatage()}.xlsx`, "Journal Upload", lignes);
  await journaliser("export_sap_journal_upload", `${factures.length} factures`);
}

/* --------------------------- PDF récap ----------------------------- */
// Ouvre une fenêtre imprimable ; l'utilisateur choisit « Enregistrer en PDF ».
function imprimer(titre, corpsHtml) {
  const w = window.open("", "_blank");
  if (!w) { alert("Autorisez les fenêtres pop-up pour générer le PDF."); return; }
  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8" />
    <title>${esc(titre)}</title>
    <style>
      body{font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#0F172A;padding:24px;}
      h1{color:#0F766E;margin:0 0 4px;} .muted{color:#64748B;font-size:.85rem;}
      table{width:100%;border-collapse:collapse;margin-top:16px;font-size:.9rem;}
      th,td{border:1px solid #E2E8F0;padding:8px;text-align:right;} th{background:#ECFDF5;}
      th:first-child,td:first-child{text-align:left;}
      .tot{margin-top:16px;float:right;width:280px;}
      .tot div{display:flex;justify-content:space-between;padding:4px 0;}
      .tot .g{font-weight:700;border-top:1px solid #E2E8F0;padding-top:8px;}
      .foot{margin-top:60px;font-size:.75rem;color:#94A3B8;clear:both;}
      @media print{ .noprint{display:none;} }
    </style></head><body>${corpsHtml}
    <div class="foot">Document généré par FactureFlow CI le ${dateFr(new Date().toISOString())}.
      Les montants et la conformité fiscale restent à valider par un professionnel.</div>
    <button class="noprint" onclick="window.print()" style="margin-top:20px;padding:10px 16px">Imprimer / PDF</button>
    </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

// Récapitulatif d'une facture.
export async function exporterFacturePDF(f, lignes) {
  const fourn = f.fournisseurs || {};
  const rows = (lignes || []).map((l) => `<tr>
    <td>${esc(l.designation)}</td><td>${l.quantite}</td>
    <td>${fcfa(l.prix_unitaire, f.devise)}</td><td>${fcfa(l.montant_ht, f.devise)}</td></tr>`).join("");
  const corps = `
    <h1>Facture ${esc(f.numero || "")}</h1>
    <div class="muted">${esc(fourn.nom || "Fournisseur inconnu")}${fourn.ncc ? " · NCC " + esc(fourn.ncc) : ""}</div>
    <div class="muted">Date : ${dateFr(f.date)}${f.echeance ? " · Échéance : " + dateFr(f.echeance) : ""}</div>
    <table><thead><tr><th>Désignation</th><th>Qté</th><th>P.U.</th><th>Montant HT</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4">Aucune ligne</td></tr>`}</tbody></table>
    <div class="tot">
      <div><span>Total HT</span><span>${fcfa(f.total_ht, f.devise)}</span></div>
      <div><span>TVA (${f.taux_tva}%)</span><span>${fcfa(f.montant_tva, f.devise)}</span></div>
      <div class="g"><span>Total TTC</span><span>${fcfa(f.total_ttc, f.devise)}</span></div>
    </div>`;
  imprimer(`Facture ${f.numero || ""}`, corps);
  await journaliser("export_pdf", `facture:${f.id}`);
}
