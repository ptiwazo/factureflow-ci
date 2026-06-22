/* =====================================================================
   Module 6.2 — Vérification / correction (ÉTAPE OBLIGATOIRE §5)
   ---------------------------------------------------------------------
   Formulaire éditable pré-rempli par l'extraction IA. Les champs incertains
   sont surlignés (orange). TVA/totaux recalculés en direct. Détection des
   factures non conformes (NCC absent). Rien n'est enregistré sans action
   explicite de l'utilisateur — aucune validation silencieuse de montants.
===================================================================== */
import { $, $$, setView, toast, busy, fcfa, toNumber, calculerTotaux, ecartCoherence, nccValide } from "../ui.js";
import { CONFIG } from "../config.js";
import { trouverOuCreerFournisseur, creerFactureComplete, journaliser } from "../store.js";
import { draft, navigate, resetDraft } from "../app.js";
import { analyserCourant } from "./capture.js";

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
      <table class="lignes-table">
        <thead><tr><th class="col-des">Désignation</th><th>Qté</th><th>P.U.</th><th>Montant HT</th><th></th></tr></thead>
        <tbody id="lignes-body"></tbody>
      </table>
    </div>

    <div class="card">
      <h3>Totaux</h3>
      <div class="field" style="max-width:160px">
        <label for="taux-tva">Taux de TVA (%)</label>
        <input id="taux-tva" type="number" step="0.01" value="${d.totaux.taux_tva ?? CONFIG.TVA_DEFAUT}" />
      </div>
      <div class="totaux-box">
        <div class="totaux-row"><span>Total HT</span><strong id="t-ht">—</strong></div>
        <div class="totaux-row"><span>TVA (<span id="t-taux">18</span>%)</span><strong id="t-tva">—</strong></div>
        <div class="totaux-row grand"><span>Total TTC</span><strong id="t-ttc">—</strong></div>
      </div>
      <p class="muted" style="font-size:.78rem;margin-top:.6rem">
        Totaux recalculés automatiquement à partir des lignes. ⚠️ Les règles fiscales
        (taux, exonérations) sont à valider par un expert-comptable / la DGI.
      </p>
    </div>

    <div class="row" style="gap:10px;margin-bottom:24px">
      <button id="btn-non-conforme" class="btn btn-secondary grow">Marquer non conforme</button>
      <button id="btn-valider" class="btn btn-primary grow">Valider & enregistrer</button>
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
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="col-des"><input class="l-des" type="text" value="${(l.designation || "").replace(/"/g, "&quot;")}" /></td>
    <td><input class="l-qte" type="number" step="0.001" value="${l.quantite || 0}" style="width:64px" /></td>
    <td><input class="l-pu" type="number" step="0.01" value="${l.prix_unitaire || 0}" style="width:90px" /></td>
    <td><input class="l-ht" type="number" step="0.01" value="${l.montant_ht || 0}" style="width:100px" /></td>
    <td><button class="icon-btn l-del" style="color:var(--danger)" title="Supprimer">✕</button></td>`;

  const qte = tr.querySelector(".l-qte");
  const pu = tr.querySelector(".l-pu");
  const ht = tr.querySelector(".l-ht");
  let htEditeManuellement = false;

  const autoHt = () => {
    if (htEditeManuellement) return;
    ht.value = (toNumber(qte.value) * toNumber(pu.value)).toFixed(2);
    recalculer();
  };
  qte.addEventListener("input", autoHt);
  pu.addEventListener("input", autoHt);
  ht.addEventListener("input", () => { htEditeManuellement = true; recalculer(); });
  tr.querySelector(".l-del").addEventListener("click", () => { tr.remove(); recalculer(); });

  return tr;
}

function lireLignes() {
  return $$("#lignes-body tr").map((tr) => ({
    designation: tr.querySelector(".l-des").value.trim(),
    quantite: toNumber(tr.querySelector(".l-qte").value),
    prix_unitaire: toNumber(tr.querySelector(".l-pu").value),
    montant_ht: toNumber(tr.querySelector(".l-ht").value),
  })).filter((l) => l.designation || l.montant_ht);
}

let totauxCourants = { total_ht: 0, montant_tva: 0, total_ttc: 0 };

function recalculer() {
  const taux = toNumber($("#taux-tva").value);
  const t = calculerTotaux(lireLignes(), taux);
  totauxCourants = t;
  $("#t-taux").textContent = taux;
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

async function enregistrer(btn, forcerNonConforme) {
  const ncc = $("#f-ncc").value.trim();
  const nom = $("#f-nom").value.trim();
  if (!nom) return toast("Le nom du fournisseur est requis.", "warn");

  const lignes = lireLignes();
  if (!lignes.length) return toast("Ajoutez au moins une ligne.", "warn");

  // Cohérence des totaux : on prévient si l'écart HT+TVA vs TTC est notable.
  const ecart = ecartCoherence({ ...totauxCourants });
  if (ecart > 1 && !forcerNonConforme) {
    const ok = confirm(`Incohérence détectée entre HT + TVA et TTC (écart ${fcfa(ecart)}). Enregistrer quand même ?`);
    if (!ok) return;
  }

  // Statut : non conforme si demandé OU si NCC absent.
  const statut = (forcerNonConforme || !ncc) ? "non_conforme" : "validee";

  busy(btn, true, "Enregistrement…");
  try {
    // 1) Fournisseur (déduplication par NCC dans le store).
    const fournisseur = await trouverOuCreerFournisseur({
      nom, ncc,
      rccm: $("#f-rccm").value.trim(),
      telephone: $("#f-tel").value.trim(),
    });

    // 2) Facture + lignes + original.
    const facture = await creerFactureComplete({
      entete: {
        fournisseur_id: fournisseur.id,
        numero: $("#fc-num").value.trim(),
        date: $("#fc-date").value || null,
        echeance: $("#fc-ech").value || null,
        devise: $("#fc-dev").value.trim() || CONFIG.DEVISE_DEFAUT,
        taux_tva: toNumber($("#taux-tva").value),
        total_ht: totauxCourants.total_ht,
        montant_tva: totauxCourants.montant_tva,
        total_ttc: totauxCourants.total_ttc,
        statut,
      },
      lignes,
      fichier: draft.fichier,
      extractionBrute: draft.data, // sortie IA brute conservée (audit/traçabilité)
    });

    await journaliser(statut === "non_conforme" ? "facture_non_conforme" : "validation", `facture:${facture.id}`);
    toast(statut === "non_conforme" ? "Enregistrée (non conforme)." : "Facture validée ✔", "success");

    // Données de la facture courante traitées : on les nettoie.
    draft.data = null; draft.fichier = null; draft.apercu = null;

    // Import multiple : enchaîner sur la facture suivante de la file.
    draft.index++;
    if (draft.index < draft.queue.length) {
      await analyserCourant();   // analyse la suivante → revient en vérification
      return;
    }

    // Fin du lot (ou facture unique).
    resetDraft();
    navigate(`#/facture/${facture.id}`);
  } catch (e) {
    busy(btn, false);
    toast(e.message || "Échec de l'enregistrement.", "error", 5000);
  }
}
