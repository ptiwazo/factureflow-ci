/* =====================================================================
   Module 6.4 — Factures : liste, filtres, détail, original consultable
===================================================================== */
import { $, $$, setView, toast, fcfa, dateFr, esc, statutBadge, emptyState, openModal, busy, toNumber, paiementBadge, infoPaiement, debounce } from "../ui.js";
import {
  listerFactures, getFacture, getLignes, majStatutFacture,
  majCategoriesLignes, majPaiement, supprimerFacture, urlOriginalSignee, journaliser,
  lierFactureCommande, lierLigneCommande, listerCommandes, getCommande, getCommandeLignes, facturesParCommande,
  listerClotures,
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
let toutesFactures = [];               // cache de la liste (filtrage client)
// Critères de recherche avancée (persistants tant qu'on reste dans le module).
const critere = { texte: "", fournisseurId: "", paiement: "", debut: "", fin: "", montantMin: "", montantMax: "" };

export async function renderListe(param) {
  // Filtre passé par l'URL (ex. #/factures/a_controler depuis le tableau de bord).
  if (param != null && FILTRES.some((f) => f.key === param)) filtreStatut = param;

  setView(`
    <div class="row between">
      <h1 class="page-title">Factures</h1>
      <a href="#/capture" class="btn btn-primary btn-sm">+ Nouvelle</a>
    </div>
    <input id="recherche" type="search" placeholder="Rechercher (n°, fournisseur, NCC)…" class="mb" value="${esc(critere.texte)}" />
    <div class="filters" id="filters">
      ${FILTRES.map((f) => `<button class="chip ${f.key === filtreStatut ? "active" : ""}" data-statut="${f.key}">${f.label}</button>`).join("")}
    </div>
    <details id="filtres-av" style="margin-bottom:10px">
      <summary style="cursor:pointer;font-size:.9rem;font-weight:600">Filtres avancés</summary>
      <div class="card" style="margin-top:8px">
        <div class="row" style="gap:12px">
          <div class="grow field"><label for="f-fourn">Fournisseur</label>
            <select id="f-fourn"><option value="">Tous</option></select></div>
          <div class="grow field"><label for="f-paie">Paiement</label>
            <select id="f-paie">
              <option value="">Tous</option>
              <option value="a_payer">À payer</option>
              <option value="partiel">Partiel</option>
              <option value="paye">Payée</option>
            </select></div>
        </div>
        <div class="row" style="gap:12px">
          <div class="grow field"><label for="f-debut">Du</label><input id="f-debut" type="date" value="${critere.debut}" /></div>
          <div class="grow field"><label for="f-fin">Au</label><input id="f-fin" type="date" value="${critere.fin}" /></div>
        </div>
        <div class="row" style="gap:12px">
          <div class="grow field"><label for="f-min">Montant min</label><input id="f-min" type="number" step="0.01" value="${critere.montantMin}" /></div>
          <div class="grow field"><label for="f-max">Montant max</label><input id="f-max" type="number" step="0.01" value="${critere.montantMax}" /></div>
        </div>
        <button id="f-reset" class="btn btn-ghost btn-sm">Réinitialiser les filtres</button>
      </div>
    </details>
    <p id="liste-compte" class="muted" style="font-size:.82rem;margin:0 0 6px"></p>
    <div id="liste"><div class="loading-block"><span class="spinner dark"></span></div></div>
  `);

  $$("#filters .chip").forEach((c) => c.addEventListener("click", () => {
    filtreStatut = c.dataset.statut;
    $$("#filters .chip").forEach((x) => x.classList.toggle("active", x === c));
    appliquer();
  }));

  $("#recherche").addEventListener("input", debounce((e) => { critere.texte = e.target.value.trim(); appliquer(); }, 200));
  $("#f-fourn").addEventListener("change", (e) => { critere.fournisseurId = e.target.value; appliquer(); });
  $("#f-paie").addEventListener("change", (e) => { critere.paiement = e.target.value; appliquer(); });
  $("#f-debut").addEventListener("change", (e) => { critere.debut = e.target.value; appliquer(); });
  $("#f-fin").addEventListener("change", (e) => { critere.fin = e.target.value; appliquer(); });
  $("#f-min").addEventListener("input", debounce((e) => { critere.montantMin = e.target.value; appliquer(); }, 200));
  $("#f-max").addEventListener("input", debounce((e) => { critere.montantMax = e.target.value; appliquer(); }, 200));
  $("#f-reset").addEventListener("click", () => {
    Object.assign(critere, { texte: "", fournisseurId: "", paiement: "", debut: "", fin: "", montantMin: "", montantMax: "" });
    renderListe(); // recharge l'écran avec critères vierges
  });

  try {
    toutesFactures = await listerFactures();
  } catch (e) {
    $("#liste").innerHTML = emptyState("⚠️", "Erreur de chargement", e.message);
    return;
  }

  // Options « Fournisseur » à partir des factures chargées.
  const fournMap = new Map();
  for (const f of toutesFactures) {
    if (f.fournisseur_id && f.fournisseurs?.nom && !fournMap.has(f.fournisseur_id)) {
      fournMap.set(f.fournisseur_id, f.fournisseurs.nom);
    }
  }
  const sel = $("#f-fourn");
  [...fournMap.entries()].sort((a, b) => a[1].localeCompare(b[1])).forEach(([id, nom]) => {
    const o = document.createElement("option");
    o.value = id; o.textContent = nom;
    if (id === critere.fournisseurId) o.selected = true;
    sel.appendChild(o);
  });
  $("#f-paie").value = critere.paiement;

  appliquer();
}

// Applique tous les critères (client-side) sur la liste chargée.
function appliquer() {
  const cible = $("#liste");
  if (!cible) return;
  const q = critere.texte.toLowerCase();
  const min = toNumber(critere.montantMin), max = toNumber(critere.montantMax);

  const res = toutesFactures.filter((f) => {
    if (filtreStatut && f.statut !== filtreStatut) return false;
    if (critere.fournisseurId && f.fournisseur_id !== critere.fournisseurId) return false;
    if (critere.paiement && infoPaiement(f).statut !== critere.paiement) return false;
    if (critere.debut && (!f.date || f.date < critere.debut)) return false;
    if (critere.fin && (!f.date || f.date > critere.fin)) return false;
    const ttc = Number(f.total_ttc) || 0;
    if (critere.montantMin && ttc < min) return false;
    if (critere.montantMax && ttc > max) return false;
    if (q) {
      const hay = `${f.numero || ""} ${f.fournisseurs?.nom || ""} ${f.fournisseurs?.ncc || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  $("#liste-compte").textContent = `${res.length} facture(s)`;
  cible.innerHTML = res.length
    ? `<div class="list">${res.map(ligneFacture).join("")}</div>`
    : emptyState("🗂️", "Aucune facture", toutesFactures.length ? "Aucun résultat pour ces critères." : "Touchez « + Nouvelle » pour en enregistrer une.");
}

function ligneFacture(f) {
  const fournisseur = f.fournisseurs?.nom || "Fournisseur inconnu";
  const ip = infoPaiement(f);
  return `
    <a class="list-item" href="#/facture/${f.id}">
      <div class="li-main">
        <div class="li-title">${esc(fournisseur)}</div>
        <div class="li-sub">${esc(f.numero || "sans n°")} · ${dateFr(f.date)} · ${statutBadge(f.statut)} · ${paiementBadge(ip.statut)}${ip.enRetard ? ` <span style="color:var(--danger)">retard</span>` : ""}</div>
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

  // Verrou de période : si le mois de la facture est clôturé, lecture seule.
  let clos = new Set();
  try { clos = new Set((await listerClotures()).map((c) => c.periode)); } catch { /* ignore */ }
  const verrou = clos.has((f.date || "").slice(0, 7));

  const role = getProfil()?.role;
  const peutEcrire = (role === "admin" || role === "saisie") && !verrou;
  const peutSupprimer = role === "admin" && !verrou;
  // Contrôle de Gestion : confirme/modifie les comptes (a_controler → a_valider)
  // puis valide (a_valider → validee). L'admin a les mêmes droits.
  const peutControler = (role === "admin" || role === "controle_gestion") && !verrou;
  const modeControle = peutControler && f.statut === "a_controler";
  const erp = getProfil()?.erp || "sap"; // affiche la colonne OHADA si 'sage'
  const ip = infoPaiement(f);            // état de règlement
  const aujISO = new Date().toISOString().slice(0, 10);
  const fourn = f.fournisseurs || {};

  // Rapprochement bon de commande (best-effort).
  const peutLier = peutEcrire || peutControler;
  let cmd = null, facturesCmd = [], commandesDispo = [], cmdLignes = [];
  if (f.commande_id) {
    try { [cmd, facturesCmd, cmdLignes] = await Promise.all([
      getCommande(f.commande_id), facturesParCommande(f.commande_id), getCommandeLignes(f.commande_id),
    ]); } catch { /* ignore */ }
  } else if (peutLier && f.fournisseur_id) {
    try { commandesDispo = (await listerCommandes({ fournisseurId: f.fournisseur_id })).filter((c) => c.statut !== "annulee"); } catch { /* ignore */ }
  }
  const cmdTotal = Number(cmd?.total_ht) || 0;
  const factureTotal = facturesCmd.filter((x) => x.statut !== "non_conforme").reduce((s, x) => s + (Number(x.total_ht) || 0), 0);
  const ecartCmd = Math.round((factureTotal - cmdTotal) * 100) / 100;
  const surCmd = ecartCmd > 0.01;

  // Comparaison ligne-à-ligne (matching par désignation normalisée).
  const normDes = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  const cmdByDes = new Map(cmdLignes.map((cl) => [normDes(cl.designation), cl]));
  const cmdById = new Map(cmdLignes.map((cl) => [cl.id, cl]));
  const comparaison = (cmd ? lignes : []).map((l) => {
    // Association explicite (manuelle) prioritaire, sinon matching par libellé.
    const c = l.commande_ligne_id ? cmdById.get(l.commande_ligne_id) : cmdByDes.get(normDes(l.designation));
    const qF = Number(l.quantite) || 0, puF = Number(l.prix_unitaire) || 0;
    const qC = c ? Number(c.quantite) || 0 : null, puC = c ? Number(c.prix_unitaire) || 0 : null;
    const eQ = c ? Math.round((qF - qC) * 1000) / 1000 : null;
    const eP = c ? Math.round((puF - puC) * 100) / 100 : null;
    const ok = c && Math.abs(eQ) < 0.001 && Math.abs(eP) < 0.01;
    return { l, c, qF, qC, puF, puC, eQ, eP, ok, explicite: !!l.commande_ligne_id };
  });
  const ecartsLigne = comparaison.filter((x) => !x.ok).length;

  setView(`
    <div class="row between">
      <a href="#/factures" class="btn btn-ghost btn-sm">← Factures</a>
      ${statutBadge(f.statut)}
    </div>
    <h1 class="page-title">${esc(fourn.nom || "Fournisseur inconnu")}</h1>

    ${!fourn.ncc ? `<div class="alert alert-danger">⛔ NCC fournisseur absent — facture non conforme (à confirmer DGI/expert-comptable).</div>` : ""}
    ${verrou ? `<div class="alert alert-warn">🔒 <div>Période <strong>clôturée</strong> (${esc((f.date || "").slice(0, 7))}) — facture <strong>verrouillée</strong> (lecture seule). Un administrateur peut rouvrir la période dans Réglages.</div></div>` : ""}

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

    <div class="card">
      <h3>Bon de commande</h3>
      ${cmd ? `
        <p style="margin-top:0">Rattachée à la commande <a href="#/commande/${cmd.id}"><strong>${esc(cmd.numero || "sans n°")}</strong></a> · ${dateFr(cmd.date)}.</p>
        <div class="kpi-grid">
          <div class="kpi accent-teal"><div class="kpi-label">Commandé HT</div><div class="kpi-value" style="font-size:1.05rem">${fcfa(cmdTotal, f.devise)}</div></div>
          <div class="kpi"><div class="kpi-label">Déjà facturé HT</div><div class="kpi-value" style="font-size:1.05rem">${fcfa(factureTotal, f.devise)}</div></div>
          <div class="kpi ${surCmd ? "accent-danger" : "accent-teal"}"><div class="kpi-label">${surCmd ? "Sur-facturation" : "Reste à facturer"}</div>
            <div class="kpi-value" style="font-size:1.05rem">${fcfa(surCmd ? ecartCmd : Math.max(0, -ecartCmd), f.devise)}</div></div>
        </div>
        ${surCmd ? `<div class="alert alert-danger">⚠️ <div>Le montant facturé dépasse la commande de <strong>${fcfa(ecartCmd, f.devise)}</strong>.</div></div>` : ""}
        <h4 style="margin:12px 0 4px">Comparaison ligne à ligne ${ecartsLigne ? `<span style="color:var(--danger)">(${ecartsLigne} écart${ecartsLigne > 1 ? "s" : ""})</span>` : `<span style="color:var(--success)">✓</span>`}</h4>
        <p class="muted" style="font-size:.76rem;margin:0 0 6px">Rapprochement par désignation (qté & prix unitaire). « Hors commande » = ligne absente du bon de commande.</p>
        <div style="overflow-x:auto"><table class="lignes-table">
          <thead><tr><th class="col-des">Désignation</th><th>Qté cmd</th><th>Qté fact</th><th>PU cmd</th><th>PU fact</th>${peutLier ? "<th>Lier à</th>" : ""}</tr></thead>
          <tbody>${comparaison.map((x) => `<tr style="${x.c ? (x.ok ? "" : "background:var(--danger-50)") : "background:#FEF3C7"}">
            <td class="col-des">${esc(x.l.designation)}${x.c ? (x.explicite ? ` <span class="muted">(lié)</span>` : "") : ` <span class="muted">(hors commande)</span>`}</td>
            <td>${x.c ? x.qC : "—"}</td>
            <td>${x.qF}${x.c && Math.abs(x.eQ) >= 0.001 ? ` <span style="color:var(--danger)">(${x.eQ > 0 ? "+" : ""}${x.eQ})</span>` : ""}</td>
            <td>${x.c ? fcfa(x.puC, f.devise) : "—"}</td>
            <td>${fcfa(x.puF, f.devise)}${x.c && Math.abs(x.eP) >= 0.01 ? ` <span style="color:var(--danger)">(${x.eP > 0 ? "+" : ""}${fcfa(x.eP, f.devise)})</span>` : ""}</td>
            ${peutLier ? `<td><select class="map-cmd" data-ligne="${esc(x.l.id)}" style="min-width:120px">
              <option value="">— Auto —</option>
              ${cmdLignes.map((cl) => `<option value="${esc(cl.id)}"${x.l.commande_ligne_id === cl.id ? " selected" : ""}>${esc((cl.designation || "ligne").slice(0, 28))}</option>`).join("")}
            </select></td>` : ""}
          </tr>`).join("") || `<tr><td colspan="${peutLier ? 6 : 5}" class="muted">Aucune ligne sur la facture.</td></tr>`}</tbody>
        </table></div>
        ${peutLier ? `<button id="btn-delier" class="btn btn-ghost btn-sm" style="margin-top:8px">Délier la commande</button>` : ""}`
      : (peutLier ? (commandesDispo.length ? `
        <div class="row" style="gap:8px;align-items:flex-end">
          <div class="grow field"><label for="sel-cmd">Rapprocher à une commande</label>
            <select id="sel-cmd"><option value="">— Choisir —</option>
              ${commandesDispo.map((c) => `<option value="${esc(c.id)}">${esc(c.numero || "sans n°")} · ${fcfa(c.total_ht, c.devise)}</option>`).join("")}</select></div>
          <button id="btn-lier" class="btn btn-primary btn-sm">Rapprocher</button>
        </div>`
        : `<p class="muted">Aucune commande pour ce fournisseur. <a href="#/nouvelle-commande">Créer une commande</a>.</p>`)
      : `<p class="muted">Non rattachée à une commande.</p>`)}
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

  // Rapprochement bon de commande.
  const bl = $("#btn-lier");
  if (bl) bl.onclick = async (e) => {
    const cid = $("#sel-cmd").value;
    if (!cid) return toast("Choisissez une commande.", "warn");
    busy(e.currentTarget, true, "…");
    try { await lierFactureCommande(f.id, cid); toast("Facture rapprochée à la commande.", "success"); renderDetail(f.id); }
    catch (err) { busy(e.currentTarget, false); toast(err.message, "error"); }
  };
  const bdl = $("#btn-delier");
  if (bdl) bdl.onclick = async (e) => {
    busy(e.currentTarget, true, "…");
    try { await lierFactureCommande(f.id, null); toast("Commande déliée.", "info"); renderDetail(f.id); }
    catch (err) { busy(e.currentTarget, false); toast(err.message, "error"); }
  };

  // Association manuelle ligne facture ↔ ligne commande.
  $$(".map-cmd").forEach((sel) => sel.addEventListener("change", async () => {
    try { await lierLigneCommande(sel.dataset.ligne, sel.value || null); renderDetail(f.id); }
    catch (err) { toast(err.message, "error"); }
  }));

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
