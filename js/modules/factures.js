/* =====================================================================
   Module 6.4 — Factures : liste, filtres, détail, original consultable
===================================================================== */
import { $, $$, setView, toast, fcfa, dateFr, esc, statutBadge, emptyState, openModal, busy, toNumber, paiementBadge, infoPaiement } from "../ui.js";
import {
  listerFactures, getFacture, getLignes, majStatutFacture,
  majCategoriesLignes, majPaiement, supprimerFacture, urlOriginalSignee, journaliser,
} from "../store.js";
import { getProfil } from "../auth.js";
import { exporterFacturePDF } from "./export.js";
import { CATEGORIES_CHARGE } from "../config.js";
import { COMPTES_PAR_NUMERO, PLAN_PAR_SECTION } from "../comptes-charge-ifrs.js";
import { notifierCircuit } from "../notify.js";
import { navigate } from "../app.js";

// <option>/<optgroup> des comptes de charge du plan de référence, avec
// présélection du compte courant. Utilisé par le Contrôle de Gestion pour
// confirmer/modifier le compte proposé par l'IA (étape 3 du workflow).
function optionsComptes(selected) {
  const sel = COMPTES_PAR_NUMERO[selected] ? selected : "";
  const opt = (val, label) => `<option value="${esc(val)}"${val === sel ? " selected" : ""}>${esc(label)}</option>`;
  return opt("", "— Non classé —") +
    PLAN_PAR_SECTION.map((s) =>
      `<optgroup label="${esc(s.prefixe)}xxxx — ${esc(s.label)}">${s.comptes.map((c) =>
        opt(c.compte, `${c.compte} — ${c.labelFr}`)).join("")}</optgroup>`).join("");
}

// Ancien code de catégorie "par nature" → libellé (rétro-compat).
const LIBELLE_CATEGORIE = Object.fromEntries(CATEGORIES_CHARGE.map((c) => [c.code, c.label]));

// Libellé d'imputation d'une ligne. La valeur est désormais un n° de compte du
// plan de référence ; repli sur l'ancienne nomenclature "par nature" si besoin.
function libelleImputation(code) {
  if (!code) return "—";
  const ref = COMPTES_PAR_NUMERO[code];
  if (ref) return `${code} — ${ref.labelFr}`;
  return LIBELLE_CATEGORIE[code] || code;
}

const FILTRES = [
  { key: "", label: "Toutes" },
  { key: "a_controler", label: "À contrôler" },
  { key: "a_valider", label: "À valider" },
  { key: "validee", label: "Validées" },
  { key: "exportee", label: "Exportées" },
  { key: "non_conforme", label: "Non conformes" },
];

let filtreStatut = "";

export async function renderListe(param) {
  // Filtre passé par l'URL (ex. #/factures/a_controler depuis le tableau de bord).
  if (param != null && FILTRES.some((f) => f.key === param)) filtreStatut = param;

  setView(`
    <div class="row between">
      <h1 class="page-title">Factures</h1>
      <a href="#/capture" class="btn btn-primary btn-sm">+ Nouvelle</a>
    </div>
    <div class="filters" id="filters">
      ${FILTRES.map((f) => `<button class="chip ${f.key === filtreStatut ? "active" : ""}" data-statut="${f.key}">${f.label}</button>`).join("")}
    </div>
    <div id="liste"><div class="loading-block"><span class="spinner dark"></span></div></div>
  `);

  $$("#filters .chip").forEach((c) => c.addEventListener("click", () => {
    filtreStatut = c.dataset.statut;
    $$("#filters .chip").forEach((x) => x.classList.toggle("active", x === c));
    chargerListe();
  }));

  chargerListe();
}

async function chargerListe() {
  const cible = $("#liste");
  try {
    const factures = await listerFactures(filtreStatut ? { statut: filtreStatut } : {});
    if (!factures.length) {
      cible.innerHTML = emptyState("🗂️", "Aucune facture", "Touchez « + Nouvelle » pour en enregistrer une.");
      return;
    }
    cible.innerHTML = `<div class="list">${factures.map(ligneFacture).join("")}</div>`;
  } catch (e) {
    cible.innerHTML = emptyState("⚠️", "Erreur de chargement", e.message);
  }
}

function ligneFacture(f) {
  const fournisseur = f.fournisseurs?.nom || "Fournisseur inconnu";
  return `
    <a class="list-item" href="#/facture/${f.id}">
      <div class="li-main">
        <div class="li-title">${esc(fournisseur)}</div>
        <div class="li-sub">${esc(f.numero || "sans n°")} · ${dateFr(f.date)} · ${statutBadge(f.statut)}</div>
      </div>
      <div class="li-amount">${fcfa(f.total_ttc, f.devise)}</div>
    </a>`;
}

/* ------------------------------ Détail ----------------------------- */
export async function renderDetail(id) {
  if (!id) return navigate("#/factures");
  setView(`<div class="loading-block"><span class="spinner dark"></span></div>`);

  let f, lignes;
  try {
    f = await getFacture(id);
    if (!f) { setView(emptyState("🔍", "Facture introuvable")); return; }
    lignes = await getLignes(id);
  } catch (e) {
    setView(emptyState("⚠️", "Erreur", e.message)); return;
  }

  const role = getProfil()?.role;
  const peutEcrire = role === "admin" || role === "saisie";
  const peutSupprimer = role === "admin";
  // Contrôle de Gestion : confirme/modifie les comptes (a_controler → a_valider)
  // puis valide (a_valider → validee). L'admin a les mêmes droits.
  const peutControler = role === "admin" || role === "controle_gestion";
  const modeControle = peutControler && f.statut === "a_controler";
  const erp = getProfil()?.erp || "sap"; // affiche la colonne OHADA si 'sage'
  const ip = infoPaiement(f);            // état de règlement
  const aujISO = new Date().toISOString().slice(0, 10);
  const fourn = f.fournisseurs || {};

  setView(`
    <div class="row between">
      <a href="#/factures" class="btn btn-ghost btn-sm">← Factures</a>
      ${statutBadge(f.statut)}
    </div>
    <h1 class="page-title">${esc(fourn.nom || "Fournisseur inconnu")}</h1>

    ${!fourn.ncc ? `<div class="alert alert-danger">⛔ NCC fournisseur absent — facture non conforme (à confirmer DGI/expert-comptable).</div>` : ""}

    <div class="card">
      <div class="detail-grid">
        <div><div class="dt">N° facture</div><div class="dd">${esc(f.numero || "—")}</div></div>
        <div><div class="dt">Date</div><div class="dd">${dateFr(f.date)}</div></div>
        <div><div class="dt">Échéance</div><div class="dd">${dateFr(f.echeance)}</div></div>
        <div><div class="dt">NCC</div><div class="dd">${esc(fourn.ncc || "—")}</div></div>
        <div><div class="dt">RCCM</div><div class="dd">${esc(fourn.rccm || "—")}</div></div>
        <div><div class="dt">Téléphone</div><div class="dd">${esc(fourn.telephone || "—")}</div></div>
      </div>
    </div>

    <div class="card">
      <h3>Lignes</h3>
      ${modeControle ? `<div class="alert alert-info">🧮 <div><strong>Contrôle de Gestion.</strong>
        Confirmez ou corrigez le <strong>compte de charge</strong> proposé par l'IA sur chaque ligne,
        puis cliquez « Confirmer les comptes ». ⚠️ Imputations à valider par un expert-comptable.</div></div>` : ""}
      <div style="overflow-x:auto">
      <table class="lignes-table erp-${erp}">
        <thead><tr><th class="col-des">Désignation</th><th>Qté</th><th>P.U.</th><th>Montant HT</th><th>TVA %</th><th>Compte de charge (IFRS)</th><th class="col-ohada">OHADA</th></tr></thead>
        <tbody>
          ${lignes.map((l) => `<tr>
            <td class="col-des">${esc(l.designation)}</td>
            <td>${l.quantite}</td>
            <td>${fcfa(l.prix_unitaire, f.devise)}</td>
            <td>${fcfa(l.montant_ht, f.devise)}</td>
            <td>${l.taux_tva != null ? l.taux_tva : f.taux_tva}%</td>
            <td>${modeControle
              ? `<select class="cg-cat" data-id="${esc(l.id)}" style="min-width:170px">${optionsComptes(l.categorie)}</select>`
              : esc(libelleImputation(l.categorie))}</td>
            <td class="col-ohada">${esc(COMPTES_PAR_NUMERO[l.categorie]?.ohada || "—")}</td></tr>`).join("") || `<tr><td colspan="7" class="muted">Aucune ligne</td></tr>`}
        </tbody>
      </table>
      </div>
      <div class="totaux-box">
        <div class="totaux-row"><span>Total HT</span><strong>${fcfa(f.total_ht, f.devise)}</strong></div>
        <div class="totaux-row"><span>TVA (${f.taux_tva}%)</span><strong>${fcfa(f.montant_tva, f.devise)}</strong></div>
        <div class="totaux-row grand"><span>Total TTC</span><strong>${fcfa(f.total_ttc, f.devise)}</strong></div>
      </div>
    </div>

    <div class="card">
      <h3>Paiement</h3>
      <div class="detail-grid">
        <div><div class="dt">Échéance</div><div class="dd">${dateFr(f.echeance)}${ip.enRetard ? ` <span style="color:var(--danger)">(en retard)</span>` : ""}</div></div>
        <div><div class="dt">Statut</div><div class="dd">${paiementBadge(ip.statut)}</div></div>
        <div><div class="dt">Déjà payé</div><div class="dd">${fcfa(ip.paye, f.devise)}</div></div>
        <div><div class="dt">Restant dû</div><div class="dd">${fcfa(ip.restant, f.devise)}</div></div>
      </div>
      ${peutEcrire && ip.statut !== "paye" ? `
        <div class="row" style="gap:12px;margin-top:8px">
          <div class="grow field"><label for="pay-date">Date de paiement</label><input id="pay-date" type="date" value="${aujISO}" /></div>
          <div class="grow field"><label for="pay-montant">Montant réglé</label><input id="pay-montant" type="number" step="0.01" value="${ip.restant}" /></div>
        </div>
        <button id="btn-payer" class="btn btn-primary btn-sm">Enregistrer le paiement</button>` : ""}
      ${peutEcrire && ip.statut !== "a_payer" ? `<button id="btn-annuler-paiement" class="btn btn-ghost btn-sm" style="margin-left:8px">Annuler le paiement</button>` : ""}
    </div>

    <div class="row wrap" style="gap:10px;margin-bottom:24px">
      ${f.fichier_url ? `<button id="btn-original" class="btn btn-secondary">📎 Voir l'original</button>` : ""}
      <button id="btn-pdf" class="btn btn-secondary">📄 PDF récap</button>
      ${modeControle ? `<button id="btn-confirmer-comptes" class="btn btn-primary">Confirmer les comptes →</button>` : ""}
      ${peutControler && f.statut === "a_valider" ? `<button id="btn-revoir-comptes" class="btn btn-ghost">← Revoir les comptes</button>
        <button id="btn-valider-facture" class="btn btn-primary">Valider la facture ✔</button>` : ""}
      ${peutEcrire && f.statut === "non_conforme" ? `<button id="btn-valider" class="btn btn-primary">Marquer validée</button>` : ""}
      ${peutSupprimer ? `<button id="btn-suppr" class="btn btn-danger">Supprimer</button>` : ""}
    </div>
  `);

  if (f.fichier_url) $("#btn-original").onclick = (e) => voirOriginal(e.currentTarget, f.fichier_url);
  $("#btn-pdf").onclick = () => exporterFacturePDF(f, lignes);

  // Contrôle de Gestion — étape 3 : enregistre les comptes confirmés/modifiés
  // puis passe la facture en « à valider ».
  const bcc = $("#btn-confirmer-comptes");
  if (bcc) bcc.onclick = async (e) => {
    busy(e.currentTarget, true, "Enregistrement…");
    try {
      const maj = $$(".cg-cat").map((s) => ({ id: s.dataset.id, categorie: s.value }));
      await majCategoriesLignes(maj);
      await majStatutFacture(f.id, "a_valider");
      await journaliser("controle_comptes", `facture:${f.id}`);
      notifierCircuit("a_valider", f.id);
      toast("Comptes confirmés — facture prête à valider.", "success");
      renderDetail(f.id);
    } catch (err) { busy(e.currentTarget, false); toast(err.message, "error"); }
  };

  // Contrôle de Gestion — étape 4 : validation finale.
  const bvf = $("#btn-valider-facture");
  if (bvf) bvf.onclick = async (e) => {
    busy(e.currentTarget, true, "Validation…");
    try {
      await majStatutFacture(f.id, "validee");
      await journaliser("validation", `facture:${f.id}`);
      notifierCircuit("validee", f.id);
      toast("Facture validée ✔", "success");
      renderDetail(f.id);
    } catch (err) { busy(e.currentTarget, false); toast(err.message, "error"); }
  };

  // Retour à l'étape de contrôle des comptes (corriger avant validation).
  const brc = $("#btn-revoir-comptes");
  if (brc) brc.onclick = async (e) => {
    busy(e.currentTarget, true, "…");
    try {
      await majStatutFacture(f.id, "a_controler");
      await journaliser("retour_controle", `facture:${f.id}`);
      renderDetail(f.id);
    } catch (err) { busy(e.currentTarget, false); toast(err.message, "error"); }
  };

  // Paiement : enregistrer un règlement (intégral ou partiel).
  const bp = $("#btn-payer");
  if (bp) bp.onclick = async (e) => {
    const montant = toNumber($("#pay-montant").value);
    if (montant <= 0) return toast("Montant de paiement invalide.", "warn");
    const ttc = Number(f.total_ttc) || 0;
    const nouveauPaye = Math.min(ttc, Math.round((ip.paye + montant) * 100) / 100);
    const statutP = nouveauPaye >= ttc && ttc > 0 ? "paye" : "partiel";
    busy(e.currentTarget, true, "Enregistrement…");
    try {
      await majPaiement(f.id, { statut_paiement: statutP, date_paiement: $("#pay-date").value || aujISO, montant_paye: nouveauPaye });
      await journaliser("paiement", `facture:${f.id}`);
      toast(statutP === "paye" ? "Facture réglée ✔" : "Paiement partiel enregistré.", "success");
      renderDetail(f.id);
    } catch (err) { busy(e.currentTarget, false); toast(err.message, "error"); }
  };

  // Annulation du paiement (remise à « à payer »).
  const bap = $("#btn-annuler-paiement");
  if (bap) bap.onclick = async (e) => {
    busy(e.currentTarget, true, "…");
    try {
      await majPaiement(f.id, { statut_paiement: "a_payer", date_paiement: null, montant_paye: 0 });
      await journaliser("paiement_annule", `facture:${f.id}`);
      toast("Paiement annulé.", "info");
      renderDetail(f.id);
    } catch (err) { busy(e.currentTarget, false); toast(err.message, "error"); }
  };

  const bv = $("#btn-valider");
  if (bv) bv.onclick = async (e) => {
    busy(e.currentTarget, true);
    try {
      await majStatutFacture(f.id, "validee");
      await journaliser("validation", `facture:${f.id}`);
      toast("Facture validée.", "success");
      renderDetail(f.id);
    } catch (err) { busy(e.currentTarget, false); toast(err.message, "error"); }
  };

  const bs = $("#btn-suppr");
  if (bs) bs.onclick = async () => {
    if (!confirm("Supprimer définitivement cette facture et son original ?")) return;
    try {
      await supprimerFacture(f.id);
      await journaliser("suppression", `facture:${f.id}`);
      toast("Facture supprimée.", "info");
      navigate("#/factures");
    } catch (err) { toast(err.message, "error"); }
  };
}

// Consultation de l'original via URL signée temporaire (§10).
async function voirOriginal(btn, chemin) {
  busy(btn, true, "Ouverture…");
  try {
    const url = await urlOriginalSignee(chemin, 300);
    busy(btn, false);
    if (!url) return toast("Original indisponible.", "warn");
    const estPdf = chemin.toLowerCase().endsWith(".pdf");
    openModal(estPdf
      ? `<iframe src="${esc(url)}" title="Original PDF"></iframe>`
      : `<img src="${esc(url)}" alt="Original de la facture" />`);
  } catch (e) {
    busy(btn, false);
    toast("Impossible d'ouvrir l'original.", "error");
  }
}
