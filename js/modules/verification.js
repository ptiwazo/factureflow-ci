/* =====================================================================
   Module 6.2 — Vérification / correction (ÉTAPE OBLIGATOIRE §5)
   ---------------------------------------------------------------------
   Formulaire éditable pré-rempli par l'extraction IA. Les champs incertains
   sont surlignés (orange). TVA/totaux recalculés en direct. Détection des
   factures non conformes (NCC absent). Rien n'est enregistré sans action
   explicite de l'utilisateur — aucune validation silencieuse de montants.
===================================================================== */
import { $, $$, setView, toast, busy, fcfa, dateFr, esc, toNumber, calculerTotaux, ecartCoherence, nccValide } from "../ui.js";
import { CONFIG, COMPTE_DEBOURS } from "../config.js";
import { trouverOuCreerFournisseur, creerFactureComplete, journaliser, chercherDoublon, rechercherFournisseur } from "../store.js";
import { getProfil } from "../auth.js";
import { draft, navigate, resetDraft } from "../app.js";
import { analyserCourant } from "./capture.js";
import { PLAN_PAR_SECTION, COMPTES_PAR_NUMERO } from "../comptes-charge-ifrs.js";

// <optgroup> des comptes de charge du plan de référence (IFRS / OHADA),
// regroupés par section. La valeur est le NUMÉRO DE COMPTE.
const OPTIONS_CATEGORIE =
  `<option value="">— Non classé —</option>` +
  PLAN_PAR_SECTION.map((s) =>
    `<optgroup label="${esc(s.prefixe)}xxxx — ${esc(s.label)}">${s.comptes.map((c) =>
      `<option value="${c.compte}">${esc(c.compte)} — ${esc(c.labelFr)}</option>`).join("")}</optgroup>`).join("");

// Détermine si un champ (chemin "facture.numero") est marqué incertain par l'IA.
function estIncertain(d, chemin) {
  return (d.confiance?.champs_incertains || []).includes(chemin);
}

// Génère un <div class="field"> éventuellement surligné.
function champ(label, id, valeur, chemin, d, { type = "text", placeholder = "" } = {}) {
  const inc = estIncertain(d, chemin);
  return `
    <div class="field ${inc ? "uncertain" : ""}">
      <label for="${id}">${label}</label>
      <input id="${id}" type="${type}" value="${valeur != null ? String(valeur).replace(/"/g, "&quot;") : ""}" placeholder="${placeholder}" />
      <div class="uncertain-flag">⚠️ À vérifier — lecture incertaine</div>
    </div>`;
}

export function render() {
  const d = draft.data;
  if (!d) {
    // Accès direct sans extraction : on renvoie vers la capture.
    navigate("#/capture");
    return;
  }

  const conf = Math.round((d.confiance?.global || 0) * 100);

  const lot = draft.total > 1;
  const progLabel = lot ? ` ${draft.index + 1}/${draft.total}` : "";

  setView(`
    <div class="row between">
      <h1 class="page-title">Vérification${progLabel}</h1>
      <a href="#/capture" class="btn btn-ghost btn-sm">${lot ? "Arrêter le lot" : "Annuler"}</a>
    </div>
    ${lot ? `<div class="alert alert-info">📦 Import multiple — facture ${draft.index + 1} sur ${draft.total}.
      <button id="btn-passer" class="btn btn-ghost btn-sm" style="margin-left:auto">Passer celle-ci</button></div>` : ""}

    <div class="card">
      <div class="row between">
        <strong>Confiance globale de l'extraction</strong>
        <span class="${conf < 75 ? "" : ""}">${conf}%</span>
      </div>
      <div class="confidence-bar"><span style="width:${conf}%; background:${conf < 60 ? "var(--danger)" : conf < 80 ? "var(--amber)" : "var(--success)"}"></span></div>
      <p class="muted" style="font-size:.82rem;margin:.6rem 0 0">
        Vérifiez chaque champ. Les zones orange ont été lues avec moins de certitude.
        Aucune extraction n'est fiable à 100 % — votre validation fait foi.
      </p>
    </div>

    <div id="alertes"></div>

    <div class="card">
      <h3>Fournisseur</h3>
      ${champ("Nom", "f-nom", d.fournisseur.nom, "fournisseur.nom", d)}
      ${champ("NCC (Numéro de Compte Contribuable)", "f-ncc", d.fournisseur.ncc, "fournisseur.ncc", d, { placeholder: "Obligatoire pour conformité" })}
      <div class="row" style="gap:12px">
        <div class="grow">${champ("RCCM", "f-rccm", d.fournisseur.rccm, "fournisseur.rccm", d)}</div>
        <div class="grow">${champ("Téléphone", "f-tel", d.fournisseur.telephone, "fournisseur.telephone", d, { type: "tel" })}</div>
      </div>
    </div>

    <div class="card">
      <h3>Facture</h3>
      <div class="row" style="gap:12px">
        <div class="grow">${champ("N° facture", "fc-num", d.facture.numero, "facture.numero", d)}</div>
        <div class="grow">${champ("Date", "fc-date", d.facture.date, "facture.date", d, { type: "date" })}</div>
      </div>
      <div class="row" style="gap:12px">
        <div class="grow">${champ("Échéance", "fc-ech", d.facture.echeance, "facture.echeance", d, { type: "date" })}</div>
        <div class="grow">${champ("Devise", "fc-dev", d.facture.devise || CONFIG.DEVISE_DEFAUT, "facture.devise", d)}</div>
      </div>
    </div>

    <div class="card">
      <div class="row between">
        <h3>Lignes</h3>
        <button id="add-ligne" class="btn btn-secondary btn-sm">+ Ligne</button>
      </div>
      ${d.est_debours ? `<div class="alert alert-info">⚓ <div>Fournisseur de transit / armateur / acconier / terminal détecté — les lignes sont imputées au <strong>compte de débours (${esc(COMPTE_DEBOURS)})</strong>. Ajustez si nécessaire.</div></div>` : ""}
      <div style="overflow-x:auto">
      <table class="lignes-table erp-${getProfil()?.erp || "sap"}">
        <thead><tr><th class="col-des">Désignation</th><th>Qté</th><th>P.U.</th><th>Montant HT</th><th>TVA %</th><th>Compte de charge (IFRS)</th><th class="col-ohada">OHADA</th><th></th></tr></thead>
        <tbody id="lignes-body"></tbody>
      </table>
      </div>
      <p class="muted" style="font-size:.76rem;margin-top:.5rem">
        Le <strong>compte de charge</strong> est proposé par l'IA d'après le plan de référence
        (IFRS / OHADA) en fonction de la ligne. Vérifiez et ajustez si besoin — ⚠️ imputations à
        valider par un expert-comptable.
      </p>
    </div>

    <div class="card">
      <h3>Totaux</h3>
      <div class="field" style="max-width:230px">
        <label for="taux-tva">Taux TVA par défaut (%) <small>nouvelles lignes</small></label>
        <input id="taux-tva" type="number" step="0.01" value="${d.totaux.taux_tva ?? CONFIG.TVA_DEFAUT}" />
      </div>
      <div class="totaux-box">
        <div class="totaux-row"><span>Total HT</span><strong id="t-ht">—</strong></div>
        <div class="totaux-row"><span>TVA <span id="t-taux" class="muted"></span></span><strong id="t-tva">—</strong></div>
        <div class="totaux-row grand"><span>Total TTC</span><strong id="t-ttc">—</strong></div>
      </div>
      <p class="muted" style="font-size:.78rem;margin-top:.6rem">
        TVA calculée <strong>ligne par ligne</strong> (taux mixtes / exonérations possibles).
        ⚠️ Les règles fiscales sont à valider par un expert-comptable / la DGI.
      </p>
    </div>

    <div class="row" style="gap:10px;margin-bottom:24px">
      <button id="btn-non-conforme" class="btn btn-secondary grow">Marquer non conforme</button>
      <button id="btn-valider" class="btn btn-primary grow">Envoyer au contrôle →</button>
    </div>
  `);

  // Lignes initiales
  const tbody = $("#lignes-body");
  (d.lignes.length ? d.lignes : [{ designation: "", quantite: 1, prix_unitaire: 0, montant_ht: 0 }])
    .forEach((l) => tbody.appendChild(ligneRow(l)));

  $("#add-ligne").onclick = () => tbody.appendChild(ligneRow({ designation: "", quantite: 1, prix_unitaire: 0, montant_ht: 0 }));
  $("#taux-tva").addEventListener("input", recalculer);
  $("#f-ncc").addEventListener("input", majAlertes);

  recalculer();
  majAlertes();

  $("#btn-valider").onclick = (e) => enregistrer(e.currentTarget, false);
  $("#btn-non-conforme").onclick = (e) => enregistrer(e.currentTarget, true);

  // Import multiple : passer la facture courante sans l'enregistrer.
  const passer = $("#btn-passer");
  if (passer) passer.onclick = () => {
    draft.data = null; draft.fichier = null; draft.apercu = null;
    draft.index++;
    if (draft.index < draft.queue.length) analyserCourant();
    else { resetDraft(); toast("Lot terminé.", "info"); navigate("#/factures"); }
  };
}

// Crée une ligne éditable ; recalcul auto du montant HT = qté × PU.
function ligneRow(l) {
  // Taux TVA de la ligne : valeur extraite, sinon taux par défaut courant.
  const tauxDefaut = toNumber($("#taux-tva")?.value) || CONFIG.TVA_DEFAUT;
  const tauxLigne = l.taux_tva != null && l.taux_tva !== "" ? toNumber(l.taux_tva) : tauxDefaut;

  const cat = COMPTES_PAR_NUMERO[l.categorie] ? l.categorie : "";
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="col-des"><input class="l-des" type="text" value="${(l.designation || "").replace(/"/g, "&quot;")}" /></td>
    <td><input class="l-qte" type="number" step="0.001" value="${l.quantite || 0}" style="width:60px" /></td>
    <td><input class="l-pu" type="number" step="0.01" value="${l.prix_unitaire || 0}" style="width:86px" /></td>
    <td><input class="l-ht" type="number" step="0.01" value="${l.montant_ht || 0}" style="width:96px" /></td>
    <td><input class="l-tva" type="number" step="0.01" value="${tauxLigne}" style="width:56px" /></td>
    <td><select class="l-cat" style="min-width:150px">${OPTIONS_CATEGORIE}</select></td>
    <td class="col-ohada"><span class="l-compte muted" style="white-space:nowrap"></span></td>
    <td><button class="icon-btn l-del" style="color:var(--danger)" title="Supprimer">✕</button></td>`;

  const qte = tr.querySelector(".l-qte");
  const pu = tr.querySelector(".l-pu");
  const ht = tr.querySelector(".l-ht");
  const tva = tr.querySelector(".l-tva");
  const sel = tr.querySelector(".l-cat");
  const compte = tr.querySelector(".l-compte");
  sel.value = cat;

  // Affiche l'équivalent OHADA du compte de charge sélectionné (cross-réf SYSCOHADA).
  const majCompte = () => {
    const ref = COMPTES_PAR_NUMERO[sel.value];
    compte.textContent = ref ? (ref.ohada || "—") : "non classé";
    compte.style.color = ref ? "var(--muted)" : "var(--danger)";
  };
  majCompte();

  let htEditeManuellement = false;
  const autoHt = () => {
    if (htEditeManuellement) return;
    ht.value = (toNumber(qte.value) * toNumber(pu.value)).toFixed(2);
    recalculer();
  };
  qte.addEventListener("input", autoHt);
  pu.addEventListener("input", autoHt);
  ht.addEventListener("input", () => { htEditeManuellement = true; recalculer(); });
  tva.addEventListener("input", recalculer);
  sel.addEventListener("change", majCompte);
  tr.querySelector(".l-del").addEventListener("click", () => { tr.remove(); recalculer(); });

  return tr;
}

function lireLignes() {
  return $$("#lignes-body tr").map((tr) => ({
    designation: tr.querySelector(".l-des").value.trim(),
    quantite: toNumber(tr.querySelector(".l-qte").value),
    prix_unitaire: toNumber(tr.querySelector(".l-pu").value),
    montant_ht: toNumber(tr.querySelector(".l-ht").value),
    taux_tva: toNumber(tr.querySelector(".l-tva").value),
    categorie: tr.querySelector(".l-cat").value,
  })).filter((l) => l.designation || l.montant_ht);
}

let totauxCourants = { total_ht: 0, montant_tva: 0, total_ttc: 0 };

function recalculer() {
  const tauxDefaut = toNumber($("#taux-tva").value);
  const lignes = lireLignes();
  const t = calculerTotaux(lignes, tauxDefaut);
  totauxCourants = t;
  // Libellé : si toutes les lignes partagent le même taux, on l'affiche ; sinon "taux mixtes".
  const taux = [...new Set(lignes.map((l) => toNumber(l.taux_tva)))];
  $("#t-taux").textContent = taux.length === 1 ? `(${taux[0]}%)` : "(taux mixtes)";
  $("#t-ht").textContent = fcfa(t.total_ht);
  $("#t-tva").textContent = fcfa(t.montant_tva);
  $("#t-ttc").textContent = fcfa(t.total_ttc);
}

// Affiche les alertes de conformité (NCC) en direct.
function majAlertes() {
  const ncc = $("#f-ncc").value.trim();
  const box = $("#alertes");
  const alertes = [];
  if (!ncc) {
    alertes.push(`<div class="alert alert-danger">⛔ <div><strong>NCC fournisseur absent.</strong>
      Facture potentiellement <strong>non conforme</strong> (obligation DGI). À confirmer avec un professionnel.</div></div>`);
  } else if (!nccValide(ncc)) {
    alertes.push(`<div class="alert alert-warn">⚠️ <div>Le format du NCC paraît inhabituel. Vérifiez la saisie.</div></div>`);
  }
  box.innerHTML = alertes.join("");
}

// ÉTAPE 1 — Première validation : contrôle les données, vérifie le doublon
// et l'existence du fournisseur, puis ouvre la 2ᵉ validation (récap + compte SAP).
async function enregistrer(btn, forcerNonConforme) {
  const ncc = $("#f-ncc").value.trim();
  const nom = $("#f-nom").value.trim();
  if (!nom) return toast("Le nom du fournisseur est requis.", "warn");

  const lignes = lireLignes();
  if (!lignes.length) return toast("Ajoutez au moins une ligne.", "warn");

  // Cohérence des totaux : on prévient si l'écart HT+TVA vs TTC est notable.
  const ecart = ecartCoherence({ ...totauxCourants });
  if (ecart > 1 && !forcerNonConforme) {
    const ok = confirm(`Incohérence détectée entre HT + TVA et TTC (écart ${fcfa(ecart)}). Continuer quand même ?`);
    if (!ok) return;
  }

  const numero = $("#fc-num").value.trim();
  const dateFacture = $("#fc-date").value || null;
  // Nouveau circuit : après vérification OCR par la saisie, la facture part au
  // Contrôle de Gestion (statut 'a_controler') au lieu d'être validée directement.
  const statut = (forcerNonConforme || !ncc) ? "non_conforme" : "a_controler";

  busy(btn, true, "Vérification…");
  let doublon = null, existant = null;
  try {
    // Existence du fournisseur d'abord, pour permettre le repli "date + TTC".
    existant = await rechercherFournisseur({ nom, ncc });
    // Doublon : par numéro (niveau organisation), repli date+TTC sur le même fournisseur.
    doublon = await chercherDoublon({
      numero, date: dateFacture, totalTtc: totauxCourants.total_ttc, fournisseurId: existant?.id,
    });
  } catch (e) {
    busy(btn, false);
    return toast(e.message || "Vérification impossible.", "error");
  }
  busy(btn, false);

  if (doublon) {
    const fournExist = doublon.fournisseurs?.nom || "fournisseur inconnu";
    const ok = confirm(
      `⚠️ Doublon probable : le numéro « ${numero || "sans n°"} » existe déjà ` +
      `(${fournExist} · ${fcfa(doublon.total_ttc)}).\n\nContinuer quand même ?`);
    if (!ok) return; // bloqué par défaut
  }

  // ÉTAPE 2 — Seconde validation : récapitulatif + compte SAP si fournisseur nouveau.
  ouvrirSecondeValidation({
    nom, ncc, numero, dateFacture, statut,
    rccm: $("#f-rccm").value.trim(),
    telephone: $("#f-tel").value.trim(),
    echeance: $("#fc-ech").value || null,
    devise: $("#fc-dev").value.trim() || CONFIG.DEVISE_DEFAUT,
    lignes,
    fournisseurExistant: existant,
  });
}

// Modale de seconde validation. Si le fournisseur est nouveau, propose la
// saisie de son compte SAP (CardCode), enregistré sur la fiche fournisseur.
function ouvrirSecondeValidation(ctx) {
  const nouveau = !ctx.fournisseurExistant;
  const compteExistant = ctx.fournisseurExistant?.compte_sap || "";

  const back = document.createElement("div");
  back.className = "modal-backdrop";
  back.id = "valid-modal";
  back.innerHTML = `
    <div class="modal">
      <div class="row between mb">
        <strong>Envoi au Contrôle de Gestion</strong>
        <button class="icon-btn" id="vm-close" style="color:var(--text)">✕</button>
      </div>
      <div class="detail-grid mb">
        <div><div class="dt">Fournisseur</div><div class="dd">${esc(ctx.nom)}</div></div>
        <div><div class="dt">NCC</div><div class="dd">${esc(ctx.ncc || "—")}</div></div>
        <div><div class="dt">N° facture</div><div class="dd">${esc(ctx.numero || "—")}</div></div>
        <div><div class="dt">Date</div><div class="dd">${dateFr(ctx.dateFacture)}</div></div>
        <div><div class="dt">Total TTC</div><div class="dd">${fcfa(totauxCourants.total_ttc, ctx.devise)}</div></div>
        <div><div class="dt">Statut</div><div class="dd">${ctx.statut === "non_conforme" ? "Non conforme" : "À contrôler"}</div></div>
      </div>
      ${nouveau ? `
        <div class="alert alert-info">🆕 <div>Nouveau fournisseur. Renseignez son <strong>compte SAP (CardCode)</strong> pour l'export FI (facultatif, modifiable plus tard).</div></div>
        <div class="field"><label for="vm-sap">Compte SAP fournisseur</label>
          <input id="vm-sap" placeholder="Ex. F0001" /></div>`
      : `<p class="muted" style="font-size:.85rem">Fournisseur existant${compteExistant ? ` — compte SAP : <strong>${esc(compteExistant)}</strong>` : " (sans compte SAP)"}.</p>`}
      <div class="row" style="gap:10px;margin-top:8px">
        <button class="btn btn-ghost grow" id="vm-cancel">Modifier</button>
        <button class="btn btn-primary grow" id="vm-ok">Envoyer au contrôle de gestion</button>
      </div>
    </div>`;
  document.body.appendChild(back);

  const fermer = () => back.remove();
  back.addEventListener("click", (e) => { if (e.target === back) fermer(); });
  $("#vm-close", back).onclick = fermer;
  $("#vm-cancel", back).onclick = fermer;
  $("#vm-ok", back).onclick = async (e) => {
    const compteSap = nouveau ? ($("#vm-sap", back).value.trim()) : compteExistant;
    busy(e.currentTarget, true, "Enregistrement…");
    try {
      await sauvegarder({ ...ctx, compteSap });
      fermer();
    } catch (err) {
      busy(e.currentTarget, false);
      toast(err.message || "Échec de l'enregistrement.", "error", 5000);
    }
  };
}

// Écrit le fournisseur (avec compte SAP) + la facture, puis enchaîne la file.
async function sauvegarder(ctx) {
  const fournisseur = await trouverOuCreerFournisseur({
    nom: ctx.nom, ncc: ctx.ncc, rccm: ctx.rccm, telephone: ctx.telephone, compteSap: ctx.compteSap,
  });

  const facture = await creerFactureComplete({
    entete: {
      fournisseur_id: fournisseur.id,
      numero: ctx.numero,
      date: ctx.dateFacture,
      echeance: ctx.echeance,
      devise: ctx.devise,
      taux_tva: toNumber($("#taux-tva")?.value) || CONFIG.TVA_DEFAUT,
      total_ht: totauxCourants.total_ht,
      montant_tva: totauxCourants.montant_tva,
      total_ttc: totauxCourants.total_ttc,
      statut: ctx.statut,
    },
    lignes: ctx.lignes,
    fichier: draft.fichier,
    extractionBrute: draft.data,
  });

  await journaliser(ctx.statut === "non_conforme" ? "facture_non_conforme" : "envoi_controle", `facture:${facture.id}`);
  toast(ctx.statut === "non_conforme" ? "Enregistrée (non conforme)." : "Envoyée au contrôle de gestion ✔", "success");

  // Données de la facture courante traitées : on les nettoie.
  draft.data = null; draft.fichier = null; draft.apercu = null;

  // Import multiple : enchaîner sur la facture suivante.
  draft.index++;
  if (draft.index < draft.queue.length) {
    await analyserCourant();
    return;
  }
  resetDraft();
  navigate(`#/facture/${facture.id}`);
}
