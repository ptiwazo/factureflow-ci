/* =====================================================================
   Module 6.4 — Factures : liste, filtres, détail, original consultable
===================================================================== */
import { $, $$, setView, toast, fcfa, dateFr, esc, statutBadge, emptyState, openModal, busy } from "../ui.js";
import {
  listerFactures, getFacture, getLignes, majStatutFacture,
  supprimerFacture, urlOriginalSignee, journaliser,
} from "../store.js";
import { getProfil } from "../auth.js";
import { exporterFacturePDF } from "./export.js";
import { CATEGORIES_CHARGE } from "../config.js";
import { COMPTES_PAR_NUMERO } from "../comptes-charge-ifrs.js";
import { navigate } from "../app.js";

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
  { key: "a_verifier", label: "À vérifier" },
  { key: "validee", label: "Validées" },
  { key: "exportee", label: "Exportées" },
  { key: "non_conforme", label: "Non conformes" },
];

let filtreStatut = "";

export async function renderListe() {
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
      <table class="lignes-table">
        <thead><tr><th class="col-des">Désignation</th><th>Qté</th><th>P.U.</th><th>Montant HT</th><th>TVA %</th><th>Compte de charge (IFRS)</th></tr></thead>
        <tbody>
          ${lignes.map((l) => `<tr>
            <td class="col-des">${esc(l.designation)}</td>
            <td>${l.quantite}</td>
            <td>${fcfa(l.prix_unitaire, f.devise)}</td>
            <td>${fcfa(l.montant_ht, f.devise)}</td>
            <td>${l.taux_tva != null ? l.taux_tva : f.taux_tva}%</td>
            <td>${esc(libelleImputation(l.categorie))}</td></tr>`).join("") || `<tr><td colspan="6" class="muted">Aucune ligne</td></tr>`}
        </tbody>
      </table>
      <div class="totaux-box">
        <div class="totaux-row"><span>Total HT</span><strong>${fcfa(f.total_ht, f.devise)}</strong></div>
        <div class="totaux-row"><span>TVA (${f.taux_tva}%)</span><strong>${fcfa(f.montant_tva, f.devise)}</strong></div>
        <div class="totaux-row grand"><span>Total TTC</span><strong>${fcfa(f.total_ttc, f.devise)}</strong></div>
      </div>
    </div>

    <div class="row wrap" style="gap:10px;margin-bottom:24px">
      ${f.fichier_url ? `<button id="btn-original" class="btn btn-secondary">📎 Voir l'original</button>` : ""}
      <button id="btn-pdf" class="btn btn-secondary">📄 PDF récap</button>
      ${peutEcrire && f.statut === "non_conforme" ? `<button id="btn-valider" class="btn btn-primary">Marquer validée</button>` : ""}
      ${peutSupprimer ? `<button id="btn-suppr" class="btn btn-danger">Supprimer</button>` : ""}
    </div>
  `);

  if (f.fichier_url) $("#btn-original").onclick = (e) => voirOriginal(e.currentTarget, f.fichier_url);
  $("#btn-pdf").onclick = () => exporterFacturePDF(f, lignes);

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
