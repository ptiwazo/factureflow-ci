/* =====================================================================
   Module — Aide à la déclaration TVA (DGI)
   ---------------------------------------------------------------------
   Rapport mensuel de TVA DÉDUCTIBLE sur les factures fournisseurs validées.
   - Base = factures 'validee' / 'exportee' de la période (par date de facture).
   - Condition de déductibilité : NCC fournisseur présent (facture conforme).
   - Contrôles de complétude : factures sans NCC (exclues) et factures encore
     en attente de validation (non comptabilisées) sur la période.
   ⚠️ Outil d'aide : les montants et la déductibilité restent à valider par un
   expert-comptable / la DGI. L'app n'invente aucune règle fiscale.
===================================================================== */
import { $, setView, toast, fcfa, dateFr, esc, emptyState, busy } from "../ui.js";
import { listerFactures, journaliser } from "../store.js";
import { telechargerXlsx } from "../xlsx.js";

const moisCourant = () => new Date().toISOString().slice(0, 7); // 'AAAA-MM'
const num2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

let toutes = []; // cache des factures pour recalcul au changement de mois

export async function render() {
  setView(`<div class="loading-block"><span class="spinner dark"></span><p>Chargement…</p></div>`);
  try { toutes = await listerFactures(); }
  catch (e) { setView(emptyState("⚠️", "Erreur", e.message)); return; }

  setView(`
    <h1 class="page-title">Déclaration TVA</h1>
    <p class="muted" style="margin-top:-10px;font-size:.85rem">
      TVA <strong>déductible</strong> sur les factures fournisseurs <strong>validées</strong> du mois.
      ⚠️ Montants et déductibilité à valider par un expert-comptable / la DGI.
    </p>

    <div class="card">
      <div class="row" style="gap:12px;align-items:flex-end">
        <div class="grow field"><label for="tva-mois">Période (mois)</label>
          <input id="tva-mois" type="month" value="${moisCourant()}" /></div>
        <button id="tva-export" class="btn btn-secondary">⬇ Excel</button>
      </div>
    </div>

    <div id="tva-contenu"></div>
  `);

  $("#tva-mois").addEventListener("change", dessiner);
  $("#tva-export").onclick = (e) => exporter(e.currentTarget);
  dessiner();
}

// Calcule les ensembles pour le mois sélectionné.
function calculer() {
  const mois = $("#tva-mois").value || moisCourant();
  const duMois = (f) => (f.date || "").slice(0, 7) === mois;
  const aNcc = (f) => !!(f.fournisseurs?.ncc || "").trim();

  const validees = toutes.filter((f) => ["validee", "exportee"].includes(f.statut) && duMois(f));
  const deductibles = validees.filter(aNcc);
  const sansNcc = validees.filter((f) => !aNcc(f));
  const enAttente = toutes.filter((f) => duMois(f) && ["a_controler", "a_valider"].includes(f.statut));

  const somme = (arr, champ) => num2(arr.reduce((s, f) => s + (Number(f[champ]) || 0), 0));
  const totaux = {
    nb: deductibles.length,
    ht: somme(deductibles, "total_ht"),
    tva: somme(deductibles, "montant_tva"),
    ttc: somme(deductibles, "total_ttc"),
  };

  // Ventilation par taux de TVA (en-tête de facture) — indicative.
  const parTaux = new Map();
  for (const f of deductibles) {
    const t = Number(f.taux_tva) || 0;
    const g = parTaux.get(t) || { base: 0, tva: 0 };
    g.base += Number(f.total_ht) || 0;
    g.tva += Number(f.montant_tva) || 0;
    parTaux.set(t, g);
  }
  const taux = [...parTaux.entries()].sort((a, b) => b[0] - a[0])
    .map(([t, g]) => ({ taux: t, base: num2(g.base), tva: num2(g.tva) }));

  return { mois, deductibles, sansNcc, enAttente, totaux, taux };
}

function dessiner() {
  const r = calculer();
  const cible = $("#tva-contenu");

  const lignesDetail = r.deductibles
    .slice()
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map((f) => `<tr>
      <td>${dateFr(f.date)}</td>
      <td>${esc(f.numero || "—")}</td>
      <td>${esc(f.fournisseurs?.nom || "—")}</td>
      <td>${esc(f.fournisseurs?.ncc || "—")}</td>
      <td>${fcfa(f.total_ht, f.devise)}</td>
      <td>${fcfa(f.montant_tva, f.devise)}</td></tr>`).join("");

  cible.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Factures déductibles</div><div class="kpi-value">${r.totaux.nb}</div></div>
      <div class="kpi accent-teal"><div class="kpi-label">Base HT</div><div class="kpi-value" style="font-size:1.1rem">${fcfa(r.totaux.ht)}</div></div>
      <div class="kpi accent-teal"><div class="kpi-label">TVA déductible</div><div class="kpi-value" style="font-size:1.1rem">${fcfa(r.totaux.tva)}</div></div>
      <div class="kpi"><div class="kpi-label">TTC</div><div class="kpi-value" style="font-size:1.1rem">${fcfa(r.totaux.ttc)}</div></div>
    </div>

    ${r.taux.length ? `<div class="card">
      <h3>Ventilation par taux</h3>
      <table class="lignes-table">
        <thead><tr><th class="col-des">Taux</th><th>Base HT</th><th>TVA</th></tr></thead>
        <tbody>${r.taux.map((g) => `<tr><td class="col-des">${g.taux}%</td><td>${fcfa(g.base)}</td><td>${fcfa(g.tva)}</td></tr>`).join("")}</tbody>
      </table>
    </div>` : ""}

    ${r.sansNcc.length ? `<div class="alert alert-warn">⚠️ <div><strong>${r.sansNcc.length} facture(s) validée(s) sans NCC fournisseur</strong> sur la période : exclues du déductible (TVA potentiellement non déductible). À régulariser.</div></div>` : ""}
    ${r.enAttente.length ? `<div class="alert alert-info">⏳ <div><strong>${r.enAttente.length} facture(s) du mois non encore validée(s)</strong> (à contrôler / à valider) : non comptabilisées ici tant qu'elles ne sont pas validées.</div></div>` : ""}

    <h2 class="section-title">Détail des factures déductibles</h2>
    ${r.deductibles.length ? `<div class="card" style="overflow-x:auto">
      <table class="lignes-table">
        <thead><tr><th class="col-des">Date</th><th>N°</th><th>Fournisseur</th><th>NCC</th><th>Base HT</th><th>TVA</th></tr></thead>
        <tbody>${lignesDetail}</tbody>
      </table>
    </div>` : emptyState("🧾", "Aucune facture déductible", "Pas de facture validée avec NCC sur ce mois.")}
    <div style="height:24px"></div>
  `;
}

async function exporter(btn) {
  const r = calculer();
  if (!r.deductibles.length) return toast("Aucune facture déductible à exporter sur ce mois.", "warn");
  busy(btn, true, "Export…");
  try {
    const entete = ["Date", "N° facture", "Fournisseur", "NCC", "Base HT", "Taux TVA", "TVA déductible", "TTC"];
    const lignes = r.deductibles
      .slice()
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .map((f) => [
        dateFr(f.date), f.numero || "", f.fournisseurs?.nom || "", f.fournisseurs?.ncc || "",
        num2(f.total_ht), Number(f.taux_tva) || 0, num2(f.montant_tva), num2(f.total_ttc),
      ]);
    const total = ["", "", "", "TOTAL", r.totaux.ht, "", r.totaux.tva, r.totaux.ttc];
    telechargerXlsx(`declaration_tva_${r.mois}.xlsx`, `TVA ${r.mois}`, [entete, ...lignes, total]);
    await journaliser("export_tva", `${r.mois} · ${r.deductibles.length} factures`);
    toast("Rapport TVA exporté.", "success");
  } catch (e) {
    toast(e.message || "Échec de l'export.", "error");
  } finally {
    busy(btn, false);
  }
}
